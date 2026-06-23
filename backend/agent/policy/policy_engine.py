"""
Enhanced Policy Engine - Evaluates guardrail rules against tool calls
"""
import re
import uuid
from datetime import datetime
from typing import Dict, Any, List
from .rule_manager import rule_manager


class PolicyEngine:
    def __init__(self):
        self.pending_approvals = {}
        self.session_budgets = {}
    
    def evaluate(self, tool_name: str, arguments: dict, session_id: str = "default") -> Dict[str, Any]:
        """
        Evaluate tool call against all active policies
        Returns: {"action": "allow|block|require_approval", "reason": str, ...}
        """
        rules = rule_manager.get_rules()
        
        for rule in rules:
            if not rule.get("enabled", False):
                continue
            
            rule_type = rule.get("type")
            
            # BLOCK_TOOL rule
            if rule_type == "BLOCK_TOOL":
                if self._matches_tool_pattern(tool_name, rule.get("pattern", rule.get("tool", ""))):
                    return {
                        "action": "block",
                        "reason": f"Tool {tool_name} blocked by rule: {rule.get('name', 'unnamed')}",
                        "rule_id": rule.get("id")
                    }
            
            # REQUIRE_APPROVAL rule
            elif rule_type == "REQUIRE_APPROVAL":
                if self._matches_tool_pattern(tool_name, rule.get("pattern", rule.get("tool", ""))):
                    approval_id = str(uuid.uuid4())
                    self.pending_approvals[approval_id] = {
                        "tool": tool_name,
                        "arguments": arguments,
                        "session_id": session_id,
                        "created_at": datetime.now().isoformat(),
                        "rule_id": rule.get("id"),
                        "status": "pending"
                    }
                    return {
                        "action": "require_approval",
                        "reason": f"Tool {tool_name} requires human approval",
                        "approval_id": approval_id,
                        "rule_id": rule.get("id")
                    }
            
            # INPUT_VALIDATION rule
            elif rule_type == "INPUT_VALIDATION":
                if tool_name == rule.get("tool"):
                    param_name = rule.get("parameter")
                    validation_type = rule.get("validation_type")
                    validation_value = rule.get("validation_value")
                    
                    param_value = arguments.get(param_name, "")
                    
                    if validation_type == "contains":
                        if validation_value not in str(param_value):
                            return {
                                "action": "block",
                                "reason": f"Parameter {param_name} must contain '{validation_value}'",
                                "rule_id": rule.get("id")
                            }
                    
                    elif validation_type == "matches_regex":
                        if not re.match(validation_value, str(param_value)):
                            return {
                                "action": "block",
                                "reason": f"Parameter {param_name} must match pattern '{validation_value}'",
                                "rule_id": rule.get("id")
                            }
                    
                    elif validation_type == "path_under":
                        # Check if path is under allowed directory
                        if not str(param_value).startswith(validation_value):
                            return {
                                "action": "block",
                                "reason": f"Path must be under {validation_value}",
                                "rule_id": rule.get("id")
                            }
            
            # TOKEN_BUDGET rule
            elif rule_type == "TOKEN_BUDGET":
                max_tokens = rule.get("max_tokens", 10000)
                current_usage = self.session_budgets.get(session_id, 0)
                
                if current_usage >= max_tokens:
                    return {
                        "action": "block",
                        "reason": f"Token budget exceeded for session {session_id} ({current_usage}/{max_tokens})",
                        "rule_id": rule.get("id")
                    }
        
        return {
            "action": "allow",
            "reason": "No policies violated"
        }
    
    def _matches_tool_pattern(self, tool_name: str, pattern: str) -> bool:
        """Check if tool name matches pattern (supports wildcards)"""
        if not pattern:
            return False
        if pattern == "*":
            return True
        if "*" in pattern:
            regex = pattern.replace("*", ".*")
            return bool(re.match(f"^{regex}$", tool_name))
        return tool_name == pattern
    
    def approve_tool(self, approval_id: str) -> bool:
        """Approve a pending tool call"""
        if approval_id in self.pending_approvals:
            self.pending_approvals[approval_id]["status"] = "approved"
            return True
        return False
    
    def reject_tool(self, approval_id: str, reason: str = "") -> bool:
        """Reject a pending tool call"""
        if approval_id in self.pending_approvals:
            self.pending_approvals[approval_id]["status"] = "rejected"
            self.pending_approvals[approval_id]["rejection_reason"] = reason
            return True
        return False
    
    def get_pending_approvals(self) -> List[Dict[str, Any]]:
        """Get all pending approvals"""
        return [
            {**approval, "approval_id": aid}
            for aid, approval in self.pending_approvals.items()
            if approval["status"] == "pending"
        ]
    
    def update_token_usage(self, session_id: str, tokens: int):
        """Update token usage for a session"""
        current = self.session_budgets.get(session_id, 0)
        self.session_budgets[session_id] = current + tokens


# Global policy engine
policy_engine = PolicyEngine()