from django.db import models


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
