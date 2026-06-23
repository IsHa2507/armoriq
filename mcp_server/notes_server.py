#!/usr/bin/env python3
"""
Custom MCP Server - Simple Notes Manager
Exposes CRUD operations for notes as MCP tools
"""
import json
import sys
from datetime import datetime
from typing import Any


class NotesDatabase:
    def __init__(self):
        self.notes = {}
        self.next_id = 1
    
    def create_note(self, title: str, content: str, tags: list = None) -> dict:
        note_id = str(self.next_id)
        self.next_id += 1
        note = {
            "id": note_id,
            "title": title,
            "content": content,
            "tags": tags or [],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        self.notes[note_id] = note
        return note
    
    def get_note(self, note_id: str) -> dict:
        return self.notes.get(note_id)
    
    def list_notes(self, tag: str = None) -> list:
        notes = list(self.notes.values())
        if tag:
            notes = [n for n in notes if tag in n.get("tags", [])]
        return notes
    
    def update_note(self, note_id: str, title: str = None, content: str = None, tags: list = None) -> dict:
        note = self.notes.get(note_id)
        if not note:
            return None
        if title:
            note["title"] = title
        if content:
            note["content"] = content
        if tags is not None:
            note["tags"] = tags
        note["updated_at"] = datetime.now().isoformat()
        return note
    
    def delete_note(self, note_id: str) -> bool:
        if note_id in self.notes:
            del self.notes[note_id]
            return True
        return False


db = NotesDatabase()


def send_response(response: dict):
    """Send JSON-RPC response to stdout"""
    print(json.dumps(response), flush=True)


def handle_request(request: dict):
    """Handle incoming JSON-RPC request"""
    method = request.get("method")
    params = request.get("params", {})
    req_id = request.get("id")
    
    try:
        if method == "initialize":
            send_response({
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {}
                    },
                    "serverInfo": {
                        "name": "notes-mcp-server",
                        "version": "1.0.0"
                    }
                }
            })
        
        elif method == "tools/list":
            send_response({
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "tools": [
                        {
                            "name": "create_note",
                            "description": "Create a new note with title and content",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "title": {"type": "string", "description": "Note title"},
                                    "content": {"type": "string", "description": "Note content"},
                                    "tags": {"type": "array", "items": {"type": "string"}, "description": "Optional tags"}
                                },
                                "required": ["title", "content"]
                            }
                        },
                        {
                            "name": "get_note",
                            "description": "Get a note by its ID",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "note_id": {"type": "string", "description": "The note ID"}
                                },
                                "required": ["note_id"]
                            }
                        },
                        {
                            "name": "list_notes",
                            "description": "List all notes, optionally filtered by tag",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "tag": {"type": "string", "description": "Optional tag to filter by"}
                                }
                            }
                        },
                        {
                            "name": "update_note",
                            "description": "Update an existing note",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "note_id": {"type": "string", "description": "The note ID"},
                                    "title": {"type": "string", "description": "New title"},
                                    "content": {"type": "string", "description": "New content"},
                                    "tags": {"type": "array", "items": {"type": "string"}}
                                },
                                "required": ["note_id"]
                            }
                        },
                        {
                            "name": "delete_note",
                            "description": "Delete a note by its ID",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "note_id": {"type": "string", "description": "The note ID to delete"}
                                },
                                "required": ["note_id"]
                            }
                        }
                    ]
                }
            })
        
        elif method == "tools/call":
            tool_name = params.get("name")
            arguments = params.get("arguments", {})
            
            result = None
            if tool_name == "create_note":
                result = db.create_note(
                    title=arguments["title"],
                    content=arguments["content"],
                    tags=arguments.get("tags", [])
                )
            elif tool_name == "get_note":
                result = db.get_note(arguments["note_id"])
                if not result:
                    raise Exception(f"Note {arguments['note_id']} not found")
            elif tool_name == "list_notes":
                result = db.list_notes(tag=arguments.get("tag"))
            elif tool_name == "update_note":
                result = db.update_note(
                    note_id=arguments["note_id"],
                    title=arguments.get("title"),
                    content=arguments.get("content"),
                    tags=arguments.get("tags")
                )
                if not result:
                    raise Exception(f"Note {arguments['note_id']} not found")
            elif tool_name == "delete_note":
                success = db.delete_note(arguments["note_id"])
                if not success:
                    raise Exception(f"Note {arguments['note_id']} not found")
                result = {"success": True, "message": f"Note {arguments['note_id']} deleted"}
            else:
                raise Exception(f"Unknown tool: {tool_name}")
            
            send_response({
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(result, indent=2)
                        }
                    ]
                }
            })
        
        else:
            send_response({
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {
                    "code": -32601,
                    "message": f"Method not found: {method}"
                }
            })
    
    except Exception as e:
        send_response({
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {
                "code": -32603,
                "message": str(e)
            }
        })


def main():
    """Main loop - read JSON-RPC requests from stdin"""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
            handle_request(request)
        except json.JSONDecodeError:
            send_response({
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32700,
                    "message": "Parse error"
                }
            })


if __name__ == "__main__":
    main()
