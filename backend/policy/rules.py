"""
Rule definitions and the rule store.

Rules are persisted to the PostgreSQL database (agent.PolicyRule model).
On every evaluate() call the rules are re-read from DB so dashboard
changes take effect immediately — no server restart required.

Falls back to rules.json if the database is unavailable (e.g. during
manage.py migrate when tables don't exist yet).

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

_JSON_FALLBACK = os.path.join(os.path.dirname(__file__), "rules.json")

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


def _db_available() -> bool:
    """Return True if the agent_policyrule table exists and is reachable."""
    try:
        from django.db import connection
        return "agent_policyrule" in connection.introspection.table_names()
    except Exception:
        return False


class RuleStore:
    """
    Persistent rule store backed by PostgreSQL (agent.PolicyRule).

    Falls back to rules.json transparently during migrate / cold-start.
    All methods present the same flat-dict interface regardless of backend.
    """

    # ── public API ────────────────────────────────────────────────────────────

    def get_rules(self) -> List[Dict[str, Any]]:
        """Return all rules sorted by priority. Re-reads from DB every call."""
        if _db_available():
            return self._db_get_all()
        return self._json_get_all()

    def get_rule(self, rule_id: str) -> Optional[Dict[str, Any]]:
        if _db_available():
            return self._db_get_one(rule_id)
        for r in self._json_get_all():
            if r["id"] == rule_id:
                return r
        return None

    def create_rule(self, data: Dict[str, Any]) -> Dict[str, Any]:
        rule_id = data.get("id") or str(uuid.uuid4())
        rule: Dict[str, Any] = {
            "id":       rule_id,
            "name":     data.get("name", "Unnamed Rule"),
            "type":     data.get("type", "BLOCK_TOOL"),
            "enabled":  data.get("enabled", True),
            "priority": data.get("priority", 100),
            "hits":     0,
        }
        extra = {k: v for k, v in data.items() if k not in rule}

        if _db_available():
            self._db_create(rule, extra)
        else:
            rule.update(extra)
            self._json_create(rule)

        logger.info("[RULES] Rule created | id=%s name=%s type=%s", rule_id, rule["name"], rule["type"])
        rule.update(extra)
        return rule

    def update_rule(self, rule_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if _db_available():
            return self._db_update(rule_id, updates)
        return self._json_update(rule_id, updates)

    def delete_rule(self, rule_id: str) -> bool:
        if _db_available():
            return self._db_delete(rule_id)
        return self._json_delete(rule_id)

    def toggle_rule(self, rule_id: str) -> Optional[Dict[str, Any]]:
        if _db_available():
            return self._db_toggle(rule_id)
        return self._json_toggle(rule_id)

    def increment_hits(self, rule_id: str) -> None:
        try:
            if _db_available():
                from django.db.models import F
                from agent.models import PolicyRule
                PolicyRule.objects.filter(rule_id=rule_id).update(hits=F("hits") + 1)
            else:
                self._json_increment_hits(rule_id)
        except Exception as exc:
            logger.warning("Failed to increment hits for rule %s: %s", rule_id, exc)

    # ── DB backend ────────────────────────────────────────────────────────────

    def _db_get_all(self) -> List[Dict[str, Any]]:
        try:
            from agent.models import PolicyRule
            qs = PolicyRule.objects.all().order_by("priority", "name")
            if not qs.exists():
                # First run — seed from defaults
                self._db_seed()
                qs = PolicyRule.objects.all().order_by("priority", "name")
            return [r.to_dict() for r in qs]
        except Exception as exc:
            logger.warning("DB read failed, falling back to JSON: %s", exc)
            return self._json_get_all()

    def _db_get_one(self, rule_id: str) -> Optional[Dict[str, Any]]:
        try:
            from agent.models import PolicyRule
            obj = PolicyRule.objects.filter(rule_id=rule_id).first()
            return obj.to_dict() if obj else None
        except Exception:
            return None

    def _db_create(self, rule: Dict[str, Any], extra: Dict[str, Any]) -> None:
        from agent.models import PolicyRule
        PolicyRule.objects.create(
            rule_id=rule["id"],
            name=rule["name"],
            rule_type=rule["type"],
            enabled=rule["enabled"],
            priority=rule["priority"],
            hits=0,
            extra=extra,
        )

    def _db_update(self, rule_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            from agent.models import PolicyRule
            obj = PolicyRule.objects.filter(rule_id=rule_id).first()
            if not obj:
                return None
            if "name"     in updates: obj.name      = updates["name"]
            if "type"     in updates: obj.rule_type = updates["type"]
            if "enabled"  in updates: obj.enabled   = updates["enabled"]
            if "priority" in updates: obj.priority  = updates["priority"]
            # remaining keys go into extra
            extra_keys = {k: v for k, v in updates.items()
                          if k not in ("id","name","type","enabled","priority","hits")}
            if extra_keys:
                obj.extra = {**obj.extra, **extra_keys}
            obj.save()
            logger.info("[RULES] Rule updated | id=%s", rule_id)
            return obj.to_dict()
        except Exception as exc:
            logger.error("DB update failed: %s", exc)
            return None

    def _db_delete(self, rule_id: str) -> bool:
        try:
            from agent.models import PolicyRule
            deleted, _ = PolicyRule.objects.filter(rule_id=rule_id).delete()
            logger.info("[RULES] Rule deleted | id=%s", rule_id)
            return deleted > 0
        except Exception as exc:
            logger.error("DB delete failed: %s", exc)
            return False

    def _db_toggle(self, rule_id: str) -> Optional[Dict[str, Any]]:
        try:
            from agent.models import PolicyRule
            obj = PolicyRule.objects.filter(rule_id=rule_id).first()
            if not obj:
                return None
            obj.enabled = not obj.enabled
            obj.save(update_fields=["enabled", "updated_at"])
            logger.info("[RULES] Rule toggled | id=%s enabled=%s", rule_id, obj.enabled)
            return obj.to_dict()
        except Exception as exc:
            logger.error("DB toggle failed: %s", exc)
            return None

    def _db_seed(self) -> None:
        """Seed default rules into the DB on first run."""
        from agent.models import PolicyRule
        for r in _DEFAULT_RULES:
            extra = {k: v for k, v in r.items()
                     if k not in ("id","name","type","enabled","priority","hits")}
            PolicyRule.objects.get_or_create(
                rule_id=r["id"],
                defaults={
                    "name":      r["name"],
                    "rule_type": r["type"],
                    "enabled":   r["enabled"],
                    "priority":  r["priority"],
                    "hits":      r.get("hits", 0),
                    "extra":     extra,
                },
            )
        logger.info("[RULES] Default rules seeded into DB")

    # ── JSON fallback backend ─────────────────────────────────────────────────

    def _json_get_all(self) -> List[Dict[str, Any]]:
        try:
            with open(_JSON_FALLBACK, "r") as fh:
                rules = json.load(fh)
            return sorted(rules, key=lambda r: r.get("priority", 100))
        except (FileNotFoundError, json.JSONDecodeError):
            return list(_DEFAULT_RULES)

    def _json_create(self, rule: Dict[str, Any]) -> None:
        rules = self._json_get_all()
        rules.append(rule)
        self._json_write(rules)

    def _json_update(self, rule_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        rules = self._json_get_all()
        for i, r in enumerate(rules):
            if r["id"] == rule_id:
                rules[i] = {**r, **updates, "id": rule_id}
                self._json_write(rules)
                return rules[i]
        return None

    def _json_delete(self, rule_id: str) -> bool:
        rules = self._json_get_all()
        new_rules = [r for r in rules if r["id"] != rule_id]
        if len(new_rules) == len(rules):
            return False
        self._json_write(new_rules)
        return True

    def _json_toggle(self, rule_id: str) -> Optional[Dict[str, Any]]:
        rules = self._json_get_all()
        for i, r in enumerate(rules):
            if r["id"] == rule_id:
                rules[i]["enabled"] = not r.get("enabled", False)
                self._json_write(rules)
                return rules[i]
        return None

    def _json_increment_hits(self, rule_id: str) -> None:
        rules = self._json_get_all()
        for i, r in enumerate(rules):
            if r["id"] == rule_id:
                rules[i]["hits"] = r.get("hits", 0) + 1
                self._json_write(rules)
                return

    def _json_write(self, rules: List[Dict[str, Any]]) -> None:
        try:
            with open(_JSON_FALLBACK, "w") as fh:
                json.dump(rules, fh, indent=2)
        except OSError as exc:
            logger.error("Failed to write rules.json: %s", exc)


# Module-level singleton
rule_store = RuleStore()
