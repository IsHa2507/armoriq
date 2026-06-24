"""
MCP Client — manages STDIO connections to all registered MCP servers,
handles tool discovery, and dispatches tool-call requests via JSON-RPC 2.0.

Registration and discovery are logged at INFO level so server startup
and tool enumeration are always visible in the Django console.
"""

import json
import logging
import subprocess
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger("agent.mcp_client")


class MCPClient:
    """
    Thread-safe manager for one or more STDIO MCP servers.

    All public methods acquire self.lock so they are safe to call
    from Django request threads concurrently.
    """

    def __init__(self):
        # server_name → server metadata dict
        self.servers: Dict[str, Dict[str, Any]] = {}
        # tool_name → tool metadata dict (includes "server" key)
        self.tools: Dict[str, Dict[str, Any]] = {}
        self.lock = threading.Lock()

    # ── public API ────────────────────────────────────────────────────────────

    def add_server(self, name: str, command: str, args: List[str] = None) -> None:
        """
        Register and connect to an MCP server subprocess.

        Idempotent — calling add_server() for an already-registered server
        (by name) is a no-op.  On successful registration the server is
        initialised and its tools are discovered automatically.
        """
        with self.lock:
            if name in self.servers:
                logger.debug("[MCP] Server '%s' already registered — skipping.", name)
                return

            logger.info("[MCP] Registering server | name=%s command=%s args=%s",
                        name, command, args or [])
            try:
                process = subprocess.Popen(
                    [command] + (args or []),
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1,
                )
                self.servers[name] = {
                    "process":      process,
                    "command":      command,
                    "args":         args or [],
                    "status":       "connected",
                    "transport":    "STDIO",
                    "tool_count":   0,
                    "registered_at": datetime.now(tz=timezone.utc).isoformat(),
                    "last_heartbeat": None,
                    "error":        None,
                }
                logger.info("[MCP] Server process started | name=%s pid=%s",
                            name, process.pid)

                server_info = self._initialize_server(name)
                tool_count  = self._discover_tools(name)

                self.servers[name]["tool_count"]    = tool_count
                self.servers[name]["server_info"]   = server_info
                self.servers[name]["last_heartbeat"] = datetime.now(tz=timezone.utc).isoformat()
                logger.info("[MCP] Server ready | name=%s tools=%d info=%s",
                            name, tool_count, server_info)

            except Exception as exc:
                logger.error("[MCP] Failed to register server '%s': %s", name, exc)
                self.servers[name] = {
                    "status":       "error",
                    "command":      command,
                    "args":         args or [],
                    "transport":    "STDIO",
                    "tool_count":   0,
                    "registered_at": datetime.now(tz=timezone.utc).isoformat(),
                    "last_heartbeat": None,
                    "error":        str(exc),
                }

    def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """
        Execute a tool call via the server that owns it.

        IMPORTANT — this method is the SOLE path to MCP tool execution.
        It must only be called from two places:
          1. LLMAgent.chat()              — after policy_engine.evaluate() returns "allow"
          2. PolicyEngine.approve_and_execute() — after human approval

        Both callers are inside this repo and are the only legitimate call sites.
        """
        with self.lock:
            if tool_name not in self.tools:
                raise ValueError(f"Tool '{tool_name}' not found. "
                                 f"Available: {sorted(self.tools.keys())}")

            tool        = self.tools[tool_name]
            server_name = tool["server"]

            logger.info("[MCP] Executing tool | server=%s tool=%s args=%s",
                        server_name, tool_name, json.dumps(arguments))

            result = self._send_request(server_name, "tools/call", {
                "name":      tool_name,
                "arguments": arguments,
            })

            # Update heartbeat on successful call
            if server_name in self.servers:
                self.servers[server_name]["last_heartbeat"] = \
                    datetime.now(tz=timezone.utc).isoformat()

            # Extract text payload from MCP content envelope
            content = result.get("content", [])
            if content:
                text = content[0].get("text", "")
                logger.info("[MCP] Tool result | server=%s tool=%s result=%.120s",
                            server_name, tool_name, text)
                return text

            logger.info("[MCP] Tool result (raw) | server=%s tool=%s", server_name, tool_name)
            return result

    def get_all_tools(self) -> List[Dict[str, Any]]:
        """Return metadata for all discovered tools across all servers."""
        with self.lock:
            return list(self.tools.values())

    def get_tools_for_llm(self) -> List[Dict[str, Any]]:
        """Format tools for LLM function-calling APIs."""
        with self.lock:
            return [
                {
                    "name":        name,
                    "description": info["description"],
                    "parameters":  info["inputSchema"],
                }
                for name, info in self.tools.items()
            ]

    def get_server_status(self) -> Dict[str, Any]:
        """
        Return status metadata for all registered servers.

        Shape of each entry:
            {
                "status":         "connected" | "error",
                "transport":      "STDIO",
                "tool_count":     int,
                "tools":          [str, ...],
                "registered_at":  ISO-8601 str,
                "last_heartbeat": ISO-8601 str | None,
                "server_info":    dict | None,
                "error":          str | None,
            }
        """
        with self.lock:
            out: Dict[str, Any] = {}
            for name, srv in self.servers.items():
                out[name] = {
                    "status":         srv["status"],
                    "transport":      srv.get("transport", "STDIO"),
                    "tool_count":     srv.get("tool_count", 0),
                    "tools":          [
                        t for t, meta in self.tools.items()
                        if meta["server"] == name
                    ],
                    "registered_at":  srv.get("registered_at"),
                    "last_heartbeat": srv.get("last_heartbeat"),
                    "server_info":    srv.get("server_info"),
                    "command":        srv.get("command"),
                    "error":          srv.get("error"),
                }
            return out

    def refresh_tools(self) -> int:
        """
        Re-discover tools from all connected servers.
        Returns the total number of tools found.
        """
        with self.lock:
            self.tools = {}
            total = 0
            for name, srv in self.servers.items():
                if srv["status"] == "connected":
                    count = self._discover_tools(name)
                    srv["tool_count"] = count
                    total += count
                    logger.info("[MCP] Tool refresh | server=%s tools=%d", name, count)
            logger.info("[MCP] Refresh complete | total_tools=%d", total)
            return total

    def close(self) -> None:
        """Terminate all server subprocesses cleanly."""
        with self.lock:
            for name, srv in self.servers.items():
                if "process" in srv:
                    try:
                        srv["process"].terminate()
                        srv["process"].wait(timeout=5)
                        logger.info("[MCP] Server process terminated | name=%s", name)
                    except Exception:
                        try:
                            srv["process"].kill()
                        except Exception:
                            pass

    # ── private helpers ───────────────────────────────────────────────────────

    def _send_request(self, server_name: str, method: str,
                      params: Optional[Dict] = None) -> Dict:
        """Send a single JSON-RPC 2.0 request and return the result dict."""
        srv = self.servers.get(server_name)
        if not srv or srv["status"] != "connected":
            raise RuntimeError(f"Server '{server_name}' is not connected.")

        process = srv["process"]
        request = {
            "jsonrpc": "2.0",
            "id":      1,
            "method":  method,
            "params":  params or {},
        }
        raw = json.dumps(request)
        logger.debug("[MCP] → %s  %s", server_name, raw[:200])

        try:
            process.stdin.write(raw + "\n")
            process.stdin.flush()

            response_line = process.stdout.readline()
            if not response_line:
                raise RuntimeError(f"Server '{server_name}' closed its stdout unexpectedly.")

            logger.debug("[MCP] ← %s  %s", server_name, response_line.strip()[:200])
            response = json.loads(response_line)

            if "error" in response:
                raise RuntimeError(response["error"].get("message", "Unknown MCP error"))

            return response.get("result", {})

        except Exception as exc:
            logger.error("[MCP] Communication error | server=%s method=%s error=%s",
                         server_name, method, exc)
            raise

    def _initialize_server(self, server_name: str) -> Dict[str, Any]:
        """Send the MCP initialize handshake; return serverInfo dict."""
        try:
            result = self._send_request(server_name, "initialize", {
                "protocolVersion": "2024-11-05",
                "capabilities":    {},
                "clientInfo":      {"name": "armoriq-agent", "version": "1.0.0"},
            })
            info = result.get("serverInfo", {})
            logger.info("[MCP] Initialized | server=%s serverInfo=%s", server_name, info)
            return info
        except Exception as exc:
            logger.warning("[MCP] Initialize failed | server=%s error=%s", server_name, exc)
            return {}

    def _discover_tools(self, server_name: str) -> int:
        """
        Call tools/list on the server and register all discovered tools.
        Returns the count of tools discovered.
        """
        try:
            result = self._send_request(server_name, "tools/list")
            tools  = result.get("tools", [])
            for tool in tools:
                tool_name = tool["name"]
                self.tools[tool_name] = {
                    "server":      server_name,
                    "name":        tool_name,
                    "description": tool.get("description", ""),
                    "inputSchema": tool.get("inputSchema", {}),
                }
                logger.info("[MCP] Tool discovered | server=%s tool=%s",
                            server_name, tool_name)
            logger.info("[MCP] Discovery complete | server=%s tools=%d",
                        server_name, len(tools))
            return len(tools)
        except Exception as exc:
            logger.error("[MCP] Tool discovery failed | server=%s error=%s",
                         server_name, exc)
            return 0


# ── module-level singleton ────────────────────────────────────────────────────
mcp_client = MCPClient()
