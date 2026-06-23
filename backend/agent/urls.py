from django.urls import path
from .views import (
    health, chat,
    get_rules, create_rule, update_rule, delete_rule, toggle_rule,
    get_mcp_servers, get_tools, refresh_tools,
    get_approvals, approve_tool, reject_tool,
    get_logs, get_analytics
)

urlpatterns = [
    # Health
    path("health/", health),
    
    # Chat/Agent
    path("chat/", chat),
    
    # Guardrails/Rules
    path("rules/", get_rules),
    path("rules/create/", create_rule),
    path("rules/<str:rule_id>/", update_rule),
    path("rules/<str:rule_id>/delete/", delete_rule),
    path("rules/<str:rule_id>/toggle/", toggle_rule),
    
    # MCP Servers
    path("mcp/servers/", get_mcp_servers),
    path("mcp/tools/", get_tools),
    path("mcp/refresh/", refresh_tools),
    
    # Approvals
    path("approvals/", get_approvals),
    path("approvals/<str:approval_id>/approve/", approve_tool),
    path("approvals/<str:approval_id>/reject/", reject_tool),
    
    # Logs & Analytics
    path("logs/", get_logs),
    path("analytics/", get_analytics),
]