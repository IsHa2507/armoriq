"""
Management command: test_intent_parser

Automated unit tests for MockLLM._parse_user_intent().
Validates every filesystem and notes intent pattern, including all
sample prompts from the requirements.

Run with:
    python manage.py test_intent_parser

Exit code 0 = all tests passed.
Exit code 1 = one or more tests failed.
"""

import sys
from typing import Any, Dict, List, Optional, Tuple
from django.core.management.base import BaseCommand


GREEN = "\033[92m"
RED   = "\033[91m"
CYAN  = "\033[96m"
BOLD  = "\033[1m"
RESET = "\033[0m"


# ── Test definitions ──────────────────────────────────────────────────────────
# Each entry: (prompt, expected_tool, {expected_arg_key: expected_arg_value, …})
# Set expected_args to {} if you only care about tool routing.

TESTS: List[Tuple[str, str, Dict[str, Any]]] = [

    # ── fs_file_exists ────────────────────────────────────────────────────
    ("Check if README.md exists",               "fs_file_exists", {"path": "README.md"}),
    ("Does README.md exist",                    "fs_file_exists", {"path": "README.md"}),
    ("is README.md present",                    "fs_file_exists", {"path": "README.md"}),
    ("does test.txt exist?",                    "fs_file_exists", {"path": "test.txt"}),
    ("check if config.json exists",             "fs_file_exists", {"path": "config.json"}),
    ("file exists test.txt",                    "fs_file_exists", {"path": "test.txt"}),
    ("is there a .env file",                    "fs_file_exists", {"path": ".env"}),

    # ── fs_read_file ──────────────────────────────────────────────────────
    ("Read README.md",                          "fs_read_file",   {"path": "README.md"}),
    ("Open README.md",                          "fs_read_file",   {"path": "README.md"}),
    ("show contents of README.md",              "fs_read_file",   {"path": "README.md"}),
    ("read file hello.txt",                     "fs_read_file",   {"path": "hello.txt"}),
    ("open file config.json",                   "fs_read_file",   {"path": "config.json"}),
    ("cat main.py",                             "fs_read_file",   {"path": "main.py"}),
    ("display requirements.txt",               "fs_read_file",   {"path": "requirements.txt"}),
    ("view notes.md",                           "fs_read_file",   {"path": "notes.md"}),
    ("show me test.txt",                        "fs_read_file",   {"path": "test.txt"}),
    ("get the contents of app.py",              "fs_read_file",   {"path": "app.py"}),

    # ── fs_write_file ─────────────────────────────────────────────────────
    ("create file test.txt with content Hello", "fs_write_file",  {"path": "test.txt"}),
    ("write file hello.txt with content Hello", "fs_write_file",  {"path": "hello.txt"}),
    ("save file output.txt with content World", "fs_write_file",  {"path": "output.txt"}),
    ("make file notes.txt with content Test",   "fs_write_file",  {"path": "notes.txt"}),
    ("new file data.csv with content a,b,c",    "fs_write_file",  {"path": "data.csv"}),
    ("create a file named log.txt with content done", "fs_write_file", {"path": "log.txt"}),
    ("write to file result.txt with content OK", "fs_write_file", {"path": "result.txt"}),

    # ── fs_list_directory ─────────────────────────────────────────────────
    ("List files in the current directory",     "fs_list_directory", {"path": "."}),
    ("list files",                              "fs_list_directory", {"path": "."}),
    ("show files",                              "fs_list_directory", {"path": "."}),
    ("current directory",                       "fs_list_directory", {"path": "."}),
    ("project root",                            "fs_list_directory", {"path": "."}),
    ("list files in .",                         "fs_list_directory", {"path": "."}),
    ("list directory",                          "fs_list_directory", {"path": "."}),
    ("show directory",                          "fs_list_directory", {"path": "."}),
    ("ls",                                      "fs_list_directory", {"path": "."}),
    ("what files are here",                     "fs_list_directory", {}),
    ("list files in src",                       "fs_list_directory", {"path": "src"}),
    ("show directory in /tmp",                  "fs_list_directory", {}),

    # ── fs_delete_file ────────────────────────────────────────────────────
    ("Delete file test.txt",                    "fs_delete_file", {"path": "test.txt"}),
    ("remove file old.log",                     "fs_delete_file", {"path": "old.log"}),
    ("erase file temp.txt",                     "fs_delete_file", {"path": "temp.txt"}),

    # ── notes: create_note ────────────────────────────────────────────────
    ("Create a note titled Meeting",            "create_note",    {}),
    ("make a new note about Python",            "create_note",    {}),
    ("add a note titled Ideas with content stuff", "create_note", {}),

    # ── notes: list_notes ────────────────────────────────────────────────
    ("list all notes",                          "list_notes",     {}),
    ("show all my notes",                       "list_notes",     {}),
    ("get all notes",                           "list_notes",     {}),
    ("display notes",                           "list_notes",     {}),

    # ── notes: update_note ───────────────────────────────────────────────
    ("update note 1 to have content Hello",     "update_note",    {"note_id": "1"}),
    ("edit note 2 content to World",            "update_note",    {"note_id": "2"}),

    # ── notes: get_note ───────────────────────────────────────────────────
    ("get note 3",                              "get_note",       {"note_id": "3"}),
    ("show note 5",                             "get_note",       {"note_id": "5"}),
    ("view note 1",                             "get_note",       {"note_id": "1"}),

    # ── notes: delete_note ────────────────────────────────────────────────
    ("delete note 2",                           "delete_note",    {"note_id": "2"}),
    ("remove note 7",                           "delete_note",    {"note_id": "7"}),

    # ── none expected ─────────────────────────────────────────────────────
    ("hello",                                   None, {}),
    ("what can you do",                         None, {}),
]


class Command(BaseCommand):
    help = "Run automated unit tests for MockLLM._parse_user_intent()."

    def handle(self, *args: Any, **options: Any) -> None:
        from agent.llm_agent import MockLLM
        llm = MockLLM()

        passed = 0
        failed = 0
        failures: List[str] = []

        self.stdout.write(
            f"\n{BOLD}{CYAN}{'─' * 68}{RESET}\n"
            f"{BOLD} Intent Parser — Automated Test Suite  ({len(TESTS)} cases){RESET}\n"
            f"{BOLD}{CYAN}{'─' * 68}{RESET}\n"
        )

        for prompt, expected_tool, expected_args in TESTS:
            result = llm._parse_user_intent(prompt)
            got_tool = result["tool"] if result else None
            got_args = result["arguments"] if result else {}

            # Check tool routing
            tool_ok = (got_tool == expected_tool)

            # Check expected argument values (subset match — extra args are fine)
            args_ok = all(
                got_args.get(k) == v
                for k, v in expected_args.items()
            )

            ok = tool_ok and args_ok

            if ok:
                passed += 1
                icon = "✅"
            else:
                failed += 1
                icon = "❌"
                detail_parts = []
                if not tool_ok:
                    detail_parts.append(f"tool: expected={expected_tool!r} got={got_tool!r}")
                if not args_ok:
                    wrong = {k: v for k, v in expected_args.items()
                             if got_args.get(k) != v}
                    detail_parts.append(f"args mismatch: {wrong} (got {got_args})")
                detail = "; ".join(detail_parts)
                failures.append(f"  {prompt!r}\n    {detail}")

            tool_label = f"→ {got_tool or 'None':<22}"
            args_label = ""
            if result and result["arguments"]:
                first_k, first_v = next(iter(result["arguments"].items()))
                args_label = f"  {first_k}={str(first_v)[:30]!r}"
            self.stdout.write(f"  {icon}  {prompt:<52} {tool_label}{args_label}")

        # Summary
        self.stdout.write(
            f"\n{BOLD}{CYAN}{'─' * 68}{RESET}\n"
        )
        if failures:
            self.stdout.write(f"\n{RED}FAILURES:{RESET}")
            for f in failures:
                self.stdout.write(f"{RED}{f}{RESET}")

        color = GREEN if failed == 0 else RED
        self.stdout.write(
            f"\n{BOLD}{color}Results: {passed} passed / {failed} failed / {len(TESTS)} total{RESET}\n"
        )

        if failed > 0:
            self.stdout.write(f"{RED}Some intent patterns need attention.{RESET}\n")
            sys.exit(1)
        else:
            self.stdout.write(f"{GREEN}All intent patterns are working correctly.{RESET}\n")
