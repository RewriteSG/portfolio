# Agent Guidelines for Scan2Plan

This document provides essential information for AI coding agents working on the Calculator App.

# Team workflow rules

All agents participate in one workflow.

Shared handoff file:
- Read `WORKFLOW_STATE.md` before starting work
- Update `WORKFLOW_STATE.md` before finishing work
- Never overwrite another section unnecessarily
- Preserve decisions, assumptions, blockers, and next steps

Workflow order:
1. Planner clarifies the request with the user
2. Planner writes clarified scope and acceptance criteria
3. Debater critiques the plan
4. Designer prepares implementation-ready UI guidance when the request changes a user-facing interface
5. Implementor makes the change
6. Reviewer reviews the result
7. Tester runs relevant tests
8. security-reviewer – performs security code review
9. Linter checks formatting/linting
10. Commit-message writes the final commit message

The designer is optional for backend-only or documentation-only work. The planner may invoke it for interface changes and should add `designer` to its permitted task agents.

Writing rules:
- Keep entries short and structured
- Prefer bullets over long paragraphs
- Record file paths when discussing code changes
- Record exact test commands and results
- Record unresolved questions under "Open Questions"

## Interface design

- For UI changes, use `.codex/agents/designer.md` to produce layout, hierarchy, responsive behavior, and interaction-state guidance before implementation.
- Prefer the existing design system and component patterns; do not introduce a new visual language without a reason in the request.
- The designer should use the `frontend-design` skill when available and record concise decisions in `WORKFLOW_STATE.md`.

# Shared workflow rules

All agents must use WORKFLOW_STATE.md as the shared handoff file.

Before starting:
- Read WORKFLOW_STATE.md

After finishing:
- Update only the sections relevant to your role
- Preserve existing content unless it is outdated or clearly incorrect
- Add a short handoff note for the next agent

When working on code, dependencies, libraries, frameworks, or APIs:
- Use context7 before proposing a plan
- Use context7 before implementation if external library behavior is relevant
- Use context7 during review when checking API usage or framework conventions
- Prefer context7 over guessing library behavior from memory
- Record important findings in WORKFLOW_STATE.md

Do not use chat history as the only source of truth.
WORKFLOW_STATE.md is the canonical workflow record.

# Serena usage rules

Serena is the semantic code assistant for this project.
Prefer Serena's MCP tools over raw grep for any code navigation.

When working with this codebase:

- Use Serena's MCP tools for semantic code navigation and edits instead of guessing.
- Prefer Serena for:
  - finding relevant files, modules, and symbols
  - understanding call graphs and relationships
  - making structured, multi-file edits
  - Trace where user input flows through the codebase
- Only fall back to raw grep/edit/apply_patch when Serena tools are clearly not applicable.

Serena tools are exposed via the MCP server. Use them by name whenever code understanding or structured refactors are needed.
Record important Serena findings in WORKFLOWSTATE.md.
