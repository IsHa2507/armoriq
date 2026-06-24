"""
Compatibility shim — delegates to the canonical policy package.

All new code should import directly from `policy.rules`.
This file exists so that any remaining internal imports of
`agent.policy.rule_manager` continue to work without modification.
"""
from policy.rules import RuleStore as RuleManager, rule_store as rule_manager  # noqa: F401
