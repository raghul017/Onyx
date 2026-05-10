## What does this PR do?

<!-- One or two sentences describing the change and its motivation. -->

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor
- [ ] Docs / config

## Testing done

<!-- Describe what you tested and how. Include edge cases if relevant. -->

## Screenshots

<!-- If this is a UI change, attach before/after screenshots. Delete this section otherwise. -->

## Checklist

- [ ] `cd server && npm run typecheck` passes
- [ ] `cd client && npx tsc --noEmit` passes
- [ ] No `console.log` / `console.warn` left in production code
- [ ] New environment variables are documented in `.env.server.example` / `.env.client.example`
- [ ] Prisma schema changes are accompanied by a migration or `db push` note
