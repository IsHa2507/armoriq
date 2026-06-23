class RuleManager:
    def __init__(self):
        self.rules = [
            {
                "id": "1",
                "name": "Block Delete Note",
                "type": "BLOCK_TOOL",
                "enabled": True,
                "tool": "delete_note"
            }
        ]

    def get_rules(self):
        return self.rules