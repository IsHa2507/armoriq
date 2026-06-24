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

    # ── filename / path extractor ─────────────────────────────────────────
    # Matches things like: README.md  hello.txt  path/to/file.py  .env
    _FILE_PATTERN = re.compile(
        r"[\"']?([\w./\-]+\.[\w]+)[\"']?",
        re.IGNORECASE,
    )
    # Matches any word that looks like a path even without an extension (e.g. "src/main")
    _PATH_PATTERN = re.compile(
        r"[\"']?([\w./\-]+)[\"']?",
        re.IGNORECASE,
    )

    @staticmethod
    def _extract_path(message: str, require_extension: bool = False) -> Optional[str]:
        """
        Pull the first filename-like token out of a message.

        Strategy (in order):
        1. Quoted string:  "README.md"  or  'test.txt'
        2. Token with extension:  README.md  test.txt  src/utils.py  .env
        3. Any path token (if require_extension is False)

        Returns None if nothing plausible is found.
        """
        # 1. Explicit quotes
        quoted = re.search(r'["\']([^"\']+)["\']', message)
        if quoted:
            return quoted.group(1).strip()

        # 2a. Dotfile (e.g. .env, .gitignore, .bashrc) — no extension needed
        dotfile = re.search(r'(?<!\S)(\.[a-zA-Z][a-zA-Z0-9_\-]{0,30})\b', message)
        if dotfile:
            return dotfile.group(1).strip()

        # 2b. Token with a dot-extension:  README.md  test.txt  src/utils.py
        ext_match = re.search(r'(?<!\w)(\.?[\w./\-]+\.[a-zA-Z0-9]{1,10})\b', message)
        if ext_match:
            return ext_match.group(1).strip()

        # 3. Any path token (only when extension not required)
        if not require_extension:
            stop = {"in", "of", "the", "a", "an", "to", "at", "for", "and",
                    "if", "is", "it", "on", "from", "by", "be", "with", "that",
                    "there", "current", "directory", "dir", "files", "file",
                    "project", "root", "here"}
            for tok in message.split():
                tok_clean = tok.strip("?.,!:;\"'")
                if tok_clean.lower() not in stop and len(tok_clean) > 1:
                    if "/" in tok_clean or "." in tok_clean:
                        return tok_clean
        return None

    def _parse_user_intent(self, message: str) -> Optional[Dict[str, Any]]:
        """
        Deterministically map a natural-language message to a tool + arguments.

        Returns {"tool": str, "arguments": dict} or None.

        ORDER IS IMPORTANT:
          Filesystem intents that share surface-level keywords with note intents
          (create, delete, read, list) are checked FIRST so they win.
        """
        msg = message.lower()

        logger.debug("[AGENT] Parsing intent | message=%.120s", message)

        # ══════════════════════════════════════════════════════════════════
        # FILESYSTEM INTENTS  (must come before notes to avoid ambiguity)
        # ══════════════════════════════════════════════════════════════════

        # ── fs_file_exists ────────────────────────────────────────────────
        # Triggers: "check if X exists", "does X exist", "is X present",
        #           "exists X", "file exists", "check file X"
        _exists_trigger = bool(re.search(
            r"\b(check\s+if|does\b.+\bexist|is\b.+\bpresent|"
            r"exist[s]?\b|check\s+file|file\s+exist[s]?|is\s+there\s+a)\b",
            msg,
        ))
        if _exists_trigger:
            path = self._extract_path(message) or "."
            logger.debug("[AGENT] Parsed intent | tool=fs_file_exists path=%s", path)
            return {"tool": "fs_file_exists", "arguments": {"path": path}}

        # ── fs_delete_file ────────────────────────────────────────────────
        # "delete file X", "remove file X", "erase file X"
        # Kept before generic delete/remove so "delete file" wins over delete_note
        if any(w in msg for w in ("delete file", "remove file", "erase file",
                                   "rm file", "unlink")):
            path = self._extract_path(message, require_extension=True) or "output.txt"
            logger.debug("[AGENT] Parsed intent | tool=fs_delete_file path=%s", path)
            return {"tool": "fs_delete_file", "arguments": {"path": path}}

        # ── fs_write_file ─────────────────────────────────────────────────
        # "write file X", "create file X", "save file X", "make file X"
        # "write X with content Y", "save to X"
        _write_trigger = any(w in msg for w in (
            "write file", "create file", "save file", "make file",
            "write to file", "new file", "create a file",
        ))
        if _write_trigger:
            path = self._extract_path(message, require_extension=True) or "output.txt"
            # Content: text after "with content", "content:", ":", or "containing"
            content_m = re.search(
                r"(?:with\s+content|content[:\s]|containing|:\s*)(.+)$",
                message,
                re.IGNORECASE,
            )
            content = content_m.group(1).strip() if content_m else ""
            logger.debug("[AGENT] Parsed intent | tool=fs_write_file path=%s content=%.40s",
                         path, content)
            return {"tool": "fs_write_file", "arguments": {"path": path, "content": content}}

        # ── fs_list_directory ─────────────────────────────────────────────
        # "list files [in X]", "show files", "ls [X]", "what files",
        # "current directory", "project root", "list directory", "show directory"
        _list_trigger = bool(re.search(
            r"\b(list\s+files|show\s+files|ls\b|what\s+files|"
            r"list\s+dir(ectory)?|show\s+dir(ectory)?|"
            r"current\s+dir(ectory)?|project\s+root|"
            r"what['']?s\s+in|what\s+is\s+in|contents?\s+of\s+dir)\b",
            msg,
        ))
        if _list_trigger:
            # Path after "in", "of", "directory", "dir" — but not stop-words
            _stop = {"the", "a", "an", "current", "this", "my", "our"}
            path_m = re.search(
                r"(?:in|of|directory|dir)\s+([\"']?[\w./\-]+[\"']?)",
                message,
                re.IGNORECASE,
            )
            if path_m:
                candidate = path_m.group(1).strip("\"'")
                path = "." if candidate.lower() in _stop else candidate
            else:
                path = "."
            logger.debug("[AGENT] Parsed intent | tool=fs_list_directory path=%s", path)
            return {"tool": "fs_list_directory", "arguments": {"path": path}}

        # ── fs_read_file ──────────────────────────────────────────────────
        # "read X", "open X", "show X", "cat X", "display X", "print X",
        # "show contents of X", "read the file X"
        # Key improvement: allow the file-like token to appear ANYWHERE,
        # not just after the literal word "file".
        _read_trigger = bool(re.search(
            r"\b(read|open|show|cat|display|print|view|see|get)\b",
            msg,
        )) and (
            # Must reference something file-like (has extension or explicit "file" keyword)
            bool(re.search(r"\b[\w./\-]+\.[a-zA-Z0-9]{1,10}\b", msg))
            or "file" in msg
            or "content" in msg
        )
        if _read_trigger:
            path = self._extract_path(message, require_extension=True) or "output.txt"
            logger.debug("[AGENT] Parsed intent | tool=fs_read_file path=%s", path)
            return {"tool": "fs_read_file", "arguments": {"path": path}}

        # ══════════════════════════════════════════════════════════════════
        # NOTES INTENTS
        # ══════════════════════════════════════════════════════════════════

        # ── delete_note ───────────────────────────────────────────────────
        if any(w in msg for w in ("delete", "remove", "erase")):
            m = re.search(r"(?:note\s+)?(\d+)", message, re.IGNORECASE)
            if m:
                logger.debug("[AGENT] Parsed intent | tool=delete_note note_id=%s", m.group(1))
                return {"tool": "delete_note", "arguments": {"note_id": m.group(1)}}

        # ── create_note ───────────────────────────────────────────────────
        if any(w in msg for w in ("create", "make", "add", "new note")):
            title_m   = re.search(r"titled?\s+[\"']?([^\"']+)[\"']?", message, re.IGNORECASE)
            content_m = re.search(r"content\s+[\"']?([^\"']+)[\"']?", message, re.IGNORECASE)
            title   = title_m.group(1).strip()   if title_m   else "Untitled"
            content = content_m.group(1).strip() if content_m else "No content"
            if not content_m:
                about_m = re.search(r"about\s+(.+)", message, re.IGNORECASE)
                if about_m:
                    content = about_m.group(1).strip()
            logger.debug("[AGENT] Parsed intent | tool=create_note title=%s", title)
            return {"tool": "create_note", "arguments": {"title": title, "content": content, "tags": []}}

        # ── list_notes ────────────────────────────────────────────────────
        if any(w in msg for w in ("list", "show all", "get all", "display")) and "note" in msg:
            logger.debug("[AGENT] Parsed intent | tool=list_notes")
            return {"tool": "list_notes", "arguments": {}}

        # ── update_note ───────────────────────────────────────────────────
        if any(w in msg for w in ("update", "edit", "modify", "change")) and "note" in msg:
            id_m      = re.search(r"note\s+(\d+)", message, re.IGNORECASE)
            content_m = re.search(r"(?:content|to)\s+[\"']?([^\"']+)[\"']?", message, re.IGNORECASE)
            if id_m:
                args: Dict[str, Any] = {"note_id": id_m.group(1)}
                if content_m:
                    args["content"] = content_m.group(1).strip()
                logger.debug("[AGENT] Parsed intent | tool=update_note note_id=%s", id_m.group(1))
                return {"tool": "update_note", "arguments": args}

        # ── get_note ──────────────────────────────────────────────────────
        if any(w in msg for w in ("get note", "show note", "view note", "note ")):
            id_m = re.search(r"note\s+(\d+)", message, re.IGNORECASE)
            if id_m:
                logger.debug("[AGENT] Parsed intent | tool=get_note note_id=%s", id_m.group(1))
                return {"tool": "get_note", "arguments": {"note_id": id_m.group(1)}}

        logger.debug("[AGENT] No intent matched | message=%.120s", message)
        return None

    def generate_response(self, message: str, tool_result: str = None) -> str:
        msg = message.lower()
        if tool_result:
            # ── notes ──────────────────────────────────────────────────────
            if any(w in msg for w in ("create_note", "create note", "make note",
                                       "add note", "new note")) and "file" not in msg:
                return f"I've successfully created the note for you! {tool_result}"
            if "list" in msg and "note" in msg and "file" not in msg:
                return f"Here are all your notes:\n{tool_result}"
            if ("get" in msg or "show" in msg) and "note" in msg and "file" not in msg:
                return f"Here's the note you requested:\n{tool_result}"
            if ("update" in msg or "edit" in msg) and "note" in msg:
                return f"I've updated the note: {tool_result}"
            if ("delete" in msg or "remove" in msg) and "note" in msg:
                return f"The note has been deleted: {tool_result}"
            # ── filesystem ─────────────────────────────────────────────────
            if any(w in msg for w in ("write file", "create file", "save file",
                                       "make file", "new file")):
                return f"File written successfully:\n{tool_result}"
            if any(w in msg for w in ("read", "open", "show", "cat", "display",
                                       "print", "view", "see", "get")) and (
                bool(re.search(r'\b[\w./\-]+\.[a-zA-Z0-9]{1,10}\b', msg)) or "file" in msg
            ):
                return f"Here is the file content:\n{tool_result}"
            if any(w in msg for w in ("list files", "show files", "list dir",
                                       "list directory", "current directory",
                                       "project root", "ls ")):
                return f"Here are the directory contents:\n{tool_result}"
            if any(w in msg for w in ("exist", "present", "check")):
                return f"File existence check result:\n{tool_result}"
            if any(w in msg for w in ("delete file", "remove file", "erase file")):
                return f"File deleted:\n{tool_result}"
            return f"Operation completed:\n{tool_result}"
        if any(w in msg for w in ("hello", "hi", "hey", "help")):
            return (
                "Hello! I'm your AI assistant. I can manage notes and interact with "
                "the filesystem workspace.\n\n"
                "Notes:\n"
                "  Create note titled X with content Y\n"
                "  List all notes\n"
                "  Get note 1\n"
                "  Update note 1 to have content Z\n"
                "  Delete note 1\n\n"
                "Filesystem:\n"
                "  Read README.md\n"
                "  Check if README.md exists\n"
                "  List files in the current directory\n"
                "  Create file test.txt with content Hello\n"
                "  Delete file test.txt\n\n"
                "What would you like to do?"
            )
        return (
            "I'm not sure what you'd like me to do. Could you please rephrase?\n"
            "I can manage notes or work with files. Try: "
            "\"Read README.md\", \"List files\", or \"Create note titled X\"."
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
            logger.info("[AGENT] Parsed intent | result=none session=%s", session_id)
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

        logger.info(
            "[AGENT] Parsed intent | tool=%s args=%s session=%s",
            tool_name,
            json.dumps(arguments),
            session_id,
        )

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
