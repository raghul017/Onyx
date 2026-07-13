# Updates

Append-only log of implementation tickets. Newest at the bottom.

## 2026-07-13 — T4: Payload placement fix + request builder

Attack payloads now reach GET/DELETE and path/query/header params (not just POST
bodies), and `{placeholder}` path segments are always resolved — closing the gap
where GET/DELETE fired bare paths and literal `{id}` braces were sent. One
payload still equals one request; job cardinality and the completion gate are
unchanged.

- **Added:** `server/src/services/request-builder.ts` (`buildAttackRequest` — decides where the payload goes by attack type), `server/src/services/__tests__/request-builder.test.ts`.
- **Changed:** `server/src/validators/schemas.ts` (job carries optional `parameters` + `requestBodySchema`), `server/src/queues/producer.ts` + `server/src/controllers/test-run.controller.ts` (thread param defs from the in-memory parsed endpoint), `server/src/queues/worker.ts` (build request via the builder; SSRF now vets the final resolved URL; timeout/redaction/detection unchanged).
- **Migration:** none (chose option (a) — params travel on the job; no Prisma/schema change).
- **Docs housekeeping:** moved tracked root markdown into `docs/` (AGENTS, OAUTH_SETUP, WORKFLOW, PROGRESS, changelog, PLAN-dashboard-instrument, Onyx-Master-Implementation-Plan); fixed internal links.
