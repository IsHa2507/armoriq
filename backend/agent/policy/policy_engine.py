from .rule_manager import RuleManager

rule_manager = RuleManager()


def evaluate(tool_name):
    rules = rule_manager.get_rules()

    for rule in rules:
        if (
            rule["enabled"]
            and rule["type"] == "BLOCK_TOOL"
            and rule["tool"] == tool_name
        ):
            return {
                "allowed": False,
                "reason": f"{tool_name} blocked by policy"
            }

    return {
        "allowed": True,
        "reason": "allowed"
    }