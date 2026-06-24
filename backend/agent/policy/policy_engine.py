"""
Compatibility shim — delegates to the canonical policy package.

All new code should import directly from `policy.engine`.
This file exists so that any remaining internal imports of
`agent.policy.policy_engine` continue to work without modification.
"""
from policy.engine import PolicyEngine, policy_engine  # noqa: F401
