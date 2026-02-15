# Demo App Guidelines

This is the demo application for shadcn-angular. All component design rules, Angular conventions, and testing patterns are defined in the root `.claude/CLAUDE.md` — follow those as the single source of truth.

## Demo-Specific Rules

- Use `NgOptimizedImage` for all static images (does not work for inline base64 images)
- Use paths relative to the component TS file for external templates/styles
- Demo imports use `@/*` → `src/*` (not the root alias)
