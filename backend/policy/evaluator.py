"""
Rule evaluators — one function per rule type.

Each evaluator receives a rule dict and the tool-call context and either
returns None (no violation) or raises the appropriate PolicyViolation.
"""

import logging
import re
from typing import Any, Dict, Optional

from .exceptions import ApprovalRequired, BudgetExceeded, ToolBlocked

logger = logging.getLogger("policy.evaluator")


# ── helpers ───────────────────────────────────────────────────────────────────

def _matches_pattern(tool_name: str, pattern: str) -> bool:
    """Return True if tool_name matches the glob-style pattern."""
    if not pattern:
        return False
    if pattern == "*":
        return True
    if "*" in pattern:
        regex = "^" + re.escape(pattern).replace(r"\*", ".*") + "$"
        return bool(re.match(regex, tool_name))
    return tool_name == pattern


# ── per-type evaluators ───────────────────────────────────────────────────────

def evaluate_block_tool(
    rule: Dict[str, Any],
    tool_name: str,
    arguments: Dict[str, Any],
    context: Dict[str, Any],
) -> None:
    """Raises ToolBlocked if the tool matches the rule's pattern."""
    pattern = rule.get("pattern") or rule.get("tool", "")
    if _matches_pattern(tool_name, pattern):
        logger.warning(
            "[POLICY] BLOCK_TOOL matched | rule=%s tool=%s",
            rule.get("name"),
            tool_name,
        )
        raise ToolBlocked(
            tool_name=tool_name,
            reason=f"Tool '{tool_name}' is blocked by rule '{rule.get('name', 'unnamed')}'.",
            rule_id=rule.get("id"),
            rule_name=rule.get("name"),
        )


def evaluate_require_approval(
    rule: Dict[str, Any],
    tool_name: str,
    arguments: Dict[str, Any],
    context: Dict[str, Any],
    approval_id_factory,
) -> None:
    """Raises ApprovalRequired if the tool matches the rule's pattern."""
    pattern = rule.get("pattern") or rule.get("tool", "")
    if _matches_pattern(tool_name, pattern):
        approval_id = approval_id_factory(
            tool_name=tool_name,
            arguments=arguments,
            session_id=context.get("session_id", "default"),
            rule_id=rule.get("id"),
        )
        logger.warning(
            "[POLICY] REQUIRE_APPROVAL matched | rule=%s tool=%s approval_id=%s",
            rule.get("name"),
            tool_name,
            approval_id,
        )
        raise ApprovalRequired(
            tool_name=tool_name,
            approval_id=approval_id,
            rule_id=rule.get("id"),
            rule_name=rule.get("name"),
        )


def evaluate_input_validation(
    rule: Dict[str, Any],
    tool_name: str,
    arguments: Dict[str, Any],
    context: Dict[str, Any],
) -> None:
    """Raises ToolBlocked if an argument fails its validation constraint."""
    if tool_name != rule.get("tool"):
        return  # rule targets a different tool

    param_name: str = rule.get("parameter", "")
    v_type: str = rule.get("validation_type", "")
    v_value: str = rule.get("validation_value", "")
    param_value: str = str(arguments.get(param_name, ""))

    violated = False
    reason = ""

    if v_type == "contains":
        if v_value not in param_value:
            violated = True
            reason = f"Parameter '{param_name}' must contain '{v_value}'."

    elif v_type == "not_contains":
        if v_value in param_value:
            violated = True
            reason = f"Parameter '{param_name}' must not contain '{v_value}'."

    elif v_type == "matches_regex":
        if not re.match(v_value, param_value):
            violated = True
            reason = f"Parameter '{param_name}' must match pattern '{v_value}'."

    elif v_type == "path_under":
        if not param_value.startswith(v_value):
            violated = True
            reason = f"Parameter '{param_name}' must be a path under '{v_value}'."

    elif v_type == "max_length":
        try:
            max_len = int(v_value)
            if len(param_value) > max_len:
                violated = True
                reason = (
                    f"Parameter '{param_name}' exceeds maximum length of {max_len} "
                    f"(got {len(param_value)})."
                )
        except ValueError:
            logger.error("Invalid max_length value in rule %s: %s", rule.get("id"), v_value)

    if violated:
        logger.warning(
            "[POLICY] INPUT_VALIDATION failed | rule=%s tool=%s param=%s reason=%s",
            rule.get("name"),
            tool_name,
            param_name,
            reason,
        )
        raise ToolBlocked(
            tool_name=tool_name,
            reason=reason,
            rule_id=rule.get("id"),
            rule_name=rule.get("name"),
        )


def evaluate_token_budget(
    rule: Dict[str, Any],
    tool_name: str,
    arguments: Dict[str, Any],
    context: Dict[str, Any],
    get_usage,
) -> None:
    """Raises BudgetExceeded if the session has consumed its token budget."""
    session_id: str = context.get("session_id", "default")
    max_tokens: int = int(rule.get("max_tokens", 10_000))
    current: int = get_usage(session_id)

    if current >= max_tokens:
        logger.warning(
            "[POLICY] TOKEN_BUDGET exceeded | rule=%s session=%s usage=%d limit=%d",
            rule.get("name"),
            session_id,
            current,
            max_tokens,
        )
        raise BudgetExceeded(
            session_id=session_id,
            current=current,
            limit=max_tokens,
            rule_id=rule.get("id"),
            rule_name=rule.get("name"),
        )
