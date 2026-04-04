# Migration Decisions and Tradeoffs

## Decision Summary

### D1: Leave legacy hosted server model
- **Decision**: Move away from long-running Express + server-rendered static frontend + session-table-centered deployment.
- **Why**:
  - Free-tier platforms favor serverless request-based execution.
  - Lower ops overhead and lower cost.
  - Better fit for incremental Cursor-driven delivery in one codebase.
- **Tradeoff**:
  - Must rework auth/session assumptions and route wiring.
  - Some middleware patterns do not map 1:1 to serverless handlers.

### D2: Consolidate to single-repo Next.js + TypeScript
- **Decision**: Migrate split CRA + Express project into one Next.js + TypeScript repo architecture.
- **Why**:
  - Strong maintainability and shared types across UI/API/domain.
  - Faster handoff and fewer cross-project integration points.
  - Better default deployment path for free-tier serverless.
- **Tradeoff**:
  - Requires staged migration and compatibility shims during transition.
  - Frontend and backend refactors happen in parallel with parity pressure.

### D3: Preserve domain behavior before redesign
- **Decision**: Feature parity is prioritized over UX or product changes.
- **Why**:
  - Reduces regression risk.
  - Keeps migration measurable and testable.
- **Tradeoff**:
  - Some known UX/tech debt may remain temporarily.

### D4: Keep availability logic server-side and UI-independent
- **Decision**: Retain server-side availability computation and pure domain module boundaries.
- **Why**:
  - Existing design intent and privacy boundary remain valid.
  - Supports deterministic testing and future provider changes.
- **Tradeoff**:
  - Requires careful API contracts and data mapping layers.

## What We Are Keeping
- Google OAuth as identity provider.
- Relational Postgres data model (users, groups, memberships, events, petitions, responses).
- Group-based availability computation with strict/flexible/lenient semantics.
- Invite link and petition workflows.
- Event normalization rules for all-day and overnight behavior.
- Core onboarding gates (username + calendar selection).

## What We Are Changing
- Hosting model: from always-on server to serverless deployment.
- App structure: from split frontend/backend JS to unified Next.js TypeScript.
- Route/runtime model: from Express middleware chain to Next route handlers + typed services.
- Auth implementation details: from Express session middleware to serverless-compatible auth/session strategy.
- Build/deploy pipeline: from custom two-part build assumptions to platform-native Next deployment.

## What We Are Intentionally Deferring
- Major UI redesign.
- New scheduling features beyond current parity scope.
- Non-essential background automation that could exceed free-tier limits.
- Advanced caching/performance optimization until baseline parity is stable.
- Any multi-provider calendar expansion beyond current Google-first behavior.

## Explicit Legacy vs Current Conflicts Recorded
- Legacy docs describe some group/petition capabilities as MVP/Future targets; repo already includes working routes and UI paths for these.
- Legacy docs and comments assume session-backed Express runtime and Render-like deployment constraints; this is treated as an old implementation detail, not a permanent requirement.

## Decision Guardrails for Implementation
- If a migration choice risks parity, choose parity first.
- If old docs conflict with executable code/tests, trust code/tests.
- Keep domain logic in framework-agnostic modules where practical.
- Keep migration steps small, reversible, and independently verifiable.
