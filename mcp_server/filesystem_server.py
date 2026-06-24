#!/usr/bin/env python3
"""
Filesystem MCP Server — ArmorIQ second MCP server.

Exposes safe, sandboxed filesystem operations as MCP tools.
All paths are constrained to a configurable workspace root so the
agent cannot escape the sandbox.  Attempting to traverse outside the
root (via ../ etc.) raises a policy-level error before any I/O occurs.

Tools exposed
─────────────
  fs_read_file      Read the text content of a file.
  fs_write_file     Write / overwrite a file with new text content.
  fs_list_directory List files and sub-directories inside a directory.
  fs_file_exists    Check whether a path exists and return its type.
  fs_delete_file    Delete a file (directories are NOT deletable for safety).

All tool names are prefixed with "fs_" so they are distinct from the
notes-server tools and can be targeted by individual guardrail rules.

Transport: STDIO / JSON-RPC 2.0  (same as notes_server.py)
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# ── Sandbox configuration ─────────────────────────────────────────────────────
# Default workspace root is a dedicated scratch directory next to this file.
# Override with the MCP_FS_ROOT environment variable.

_DEFAULT_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fs_workspace")
WORKSPACE_ROOT = os.environ.get("MCP_FS_ROOT", _DEFAULT_ROOT)

# Create the workspace if it doesn't exist yet.
os.makedirs(WORKSPACE_ROOT, exist_ok=True)


# ── Sandbox helper ────────────────────────────────────────────────────────────

def _safe_path(relative: str) -> Path:
    """
    Resolve `relative` against WORKSPACE_ROOT and verify the result is
    still inside the sandbox.  Raises ValueError on path traversal attempts.
    """
    root = Path(WORKSPACE_ROOT).resolve()
    target = (root / relative).resolve()
    if not str(target).startswith(str(root)):
        raise ValueError(
            f"Path traversal rejected: '{relative}' resolves outside the workspace."
        )
    return target


# ── JSON-RPC helpers ──────────────────────────────────────────────────────────

def send_response(response: dict) -> None:
    print(json.dumps(response), flush=True)


def ok(req_id: Any, result: Any) -> None:
    send_response({"jsonrpc": "2.0", "id": req_id, "result": result})


def err(req_id: Any, code: int, message: str) -> None:
    send_response({
        "jsonrpc": "2.0",
        "id": req_id,
        "error": {"code": code, "message": message},
    })


def text_result(req_id: Any, text: str) -> None:
    ok(req_id, {"content": [{"type": "text", "text": text}]})


# ── Tool implementations ──────────────────────────────────────────────────────

def tool_fs_read_file(args: dict, req_id: Any) -> None:
    path = _safe_path(args["path"])
    if not path.exists():
        raise FileNotFoundError(f"File not found: {args['path']}")
    if not path.is_file():
        raise IsADirectoryError(f"Path is a directory, not a file: {args['path']}")
    content = path.read_text(encoding="utf-8", errors="replace")
    text_result(req_id, json.dumps({
        "path": str(args["path"]),
        "content": content,
        "size_bytes": path.stat().st_size,
        "last_modified": datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
    }, indent=2))


def tool_fs_write_file(args: dict, req_id: Any) -> None:
    path = _safe_path(args["path"])
    path.parent.mkdir(parents=True, exist_ok=True)
    existed = path.exists()
    path.write_text(args["content"], encoding="utf-8")
    text_result(req_id, json.dumps({
        "path": str(args["path"]),
        "action": "updated" if existed else "created",
        "size_bytes": path.stat().st_size,
        "timestamp": datetime.now().isoformat(),
    }, indent=2))


def tool_fs_list_directory(args: dict, req_id: Any) -> None:
    path = _safe_path(args.get("path", "."))
    if not path.exists():
        raise FileNotFoundError(f"Directory not found: {args.get('path', '.')}")
    if not path.is_dir():
        raise NotADirectoryError(f"Path is a file, not a directory: {args.get('path', '.')}")

    entries = []
    for entry in sorted(path.iterdir()):
        stat = entry.stat()
        entries.append({
            "name": entry.name,
            "type": "directory" if entry.is_dir() else "file",
            "size_bytes": stat.st_size if entry.is_file() else None,
            "last_modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        })
    text_result(req_id, json.dumps({
        "path": str(args.get("path", ".")),
        "entries": entries,
        "total": len(entries),
    }, indent=2))


def tool_fs_file_exists(args: dict, req_id: Any) -> None:
    path = _safe_path(args["path"])
    exists = path.exists()
    ftype = None
    if exists:
        ftype = "directory" if path.is_dir() else "file"
    text_result(req_id, json.dumps({
        "path": str(args["path"]),
        "exists": exists,
        "type": ftype,
    }, indent=2))


def tool_fs_delete_file(args: dict, req_id: Any) -> None:
    path = _safe_path(args["path"])
    if not path.exists():
        raise FileNotFoundError(f"File not found: {args['path']}")
    if path.is_dir():
        raise IsADirectoryError(
            f"'{args['path']}' is a directory. Only files can be deleted via this tool."
        )
    path.unlink()
    text_result(req_id, json.dumps({
        "path": str(args["path"]),
        "deleted": True,
        "timestamp": datetime.now().isoformat(),
    }, indent=2))


# ── Tool dispatch table ───────────────────────────────────────────────────────

TOOLS = {
    "fs_read_file":      tool_fs_read_file,
    "fs_write_file":     tool_fs_write_file,
    "fs_list_directory": tool_fs_list_directory,
    "fs_file_exists":    tool_fs_file_exists,
    "fs_delete_file":    tool_fs_delete_file,
}

TOOL_SCHEMAS = [
    {
        "name": "fs_read_file",
        "description": "Read the text content of a file inside the agent workspace.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative path to the file inside the workspace.",
                }
            },
            "required": ["path"],
        },
    },
    {
        "name": "fs_write_file",
        "description": "Write or overwrite a file with new text content inside the agent workspace.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative path to the file (created if it does not exist).",
                },
                "content": {
                    "type": "string",
                    "description": "The text content to write.",
                },
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "fs_list_directory",
        "description": "List files and subdirectories inside a directory in the agent workspace.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative path to the directory. Defaults to workspace root.",
                }
            },
        },
    },
    {
        "name": "fs_file_exists",
        "description": "Check whether a path exists in the agent workspace and return its type.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative path to check.",
                }
            },
            "required": ["path"],
        },
    },
    {
        "name": "fs_delete_file",
        "description": "Delete a file from the agent workspace. Directories cannot be deleted.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative path to the file to delete.",
                }
            },
            "required": ["path"],
        },
    },
]


# ── Request handler ───────────────────────────────────────────────────────────

def handle_request(request: dict) -> None:
    method = request.get("method", "")
    params = request.get("params", {})
    req_id = request.get("id")

    try:
        if method == "initialize":
            ok(req_id, {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {
                    "name": "filesystem-mcp-server",
                    "version": "1.0.0",
                    "workspace_root": WORKSPACE_ROOT,
                },
            })

        elif method == "tools/list":
            ok(req_id, {"tools": TOOL_SCHEMAS})

        elif method == "tools/call":
            tool_name = params.get("name")
            arguments = params.get("arguments", {})

            if tool_name not in TOOLS:
                raise ValueError(f"Unknown tool: {tool_name}")

            TOOLS[tool_name](arguments, req_id)

        else:
            err(req_id, -32601, f"Method not found: {method}")

    except (FileNotFoundError, IsADirectoryError, NotADirectoryError, ValueError) as exc:
        err(req_id, -32603, str(exc))
    except Exception as exc:
        err(req_id, -32603, f"Internal error: {exc}")


# ── Main loop ─────────────────────────────────────────────────────────────────

def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
            handle_request(request)
        except json.JSONDecodeError:
            err(None, -32700, "Parse error")


if __name__ == "__main__":
    main()
