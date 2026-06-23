"""
MCP Client - Manages connections to MCP servers and tool discovery
"""
import json
import subprocess
import asyncio
from typing import Dict, List, Any, Optional
import threading


class MCPClient:
    def __init__(self):
        self.servers = {}
        self.tools = {}
        self.lock = threading.Lock()
    
    def add_server(self, name: str, command: str, args: List[str] = None):
        """Add and connect to an MCP server"""
        with self.lock:
            if name in self.servers:
                return
            
            try:
                # Start MCP server process
                process = subprocess.Popen(
                    [command] + (args or []),
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1
                )
                
                self.servers[name] = {
                    "process": process,
                    "command": command,
                    "args": args or [],
                    "status": "connected"
                }
                
                # Initialize and discover tools
                self._initialize_server(name)
                self._discover_tools(name)
                
            except Exception as e:
                print(f"Failed to connect to {name}: {e}")
                self.servers[name] = {
                    "status": "error",
                    "error": str(e)
                }
    
    def _send_request(self, server_name: str, method: str, params: dict = None) -> dict:
        """Send JSON-RPC request to MCP server"""
        server = self.servers.get(server_name)
        if not server or server["status"] != "connected":
            raise Exception(f"Server {server_name} not connected")
        
        process = server["process"]
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params or {}
        }
        
        try:
            # Send request
            process.stdin.write(json.dumps(request) + "\n")
            process.stdin.flush()
            
            # Read response
            response_line = process.stdout.readline()
            if not response_line:
                raise Exception("No response from server")
            
            response = json.loads(response_line)
            
            if "error" in response:
                raise Exception(response["error"]["message"])
            
            return response.get("result", {})
        
        except Exception as e:
            print(f"Error communicating with {server_name}: {e}")
            raise
    
    def _initialize_server(self, server_name: str):
        """Initialize MCP server"""
        try:
            result = self._send_request(server_name, "initialize", {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "armoriq-agent",
                    "version": "1.0.0"
                }
            })
            print(f"Initialized {server_name}: {result.get('serverInfo', {}).get('name')}")
        except Exception as e:
            print(f"Failed to initialize {server_name}: {e}")
    
    def _discover_tools(self, server_name: str):
        """Discover tools from MCP server"""
        try:
            result = self._send_request(server_name, "tools/list")
            tools = result.get("tools", [])
            
            for tool in tools:
                tool_name = tool["name"]
                self.tools[tool_name] = {
                    "server": server_name,
                    "name": tool_name,
                    "description": tool.get("description", ""),
                    "inputSchema": tool.get("inputSchema", {})
                }
            
            print(f"Discovered {len(tools)} tools from {server_name}")
        
        except Exception as e:
            print(f"Failed to discover tools from {server_name}: {e}")
    
    def get_all_tools(self) -> List[Dict[str, Any]]:
        """Get all discovered tools"""
        with self.lock:
            return list(self.tools.values())
    
    def call_tool(self, tool_name: str, arguments: dict) -> Any:
        """Execute a tool call"""
        with self.lock:
            if tool_name not in self.tools:
                raise Exception(f"Tool {tool_name} not found")
            
            tool = self.tools[tool_name]
            server_name = tool["server"]
            
            result = self._send_request(server_name, "tools/call", {
                "name": tool_name,
                "arguments": arguments
            })
            
            # Extract content from MCP response
            content = result.get("content", [])
            if content and len(content) > 0:
                return content[0].get("text", "")
            
            return result
    
    def get_tools_for_llm(self) -> List[Dict[str, Any]]:
        """Format tools for LLM function calling"""
        tools = []
        for tool_name, tool_info in self.tools.items():
            tools.append({
                "name": tool_name,
                "description": tool_info["description"],
                "parameters": tool_info["inputSchema"]
            })
        return tools
    
    def refresh_tools(self):
        """Rediscover tools from all servers"""
        with self.lock:
            self.tools = {}
            for server_name, server in self.servers.items():
                if server["status"] == "connected":
                    self._discover_tools(server_name)
    
    def get_server_status(self) -> Dict[str, Any]:
        """Get status of all connected servers"""
        with self.lock:
            return {
                name: {
                    "status": server["status"],
                    "command": server.get("command"),
                    "error": server.get("error")
                }
                for name, server in self.servers.items()
            }
    
    def close(self):
        """Close all server connections"""
        with self.lock:
            for server in self.servers.values():
                if "process" in server:
                    try:
                        server["process"].terminate()
                        server["process"].wait(timeout=5)
                    except:
                        server["process"].kill()


# Global MCP client instance
mcp_client = MCPClient()
