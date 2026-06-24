"""
Management command: verify_mcp_servers

Performs a live end-to-end verification of both MCP servers and the
PolicyEngine integration.  Run with:

    python manage.py verify_mcp_servers

Exit code 0 = all tests passed.
Exit code 1 = one or more tests failed.
"""

import json
import sys
import textwrap
import traceback
from typing import Any, Dict, List, Tuple

from django.core.management.base import BaseCommand

# ── ANSI colour helpers ───────────────────────────────────────────────────────

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

PASS = f"{GREEN}✅ PASS{RESET}"
FAIL = f"{RED}❌ FAIL{RESET}"
INFO = f"{CYAN}ℹ {RESET}"


def header(text: str) -> str:
    bar = "─" * 68
    return f"\n{BOLD}{CYAN}{bar}{RESET}\n{BOLD} {text}{RESET}\n{BOLD}{CYAN}{bar}{RESET}"


def section(text: str) -> str:
    return f"\n{BOLD}{YELLOW}▶ {text}{RESET}"


class Command(BaseCommand):
    help = "Verify both MCP servers are connected and governed by PolicyEngine."

    def handle(self, *args: Any, **options: Any) -> None:
        results: List[Tuple[str, bool, str]] = []  # (label, passed, detail)

        self.stdout.write(header("ArmorIQ — MCP Server Verification Suite"))

        # ── Bootstrap ─────────────────────────────────────────────────────
        self.stdout.write(section("Bootstrapping MCP client…"))

        # Import triggers add_server() calls inside views module-load.
        # We re-use the same singleton the Django app uses.
        try:
            from agent.mcp_client import mcp_client  # noqa: F401 — triggers registration
            # Ensure both servers are registered (views may not have been imported yet)
            import os
            server_dir = os.path.join(
                os.path.dirname(__file__), "../../../../mcp_server"
            )
            notes_path = os.path.join(server_dir, "notes_server.py")
            fs_path    = os.path.join(server_dir, "filesystem_server.py")
            mcp_client.add_server("notes-server",      "python3", [notes_path])
            mcp_client.add_server("filesystem-server", "python3", [fs_path])
        except Exception as exc:
            self.stdout.write(f"{FAIL}  Bootstrap failed: {exc}")
            sys.exit(1)

        from agent.mcp_client import mcp_client
        from policy.engine    import policy_engine
        from policy.rules     import rule_store

        # ══════════════════════════════════════════════════════════════════
        # TEST 1 — Notes server connected
        # ══════════════════════════════════════════════════════════════════
        self.stdout.write(section("Test 1 — Notes server connected"))
        try:
            status = mcp_client.get_server_status()
            notes  = status.get("notes-server", {})
            ok     = notes.get("status") == "connected"
            detail = f"status={notes.get('status')}  tools={notes.get('tool_count', 0)}"
            results.append(("Notes server connected", ok, detail))
            self.stdout.write(f"  {PASS if ok else FAIL}  {detail}")
        except Exception as exc:
            results.append(("Notes server connected", False, str(exc)))
            self.stdout.write(f"  {FAIL}  {exc}")

        # ══════════════════════════════════════════════════════════════════
        # TEST 2 — Filesystem server connected
        # ══════════════════════════════════════════════════════════════════
        self.stdout.write(section("Test 2 — Filesystem server connected"))
        try:
            status = mcp_client.get_server_status()
            fsrv   = status.get("filesystem-server", {})
            ok     = fsrv.get("status") == "connected"
            detail = f"status={fsrv.get('status')}  tools={fsrv.get('tool_count', 0)}"
            results.append(("Filesystem server connected", ok, detail))
            self.stdout.write(f"  {PASS if ok else FAIL}  {detail}")
        except Exception as exc:
            results.append(("Filesystem server connected", False, str(exc)))
            self.stdout.write(f"  {FAIL}  {exc}")

        # ══════════════════════════════════════════════════════════════════
        # TEST 3 — Tool discovery — expected tools present
        # ══════════════════════════════════════════════════════════════════
        self.stdout.write(section("Test 3 — Tool discovery"))
        expected_notes = {"create_note", "get_note", "list_notes", "update_note", "delete_note"}
        expected_fs    = {"fs_read_file", "fs_write_file", "fs_list_directory",
                          "fs_file_exists", "fs_delete_file"}
        try:
            all_tools   = {t["name"] for t in mcp_client.get_all_tools()}
            notes_found = expected_notes.issubset(all_tools)
            fs_found    = expected_fs.issubset(all_tools)
            ok          = notes_found and fs_found

            self.stdout.write(f"  {INFO} All discovered tools: {sorted(all_tools)}")
            self.stdout.write(
                f"  {'✅' if notes_found else '❌'} Notes tools: "
                f"{sorted(expected_notes & all_tools)} / {sorted(expected_notes)}"
            )
            self.stdout.write(
                f"  {'✅' if fs_found else '❌'} Filesystem tools: "
                f"{sorted(expected_fs & all_tools)} / {sorted(expected_fs)}"
            )
            detail = f"total={len(all_tools)}  notes_ok={notes_found}  fs_ok={fs_found}"
            results.append(("Tool discovery", ok, detail))
            self.stdout.write(f"  {PASS if ok else FAIL}  {detail}")
        except Exception as exc:
            results.append(("Tool discovery", False, str(exc)))
            self.stdout.write(f"  {FAIL}  {exc}")
            traceback.print_exc()

        # ══════════════════════════════════════════════════════════════════
        # TEST 4 — Notes server: execute list_notes
        # ══════════════════════════════════════════════════════════════════
        self.stdout.write(section("Test 4 — Notes server tool execution (list_notes)"))
        try:
            # Ensure no blocking rule on list_notes for this session
            result = mcp_client.call_tool("list_notes", {})
            ok     = result is not None
            detail = f"result_type={type(result).__name__}  preview={str(result)[:80]}"
            results.append(("Notes tool execution", ok, detail))
            self.stdout.write(f"  {PASS if ok else FAIL}  {detail}")
        except Exception as exc:
            results.append(("Notes tool execution", False, str(exc)))
            self.stdout.write(f"  {FAIL}  {exc}")

        # ══════════════════════════════════════════════════════════════════
        # TEST 5 — Filesystem server: write then read a file
        # ══════════════════════════════════════════════════════════════════
        self.stdout.write(section("Test 5 — Filesystem server tool execution (write + read)"))
        try:
            # Write
            write_result = mcp_client.call_tool("fs_write_file", {
                "path":    "verify_test.txt",
                "content": "ArmorIQ MCP verification — filesystem-server OK",
            })
            write_ok = "created" in str(write_result) or "updated" in str(write_result)

            # Read back
            read_result = mcp_client.call_tool("fs_read_file", {"path": "verify_test.txt"})
            read_data   = json.loads(read_result) if isinstance(read_result, str) else {}
            content_ok  = "ArmorIQ MCP verification" in read_data.get("content", "")

            ok     = write_ok and content_ok
            detail = (f"write_ok={write_ok}  read_ok={content_ok}  "
                      f"size={read_data.get('size_bytes', '?')}B")
            results.append(("Filesystem tool execution", ok, detail))
            self.stdout.write(f"  {PASS if ok else FAIL}  {detail}")
        except Exception as exc:
            results.append(("Filesystem tool execution", False, str(exc)))
            self.stdout.write(f"  {FAIL}  {exc}")
            traceback.print_exc()

        # ══════════════════════════════════════════════════════════════════
        # TEST 6 — PolicyEngine: BLOCK_TOOL on a notes tool
        # ══════════════════════════════════════════════════════════════════
        self.stdout.write(section("Test 6 — PolicyEngine BLOCK_TOOL (notes: delete_note)"))
        try:
            # The default-block-delete rule should be present and enabled.
            decision = policy_engine.evaluate(
                tool_name="delete_note",
                arguments={"note_id": "999"},
                session_id="verify-block-notes",
            )
            ok     = decision["action"] == "block"
            detail = f"action={decision['action']}  rule={decision.get('rule_name')}"
            results.append(("PolicyEngine BLOCK_TOOL (notes)", ok, detail))
            self.stdout.write(f"  {PASS if ok else FAIL}  {detail}")
            if not ok:
                self.stdout.write(
                    f"  {YELLOW}  Hint: ensure 'default-block-delete' rule is enabled "
                    f"in policy/rules.json{RESET}"
                )
        except Exception as exc:
            results.append(("PolicyEngine BLOCK_TOOL (notes)", False, str(exc)))
            self.stdout.write(f"  {FAIL}  {exc}")

        # ══════════════════════════════════════════════════════════════════
        # TEST 7 — PolicyEngine: BLOCK_TOOL on a filesystem tool
        # ══════════════════════════════════════════════════════════════════
        self.stdout.write(section("Test 7 — PolicyEngine BLOCK_TOOL (filesystem: fs_delete_file)"))

        # Create a temporary block rule for fs_delete_file
        tmp_rule = rule_store.create_rule({
            "name":    "VERIFY: Block fs_delete_file",
            "type":    "BLOCK_TOOL",
            "enabled": True,
            "priority": 1,
            "pattern": "fs_delete_file",
        })
        tmp_id = tmp_rule["id"]
        self.stdout.write(f"  {INFO} Temporary rule created: id={tmp_id[:8]}…")

        try:
            decision = policy_engine.evaluate(
                tool_name="fs_delete_file",
                arguments={"path": "verify_test.txt"},
                session_id="verify-block-fs",
            )
            ok     = decision["action"] == "block"
            detail = f"action={decision['action']}  rule={decision.get('rule_name')}"
            results.append(("PolicyEngine BLOCK_TOOL (filesystem)", ok, detail))
            self.stdout.write(f"  {PASS if ok else FAIL}  {detail}")
        except Exception as exc:
            results.append(("PolicyEngine BLOCK_TOOL (filesystem)", False, str(exc)))
            self.stdout.write(f"  {FAIL}  {exc}")
        finally:
            rule_store.delete_rule(tmp_id)
            self.stdout.write(f"  {INFO} Temporary rule removed: id={tmp_id[:8]}…")

        # ══════════════════════════════════════════════════════════════════
        # TEST 8 — PolicyEngine: REQUIRE_APPROVAL on a filesystem tool
        # ══════════════════════════════════════════════════════════════════
        self.stdout.write(section("Test 8 — PolicyEngine REQUIRE_APPROVAL (filesystem: fs_write_file)"))

        tmp_rule2 = rule_store.create_rule({
            "name":    "VERIFY: Require Approval fs_write_file",
            "type":    "REQUIRE_APPROVAL",
            "enabled": True,
            "priority": 1,
            "pattern": "fs_write_file",
        })
        tmp_id2 = tmp_rule2["id"]
        self.stdout.write(f"  {INFO} Temporary rule created: id={tmp_id2[:8]}…")

        try:
            decision = policy_engine.evaluate(
                tool_name="fs_write_file",
                arguments={"path": "blocked.txt", "content": "should not write"},
                session_id="verify-approval-fs",
            )
            ok          = decision["action"] == "require_approval"
            approval_id = decision.get("approval_id")
            detail      = (f"action={decision['action']}  rule={decision.get('rule_name')}  "
                           f"approval_id={'set' if approval_id else 'missing'}")
            results.append(("PolicyEngine REQUIRE_APPROVAL (filesystem)", ok, detail))
            self.stdout.write(f"  {PASS if ok else FAIL}  {detail}")
        except Exception as exc:
            results.append(("PolicyEngine REQUIRE_APPROVAL (filesystem)", False, str(exc)))
            self.stdout.write(f"  {FAIL}  {exc}")
        finally:
            rule_store.delete_rule(tmp_id2)
            self.stdout.write(f"  {INFO} Temporary rule removed: id={tmp_id2[:8]}…")

        # ══════════════════════════════════════════════════════════════════
        # TEST 9 — Both servers appear in get_server_status()
        # ══════════════════════════════════════════════════════════════════
        self.stdout.write(section("Test 9 — Both servers registered in MCPClient registry"))
        try:
            status = mcp_client.get_server_status()
            has_notes = "notes-server" in status
            has_fs    = "filesystem-server" in status
            ok        = has_notes and has_fs
            detail    = f"registered_servers={list(status.keys())}"
            results.append(("Both servers in registry", ok, detail))
            self.stdout.write(f"  {PASS if ok else FAIL}  {detail}")
        except Exception as exc:
            results.append(("Both servers in registry", False, str(exc)))
            self.stdout.write(f"  {FAIL}  {exc}")

        # ══════════════════════════════════════════════════════════════════
        # Summary
        # ══════════════════════════════════════════════════════════════════
        passed = sum(1 for _, ok, _ in results if ok)
        failed = len(results) - passed

        self.stdout.write(header("RESULTS"))
        for label, ok, detail in results:
            icon = "✅" if ok else "❌"
            self.stdout.write(f"  {icon}  {label:<50}  {detail}")

        self.stdout.write(
            f"\n{BOLD}{'Passed' if failed == 0 else 'Summary'}: "
            f"{GREEN}{passed}{RESET}{BOLD} / {len(results)} "
            f"{'— ALL TESTS PASSED' if failed == 0 else f'— {RED}{failed} FAILED{RESET}'}{RESET}\n"
        )

        if failed:
            self.stdout.write(
                f"{RED}Conclusion: system does NOT satisfy all requirements.{RESET}\n"
            )
            sys.exit(1)
        else:
            self.stdout.write(
                f"{GREEN}Conclusion: Both MCP servers are connected, tools are discovered, "
                f"tool execution works, and PolicyEngine governs both servers correctly.{RESET}\n"
            )
