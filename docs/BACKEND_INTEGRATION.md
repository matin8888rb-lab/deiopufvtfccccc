# COUNCIL HQ — Backend integration blueprint

## Current release boundary
The GitHub Pages application remains a browser-based client. Supabase Auth is connected, and first sign-in creates a private owner workspace plus seven council-member profiles. The PostgreSQL schema currently contains 17 tables with RLS enabled. There is no model provider, Edge Function gateway, background worker, or scheduled agent execution yet. Demo messages are seeded examples, not real agent output. Projects, journal entries, research proposals, user-authored chat messages, tasks, task dependencies, meetings, meeting participants, decisions, decision evidence, and audit events sync to Supabase; LocalStorage remains a device cache/backup. Deletion for tasks is supported; synchronized deletion for projects/journal/research/chat and multi-device conflict resolution are not implemented yet.

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
- [x] Connect the client to Auth and bootstrap an owner workspace and seven member profiles.
- [x] Connect project, journal, research proposal, and user chat create/update sync to the database.
- [x] Connect task create/status/delete, meeting create/start/finish, decision create/status, evidence, and audit-event workflows.
- [x] Add invoker-security database triggers that validate same-workspace references and reject task-dependency cycles.
- [x] Check in the operational-integrity migration at `supabase/migrations/202611240001_council_operations_integrity.sql` (applied to the linked project).
- [ ] Add synchronized deletion for project/journal/research/chat and multi-device conflict resolution.
- [ ] Verify RLS with separate owner and non-owner sessions.
- Add a bounded queue/scheduler and test pause, retry, quota, and human-approval paths.
- Run end-to-end tests before enabling real agent actions.

## Not activated yet
The Supabase project is live and connected for authentication and workspace bootstrap. The current database has 17 public tables and RLS enabled. Project, journal, research proposal, and user-message sync is active in the client after authentication. Task, meeting, decision, evidence, and audit-event workflows are connected in the client. Edge Functions, model provider, event orchestrator, scheduler, and automated research are not active. The original 17-table schema was applied directly; the operational-integrity triggers now have a checked-in migration artifact and a recorded Supabase migration.
