<div align="center">

<img src="frontend/public/favicon.svg" alt="ArmorIQ Logo" width="80" height="80" />

# ArmorIQ

**AI Agent Safety & Governance Platform**

A production-ready system for governing AI agent tool calls in real time —
policy enforcement, human-in-the-loop approvals, audit logging, and a live
security dashboard. Built on the **Model Context Protocol (MCP)**.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-amor--beta--livid.vercel.app-6366f1?style=for-the-badge&logo=vercel)](https://amor-beta-livid.vercel.app)
[![Backend](https://img.shields.io/badge/API-armoriq--backend.onrender.com-22c55e?style=for-the-badge&logo=render)](https://armoriq-backend-9ka9.onrender.com/api/health/)
[![Python](https://img.shields.io/badge/Python-3.14-3776AB?style=for-the-badge&logo=python)](https://python.org)
[![Django](https://img.shields.io/badge/Django-6.0-092E20?style=for-the-badge&logo=django)](https://djangoproject.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript)](https://typescriptlang.org)

</div>

---

## What is ArmorIQ?

ArmorIQ sits between your AI agent and its tools. Every tool call the agent
tries to make passes through a **PolicyEngine** before it executes. You decide
in real time — through a live dashboard — whether a tool is allowed, blocked,
or held for your manual approval.

```
User Prompt
    │
    ▼
┌─────────────┐     intent      ┌──────────────┐
│  LLM Agent  │ ──────────────► │ PolicyEngine │
└─────────────┘                 └──────┬───────┘
                                       │
               ┌───────────────────────┼──────────────────────┐
               │                       │                      │
               ▼                       ▼                      ▼
         ✅ ALLOW               🚫 BLOCK                ⏳ REQUIRE
      Execute via MCP        Return error to         Human approves
         client               user, log it           via dashboard
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           ArmorIQ System                            │
│                                                                     │
│  ┌──────────────────────┐         ┌──────────────────────────────┐  │
│  │   React Frontend     │         │      Django Backend           │  │
│  │   (Vercel)           │ ◄─────► │      (Render)                │  │
│  │                      │  REST   │                              │  │
│  │  • Dashboard         │  API    │  ┌────────────────────────┐  │  │
│  │  • Chat Interface    │         │  │     PolicyEngine        │  │  │
│  │  • Rules Manager     │         │  │  BLOCK / ALLOW /        │  │  │
│  │  • Approvals Queue   │         │  │  REQUIRE_APPROVAL       │  │  │
│  │  • Analytics         │         │  └──────────┬─────────────┘  │  │
│  │  • MCP Server Status │         │             │                │  │
│  └──────────────────────┘         │  ┌──────────▼─────────────┐  │  │
│                                   │  │      MCPClient          │  │  │
│                                   │  │  JSON-RPC over STDIO    │  │  │
│                                   │  └──────────┬─────────────┘  │  │
│                                   │             │                │  │
│                                   │  ┌──────────┴─────────────┐  │  │
│                                   │  │     MCP Servers         │  │  │
│                                   │  │  notes-server      ✓   │  │  │
│                                   │  │  filesystem-server ✓   │  │  │
│                                   │  └────────────────────────┘  │  │
│                                   │                              │  │
│                                   │  ┌────────────────────────┐  │  │
│                                   │  │    PostgreSQL (Render)  │  │  │
│                                   │  │  ToolCall audit log     │  │  │
│                                   │  │  ApprovalRequests       │  │  │
│                                   │  │  PolicyRules            │  │  │
│                                   │  │  Conversations          │  │  │
│                                   │  └────────────────────────┘  │  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Features

### 🛡️ Policy Engine
- **BLOCK_TOOL** — permanently block any tool by name or glob pattern
- **REQUIRE_APPROVAL** — gate any tool behind a human approval step
- **INPUT_VALIDATION** — validate tool arguments with regex, length limits, path constraints
- **TOKEN_BUDGET** — cap total token usage per session
- Rules reload from the database on every tool call — no restart needed

### 📊 Live Dashboard
- Real-time KPIs: active sessions, tool calls today, blocked actions, pending approvals
- 24-hour tool usage time series chart (calls vs blocked)
- Top tools by usage, security event feed, threat shield score
- All data sourced live from the audit database

### 💬 Chat Interface
- Natural language commands mapped to MCP tools
- Full conversation log showing every pipeline step: intent → policy → execution → response
- Blocked and pending-approval states surfaced inline

### ✅ Human-in-the-Loop Approvals
- Any tool can be gated with `REQUIRE_APPROVAL`
- Pending approvals appear in the dashboard queue
- One-click approve or reject with reason
- Approved tools execute immediately through the policy engine

### 📋 Audit Log
- Every tool call — allowed, blocked, pending, or error — is logged
- Per-session filtering, configurable limit
- Full policy decision metadata stored per record

### 🖥️ MCP Servers (2 built-in)

| Server | Tools | Description |
|--------|-------|-------------|
| `notes-server` | `create_note`, `get_note`, `list_notes`, `update_note`, `delete_note` | In-process CRUD note manager |
| `filesystem-server` | `fs_read_file`, `fs_write_file`, `fs_list_directory`, `fs_file_exists`, `fs_delete_file` | Sandboxed filesystem operations — path traversal blocked |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, shadcn/ui, Recharts, Zustand |
| Backend | Django 6, Django REST Framework, Python 3.14 |
| Agent Protocol | MCP (Model Context Protocol) over JSON-RPC 2.0 / STDIO |
| Database | PostgreSQL (production), SQLite (local dev) |
| Auth / AI | OpenAI API, Google Gemini API |
| Deployment | Render (backend), Vercel (frontend) |
| Static Files | WhiteNoise |

---

## Project Structure

```
amor/
├── backend/                        # Django application
│   ├── agent/
│   │   ├── models.py               # ToolCall, ApprovalRequest, PolicyRule, Conversation
│   │   ├── views.py                # All REST API endpoints
│   │   ├── urls.py                 # URL routing
│   │   ├── llm_agent.py            # Agent loop: intent → policy → MCP → response
│   │   ├── mcp_client.py           # MCP JSON-RPC client (STDIO transport)
│   │   └── migrations/             # 0001_initial, 0002_policyrule
│   ├── policy/
│   │   ├── engine.py               # PolicyEngine singleton
│   │   ├── evaluator.py            # Per-rule-type evaluators
│   │   ├── rules.py                # RuleStore (PostgreSQL + JSON fallback)
│   │   ├── exceptions.py           # ToolBlocked, ApprovalRequired, BudgetExceeded
│   │   └── rules.json              # Local dev seed data
│   ├── config/
│   │   ├── settings.py             # All Django settings
│   │   └── urls.py                 # Root URL conf
│   ├── requirements.txt
│   └── .env.example
│
├── mcp_server/                     # Standalone MCP servers
│   ├── notes_server.py             # Notes CRUD MCP server
│   ├── filesystem_server.py        # Sandboxed filesystem MCP server
│   └── fs_workspace/               # Sandbox root for filesystem server
│
└── frontend/                       # React application
    └── src/
        ├── components/
        │   └── dashboard/          # All dashboard UI components
        ├── services/
        │   └── api.ts              # Typed API client (all endpoints)
        └── routes/                 # Page-level route components
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health/` | Health check |
| `POST` | `/api/chat/` | Send message to agent |
| `GET` | `/api/rules/` | List all guardrail rules |
| `POST` | `/api/rules/create/` | Create a new rule |
| `PUT` | `/api/rules/<id>/` | Update a rule |
| `DELETE` | `/api/rules/<id>/delete/` | Delete a rule |
| `POST` | `/api/rules/<id>/toggle/` | Toggle rule enabled/disabled |
| `GET` | `/api/mcp/servers/` | MCP server status |
| `GET` | `/api/mcp/tools/` | All available MCP tools |
| `POST` | `/api/mcp/refresh/` | Refresh tool discovery |
| `GET` | `/api/approvals/` | List pending approvals |
| `POST` | `/api/approvals/<id>/approve/` | Approve and execute a tool |
| `POST` | `/api/approvals/<id>/reject/` | Reject a tool call |
| `GET` | `/api/logs/` | Tool call audit log |
| `GET` | `/api/analytics/` | Usage analytics (last 24h) |
| `GET` | `/api/dashboard/` | Full dashboard data in one call |

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 20+

### Backend (local)

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env and set SECRET_KEY at minimum

python manage.py migrate
python manage.py runserver
```

Backend runs at `http://localhost:8000`

### Frontend (local)

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```
VITE_API_BASE=http://localhost:8000/api
```

```bash
npm run dev
```

Frontend runs at `http://localhost:5173`

---

## Deployment

### Render (Backend)

**Root Directory:** `backend`

**Build Command:**
```
pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
```

**Start Command:**
```
gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
```

**Environment Variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | ✅ Yes | Django secret key — generate with `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `DEBUG` | ✅ Yes | Set to `False` in production |
| `ALLOWED_HOSTS` | ✅ Yes | Your Render subdomain e.g. `your-service.onrender.com` |
| `DATABASE_URL` | ✅ Yes | Auto-set by Render PostgreSQL add-on |
| `CORS_ALLOWED_ORIGINS` | ✅ Yes | Your Vercel URL e.g. `https://your-app.vercel.app` |
| `OPENAI_API_KEY` | Optional | For OpenAI-powered agent |
| `GEMINI_API_KEY` | Optional | For Gemini-powered agent |

### Vercel (Frontend)

**Environment Variable:**

| Variable | Value |
|----------|-------|
| `VITE_API_BASE` | `https://your-render-service.onrender.com/api` |

---

## Database

ArmorIQ uses **PostgreSQL in production** and **SQLite locally**.

The switch is automatic — if `DATABASE_URL` is present, PostgreSQL is used. If not, SQLite is used as a fallback for local development.

```python
# backend/config/settings.py
DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    DATABASES = {"default": dj_database_url.config(default=DATABASE_URL, conn_max_age=600, ssl_require=True)}
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
```

### Tables

| Table | Model | Purpose |
|-------|-------|---------|
| `agent_toolcall` | `ToolCall` | Full audit log of every tool execution |
| `agent_approvalrequest` | `ApprovalRequest` | Human-in-the-loop approval queue |
| `agent_policyrule` | `PolicyRule` | Persistent guardrail rules (survives deploys) |
| `agent_conversation` | `Conversation` | Chat sessions |
| `agent_message` | `Message` | Individual messages per session |

---

## Policy Rule Examples

**Block a tool completely:**
```json
{
  "name": "Block file delete",
  "type": "BLOCK_TOOL",
  "pattern": "fs_delete_file",
  "enabled": true,
  "priority": 10
}
```

**Require human approval:**
```json
{
  "name": "Approve before creating notes",
  "type": "REQUIRE_APPROVAL",
  "pattern": "create_note",
  "enabled": true,
  "priority": 5
}
```

**Validate input:**
```json
{
  "name": "Alphanumeric titles only",
  "type": "INPUT_VALIDATION",
  "tool": "create_note",
  "parameter": "title",
  "validation_type": "matches_regex",
  "validation_value": "^[a-zA-Z0-9_\\s\\-]+$",
  "enabled": true
}
```

**Token budget per session:**
```json
{
  "name": "Session budget",
  "type": "TOKEN_BUDGET",
  "max_tokens": 10000,
  "enabled": true
}
```

---

## Verify Data Persistence

Run in Render Shell or local `python manage.py shell`:

```python
from agent.models import ToolCall, ApprovalRequest, PolicyRule

print("Tool calls logged:  ", ToolCall.objects.count())
print("Approval requests:  ", ApprovalRequest.objects.count())
print("Policy rules in DB: ", PolicyRule.objects.count())

# Latest 5 tool calls
for t in ToolCall.objects.all()[:5]:
    print(f"  {t.timestamp:%H:%M:%S}  {t.tool_name:<25} {t.status}")
```

Or hit the live API:
```
GET /api/logs/
GET /api/rules/
GET /api/dashboard/
```

---

<div align="center">

Built with Django · React · MCP · PostgreSQL · Render · Vercel

</div>
