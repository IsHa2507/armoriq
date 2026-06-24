"""
Rule definitions and the rule store.

Rules are persisted to rules.json and reloaded from disk on every
evaluate() call so that dashboard changes take effect immediately —
no server restart required.

Rule schema (all fields):
    id              str       unique identifier
    name            str       human-readable label
    type            str       BLOCK_TOOL | REQUIRE_APPROVAL | INPUT_VALIDATION | TOKEN_BUDGET
    enabled         bool      whether the rule is active
    priority        int       lower = evaluated first (default 100)

    # BLOCK_TOOL / REQUIRE_APPROVAL
    pattern         str       tool name or glob (supports * wildcard)

    # INPUT_VALIDATION
    tool            str       exact tool name this validation applies to
    parameter       str       argument key to inspect
    validation_type str       contains | matches_regex | not_contains | path_under | max_length
    validation_value str      value for the validation

    # TOKEN_BUDGET
    max_tokens      int       maximum cumulative tokens for a session
"""

import json
import logging
import os
import uuid
from typing import Any, Dict, List, Optional

logger = logging.getLogger("policy.rules")

_DEFAULT_STORAGE = os.path.join(os.path.dirname(__file__), "rules.json")

# ── default seed rules ────────────────────────────────────────────────────────

_DEFAULT_RULES: List[Dict[str, Any]] = [
    {
        "id": "default-block-delete",
        "name": "Block Delete Note",
        "type": "BLOCK_TOOL",
        "enabled": True,
        "priority": 10,
        "pattern": "delete_note",
        "hits": 0,
    },
    {
        "id": "default-title-validation",
        "name": "Title Must Be Alphanumeric",
        "type": "INPUT_VALIDATION",
        "enabled": False,
        "priority": 50,
        "tool": "create_note",
        "parameter": "title",
        "validation_type": "matches_regex",
        "validation_value": r"^[a-zA-Z0-9_\s\-]+$",
        "hits": 0,
    },
]


class RuleStore:
    """
    Persistent, file-backed rule store.

    Rules are written to disk on every mutation and read fresh from disk
    inside get_rules() so that any process writing the file (e.g. the
    dashboard API) is immediately visible to the running agent.
    """

    def __init__(self, storage_file: str = _DEFAULT_STORAGE):
        self._path = storage_file
        # Seed the file if it does not exist yet.
        if not os.path.exists(self._path):
            self._write(_DEFAULT_RULES)

    # ── public API ────────────────────────────────────────────────────────────

    def get_rules(self) -> List[Dict[str, Any]]:
        """Return all rules, sorted by priority. Always re-reads from disk."""
        rules = self._read()
        return sorted(rules, key=lambda r: r.get("priority", 100))

    def get_rule(self, rule_id: str) -> Optional[Dict[str, Any]]:
        for rule in self._read():
            if rule["id"] == rule_id:
                return rule
        return None

    def create_rule(self, data: Dict[str, Any]) -> Dict[str, Any]:
        rules = self._read()
        rule: Dict[str, Any] = {
            "id": data.get("id") or str(uuid.uuid4()),
            "name": data.get("name", "Unnamed Rule"),
            "type": data.get("type", "BLOCK_TOOL"),
            "enabled": data.get("enabled", True),
            "priority": data.get("priority", 100),
            "hits": 0,
        }
        # Copy any extra fields (pattern, tool, parameter …)
        for k, v in data.items():
            if k not in rule:
                rule[k] = v
        rules.append(rule)
        self._write(rules)
        logger.info(
            "[RULES] Rule DEPLOYED | id=%s name=%s type=%s enabled=%s pattern=%s",
            rule["id"],
            rule["name"],
            rule["type"],
            rule["enabled"],
            rule.get("pattern") or rule.get("tool", ""),
        )
        return rule

    def update_rule(self, rule_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        rules = self._read()
        for i, rule in enumerate(rules):
            if rule["id"] == rule_id:
                rules[i] = {**rule, **updates, "id": rule_id}
                self._write(rules)
                logger.info(
                    "[RULES] Rule updated | id=%s name=%s enabled=%s",
                    rule_id,
                    rules[i].get("name"),
                    rules[i].get("enabled"),
                )
                return rules[i]
        return None

    def delete_rule(self, rule_id: str) -> bool:
        rules = self._read()
        new_rules = [r for r in rules if r["id"] != rule_id]
        if len(new_rules) == len(rules):
            return False
        self._write(new_rules)
        logger.info("[RULES] Rule deleted | id=%s", rule_id)
        return True

    def toggle_rule(self, rule_id: str) -> Optional[Dict[str, Any]]:
        rules = self._read()
        for i, rule in enumerate(rules):
            if rule["id"] == rule_id:
                rules[i]["enabled"] = not rule.get("enabled", False)
                self._write(rules)
                logger.info(
                    "[RULES] Rule toggled | id=%s name=%s enabled=%s — takes effect on next tool call",
                    rule_id,
                    rules[i].get("name"),
                    rules[i]["enabled"],
                )
                return rules[i]
        return None

    def increment_hits(self, rule_id: str) -> None:
        """Increment the hit counter for a rule in rules.json (best-effort)."""
        try:
            rules = self._read()
            for i, rule in enumerate(rules):
                if rule["id"] == rule_id:
                    rules[i]["hits"] = rule.get("hits", 0) + 1
                    self._write(rules)
                    return
        except Exception as exc:
            logger.warning("Failed to increment hits for rule %s: %s", rule_id, exc)

    # ── internal helpers ──────────────────────────────────────────────────────

    def _read(self) -> List[Dict[str, Any]]:
        try:
            with open(self._path, "r") as fh:
                return json.load(fh)
        except (FileNotFoundError, json.JSONDecodeError) as exc:
            logger.warning("Could not read rules file (%s), using defaults.", exc)
            return list(_DEFAULT_RULES)

    def _write(self, rules: List[Dict[str, Any]]) -> None:
        try:
            with open(self._path, "w") as fh:
                json.dump(rules, fh, indent=2)
        except OSError as exc:
            logger.error("Failed to write rules file: %s", exc)


# Module-level singleton — import this everywhere instead of instantiating
rule_store = RuleStore()
