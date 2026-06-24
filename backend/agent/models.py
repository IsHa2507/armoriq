from django.db import models


class PolicyRule(models.Model):
    """
    Persistent storage for guardrail rules.
    Replaces the file-based rules.json so rules survive Render deploys.
    """
    RULE_TYPES = [
        ("BLOCK_TOOL", "Block Tool"),
        ("REQUIRE_APPROVAL", "Require Approval"),
        ("INPUT_VALIDATION", "Input Validation"),
        ("TOKEN_BUDGET", "Token Budget"),
    ]

    rule_id   = models.CharField(max_length=255, unique=True, db_index=True)
    name      = models.CharField(max_length=255)
    rule_type = models.CharField(max_length=50, choices=RULE_TYPES)
    enabled   = models.BooleanField(default=True)
    priority  = models.IntegerField(default=100)
    hits      = models.IntegerField(default=0)
    # All extra fields (pattern, tool, parameter, validation_type, etc.)
    # stored as JSON so the schema stays flexible without new migrations.
    extra     = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["priority", "name"]

    def to_dict(self):
        """Return the flat dict format expected by PolicyEngine / RuleStore."""
        d = {
            "id":      self.rule_id,
            "name":    self.name,
            "type":    self.rule_type,
            "enabled": self.enabled,
            "priority": self.priority,
            "hits":    self.hits,
        }
        d.update(self.extra)
        return d


class Conversation(models.Model):
    session_id = models.CharField(max_length=255, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-updated_at']


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, related_name='messages', on_delete=models.CASCADE)
    role = models.CharField(max_length=50)  # user, assistant, system
    content = models.TextField()
    tool_calls = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['timestamp']


class ToolCall(models.Model):
    session_id = models.CharField(max_length=255, db_index=True)
    tool_name = models.CharField(max_length=255)
    arguments = models.JSONField()
    result = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=50)  # allowed, blocked, pending, error
    policy_decision = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']


class ApprovalRequest(models.Model):
    approval_id = models.CharField(max_length=255, unique=True, db_index=True)
    tool_name = models.CharField(max_length=255)
    arguments = models.JSONField()
    session_id = models.CharField(max_length=255)
    status = models.CharField(max_length=50, default='pending')  # pending, approved, rejected
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.CharField(max_length=255, null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
