# Council Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add working, cloud-backed task, meeting, decision and audit-history workflows to COUNCIL HQ.

**Architecture:** Keep the current single-page Persian application and Supabase JS client. Use existing RLS-protected tables with workspace-scoped reads, authenticated-owner writes, and explicit audit events. Cache fetched rows in memory/local storage only for UI responsiveness.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Supabase JS v2, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-11-24-council-operations-design.md`

## Global Constraints
- Do not expose a Supabase secret/service-role key.
- Do not weaken RLS or enable paid services.
- Do not present mock AI messages or background work as real.
- Keep the mobile-first Persian interface and existing identity colors.
- Destructive task deletion requires confirmation.
- Use only existing database tables and enumerated status values.

## Review Focus
- No authenticated session: operations must fail safely and must not silently claim cloud save.
- Empty workspace: forms and empty states remain usable.
- Missing/disabled member or project: nullable assignment and project choices remain safe.
- Dependency cycle: reject before writing.
- Partial multi-table write: show a clear error and do not claim the entire operation succeeded.

---

### Task 1: Cloud operations data layer
**Files:** Modify `index.html`; create `tests/council-ops.test.js`.
- [ ] Add workspace-scoped loaders for tasks, dependencies, meetings, participants, decisions, evidence and audit events.
- [ ] Add one audit writer with safe error propagation.
- [ ] Add task dependency cycle validation and status label mappings.
- [ ] Verify JavaScript syntax and pure validation cases.

### Task 2: Mobile-first operations screens
**Files:** Modify `index.html`.
- [ ] Add tasks, meetings and decisions pages and navigation links.
- [ ] Add task create/update/delete, assignment, project, due date and dependency UI.
- [ ] Add meeting create/start/finish, participants and summary UI.
- [ ] Add decision create/status/evidence UI.
- [ ] Render live counts and recent audit events; add useful empty and error states.
- [ ] Verify syntax, markup IDs, status mappings and no unsafe HTML interpolation for user-entered content.

### Task 3: Documentation and final verification
**Files:** Modify `README.md`, `docs/BACKEND_INTEGRATION.md`.
- [ ] Document working operations and remaining limits.
- [ ] Re-run syntax and focused logic checks.
- [ ] Inspect Supabase security/performance/health advisors.
- [ ] Check GitHub Pages workflow separately; do not claim deployment unless a run succeeds.
