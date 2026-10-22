# OpenCode Multi-Agent Workflow
### Local AI Dev Team — Ollama + Security Reviewer + Serena MCP

> 📺 **Video Tutorial (this version):** `https://youtu.be/s2rrrGwo448`
> 📺 **Video Tutorial (v1 — original Copilot setup):** `https://youtu.be/kE6x7xKy4lM?si=_dCDpZVN_vOZZSzL`

A practical multi-agent workflow for [OpenCode](https://opencode.ai) that runs a full local AI dev team using **Ollama** — no API key required, no code leaves your machine.

This is **Version 2** of the workflow, built on the foundation from the first video and adding:
- 🦙 **Ollama** as the model provider (local + cloud-routed models per agent)
- 🔐 **Security reviewer** — a read-only agent that audits every change for vulnerabilities
- 🧠 **Serena MCP** — semantic codebase understanding for agents (symbol queries, call graphs, structured edits)

---

## What's in this repo

```
your-project/
├── AGENTS.md                         ← Shared rules for all agents
├── WORKFLOWSTATE.md                  ← Shared handoff state between agents
├── opencode.jsonc                    ← OpenCode config: Ollama provider + per-agent models
└── .opencode/
    └── agents/
        ├── planner.md                ← Primary agent: clarifies → plans → orchestrates
        ├── debater.md                ← Checks if a better plan exists
        ├── implementor.md            ← Writes the code
        ├── reviewer.md               ← Correctness + maintainability review
        ├── security-reviewer.md      ← Security audit (read-only on code)  ← NEW
        ├── tester.md                 ← Runs tests
        ├── linter.md                 ← Runs your lint/check script
        └── commit-message.md         ← Generates the final commit message
```

---

## Workflow

```
User
 └─▶ Planner        (clarifies request, writes plan)
       └─▶ Debater        (checks if a better plan exists)
             └─▶ Implementor   (writes the code)
                   └─▶ Reviewer       (correctness + maintainability)
                         └─▶ Security Reviewer  (vulnerability audit)  ← NEW
                               └─▶ Tester       (runs tests)
                                     └─▶ Linter       (runs lint script)
                                           └─▶ Commit Msg  (prints final commit)
```

Every agent reads `WORKFLOWSTATE.md` before starting and updates it before finishing.
The security reviewer routes back to the implementor if it finds issues.

---

## Agent overview

| Agent | Role | Mode | Can edit code? |
|---|---|---|---|
| `planner` | Clarify → plan → orchestrate | primary | ✗ (only WORKFLOWSTATE.md) |
| `debater` | Challenge the plan | subagent | ✗ |
| `implementor` | Write the code | subagent | ✅ |
| `reviewer` | Correctness + maintainability | subagent | ✗ |
| `security-reviewer` | Vulnerability audit | subagent | ✗ |
| `tester` | Run tests | subagent | ✗ |
| `linter` | Run lint script | subagent | ✗ |
| `commit-message` | Generate commit message | subagent | ✗ |

---

## Model assignments (Ollama)

```jsonc
// opencode.jsonc
{
  "provider": {
    "ollama": {
      "name": "Ollama (local)",
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "http://localhost:11434/v1"
      },
      "models": {
        "kimi-k2.6:cloud": {
          "_launch": true,
          "limit": {
            "context": 262144,
            "output": 262144
          },
          "name": "kimi-k2.6:cloud"
        },
        "gemma4:e4b": {
          "name": "gemma4:e4b"
        },
        "gemma4:26b": {
          "name": "gemma4:26b"
        },
        "qwen3.6:27b": {
          "name": "qwen3.6:27b"
        }
      }
    }
  }
}
```

**Local vs `:cloud` models:**
- `ollama/gemma4` — runs fully on your CPU/GPU, no token limits, fully private
- `ollama/kimi-k2.6:cloud` — routes through Ollama's servers, stronger tool-calling, uses daily quota

Swap `:cloud` models to local-only variants if your code is sensitive and must never leave your machine.

---

## Permissions

Each agent gets only what it needs:

```yaml
# All agents except implementor — read-only on code
permission:
  edit:
    "*": deny
    WORKFLOWSTATE.md: allow   # only this file allowed

# Implementor — can edit code
permission:
  edit: allow

# Tester — bash allowlist only
permission:
  bash:
    "*": deny
    "pytest": allow
    "npm test": allow

# Linter — Python script only
permission:
  bash:
    "*": deny
    "python scripts/lint.py": allow
```

OpenCode evaluates the last matching path rule, so `WORKFLOWSTATE.md: allow` overrides the catch-all `deny`.

---

## WORKFLOWSTATE.md structure

```markdown
## Request
## Clarified Scope
## Open Questions
## Constraints
## Acceptance Criteria
## Plan
## Debate Notes
## Files To Change
## Implementation Notes
## Review Findings
## Security Findings        ← added in Version 2
## Test Results
## Lint Results
## Commit Message Draft
## Current Status
## Next Agent
```

This file is the canonical audit trail of every decision made during a workflow run.

---

## Serena MCP (optional bonus)

[Serena](https://github.com/oraios/serena) gives agents semantic codebase understanding —
symbol queries, call graph navigation, structured multi-file edits — instead of raw grep.

**Setup in `opencode.jsonc`:**
```jsonc
"mcp": {
  "serena": {
    "type": "local",
    "enabled": true,
    "command": ["uvx", "--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server" , "--context", "ide", "--project-from-cwd"],
  }
}
```

Requires [uv](https://docs.astral.sh/uv) — install with: `curl -LsSf https://astral.sh/uv/install.sh | sh`

Once configured, `AGENTS.md` tells all agents to prefer Serena for code navigation:
```markdown
## Serena usage rules
Prefer Serena's MCP tools over raw grep for any code navigation.
Use Serena to find symbols, inspect call sites, and apply structured multi-file edits.
```

---

## Getting started

**1. Install Ollama and pull models**
```bash
# Install: https://ollama.com
ollama pull gemma4:e4b
ollama pull gemma4:26b
ollama pull qwen3.6:27b
```

**2. Verify Ollama is running**
```bash
# macOS: Ollama runs as a menu bar app
# Linux/Windows: run manually
ollama serve

# Verify: open http://localhost:11434 in your browser
```

**3. Copy files into your project**

Place all files as shown in the repo structure above. Adjust:
- Test commands in `tester.md`
- Lint script path in `linter.md`
- Model names to match what you've pulled locally

**4. Start OpenCode from your project root**
```bash
opencode run --agent planner "Add a user settings page with profile and notification preferences"
```

The planner will ask clarifying questions first, then the full pipeline runs automatically.

---

## Customizing models

Adjust model names in Agents file to match what you've pulled.
Browse the full model library at [ollama.com/library](https://ollama.com/library).

---

## Extending the workflow

Add new agents by creating a new `.md` file in `.opencode/agents/`.
Good candidates for future additions:
- `docs-writer` — generates or updates documentation
- `release-notes` — summarizes changes for a release
- `migration-planner` — plans database or API migrations
- `performance-reviewer` — checks for performance regressions

Update the workflow order in `AGENTS.md` and add the new agent name to the planner's `task:` allow list.

---

## Version history

| Version | Video | Key additions |
|---|---|---|
| v1 | `https://youtu.be/kE6x7xKy4lM?si=_dCDpZVN_vOZZSzL` | Original workflow: planner, debater, implementor, reviewer, tester, linter, commit-message with GitHub Copilot |
| v2 (this) | `https://youtu.be/s2rrrGwo448` | Ollama local models, security reviewer, Serena MCP |

---

## Resources

- [OpenCode docs — Agents](https://opencode.ai/docs/agents)
- [OpenCode docs — Permissions](https://opencode.ai/docs/permissions)
- [OpenCode docs — MCP Servers](https://opencode.ai/docs/mcp-servers)
- [Ollama model library](https://ollama.com/library)
- [Serena MCP](https://github.com/oraios/serena)
- [uv (Python runner for Serena)](https://docs.astral.sh/uv)

---

## License

MIT — feel free to copy, adapt, and share.
