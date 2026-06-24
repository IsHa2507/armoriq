import os
import logging

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

# Import the canonical singletons from the new policy package
from policy.engine import policy_engine
from policy.rules import rule_store
from .mcp_client import mcp_client
from .llm_agent import get_agent
from .models import Conversation, Message, ToolCall, ApprovalRequest

logger = logging.getLogger("agent.views")


# ── MCP server initialisation ─────────────────────────────────────────────────

def _server_path(filename: str) -> str:
    """Resolve a filename relative to the project-level mcp_server/ directory."""
    return os.path.join(os.path.dirname(__file__), "../../mcp_server", filename)


def init_mcp_servers() -> None:
    """
    Register all MCP servers with the global mcp_client singleton.

    Server 1 — notes-server   (custom, in-process notes CRUD)
    Server 2 — filesystem-server  (sandboxed filesystem operations)

    Both use the STDIO transport and the JSON-RPC 2.0 protocol that the
    MCPClient already handles.  PolicyEngine governs every tool call from
    both servers identically — no special-casing needed.
    """
    logger.info("[MCP] Initialising MCP servers…")

    # ── Server 1: Notes MCP ───────────────────────────────────────────────
    notes_path = _server_path("notes_server.py")
    logger.info("[MCP] Registering notes-server | path=%s", notes_path)
    mcp_client.add_server("notes-server", "python3", [notes_path])

    # ── Server 2: Filesystem MCP ──────────────────────────────────────────
    fs_path = _server_path("filesystem_server.py")
    logger.info("[MCP] Registering filesystem-server | path=%s", fs_path)
    mcp_client.add_server("filesystem-server", "python3", [fs_path])

    status = mcp_client.get_server_status()
    for name, info in status.items():
        logger.info(
            "[MCP] Server status | name=%-22s status=%-12s tools=%d",
            name, info["status"], info["tool_count"],
        )


try:
    init_mcp_servers()
except Exception as exc:
    logger.warning("Failed to initialise MCP servers: %s", exc)


# ── health ────────────────────────────────────────────────────────────────────

@api_view(["GET"])
def health(request):
    return Response({"status": "ok", "message": "ArmorIQ Backend Running"})


# ── guardrail / rule endpoints ────────────────────────────────────────────────

@api_view(["GET"])
def get_rules(request):
    """Return all guardrail rules (fresh from disk on every call)."""
    return Response(rule_store.get_rules())


@api_view(["POST"])
def create_rule(request):
    rule = rule_store.create_rule(request.data)
    return Response(rule, status=status.HTTP_201_CREATED)


@api_view(["PUT"])
def update_rule(request, rule_id):
    rule = rule_store.update_rule(rule_id, request.data)
    if not rule:
        return Response({"error": "Rule not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(rule)


@api_view(["DELETE"])
def delete_rule(request, rule_id):
    if not rule_store.delete_rule(rule_id):
        return Response({"error": "Rule not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response({"success": True})


@api_view(["POST"])
def toggle_rule(request, rule_id):
    rule = rule_store.toggle_rule(rule_id)
    if not rule:
        return Response({"error": "Rule not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(rule)


# ── MCP server / tool endpoints ───────────────────────────────────────────────

@api_view(["GET"])
def get_mcp_servers(request):
    return Response(mcp_client.get_server_status())


@api_view(["GET"])
def get_tools(request):
    return Response(mcp_client.get_all_tools())


@api_view(["POST"])
def refresh_tools(request):
    mcp_client.refresh_tools()
    tools = mcp_client.get_all_tools()
    return Response({"tools": tools, "count": len(tools)})


# ── agent / chat endpoint ─────────────────────────────────────────────────────

@api_view(["POST"])
def chat(request):
    """
    POST body: {"message": str, "session_id": str (optional)}

    Response shapes:
        completed       — normal execution finished
        blocked         — policy blocked the tool
        pending_approval— tool is awaiting human approval
    """
    message = request.data.get("message")
    session_id = request.data.get("session_id", "default")

    if not message:
        return Response({"error": "Message required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        result = get_agent().chat(message, session_id=session_id)
        return Response(result)
    except Exception as exc:
        logger.exception("Unhandled error in chat endpoint")
        return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── approval endpoints ────────────────────────────────────────────────────────

@api_view(["GET"])
def get_approvals(request):
    """Return all pending ApprovalRequests from the database."""
    return Response(policy_engine.get_pending_approvals())


@api_view(["POST"])
def approve_tool(request, approval_id):
    """
    Approve a pending tool call and execute it immediately.
    The tool is executed through mcp_client inside PolicyEngine — it cannot
    reach mcp_client without first having been recorded as an ApprovalRequest.
    """
    result = policy_engine.approve_and_execute(approval_id)
    if not result["success"]:
        http_status = (
            status.HTTP_404_NOT_FOUND
            if "not found" in result.get("error", "").lower()
            else status.HTTP_400_BAD_REQUEST
        )
        return Response({"error": result["error"]}, status=http_status)
    return Response({
        "success": True,
        "approval_id": approval_id,
        "tool_name": result.get("tool_name"),
        "result": result.get("result"),
    })


@api_view(["POST"])
def reject_tool(request, approval_id):
    reason = request.data.get("reason", "")
    if not policy_engine.reject_tool(approval_id, reason):
        return Response({"error": "Approval not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response({"success": True, "approval_id": approval_id})


# ── logs / analytics endpoints ────────────────────────────────────────────────

@api_view(["GET"])
def get_logs(request):
    session_id = request.query_params.get("session_id")
    limit = int(request.query_params.get("limit", 100))

    qs = ToolCall.objects.all()
    if session_id:
        qs = qs.filter(session_id=session_id)

    return Response([
        {
            "id": log.id,
            "session_id": log.session_id,
            "tool_name": log.tool_name,
            "arguments": log.arguments,
            "result": log.result,
            "status": log.status,
            "policy_decision": log.policy_decision,
            "timestamp": log.timestamp.isoformat(),
        }
        for log in qs[:limit]
    ])


@api_view(["GET"])
def get_analytics(request):
    from django.db.models import Count
    from datetime import timedelta

    last_24h = timezone.now() - timedelta(hours=24)

    tool_usage = (
        ToolCall.objects.filter(timestamp__gte=last_24h)
        .values("tool_name")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    status_counts = (
        ToolCall.objects.filter(timestamp__gte=last_24h)
        .values("status")
        .annotate(count=Count("id"))
    )

    return Response({
        "tool_usage": list(tool_usage),
        "status_counts": list(status_counts),
        "total_calls": ToolCall.objects.filter(timestamp__gte=last_24h).count(),
        "budget_usage": {
            session: policy_engine.get_budget_usage(session)
            for session in set(
                ToolCall.objects.filter(timestamp__gte=last_24h)
                .values_list("session_id", flat=True)
                .distinct()
            )
        },
    })


@api_view(["GET"])
def get_dashboard(request):
    """
    Single endpoint that powers the entire Dashboard page.

    Returns all KPI values, the 24-hour tool-usage time series,
    top tools by call count, recent security events (ToolCall rows),
    and Threat Shield totals — all sourced from the live database.
    """
    from django.db.models import Count
    from datetime import timedelta, datetime

    now = timezone.now()
    last_24h = now - timedelta(hours=24)

    # ── KPI: Tool calls today ─────────────────────────────────────────────
    total_calls_today = ToolCall.objects.filter(timestamp__gte=last_24h).count()
    total_calls_prev  = ToolCall.objects.filter(
        timestamp__gte=last_24h - timedelta(hours=24),
        timestamp__lt=last_24h,
    ).count()

    # ── KPI: Blocked actions (last 24h) ───────────────────────────────────
    blocked_today = ToolCall.objects.filter(
        timestamp__gte=last_24h, status="blocked"
    ).count()
    blocked_prev  = ToolCall.objects.filter(
        timestamp__gte=last_24h - timedelta(hours=24),
        timestamp__lt=last_24h,
        status="blocked",
    ).count()

    # ── KPI: Pending approvals ────────────────────────────────────────────
    pending_approvals = ApprovalRequest.objects.filter(status="pending").count()

    # ── KPI: MCP servers connected ────────────────────────────────────────
    server_status = mcp_client.get_server_status()
    mcp_connected = sum(1 for s in server_status.values() if s.get("status") == "connected")
    mcp_total     = len(server_status)

    # ── KPI: Uptime (server start → now) ─────────────────────────────────
    # Approximate: ratio of healthy requests vs total, or report process uptime.
    # We derive from ToolCall success rate as a proxy; fallback to 100% when empty.
    total_all = ToolCall.objects.count()
    error_count = ToolCall.objects.filter(status="error").count()
    uptime_pct = round(((total_all - error_count) / total_all * 100), 2) if total_all else 100.0

    # ── KPI: Active sessions (distinct session_ids in last 24h) ──────────
    active_sessions = (
        ToolCall.objects.filter(timestamp__gte=last_24h)
        .values("session_id")
        .distinct()
        .count()
    )

    # delta helpers (formatted as "+N" / "-N" / "0")
    def _delta(current: int, previous: int) -> str:
        diff = current - previous
        return f"+{diff}" if diff > 0 else str(diff)

    def _pct_delta(current: int, previous: int) -> str:
        if previous == 0:
            return "+0%"
        pct = round((current - previous) / previous * 100)
        return f"+{pct}%" if pct >= 0 else f"{pct}%"

    # ── Tool usage time series (last 24h, hourly buckets) ─────────────────
    series = []
    for h in range(24):
        bucket_start = last_24h + timedelta(hours=h)
        bucket_end   = bucket_start + timedelta(hours=1)
        calls   = ToolCall.objects.filter(
            timestamp__gte=bucket_start, timestamp__lt=bucket_end
        ).count()
        blocked = ToolCall.objects.filter(
            timestamp__gte=bucket_start, timestamp__lt=bucket_end, status="blocked"
        ).count()
        series.append({
            "hour":    bucket_start.strftime("%H:%M"),
            "calls":   calls,
            "blocked": blocked,
        })

    # ── Top tools (all time) ──────────────────────────────────────────────
    top_tools_qs = (
        ToolCall.objects.values("tool_name")
        .annotate(calls=Count("id"))
        .order_by("-calls")[:10]
    )
    top_tools = [{"name": row["tool_name"], "calls": row["calls"]} for row in top_tools_qs]

    # ── Security events (last 20 ToolCall rows, newest first) ─────────────
    recent_calls = ToolCall.objects.order_by("-timestamp")[:20]
    security_events = []
    for tc in recent_calls:
        decision   = tc.policy_decision or {}
        rule_name  = decision.get("rule_name") or "N/A"
        action_str = decision.get("action", "allow")
        if tc.status == "blocked":
            severity = "warning"
            message  = (
                f"Tool '{tc.tool_name}' blocked by rule '{rule_name}' "
                f"in session {tc.session_id}."
            )
        elif tc.status == "pending":
            severity = "info"
            message  = (
                f"Tool '{tc.tool_name}' pending approval "
                f"in session {tc.session_id}."
            )
        elif tc.status == "error":
            severity = "critical"
            message  = (
                f"Tool '{tc.tool_name}' execution error "
                f"in session {tc.session_id}."
            )
        else:
            severity = "info"
            message  = (
                f"Tool '{tc.tool_name}' executed successfully "
                f"in session {tc.session_id}."
            )
        security_events.append({
            "time":     tc.timestamp.strftime("%H:%M:%S"),
            "severity": severity,
            "agent":    tc.session_id,
            "tool":     tc.tool_name,
            "message":  message,
            "status":   tc.status,
        })

    # ── Threat Shield totals ──────────────────────────────────────────────
    allowed_total = ToolCall.objects.filter(status="executed").count()
    blocked_total = ToolCall.objects.filter(status="blocked").count()
    pending_total = ApprovalRequest.objects.filter(status="pending").count()
    # Security score: penalise errors and blocks; floor at 0, ceil at 100
    if total_all > 0:
        score = max(0, min(100, round(100 - (error_count + blocked_total * 0.1) / total_all * 100)))
    else:
        score = 100

    return Response({
        "kpis": {
            "active_sessions":  active_sessions,
            "mcp_servers":      f"{mcp_connected}/{mcp_total}",
            "tool_calls_today": total_calls_today,
            "blocked_today":    blocked_today,
            "pending_approvals": pending_approvals,
            "uptime_pct":       uptime_pct,
        },
        "kpi_deltas": {
            "tool_calls_today": _pct_delta(total_calls_today, total_calls_prev),
            "blocked_today":    _delta(blocked_today, blocked_prev),
        },
        "tool_usage_series": series,
        "top_tools":         top_tools,
        "security_events":   security_events,
        "threat_shield": {
            "score":   score,
            "allowed": allowed_total,
            "blocked": blocked_total,
            "pending": pending_total,
        },
    })
