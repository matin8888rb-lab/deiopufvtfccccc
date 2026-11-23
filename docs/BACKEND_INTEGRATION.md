# COUNCIL HQ — Backend integration blueprint

## Current release boundary
The GitHub Pages application is a browser-only prototype. It has no server process, model provider, shared database, background worker, or scheduled agent execution. Demo messages are seeded examples, not real agent output. User-entered projects, journal entries, research ideas, and chat drafts can be saved locally and exported as JSON.

## Target architecture
- **Web client:** this repository; Persian RTL, mobile-first PWA.
- **Authentication:** Supabase Auth; one owner workspace initially.
- **Database:** PostgreSQL with RLS for projects, tasks, council sessions, messages, decisions, evidence, journal entries, research proposals, approvals, and audit events.
- **Agent gateway:** Supabase Edge Function. The browser sends a user-scoped request; the function validates the JWT, checks workspace permissions and quotas, then calls the chosen LLM using a server-side secret.
- **Orchestrator:** bounded task queue and scheduled worker. No infinite loops. Each run has a goal, deadline, token/cost ceiling, allowed tools, and required output.
- **Research:** source retrieval, source URLs, claim status, evidence excerpts, and a separate verification step.
- **Audit:** append-only activity records with actor, timestamp, input/output references, status, and approval state.

## Decision and safety rules
1. Separate verified fact, analysis, hypothesis, and opinion.
2. Record both supporting and opposing arguments; disagreement requires reasons and evidence.
3. The six main members have equal standing. The judge facilitates reasoned resolution and is not a permanent leader.
4. High-impact or irreversible actions require explicit owner approval.
5. A member may pause a task when a serious risk is detected; the pause and reason are audited.
6. Enforce rate limits and per-run budgets; stop safely when limits are reached.
7. Never expose provider secrets or Supabase service-role credentials to the browser.

## Suggested core entities
- workspaces, workspace_members
- projects, tasks, task_dependencies
- council_sessions, messages, decisions, decision_revisions
- journal_entries, member_notes
- research_topics, sources, claims, evidence
- approvals, agent_runs, audit_events, usage_ledger

## Activation checklist
- Choose the Supabase account/workspace and confirm the actual quoted cost before provisioning anything billable.
- Create the project and apply a reviewed schema with RLS policies.
- Deploy an authenticated Edge Function and store provider keys as server-side secrets.
- Add the public Supabase URL and publishable key to the client configuration only; never add service-role or model keys to Git.
- Connect the client to Auth and the database; verify RLS with separate owner and non-owner sessions.
- Add a bounded queue/scheduler and test pause, retry, quota, and human-approval paths.
- Run end-to-end tests before enabling real agent actions.

## Not activated yet
No Supabase project is currently connected to this repository, and neither of the connected Supabase accounts currently has a project available. Therefore the backend above is a design contract, not a live service.
