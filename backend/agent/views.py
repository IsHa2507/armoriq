import os
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone

from .policy.policy_engine import policy_engine
from .policy.rule_manager import rule_manager
from .mcp_client import mcp_client
from .llm_agent import get_agent
from .models import Conversation, Message, ToolCall, ApprovalRequest


# Initialize MCP servers
def init_mcp_servers():
    """Initialize MCP server connections"""
    # Add custom notes server
    notes_server_path = os.path.join(os.path.dirname(__file__), "../../mcp_server/notes_server.py")
    mcp_client.add_server("notes-server", "python3", [notes_server_path])
    
    # Add more MCP servers here (e.g., weather, database, etc.)


# Initialize on module load
try:
    init_mcp_servers()
except Exception as e:
    print(f"Failed to initialize MCP servers: {e}")


@api_view(["GET"])
def health(request):
    return Response({
        "status": "ok",
        "message": "ArmorIQ Backend Running"
    })


# ========== GUARDRAILS/RULES ENDPOINTS ==========

@api_view(["GET"])
def get_rules(request):
    """Get all guardrail rules"""
    return Response(rule_manager.get_rules())


@api_view(["POST"])
def create_rule(request):
    """Create a new guardrail rule"""
    rule = rule_manager.create_rule(request.data)
    return Response(rule, status=status.HTTP_201_CREATED)


@api_view(["PUT"])
def update_rule(request, rule_id):
    """Update a guardrail rule"""
    rule = rule_manager.update_rule(rule_id, request.data)
    if not rule:
        return Response({"error": "Rule not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(rule)


@api_view(["DELETE"])
def delete_rule(request, rule_id):
    """Delete a guardrail rule"""
    success = rule_manager.delete_rule(rule_id)
    if not success:
        return Response({"error": "Rule not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response({"success": True})


@api_view(["POST"])
def toggle_rule(request, rule_id):
    """Toggle a rule enabled/disabled"""
    rule = rule_manager.toggle_rule(rule_id)
    if not rule:
        return Response({"error": "Rule not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(rule)


# ========== MCP SERVER ENDPOINTS ==========

@api_view(["GET"])
def get_mcp_servers(request):
    """Get all connected MCP servers"""
    servers = mcp_client.get_server_status()
    return Response(servers)


@api_view(["GET"])
def get_tools(request):
    """Get all available tools from MCP servers"""
    tools = mcp_client.get_all_tools()
    return Response(tools)


@api_view(["POST"])
def refresh_tools(request):
    """Refresh tool discovery from all servers"""
    mcp_client.refresh_tools()
    tools = mcp_client.get_all_tools()
    return Response({"tools": tools, "count": len(tools)})


# ========== AGENT/CHAT ENDPOINTS ==========

@api_view(["POST"])
def chat(request):
    """
    Send a message to the agent
    Body: {"message": str, "session_id": str (optional)}
    """
    message = request.data.get("message")
    session_id = request.data.get("session_id", "default")
    
    if not message:
        return Response({"error": "Message required"}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        agent = get_agent()
        result = agent.chat(message, session_id=session_id)
        return Response(result)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ========== APPROVAL ENDPOINTS ==========

@api_view(["GET"])
def get_approvals(request):
    """Get all pending approvals"""
    approvals = policy_engine.get_pending_approvals()
    return Response(approvals)


@api_view(["POST"])
def approve_tool(request, approval_id):
    """Approve a pending tool call"""
    success = policy_engine.approve_tool(approval_id)
    if not success:
        return Response({"error": "Approval not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response({"success": True, "approval_id": approval_id})


@api_view(["POST"])
def reject_tool(request, approval_id):
    """Reject a pending tool call"""
    reason = request.data.get("reason", "")
    success = policy_engine.reject_tool(approval_id, reason)
    if not success:
        return Response({"error": "Approval not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response({"success": True, "approval_id": approval_id})


# ========== LOGS/ANALYTICS ENDPOINTS ==========

@api_view(["GET"])
def get_logs(request):
    """Get activity logs"""
    session_id = request.query_params.get("session_id")
    limit = int(request.query_params.get("limit", 100))
    
    query = ToolCall.objects.all()
    if session_id:
        query = query.filter(session_id=session_id)
    
    logs = query[:limit]
    
    return Response([{
        "id": log.id,
        "session_id": log.session_id,
        "tool_name": log.tool_name,
        "arguments": log.arguments,
        "result": log.result,
        "status": log.status,
        "policy_decision": log.policy_decision,
        "timestamp": log.timestamp.isoformat()
    } for log in logs])


@api_view(["GET"])
def get_analytics(request):
    """Get analytics data"""
    from django.db.models import Count
    from datetime import timedelta
    
    now = timezone.now()
    last_24h = now - timedelta(hours=24)
    
    # Tool usage counts
    tool_usage = ToolCall.objects.filter(timestamp__gte=last_24h).values('tool_name').annotate(count=Count('id'))
    
    # Status counts
    status_counts = ToolCall.objects.filter(timestamp__gte=last_24h).values('status').annotate(count=Count('id'))
    
    return Response({
        "tool_usage": list(tool_usage),
        "status_counts": list(status_counts),
        "total_calls": ToolCall.objects.filter(timestamp__gte=last_24h).count()
    })