"""
PolicyEngine — the single choke-point for all MCP tool executions.

Usage
-----
from policy.engine import policy_engine   # module-level singleton

# In agent code:
decision = policy_engine.evaluate(
    tool_name="delete_note",
    arguments={"note_id": "42"},
    session_id="session-abc",
)
# decision["action"] is one of: "allow" | "block" | "require_approval" | "budget_exceeded"

# After execution, record token usage so budget rules work:
policy_engine.record_token_usage(session_id="session-abc", tokens=150)

Design notes
------------
* Rules are re-read from disk on every evaluate() call so that dashboard
  changes (create / update / delete / toggle) are picked up immediately
  without a server restart.
* ApprovalRequest records are written to the database so they survive
  restarts and are visible across all processes.
* All policy decisions and tool executions are written to the ToolCall
  model for audit/analytics.
* Budget usage is stored in-memory (per-process). For multi-process
  deployments, swap _budget_store for a Redis or DB-backed counter.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from .evaluator import (
    evaluate_block_tool,
    evaluate_input_validation,
    evaluate_require_approval,
    evaluate_token_budget,
)
from .exceptions import ApprovalRequired, BudgetExceeded, PolicyViolation, ToolBlocked
from .rules import rule_store

logger = logging.getLogger("policy.engine")

# Mapping from rule type string to evaluator function name (used for logging)
_RULE_TYPE_LABELS = {
    "BLOCK_TOOL": "block_tool",
    "REQUIRE_APPROVAL": "require_approval",
    "INPUT_VALIDATION": "input_validation",
    "TOKEN_BUDGET": "token_budget",
}


class PolicyEngine:
    """
    Evaluates every pending tool call against the current rule set and
    persists the decision to the database.
    """

    def __init__(self):
        # In-memory token budget counters keyed by session_id.
        # These reset on process restart; acceptable for the current single-
        # process deployment. Replace with DB/Redis for multi-process.
        self._budget_store: Dict[str, int] = {}

    # ── public interface ──────────────────────────────────────────────────────

    def evaluate(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        session_id: str = "default",
    ) -> Dict[str, Any]:
        """
        Evaluate a tool call against all active policies.

        Returns a decision dict:
            {
                "action":      "allow" | "block" | "require_approval" | "budget_exceeded",
                "reason":      str,
                "rule_id":     str | None,
                "rule_name":   str | None,
                "approval_id": str | None,   # only when action == "require_approval"
            }

        Also persists a ToolCall log record and (when required) an
        ApprovalRequest record to the database.
        """
        context = {"session_id": session_id}
        rules = rule_store.get_rules()

        logger.info(
            "[POLICY] Evaluating | tool=%s session=%s total_rules=%d active_rules=%d",
            tool_name,
            session_id,
            len(rules),
            sum(1 for r in rules if r.get("enabled")),
        )
        for r in rules:
            logger.debug(
                "[POLICY] Loaded rule | id=%s name=%s type=%s enabled=%s pattern=%s",
                r.get("id"),
                r.get("name"),
                r.get("type"),
                r.get("enabled"),
                r.get("pattern") or r.get("tool", ""),
            )

        decision: Dict[str, Any] = {
            "action": "allow",
            "reason": "No active rules violated.",
            "rule_id": None,
            "rule_name": None,
            "approval_id": None,
        }

        try:
            for rule in rules:
                if not rule.get("enabled", False):
                    logger.debug(
                        "[POLICY] Skipping disabled rule | id=%s name=%s",
                        rule.get("id"),
                        rule.get("name"),
                    )
                    continue

                rule_type = rule.get("type")
                logger.debug(
                    "[POLICY] Checking rule | id=%s name=%s type=%s tool=%s",
                    rule.get("id"),
                    rule.get("name"),
                    rule_type,
                    tool_name,
                )

                if rule_type == "BLOCK_TOOL":
                    evaluate_block_tool(rule, tool_name, arguments, context)

                elif rule_type == "REQUIRE_APPROVAL":
                    evaluate_require_approval(
                        rule,
                        tool_name,
                        arguments,
                        context,
                        approval_id_factory=self._create_approval_request,
                    )

                elif rule_type == "INPUT_VALIDATION":
                    evaluate_input_validation(rule, tool_name, arguments, context)

                elif rule_type == "TOKEN_BUDGET":
                    evaluate_token_budget(
                        rule,
                        tool_name,
                        arguments,
                        context,
                        get_usage=self._get_budget,
                    )

                else:
                    logger.debug("Unknown rule type '%s', skipping.", rule_type)

        except ToolBlocked as exc:
            decision = {
                "action": "block",
                "reason": exc.reason,
                "rule_id": exc.rule_id,
                "rule_name": exc.rule_name,
                "approval_id": None,
            }
            logger.warning(
                "[POLICY] TOOL BLOCKED | tool=%s rule_id=%s rule_name=%s reason=%s",
                tool_name,
                exc.rule_id,
                exc.rule_name,
                exc.reason,
            )
            # Increment hit counter in rules.json so dashboard shows real data.
            if exc.rule_id:
                rule_store.increment_hits(exc.rule_id)

        except ApprovalRequired as exc:
            decision = {
                "action": "require_approval",
                "reason": exc.message,
                "rule_id": exc.rule_id,
                "rule_name": exc.rule_name,
                "approval_id": exc.approval_id,
            }
            logger.warning(
                "[POLICY] APPROVAL REQUIRED | tool=%s approval_id=%s rule_id=%s rule_name=%s",
                tool_name,
                exc.approval_id,
                exc.rule_id,
                exc.rule_name,
            )
            if exc.rule_id:
                rule_store.increment_hits(exc.rule_id)

        except BudgetExceeded as exc:
            decision = {
                "action": "budget_exceeded",
                "reason": exc.message,
                "rule_id": exc.rule_id,
                "rule_name": exc.rule_name,
                "approval_id": None,
            }
            logger.warning(
                "[POLICY] BUDGET EXCEEDED | tool=%s session=%s usage=%d limit=%d rule_id=%s",
                tool_name,
                exc.session_id,
                exc.current,
                exc.limit,
                exc.rule_id,
            )
            if exc.rule_id:
                rule_store.increment_hits(exc.rule_id)

        # Persist to DB (import deferred to avoid Django app registry issues)
        self._log_tool_call(
            session_id=session_id,
            tool_name=tool_name,
            arguments=arguments,
            decision=decision,
        )

        logger.info(
            "[POLICY] Decision | tool=%s action=%s rule_id=%s rule_name=%s",
            tool_name,
            decision["action"],
            decision.get("rule_id"),
            decision.get("rule_name"),
        )
        return decision

    def record_tool_result(
        self,
        session_id: str,
        tool_name: str,
        result: str,
        status: str = "executed",
    ) -> None:
        """Update the most recent ToolCall record with the execution result."""
        try:
            from agent.models import ToolCall  # deferred import

            record = (
                ToolCall.objects.filter(
                    session_id=session_id,
                    tool_name=tool_name,
                    status="allowed",
                )
                .order_by("-timestamp")
                .first()
            )
            if record:
                record.result = str(result)
                record.status = status
                record.save(update_fields=["result", "status"])
        except Exception as exc:  # pragma: no cover
            logger.error("Failed to update ToolCall result: %s", exc)

    def record_token_usage(self, session_id: str, tokens: int) -> None:
        """Increment the in-memory token counter for a session."""
        self._budget_store[session_id] = self._get_budget(session_id) + tokens
        logger.debug(
            "[POLICY] Token usage updated | session=%s total=%d",
            session_id,
            self._budget_store[session_id],
        )

    def get_budget_usage(self, session_id: str) -> int:
        """Return current token usage for a session."""
        return self._get_budget(session_id)

    # ── approval management ───────────────────────────────────────────────────

    def get_pending_approvals(self) -> List[Dict[str, Any]]:
        """Return all pending ApprovalRequest records from the database."""
        try:
            from agent.models import ApprovalRequest  # deferred import

            qs = ApprovalRequest.objects.filter(status="pending").order_by("-created_at")
            return [self._approval_to_dict(a) for a in qs]
        except Exception as exc:  # pragma: no cover
            logger.error("Failed to fetch pending approvals: %s", exc)
            return []

    def approve_and_execute(self, approval_id: str) -> Dict[str, Any]:
        """
        Approve a pending ApprovalRequest and immediately execute the tool.

        This is the ONLY path by which a previously-gated tool can run.
        It goes through mcp_client.call_tool() directly (the approval IS the
        policy pass), but still records the execution in the ToolCall audit log.

        Returns a dict with keys: success, tool_name, result, error
        """
        from agent.models import ApprovalRequest  # deferred import
        from agent.mcp_client import mcp_client   # deferred import

        try:
            record = ApprovalRequest.objects.filter(approval_id=approval_id).first()
        except Exception as exc:
            logger.error("Failed to fetch ApprovalRequest %s: %s", approval_id, exc)
            return {"success": False, "error": str(exc)}

        if not record:
            return {"success": False, "error": "Approval not found"}
        if record.status != "pending":
            return {"success": False, "error": f"Approval is already '{record.status}'"}

        # 1. Mark approved in DB
        self._resolve_approval(approval_id, "approved")
        tool_name = record.tool_name
        arguments = record.arguments
        session_id = record.session_id

        logger.info(
            "[POLICY] Executing approved tool | approval_id=%s tool=%s session=%s",
            approval_id,
            tool_name,
            session_id,
        )

        # 2. Execute through mcp_client (approval = explicit policy pass)
        try:
            raw_result = mcp_client.call_tool(tool_name, arguments)
            result_str = str(raw_result)

            # 3. Log the execution result
            self._log_tool_call(
                session_id=session_id,
                tool_name=tool_name,
                arguments=arguments,
                decision={
                    "action": "allow",
                    "reason": f"Executed after human approval (approval_id={approval_id})",
                    "rule_id": None,
                    "rule_name": "APPROVED",
                    "approval_id": approval_id,
                },
            )
            self.record_tool_result(
                session_id=session_id,
                tool_name=tool_name,
                result=result_str,
                status="executed",
            )
            estimated_tokens = len(result_str) // 4
            self.record_token_usage(session_id=session_id, tokens=estimated_tokens)

            logger.info(
                "[POLICY] Approved tool executed | tool=%s result=%.120s",
                tool_name,
                result_str,
            )
            return {"success": True, "tool_name": tool_name, "result": result_str}

        except Exception as exc:
            logger.error(
                "[POLICY] Approved tool execution failed | tool=%s error=%s",
                tool_name,
                exc,
            )
            return {"success": False, "tool_name": tool_name, "error": str(exc)}

    def approve_tool(self, approval_id: str) -> bool:
        """
        Mark an ApprovalRequest as approved WITHOUT executing the tool.
        Used when the caller handles execution itself. Prefer approve_and_execute()
        for the normal dashboard approval flow.
        """
        return self._resolve_approval(approval_id, "approved")

    def reject_tool(self, approval_id: str, reason: str = "") -> bool:
        """Mark an ApprovalRequest as rejected."""
        return self._resolve_approval(approval_id, "rejected", reason)

    def get_approval(self, approval_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a single ApprovalRequest by ID."""
        try:
            from agent.models import ApprovalRequest  # deferred import

            record = ApprovalRequest.objects.filter(approval_id=approval_id).first()
            if record:
                return self._approval_to_dict(record)
        except Exception as exc:  # pragma: no cover
            logger.error("Failed to fetch approval %s: %s", approval_id, exc)
        return None

    # ── private helpers ───────────────────────────────────────────────────────

    def _get_budget(self, session_id: str) -> int:
        return self._budget_store.get(session_id, 0)

    def _create_approval_request(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        session_id: str,
        rule_id: str,
    ) -> str:
        """Persist an ApprovalRequest to the DB and return its approval_id."""
        approval_id = str(uuid.uuid4())
        try:
            from agent.models import ApprovalRequest  # deferred import

            ApprovalRequest.objects.create(
                approval_id=approval_id,
                tool_name=tool_name,
                arguments=arguments,
                session_id=session_id,
                status="pending",
            )
            logger.info(
                "[POLICY] ApprovalRequest created | approval_id=%s tool=%s session=%s",
                approval_id,
                tool_name,
                session_id,
            )
        except Exception as exc:  # pragma: no cover
            logger.error("Failed to create ApprovalRequest: %s", exc)
        return approval_id

    def _resolve_approval(
        self, approval_id: str, new_status: str, reason: str = ""
    ) -> bool:
        try:
            from agent.models import ApprovalRequest  # deferred import

            record = ApprovalRequest.objects.filter(approval_id=approval_id).first()
            if not record:
                return False
            record.status = new_status
            record.resolved_at = datetime.now(tz=timezone.utc)
            if reason:
                record.rejection_reason = reason
            record.save(update_fields=["status", "resolved_at", "rejection_reason"])
            logger.info(
                "[POLICY] Approval resolved | approval_id=%s status=%s",
                approval_id,
                new_status,
            )
            return True
        except Exception as exc:  # pragma: no cover
            logger.error("Failed to resolve approval %s: %s", approval_id, exc)
            return False

    def _log_tool_call(
        self,
        session_id: str,
        tool_name: str,
        arguments: Dict[str, Any],
        decision: Dict[str, Any],
    ) -> None:
        """Persist a ToolCall audit record."""
        # Map policy action to ToolCall.status vocabulary
        status_map = {
            "allow": "allowed",
            "block": "blocked",
            "require_approval": "pending",
            "budget_exceeded": "blocked",
        }
        try:
            from agent.models import ToolCall  # deferred import

            ToolCall.objects.create(
                session_id=session_id,
                tool_name=tool_name,
                arguments=arguments,
                status=status_map.get(decision["action"], decision["action"]),
                policy_decision=decision,
            )
        except Exception as exc:  # pragma: no cover
            logger.error("Failed to log ToolCall: %s", exc)

    @staticmethod
    def _approval_to_dict(record) -> Dict[str, Any]:
        return {
            "approval_id": record.approval_id,
            "tool_name": record.tool_name,
            "arguments": record.arguments,
            "session_id": record.session_id,
            "status": record.status,
            "created_at": record.created_at.isoformat(),
            "resolved_at": record.resolved_at.isoformat() if record.resolved_at else None,
            "rejection_reason": record.rejection_reason,
        }


# ── module-level singleton ────────────────────────────────────────────────────
# Import this instance everywhere — never instantiate PolicyEngine directly.
policy_engine = PolicyEngine()
