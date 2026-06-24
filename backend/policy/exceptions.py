"""
Policy exceptions raised by the enforcement layer.
All policy violations are expressed as typed exceptions so
call-sites can handle each case independently.
"""


class PolicyViolation(Exception):
    """Base class for all policy violations."""

    def __init__(self, message: str, rule_id: str = None, rule_name: str = None):
        super().__init__(message)
        self.message = message
        self.rule_id = rule_id
        self.rule_name = rule_name

    def to_dict(self) -> dict:
        return {
            "violation_type": self.__class__.__name__,
            "message": self.message,
            "rule_id": self.rule_id,
            "rule_name": self.rule_name,
        }


class ToolBlocked(PolicyViolation):
    """Raised when a BLOCK_TOOL or INPUT_VALIDATION rule blocks the tool."""

    def __init__(self, tool_name: str, reason: str, rule_id: str = None, rule_name: str = None):
        super().__init__(reason, rule_id=rule_id, rule_name=rule_name)
        self.tool_name = tool_name
        self.reason = reason

    def to_dict(self) -> dict:
        d = super().to_dict()
        d["tool_name"] = self.tool_name
        d["reason"] = self.reason
        return d


class ApprovalRequired(PolicyViolation):
    """Raised when a REQUIRE_APPROVAL rule intercepts the tool call."""

    def __init__(self, tool_name: str, approval_id: str, rule_id: str = None, rule_name: str = None):
        super().__init__(
            f"Tool '{tool_name}' requires human approval before execution.",
            rule_id=rule_id,
            rule_name=rule_name,
        )
        self.tool_name = tool_name
        self.approval_id = approval_id

    def to_dict(self) -> dict:
        d = super().to_dict()
        d["tool_name"] = self.tool_name
        d["approval_id"] = self.approval_id
        return d


class BudgetExceeded(PolicyViolation):
    """Raised when a TOKEN_BUDGET or COST_BUDGET rule blocks the call."""

    def __init__(self, session_id: str, current: int, limit: int, rule_id: str = None, rule_name: str = None):
        super().__init__(
            f"Budget exceeded for session '{session_id}': {current}/{limit} tokens used.",
            rule_id=rule_id,
            rule_name=rule_name,
        )
        self.session_id = session_id
        self.current = current
        self.limit = limit

    def to_dict(self) -> dict:
        d = super().to_dict()
        d["session_id"] = self.session_id
        d["current"] = self.current
        d["limit"] = self.limit
        return d
