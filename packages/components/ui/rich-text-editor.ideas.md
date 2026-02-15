# Rich Text Editor - Follow-up Ideas

This file captures the improvement ideas discussed during the history/UX work so they are not lost.

## Near-term Ideas

1. Revision diff view
- In the full revision dialog, show a visual diff between current content and selected revision.
- Keep quick apply as default, diff as optional “inspect before apply”.

2. Better revision understanding
- Continue improving revision cards for long and multiline documents.
- Explore side-by-side mini preview for selected revision.

3. History keyboard discoverability
- Show an inline hint for history shortcut (`Ctrl/Cmd+Shift+H`) when history button is hidden.
- Consider a short onboarding tooltip the first time shortcut mode is used.

4. Word/Docx paste fidelity mode (major org need)
- Add dedicated Word-paste detection path (`Mso` markers / Word HTML signatures).
- Build a Word-specific normalization layer before sanitize so pasted content stays visually close to source.
- Preserve meaningful structure: headings, lists, nested lists, tables, links, images, alignment, spacing.
- Keep strict sanitizer allowlist but make it Word-aware (drop unsafe/irrelevant styles and `mso-*` noise).
- Add an opt-in “fidelity mode” input (keep current strict mode as default or configurable).
- Add regression fixtures from real org docx examples and verify normalized output snapshots.

5. Mention/tag output contract + host notifications
- Mentions and tags should support configurable output rendering on insert, including link output.
- Add API to define how mention/tag HTML is generated (e.g., plain chip, `<a>` link, custom template).
- Add URL template support for links with token replacement, e.g.:
  - `http://example.local/:userId`
  - `http://example.local?userId=@@userId@@&sort=asc`
- Sanitize final resolved URL before injecting into editor HTML.
- Emit host-facing events for mention/tag insertion so parent app can react (analytics, notifications, side effects).
- Consider per-type config (mentions vs tags) and fallback behavior when template tokens are missing.

## Bigger Product Differentiators

1. Comments and suggestions mode
- Track changes with accept/reject flow.
- Inline comments anchored to selections.

2. Slash commands and extensible command registry
- `/` command palette for blocks/actions.
- Public extension API so apps can register custom commands.

3. Realtime collaboration adapter
- CRDT/Yjs integration layer.
- Presence cursors and conflict-safe co-authoring.

4. Templates and snippets
- Reusable content blocks.
- Variable placeholders for dynamic insertion.

5. Import/export fidelity pack
- Better round-trip support for HTML/Markdown/Docx.
- Preserve structure and formatting across formats.

6. AI assist hooks
- Optional APIs for rewrite/summarize/translate/tone adjustments.
- Keep provider-agnostic integration points.

7. Enterprise compliance pack
- Audit log of editing actions.

- Policy enforcement and optional PII scanning hooks.

## Cross-Component Shortcut System (platform-level idea)

1. Central shortcut registry
- Components register actions + default bindings in one shared registry.

2. Rebind dialog
- Users can view all bindings, rebind per action, and resolve conflicts.

3. View-only system shortcuts
- Non-rebindable app/system shortcuts shown for transparency.

4. Persistence
- Store user overrides by app/user scope.
