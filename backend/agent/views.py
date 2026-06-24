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

def init_mcp_servers():
    notes_server_path = os.path.join(
        os.path.dirname(__file__), "../../mcp_server/notes_server.py"
    )
    mcp_client.add_server("notes-server", "python3", [notes_server_path])


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
            # expose per-session budget for the dashboard
            session: policy_engine.get_budget_usage(session)
            for session in set(
                ToolCall.objects.filter(timestamp__gte=last_24h)
                .values_list("session_id", flat=True)
                .distinct()
            )
        },
    })
