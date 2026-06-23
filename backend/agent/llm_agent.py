"""
LLM Agent - Handles conversation loop with tool execution
Using Mock LLM for demo purposes (works without API keys)
"""
import json
import re
from typing import List, Dict, Any, Optional
from .mcp_client import mcp_client
from .policy.policy_engine import PolicyEngine


class MockLLM:
    """Mock LLM that intelligently decides which tools to use"""
    
    def _parse_user_intent(self, message: str) -> Optional[Dict[str, Any]]:
        """Parse user message and determine which tool to use"""
        message_lower = message.lower()
        
        # Delete note (check this FIRST before other operations)
        if any(word in message_lower for word in ["delete", "remove", "erase"]):
            id_match = re.search(r'(?:note\s+)?(\d+)', message, re.IGNORECASE)
            if id_match:
                return {
                    "tool": "delete_note",
                    "arguments": {"note_id": id_match.group(1)}
                }
        
        # Create note
        if any(word in message_lower for word in ["create", "make", "add", "new note"]):
            # Extract title and content
            title_match = re.search(r'titled?\s+["\']?([^"\']+)["\']?', message, re.IGNORECASE)
            content_match = re.search(r'content\s+["\']?([^"\']+)["\']?', message, re.IGNORECASE)
            
            title = title_match.group(1).strip() if title_match else "Untitled"
            content = content_match.group(1).strip() if content_match else "No content"
            
            # Also handle simpler patterns like "Create a note about X"
            if not content_match and "about" in message_lower:
                about_match = re.search(r'about\s+(.+)', message, re.IGNORECASE)
                if about_match:
                    content = about_match.group(1).strip()
            
            return {
                "tool": "create_note",
                "arguments": {"title": title, "content": content, "tags": []}
            }
        
        # List notes
        elif any(word in message_lower for word in ["list", "show all", "get all", "display"]) and "note" in message_lower:
            return {
                "tool": "list_notes",
                "arguments": {}
            }
        
        # Update note
        elif any(word in message_lower for word in ["update", "edit", "modify", "change"]) and "note" in message_lower:
            id_match = re.search(r'note\s+(\d+)', message, re.IGNORECASE)
            content_match = re.search(r'(?:content|to)\s+["\']?([^"\']+)["\']?', message, re.IGNORECASE)
            
            if id_match:
                args = {"note_id": id_match.group(1)}
                if content_match:
                    args["content"] = content_match.group(1).strip()
                return {
                    "tool": "update_note",
                    "arguments": args
                }
        
        # Get specific note
        elif any(word in message_lower for word in ["get note", "show note", "view note", "note "]):
            # Extract note ID
            id_match = re.search(r'note\s+(\d+)', message, re.IGNORECASE)
            if id_match:
                return {
                    "tool": "get_note",
                    "arguments": {"note_id": id_match.group(1)}
                }
        
        return None
    
    def generate_response(self, message: str, tool_result: str = None) -> str:
        """Generate a natural language response"""
        message_lower = message.lower()
        
        if tool_result:
            # Response after tool execution
            if "create" in message_lower:
                return f"I've successfully created the note for you! {tool_result}"
            elif "list" in message_lower:
                return f"Here are all your notes:\n{tool_result}"
            elif "get" in message_lower or "show" in message_lower:
                return f"Here's the note you requested:\n{tool_result}"
            elif "update" in message_lower:
                return f"I've updated the note: {tool_result}"
            elif "delete" in message_lower:
                return f"The note has been deleted: {tool_result}"
            else:
                return f"Operation completed: {tool_result}"
        else:
            # Initial greeting or unclear intent
            if any(word in message_lower for word in ["hello", "hi", "hey", "help"]):
                return """Hello! I'm your AI assistant with access to a notes management system. I can help you:
- Create notes: "Create a note titled X with content Y"
- List notes: "List all notes"
- Get a note: "Get note 1"
- Update a note: "Update note 1 to have content Z"
- Delete a note: "Delete note 1"

What would you like to do?"""
            else:
                return "I'm not sure what you'd like me to do. Could you please rephrase? You can ask me to create, list, get, update, or delete notes."


class LLMAgent:
    def __init__(self, api_key: str = None):
        # Use mock LLM (no API key needed)
        self.llm = MockLLM()
        self.policy_engine = PolicyEngine()
        self.conversation_history = []
    
    def chat(self, user_message: str, session_id: str = "default") -> Dict[str, Any]:
        """Process user message with tool-use loop"""
        conversation_log = []
        
        # Add user message to history
        self.conversation_history.append({
            "role": "user",
            "content": user_message
        })
        conversation_log.append({
            "phase": "User Prompt",
            "content": user_message,
            "status": "done"
        })
        
        # Parse user intent and determine tool to use
        tool_call = self.llm._parse_user_intent(user_message)
        
        if not tool_call:
            # No tool needed, just respond
            response = self.llm.generate_response(user_message)
            conversation_log.append({
                "phase": "Final Response",
                "content": response,
                "status": "done"
            })
            
            self.conversation_history.append({
                "role": "assistant",
                "content": response
            })
            
            return {
                "status": "completed",
                "response": response,
                "conversation_log": conversation_log
            }
        
        # LLM wants to use a tool
        tool_name = tool_call["tool"]
        arguments = tool_call["arguments"]
        
        conversation_log.append({
            "phase": "Tool Selected",
            "content": f"Tool: {tool_name}, Args: {json.dumps(arguments)}",
            "status": "done"
        })
        
        # Policy evaluation
        policy_result = self.policy_engine.evaluate(
            tool_name=tool_name,
            arguments=arguments,
            session_id=session_id
        )
        
        conversation_log.append({
            "phase": "Policy Evaluation",
            "content": f"Decision: {policy_result['action']}, Reason: {policy_result.get('reason', '')}",
            "status": "done" if policy_result["action"] == "allow" else "warning"
        })
        
        if policy_result["action"] == "block":
            # Tool blocked by policy
            tool_result = f"Tool {tool_name} was blocked by security policy: {policy_result.get('reason', 'Policy violation')}"
            conversation_log.append({
                "phase": "Tool Execution",
                "content": tool_result,
                "status": "warning"
            })
            
            response = f"I cannot complete that action. {tool_result}"
        
        elif policy_result["action"] == "require_approval":
            # Tool requires human approval
            return {
                "status": "pending_approval",
                "tool": tool_name,
                "arguments": arguments,
                "approval_id": policy_result.get("approval_id"),
                "message": f"Tool {tool_name} requires human approval",
                "conversation_log": conversation_log
            }
        
        else:
            # Execute tool
            try:
                tool_result = mcp_client.call_tool(tool_name, arguments)
                conversation_log.append({
                    "phase": "Tool Execution",
                    "content": f"Result: {tool_result}",
                    "status": "done"
                })
                
                # Generate natural language response
                response = self.llm.generate_response(user_message, tool_result)
                
            except Exception as e:
                tool_result = f"Error executing tool: {str(e)}"
                conversation_log.append({
                    "phase": "Tool Execution",
                    "content": tool_result,
                    "status": "warning"
                })
                response = f"I encountered an error: {tool_result}"
        
        conversation_log.append({
            "phase": "Final Response",
            "content": response,
            "status": "done"
        })
        
        # Add assistant response to history
        self.conversation_history.append({
            "role": "assistant",
            "content": response
        })
        
        return {
            "status": "completed",
            "response": response,
            "conversation_log": conversation_log
        }


# Global agent instance
agent = None

def get_agent():
    global agent
    if agent is None:
        agent = LLMAgent()
    return agent
