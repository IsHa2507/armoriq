"""
Rule Manager - Manages guardrail rules (CRUD operations)
"""
import json
import os
from typing import List, Dict, Any
import uuid


class RuleManager:
    def __init__(self, storage_file: str = "rules.json"):
        self.storage_file = os.path.join(os.path.dirname(__file__), storage_file)
        self.rules = self._load_rules()
    
    def _load_rules(self) -> List[Dict[str, Any]]:
        """Load rules from file"""
        if os.path.exists(self.storage_file):
            try:
                with open(self.storage_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        
        # Default rules
        return [
            {
                "id": "1",
                "name": "Block Delete Note",
                "type": "BLOCK_TOOL",
                "enabled": True,
                "pattern": "delete_note",
                "tool": "delete_note"
            },
            {
                "id": "2",
                "name": "Path Validation",
                "type": "INPUT_VALIDATION",
                "enabled": False,
                "tool": "create_note",
                "parameter": "title",
                "validation_type": "matches_regex",
                "validation_value": "^[a-zA-Z0-9_\\s-]+$"
            }
        ]
    
    def _save_rules(self):
        """Save rules to file"""
        try:
            with open(self.storage_file, 'w') as f:
                json.dump(self.rules, f, indent=2)
        except Exception as e:
            print(f"Failed to save rules: {e}")
    
    def get_rules(self) -> List[Dict[str, Any]]:
        """Get all rules"""
        return self.rules
    
    def get_rule(self, rule_id: str) -> Dict[str, Any]:
        """Get a specific rule"""
        for rule in self.rules:
            if rule["id"] == rule_id:
                return rule
        return None
    
    def create_rule(self, rule_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new rule"""
        rule = {
            "id": rule_data.get("id", str(uuid.uuid4())),
            "name": rule_data.get("name", "Unnamed Rule"),
            "type": rule_data.get("type", "BLOCK_TOOL"),
            "enabled": rule_data.get("enabled", True),
            **{k: v for k, v in rule_data.items() if k not in ["id", "name", "type", "enabled"]}
        }
        self.rules.append(rule)
        self._save_rules()
        return rule
    
    def update_rule(self, rule_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing rule"""
        for i, rule in enumerate(self.rules):
            if rule["id"] == rule_id:
                self.rules[i].update(updates)
                self._save_rules()
                return self.rules[i]
        return None
    
    def delete_rule(self, rule_id: str) -> bool:
        """Delete a rule"""
        for i, rule in enumerate(self.rules):
            if rule["id"] == rule_id:
                self.rules.pop(i)
                self._save_rules()
                return True
        return False
    
    def toggle_rule(self, rule_id: str) -> Dict[str, Any]:
        """Toggle rule enabled state"""
        for rule in self.rules:
            if rule["id"] == rule_id:
                rule["enabled"] = not rule.get("enabled", False)
                self._save_rules()
                return rule
        return None


# Global rule manager instance
rule_manager = RuleManager()