# Cal.diy Development Guide for AI Agents

Work as a senior Cal.diy engineer in this Yarn/Turbo monorepo. Prioritize type safety, security, small reviewable diffs, and the repository guidance indexed in [`agents/README.md`](agents/README.md).

## Binding engineering rules

- Prefer Prisma `select` over `include`; never expose `credential.key`.
- Use `import type` for TypeScript types and import source modules directly instead of barrel `index.ts` files.
- Use early returns to reduce nesting.
- Use `ErrorWithCode` in services, repositories, and utilities; reserve `TRPCError` for tRPC routers. See [`agents/rules/quality-error-handling.md`](agents/rules/quality-error-handling.md).
- Keep business logic in services, not repositories.
- Put permission checks in `page.tsx`, never `layout.tsx`.
- Add all UI strings to `packages/i18n/locales/en/common.json`.
- Use `date-fns` or native `Date` when timezone awareness is unnecessary.
- Use Biome for formatting and linting.
- Add comments only when they explain why. Follow [`agents/rules/quality-code-comments.md`](agents/rules/quality-code-comments.md).
- Never use `as any`, commit secrets, bypass type checks, or edit `*.generated.ts` files directly.
- Search with `ast-grep` when available, then `rg`, then `grep`.

## Change boundaries

- Use conventional commit and PR titles such as `feat(scope): description`.
- Create draft PRs by default.
- Keep a PR focused and normally below 500 changed code lines and 10 code files. Split larger work by dependency, layer, or feature responsibility.
- Ask before adding dependencies, changing `packages/prisma/schema.prisma`, deleting files, changing multiple packages, force-pushing/rebasing a shared branch, or starting full build/E2E runs.
- Documentation, lock files, and generated output do not count toward the code-size guideline, but generated source must still come from its generator.

## Verification

Run the proof appropriate to the changed behavior and do not dismiss failures without first checking the full CI type-check command.

- Type check: `yarn type-check:ci --force`
- Lint/format: `yarn biome check --write .`
- Unit tests: `TZ=UTC yarn test`
- Prisma regeneration after schema changes: `yarn prisma generate`

Before pushing, confirm the type check, Biome, and relevant tests pass. The full command catalogue is in [`agents/commands.md`](agents/commands.md).

## API v2 import boundary

`apps/api/v2` does not resolve direct `@calcom/features` or `@calcom/trpc` imports. Re-export the required symbol from `packages/platform/libraries/index.ts`, then import it from `@calcom/platform-libraries`.

## Working method

- For complex work, state a short plan before making speculative changes.
- Fix type errors before chasing dependent test failures.
- Run `yarn prisma generate` when generated Prisma enums or types are missing.
- Use the opt-in workflow in [`SPEC-WORKFLOW.md`](SPEC-WORKFLOW.md) only when spec-driven development is explicitly requested.

Detailed architecture, domain rules, and examples belong in:

- [`agents/README.md`](agents/README.md)
- [`agents/rules/`](agents/rules/)
- [`agents/commands.md`](agents/commands.md)
- [`agents/knowledge-base.md`](agents/knowledge-base.md)
