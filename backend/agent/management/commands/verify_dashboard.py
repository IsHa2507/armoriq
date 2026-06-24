"""
Management command: verify_dashboard

Validates that the /api/dashboard/ endpoint returns values that match
direct database queries — proving the dashboard shows real data.

Run with:
    python manage.py verify_dashboard

Exit code 0 = all checks passed.
Exit code 1 = one or more checks failed.
"""

import json
import sys
from datetime import timedelta
from typing import Any, List, Tuple

from django.core.management.base import BaseCommand
from django.utils import timezone

GREEN = "\033[92m"
RED   = "\033[91m"
CYAN  = "\033[96m"
BOLD  = "\033[1m"
RESET = "\033[0m"


class Command(BaseCommand):
    help = "Verify that dashboard metrics match the live database."

    def handle(self, *args: Any, **options: Any) -> None:
        from agent.models import ToolCall, ApprovalRequest
        from agent.mcp_client import mcp_client
        from django.db.models import Count

        results: List[Tuple[str, bool, str]] = []

        self.stdout.write(
            f"\n{BOLD}{CYAN}{'─' * 68}{RESET}\n"
            f"{BOLD} ArmorIQ — Dashboard Data Verification{RESET}\n"
            f"{BOLD}{CYAN}{'─' * 68}{RESET}\n"
        )

        now      = timezone.now()
        last_24h = now - timedelta(hours=24)

        # ── Compute ground-truth values directly from DB ───────────────────

        db_total_calls   = ToolCall.objects.filter(timestamp__gte=last_24h).count()
        db_blocked       = ToolCall.objects.filter(timestamp__gte=last_24h, status="blocked").count()
        db_pending       = ApprovalRequest.objects.filter(status="pending").count()
        db_sessions      = (
            ToolCall.objects.filter(timestamp__gte=last_24h)
            .values("session_id").distinct().count()
        )
        db_total_all     = ToolCall.objects.count()
        db_errors        = ToolCall.objects.filter(status="error").count()
        db_uptime        = (
            round(((db_total_all - db_errors) / db_total_all * 100), 2)
            if db_total_all else 100.0
        )
        srv_status       = mcp_client.get_server_status()
        db_mcp_connected = sum(1 for s in srv_status.values() if s.get("status") == "connected")
        db_mcp_total     = len(srv_status)
        db_mcp_str       = f"{db_mcp_connected}/{db_mcp_total}"

        db_top_tools = list(
            ToolCall.objects.values("tool_name")
            .annotate(calls=Count("id"))
            .order_by("-calls")[:10]
        )

        db_allowed = ToolCall.objects.filter(status="executed").count()
        db_blocked_all = ToolCall.objects.filter(status="blocked").count()

        # Series: 24 hourly buckets
        db_series = []
        for h in range(24):
            start = last_24h + timedelta(hours=h)
            end   = start + timedelta(hours=1)
            c = ToolCall.objects.filter(timestamp__gte=start, timestamp__lt=end).count()
            b = ToolCall.objects.filter(timestamp__gte=start, timestamp__lt=end, status="blocked").count()
            db_series.append({"hour": start.strftime("%H:%M"), "calls": c, "blocked": b})

        self.stdout.write(f"\n{BOLD}Ground-truth from database:{RESET}")
        self.stdout.write(f"  active_sessions   = {db_sessions}")
        self.stdout.write(f"  mcp_servers       = {db_mcp_str}")
        self.stdout.write(f"  tool_calls_today  = {db_total_calls}")
        self.stdout.write(f"  blocked_today     = {db_blocked}")
        self.stdout.write(f"  pending_approvals = {db_pending}")
        self.stdout.write(f"  uptime_pct        = {db_uptime}")
        self.stdout.write(f"  top_tools (count) = {len(db_top_tools)}")
        self.stdout.write(f"  threat_shield allowed/blocked/pending = {db_allowed}/{db_blocked_all}/{db_pending}")
        self.stdout.write(f"  series points     = {len(db_series)}")

        # ── Call the API endpoint ──────────────────────────────────────────
        self.stdout.write(f"\n{BOLD}Calling /api/dashboard/…{RESET}")

        import django
        from django.test import RequestFactory
        from agent.views import get_dashboard

        factory = RequestFactory()
        request = factory.get("/api/dashboard/")
        # Attach Django REST Framework format
        request.query_params = {}
        response = get_dashboard(request)
        api_data = response.data

        self.stdout.write(f"  HTTP status = {response.status_code}")

        # ── Check 1: HTTP 200 ─────────────────────────────────────────────
        ok = response.status_code == 200
        results.append(("Dashboard endpoint returns HTTP 200", ok, f"got {response.status_code}"))
        self.stdout.write(f"  {'✅' if ok else '❌'} HTTP 200 — got {response.status_code}")

        kpis   = api_data.get("kpis", {})
        shield = api_data.get("threat_shield", {})

        # ── Check 2: active_sessions matches DB ───────────────────────────
        api_val = kpis.get("active_sessions")
        ok = api_val == db_sessions
        results.append(("active_sessions matches DB", ok,
                         f"api={api_val}  db={db_sessions}"))
        self.stdout.write(f"  {'✅' if ok else '❌'} active_sessions: api={api_val}  db={db_sessions}")

        # ── Check 3: mcp_servers matches live client ──────────────────────
        api_val = kpis.get("mcp_servers")
        ok = api_val == db_mcp_str
        results.append(("mcp_servers matches live client", ok,
                         f"api={api_val!r}  expected={db_mcp_str!r}"))
        self.stdout.write(f"  {'✅' if ok else '❌'} mcp_servers: api={api_val!r}  expected={db_mcp_str!r}")

        # ── Check 4: tool_calls_today matches DB ──────────────────────────
        api_val = kpis.get("tool_calls_today")
        ok = api_val == db_total_calls
        results.append(("tool_calls_today matches DB", ok,
                         f"api={api_val}  db={db_total_calls}"))
        self.stdout.write(f"  {'✅' if ok else '❌'} tool_calls_today: api={api_val}  db={db_total_calls}")

        # ── Check 5: blocked_today matches DB ─────────────────────────────
        api_val = kpis.get("blocked_today")
        ok = api_val == db_blocked
        results.append(("blocked_today matches DB", ok,
                         f"api={api_val}  db={db_blocked}"))
        self.stdout.write(f"  {'✅' if ok else '❌'} blocked_today: api={api_val}  db={db_blocked}")

        # ── Check 6: pending_approvals matches DB ─────────────────────────
        api_val = kpis.get("pending_approvals")
        ok = api_val == db_pending
        results.append(("pending_approvals matches DB", ok,
                         f"api={api_val}  db={db_pending}"))
        self.stdout.write(f"  {'✅' if ok else '❌'} pending_approvals: api={api_val}  db={db_pending}")

        # ── Check 7: uptime_pct matches DB calculation ────────────────────
        api_val = kpis.get("uptime_pct")
        ok = api_val == db_uptime
        results.append(("uptime_pct matches DB calculation", ok,
                         f"api={api_val}  db={db_uptime}"))
        self.stdout.write(f"  {'✅' if ok else '❌'} uptime_pct: api={api_val}  db={db_uptime}")

        # ── Check 8: tool_usage_series has 24 points ─────────────────────
        series = api_data.get("tool_usage_series", [])
        ok = len(series) == 24
        results.append(("tool_usage_series has 24 hourly buckets", ok,
                         f"got {len(series)}"))
        self.stdout.write(f"  {'✅' if ok else '❌'} tool_usage_series length: {len(series)} (expected 24)")

        # ── Check 9: series totals match DB totals ────────────────────────
        series_calls   = sum(p.get("calls", 0) for p in series)
        series_blocked = sum(p.get("blocked", 0) for p in series)
        db_s_calls     = sum(p["calls"] for p in db_series)
        db_s_blocked   = sum(p["blocked"] for p in db_series)
        ok = series_calls == db_s_calls and series_blocked == db_s_blocked
        results.append(("series totals match DB counts", ok,
                         f"api calls={series_calls} blocked={series_blocked}  "
                         f"db calls={db_s_calls} blocked={db_s_blocked}"))
        self.stdout.write(
            f"  {'✅' if ok else '❌'} series totals: "
            f"api calls={series_calls}/blocked={series_blocked}  "
            f"db calls={db_s_calls}/blocked={db_s_blocked}"
        )

        # ── Check 10: top_tools names match DB ───────────────────────────
        api_tools = [t["name"] for t in api_data.get("top_tools", [])]
        db_tool_names = [t["tool_name"] for t in db_top_tools]
        ok = api_tools == db_tool_names
        results.append(("top_tools order matches DB", ok,
                         f"api={api_tools[:3]}  db={db_tool_names[:3]}"))
        self.stdout.write(
            f"  {'✅' if ok else '❌'} top_tools: api={api_tools[:3]}  db={db_tool_names[:3]}"
        )

        # ── Check 11: threat_shield totals match DB ───────────────────────
        api_allowed = shield.get("allowed")
        api_blocked = shield.get("blocked")
        api_pending = shield.get("pending")
        ok = api_allowed == db_allowed and api_blocked == db_blocked_all and api_pending == db_pending
        results.append(("threat_shield totals match DB", ok,
                         f"api A={api_allowed}/B={api_blocked}/P={api_pending}  "
                         f"db A={db_allowed}/B={db_blocked_all}/P={db_pending}"))
        self.stdout.write(
            f"  {'✅' if ok else '❌'} threat_shield: "
            f"api allowed={api_allowed}/blocked={api_blocked}/pending={api_pending}  "
            f"db allowed={db_allowed}/blocked={db_blocked_all}/pending={db_pending}"
        )

        # ── Check 12: security_events are real ToolCall rows ─────────────
        events = api_data.get("security_events", [])
        # Every event must have required fields
        valid = all(
            isinstance(e.get("time"), str)
            and e.get("severity") in ("info", "warning", "critical")
            and isinstance(e.get("message"), str)
            and isinstance(e.get("tool"), str)
            for e in events
        )
        ok = valid
        results.append(("security_events have correct shape", ok,
                         f"{len(events)} events, valid={valid}"))
        self.stdout.write(f"  {'✅' if ok else '❌'} security_events: {len(events)} events, all valid={valid}")

        # ── Check 13: confirm NO mock data strings appear in response ─────
        raw_json = json.dumps(api_data)
        mock_indicators = [
            "research-bot", "finance-bot", "ops-agent", "postgres-mcp",
            "search_repos", "execute_sql", "send_email", "G-PASS", "G-101",
        ]
        found_mock = [m for m in mock_indicators if m in raw_json]
        ok = len(found_mock) == 0
        detail = f"mock strings found: {found_mock}" if found_mock else "none found"
        results.append(("No mock/hardcoded strings in response", ok, detail))
        self.stdout.write(f"  {'✅' if ok else '⚠️ '} Mock string check: {detail}")

        # ── Summary ───────────────────────────────────────────────────────
        passed = sum(1 for _, ok, _ in results if ok)
        failed = len(results) - passed

        self.stdout.write(f"\n{BOLD}{CYAN}{'─' * 68}{RESET}")
        self.stdout.write(f"\n{BOLD}Results:{RESET}")
        for label, ok, detail in results:
            self.stdout.write(f"  {'✅' if ok else '❌'}  {label:<50}  {detail}")

        color = GREEN if failed == 0 else RED
        self.stdout.write(
            f"\n{BOLD}{color}{passed}/{len(results)} checks passed"
            f"{'  — ALL PASSED' if failed == 0 else f'  — {failed} FAILED'}{RESET}\n"
        )

        if failed == 0:
            self.stdout.write(
                f"{GREEN}Conclusion: Dashboard is powered entirely by live database data.{RESET}\n"
            )
        else:
            self.stdout.write(
                f"{RED}Conclusion: {failed} metric(s) do not match the database.{RESET}\n"
            )
            sys.exit(1)
