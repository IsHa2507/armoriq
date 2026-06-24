"""
LLM Agent — prompt → tool decision → policy enforcement → MCP execution.

Execution flow
--------------
User Prompt
  └─► MockLLM._parse_user_intent()   (determines tool + arguments)
        └─► PolicyEngine.evaluate()  (enforce guardrails)
              ├─ ALLOW  ──► mcp_client.call_tool()  ──► record result ──► LLM response
              ├─ BLOCK  ──► structured error response (no tool executed)
              └─ REQUIRE_APPROVAL ──► return pending_approval status
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional

from .mcp_client import mcp_client
from policy.engine import policy_engine   # single canonical instance

logger = logging.getLogger("agent.llm_agent")


# ── Mock LLM ──────────────────────────────────────────────────────────────────

class MockLLM:
    """
    Deterministic intent parser that mimics LLM tool-use decisions.
    Swap this for a real LLM (OpenAI / Gemini) without changing the
    agent loop below.
    """

    def _parse_user_intent(self, message: str) -> Optional[Dict[str, Any]]:
        """Return {"tool": str, "arguments": dict} or None if no tool needed."""
        msg = message.lower()

        # ── delete (check before other operations) ────────────────────────
        if any(w in msg for w in ("delete", "remove", "erase")):
            m = re.search(r"(?:note\s+)?(\d+)", message, re.IGNORECASE)
            if m:
                return {"tool": "delete_note", "arguments": {"note_id": m.group(1)}}

        # ── create ────────────────────────────────────────────────────────
        if any(w in msg for w in ("create", "make", "add", "new note")):
            title_m = re.search(r"titled?\s+[\"']?([^\"']+)[\"']?", message, re.IGNORECASE)
            content_m = re.search(r"content\s+[\"']?([^\"']+)[\"']?", message, re.IGNORECASE)
            title = title_m.group(1).strip() if title_m else "Untitled"
            content = content_m.group(1).strip() if content_m else "No content"
            if not content_m:
                about_m = re.search(r"about\s+(.+)", message, re.IGNORECASE)
                if about_m:
                    content = about_m.group(1).strip()
            return {
                "tool": "create_note",
                "arguments": {"title": title, "content": content, "tags": []},
            }

        # ── list ──────────────────────────────────────────────────────────
        if any(w in msg for w in ("list", "show all", "get all", "display")) and "note" in msg:
            return {"tool": "list_notes", "arguments": {}}

        # ── update ────────────────────────────────────────────────────────
        if any(w in msg for w in ("update", "edit", "modify", "change")) and "note" in msg:
            id_m = re.search(r"note\s+(\d+)", message, re.IGNORECASE)
            content_m = re.search(r"(?:content|to)\s+[\"']?([^\"']+)[\"']?", message, re.IGNORECASE)
            if id_m:
                args: Dict[str, Any] = {"note_id": id_m.group(1)}
                if content_m:
                    args["content"] = content_m.group(1).strip()
                return {"tool": "update_note", "arguments": args}

        # ── get note by id ────────────────────────────────────────────────
        if any(w in msg for w in ("get note", "show note", "view note", "note ")):
            id_m = re.search(r"note\s+(\d+)", message, re.IGNORECASE)
            if id_m:
                return {"tool": "get_note", "arguments": {"note_id": id_m.group(1)}}

        # ── filesystem: write file ────────────────────────────────────────
        if any(w in msg for w in ("write file", "create file", "save file", "write to file")):
            path_m = re.search(r"(?:file\s+|to\s+)[\"']?([\w./\-]+\.\w+)[\"']?", message, re.IGNORECASE)
            content_m = re.search(r"(?:content|with|:)\s+[\"']?(.+)[\"']?$", message, re.IGNORECASE)
            path = path_m.group(1).strip() if path_m else "output.txt"
            content = content_m.group(1).strip() if content_m else ""
            return {"tool": "fs_write_file", "arguments": {"path": path, "content": content}}

        # ── filesystem: read file ─────────────────────────────────────────
        if any(w in msg for w in ("read file", "show file", "open file", "get file", "cat file")):
            path_m = re.search(r"(?:file\s+)[\"']?([\w./\-]+)[\"']?", message, re.IGNORECASE)
            path = path_m.group(1).strip() if path_m else "output.txt"
            return {"tool": "fs_read_file", "arguments": {"path": path}}

        # ── filesystem: list directory ────────────────────────────────────
        if any(w in msg for w in ("list files", "list directory", "show directory",
                                   "list dir", "show dir", "ls ")):
            path_m = re.search(r"(?:directory|dir|in|of)\s+[\"']?([\w./\-]+)[\"']?",
                                message, re.IGNORECASE)
            path = path_m.group(1).strip() if path_m else "."
            return {"tool": "fs_list_directory", "arguments": {"path": path}}

        # ── filesystem: check file existence ──────────────────────────────
        if any(w in msg for w in ("file exists", "does file exist", "check file",
                                   "exists file")):
            path_m = re.search(r"(?:file\s+)[\"']?([\w./\-]+)[\"']?", message, re.IGNORECASE)
            path = path_m.group(1).strip() if path_m else "output.txt"
            return {"tool": "fs_file_exists", "arguments": {"path": path}}

        # ── filesystem: delete file ───────────────────────────────────────
        if any(w in msg for w in ("delete file", "remove file", "erase file")):
            path_m = re.search(r"(?:file\s+)[\"']?([\w./\-]+\.\w+)[\"']?", message, re.IGNORECASE)
            path = path_m.group(1).strip() if path_m else "output.txt"
            return {"tool": "fs_delete_file", "arguments": {"path": path}}

        return None

    def generate_response(self, message: str, tool_result: str = None) -> str:
        msg = message.lower()
        if tool_result:
            if "create" in msg and "file" not in msg:
                return f"I've successfully created the note for you! {tool_result}"
            if "list" in msg and "note" in msg:
                return f"Here are all your notes:\n{tool_result}"
            if ("get" in msg or "show" in msg) and "note" in msg:
                return f"Here's the note you requested:\n{tool_result}"
            if ("update" in msg or "edit" in msg) and "note" in msg:
                return f"I've updated the note: {tool_result}"
            if ("delete" in msg or "remove" in msg) and "note" in msg:
                return f"The note has been deleted: {tool_result}"
            # filesystem responses
            if "write file" in msg or "create file" in msg or "save file" in msg:
                return f"File written successfully:\n{tool_result}"
            if "read file" in msg or "show file" in msg or "open file" in msg:
                return f"Here is the file content:\n{tool_result}"
            if "list files" in msg or "list dir" in msg or "list directory" in msg:
                return f"Here are the directory contents:\n{tool_result}"
            if "file exists" in msg or "check file" in msg:
                return f"File existence check result:\n{tool_result}"
            if "delete file" in msg or "remove file" in msg:
                return f"File deleted:\n{tool_result}"
            return f"Operation completed: {tool_result}"
        if any(w in msg for w in ("hello", "hi", "hey", "help")):
            return (
                "Hello! I'm your AI assistant with access to a notes management system "
                "and a filesystem workspace. I can help you:\n"
                "Notes:\n"
                "  - Create notes: \"Create a note titled X with content Y\"\n"
                "  - List notes:   \"List all notes\"\n"
                "  - Get a note:   \"Get note 1\"\n"
                "  - Update a note:\"Update note 1 to have content Z\"\n"
                "  - Delete a note:\"Delete note 1\"\n\n"
                "Filesystem:\n"
                "  - Write file:   \"Write file hello.txt with content Hello World\"\n"
                "  - Read file:    \"Read file hello.txt\"\n"
                "  - List dir:     \"List files in .\"\n"
                "  - Check file:   \"Does file hello.txt exist?\"\n"
                "  - Delete file:  \"Delete file hello.txt\"\n\n"
                "What would you like to do?"
            )
        return (
            "I'm not sure what you'd like me to do. Could you please rephrase? "
            "I can manage notes or perform filesystem operations."
        )


# ── LLM Agent ─────────────────────────────────────────────────────────────────

class LLMAgent:
    def __init__(self, api_key: str = None):
        self.llm = MockLLM()
        self.conversation_history: List[Dict[str, Any]] = []

    def chat(self, user_message: str, session_id: str = "default") -> Dict[str, Any]:
        """
        Process a user message through the full pipeline:
        intent → policy evaluation → tool execution → natural language response.
        """
        conversation_log = []

        # ── 1. record user message ─────────────────────────────────────────
        self.conversation_history.append({"role": "user", "content": user_message})
        conversation_log.append({
            "phase": "User Prompt",
            "content": user_message,
            "status": "done",
        })
        logger.info("[AGENT] User message | session=%s message=%.120s", session_id, user_message)

        # ── 2. intent detection ────────────────────────────────────────────
        tool_call = self.llm._parse_user_intent(user_message)

        if not tool_call:
            response = self.llm.generate_response(user_message)
            conversation_log.append({
                "phase": "Final Response",
                "content": response,
                "status": "done",
            })
            self.conversation_history.append({"role": "assistant", "content": response})
            logger.info("[AGENT] No tool needed | session=%s", session_id)
            return {
                "status": "completed",
                "response": response,
                "conversation_log": conversation_log,
            }

        tool_name: str = tool_call["tool"]
        arguments: Dict[str, Any] = tool_call["arguments"]

        conversation_log.append({
            "phase": "Tool Selected",
            "content": f"Tool: {tool_name} | Args: {json.dumps(arguments)}",
            "status": "done",
        })
        logger.info(
            "[AGENT] Tool selected | session=%s tool=%s args=%s",
            session_id,
            tool_name,
            json.dumps(arguments),
        )

        # ── 3. policy evaluation ───────────────────────────────────────────
        decision = policy_engine.evaluate(
            tool_name=tool_name,
            arguments=arguments,
            session_id=session_id,
        )

        action = decision["action"]
        conversation_log.append({
            "phase": "Policy Evaluation",
            "content": (
                f"Decision: {action} | "
                f"Rule: {decision.get('rule_name') or 'N/A'} | "
                f"Reason: {decision.get('reason', '')}"
            ),
            "status": "done" if action == "allow" else "warning",
        })

        # ── 4a. blocked ────────────────────────────────────────────────────
        if action in ("block", "budget_exceeded"):
            reason = decision.get("reason", "Policy violation")
            tool_result_msg = (
                f"Tool '{tool_name}' was blocked by policy rule "
                f"'{decision.get('rule_name', 'unnamed')}': {reason}"
            )
            conversation_log.append({
                "phase": "Tool Execution",
                "content": tool_result_msg,
                "status": "blocked",
            })
            response = f"I cannot complete that action. {tool_result_msg}"
            conversation_log.append({
                "phase": "Final Response",
                "content": response,
                "status": "done",
            })
            self.conversation_history.append({"role": "assistant", "content": response})
            logger.warning(
                "[AGENT] Tool blocked | session=%s tool=%s rule=%s",
                session_id,
                tool_name,
                decision.get("rule_name"),
            )
            return {
                "status": "blocked",
                "response": response,
                "tool": tool_name,
                "policy_decision": decision,
                "conversation_log": conversation_log,
            }

        # ── 4b. approval required ──────────────────────────────────────────
        if action == "require_approval":
            approval_id = decision.get("approval_id")
            conversation_log.append({
                "phase": "Tool Execution",
                "content": f"Approval required. approval_id={approval_id}",
                "status": "pending",
            })
            logger.warning(
                "[AGENT] Approval required | session=%s tool=%s approval_id=%s",
                session_id,
                tool_name,
                approval_id,
            )
            return {
                "status": "pending_approval",
                "tool": tool_name,
                "arguments": arguments,
                "approval_id": approval_id,
                "message": f"Tool '{tool_name}' requires human approval before it can execute.",
                "policy_decision": decision,
                "conversation_log": conversation_log,
            }

        # ── 4c. allowed — execute tool ─────────────────────────────────────
        try:
            logger.info(
                "[AGENT] Executing tool | session=%s tool=%s", session_id, tool_name
            )
            raw_result = mcp_client.call_tool(tool_name, arguments)
            tool_result = str(raw_result)

            # Persist execution result back to the ToolCall audit record
            policy_engine.record_tool_result(
                session_id=session_id,
                tool_name=tool_name,
                result=tool_result,
                status="executed",
            )

            # Rough token estimate (1 token ≈ 4 chars) for budget tracking
            estimated_tokens = (len(user_message) + len(tool_result)) // 4
            policy_engine.record_token_usage(session_id=session_id, tokens=estimated_tokens)

            conversation_log.append({
                "phase": "Tool Execution",
                "content": f"Result: {tool_result}",
                "status": "done",
            })
            logger.info(
                "[AGENT] Tool executed | session=%s tool=%s result=%.120s",
                session_id,
                tool_name,
                tool_result,
            )

            response = self.llm.generate_response(user_message, tool_result)

        except Exception as exc:
            error_msg = f"Error executing tool '{tool_name}': {exc}"
            conversation_log.append({
                "phase": "Tool Execution",
                "content": error_msg,
                "status": "error",
            })
            logger.error(
                "[AGENT] Tool error | session=%s tool=%s error=%s",
                session_id,
                tool_name,
                exc,
            )
            response = f"I encountered an error: {error_msg}"

        # ── 5. final response ──────────────────────────────────────────────
        conversation_log.append({
            "phase": "Final Response",
            "content": response,
            "status": "done",
        })
        self.conversation_history.append({"role": "assistant", "content": response})

        return {
            "status": "completed",
            "response": response,
            "tool": tool_name,
            "policy_decision": decision,
            "conversation_log": conversation_log,
        }


# ── module-level singleton ────────────────────────────────────────────────────

_agent: Optional[LLMAgent] = None


def get_agent() -> LLMAgent:
    global _agent
    if _agent is None:
        _agent = LLMAgent()
    return _agent
