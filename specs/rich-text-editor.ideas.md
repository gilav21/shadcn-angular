# Rich Text Editor - Follow-up Ideas

This file captures the improvement ideas discussed during the history/UX work
so they are not lost.

## Near-term Ideas

1. Revision diff view

- In the full revision dialog, show a visual diff between current content and
  selected revision.
- Keep quick apply as default, diff as optional “inspect before apply”.

1. Better revision understanding

- Continue improving revision cards for long and multiline documents.
- Explore side-by-side mini preview for selected revision.

1. History keyboard discoverability

- Show an inline hint for history shortcut (`Ctrl/Cmd+Shift+H`) when history
  button is hidden.
- Consider a short onboarding tooltip the first time shortcut mode is used.

## Bigger Product Differentiators

1. Comments and suggestions mode

- Track changes with accept/reject flow.
- Inline comments anchored to selections.

1. Slash commands and extensible command registry

- `/` command palette for blocks/actions.
- Public extension API so apps can register custom commands.

1. Realtime collaboration adapter

- CRDT/Yjs integration layer.
- Presence cursors and conflict-safe co-authoring.

1. Templates and snippets

- Reusable content blocks.
- Variable placeholders for dynamic insertion.

1. Import/export fidelity pack

- Better round-trip support for HTML/Markdown/Docx.
- Preserve structure and formatting across formats.

1. AI assist hooks

- Optional APIs for rewrite/summarize/translate/tone adjustments.
- Keep provider-agnostic integration points.

1. Enterprise compliance pack

- Audit log of editing actions.

- Policy enforcement and optional PII scanning hooks.

## 2026-09-03 Backlog Review (approved bundles → specs)

Full backlog with measurements lives in the session plan; the accepted items
are specced in `specs/rte-improvements-index.md`. Status of earlier items:
slash commands + command registry ✅ built (addon); AI assist hooks ✅ built
(addon); revision diff view — still open (folded into future history v2);
collaboration / comments / track changes — cut by maintainer (not planned).

Accepted for implementation (see the index for order and prerequisites):

1. DX trio + base e2e — barrel re-exports of every addon + `RTE_FULL`, typed
   toolbar table (missing entry = compile error), addon-author guide,
   `e2e/harness/rich-text-editor/` covering the base editor.
1. Markdown input rules (heading `#`, list `-`/`1.`, quote `>`, task `[]`,
   rule `---`, `**bold**`, backtick code) + block-state-aware toolbar with a
   single "Text style" select.
1. Find & replace v2 (cross-markup matches, counter, highlight-all, debounce,
   whole-word/regex) + undo consistency (`setContent`, external writes, overlay
   inserts all recorded; `historyChange`, `isDirty()`).
1. Consumer API pack — imperative API, reactive-forms validators measuring
   visible text, `ui-rich-text-view` read-only renderer, single locale cascade
   (addons inherit the editor's locale).
1. CLI install summary grouped by requested / addons / shared deps with file
   counts, `--preset` (core/writing/media/styling/everything), post-install
   "what now" messaging.
1. Additive compiled npm packages `@gilav21/shadcn-angular-rte` and
   `@gilav21/shadcn-angular-data-table` (copy model unchanged).

Parked, not scheduled: block-state toolbar a11y roving tabindex, density
support for the editor, table editing polish (touch resize, Tab between
cells), image captions/alt prompt, auto-linkify, paste-as-plain-text chip,
code-block language picker + highlighter hook, templates/snippets addon,
autosave/draft addon, block drag handles, focus mode, keyboard-aware bottom
toolbar, floating-toolbar parity for addon slots, copy-as-markdown export,
document stats, emoji shortcodes, `spellcheck`/`lang` passthrough,
superscript/subscript buttons, per-folder `--compact` install layout.

## Cross-Component Shortcut System (platform-level idea)

1. Central shortcut registry

- Components register actions + default bindings in one shared registry.

1. Rebind dialog

- Users can view all bindings, rebind per action, and resolve conflicts.

1. View-only system shortcuts

- Non-rebindable app/system shortcuts shown for transparency.

1. Persistence

- Store user overrides by app/user scope.

## Markdown input rules — accepted follow-ups (out of scope for the C1/B1 spec)

Deferred while implementing `rte-markdown-input-rules-and-block-toolbar-spec`.
Each was considered and deliberately left out, not overlooked.

1. **More block rules.** `####`–`######` headings, and `1)` as an alternative
   ordered-list marker. Both are cheap additions to the `BLOCK_RULES` table in
   `rich-text-input-rules.ts` — one row each.
2. **More inline rules.** `_italic_`, `__bold__`, `~~strike~~`, and the link and
   image forms `[text](url)` / `![alt](src)`. The link rule is the interesting
   one: it needs the sanitizer's URL policy applied to typed input, which the
   paste path already does but the typing path does not.
3. **Numbered lists that start where the author says.** Typing `3. ` currently
   starts the list at 1, because the sanitizer keeps no `start` attribute.
   Supporting it means allowing `start` on `<ol>` and round-tripping it through
   the markdown serializer.
4. **Arabic-Indic and other non-ASCII digits** in the ordered-list rule
   (`٣. `). The regex is ASCII-only today; the locale already knows the
   direction, so the digit set could follow it.
5. **A configurable rule set** — an `[inputRules]` array letting a consumer
   enable a subset rather than the whole feature. Deferred deliberately in
   favour of one boolean, on the "inputs-only configuration" rule; revisit only
   if real consumers ask for a subset rather than all-or-nothing.
6. **`:shortcode:` emoji triggers** (idea C12). The emoji addon has no typed
   trigger at all today — it inserts from its toolbar overlay — so this would be
   its first consumer of `registerInputObserver`.
7. **Delete the markdown service's dead string-buffer helpers.**
   `hasMarkdownSyntax`, `applyFormat`, `insertHeading` and `insertCodeBlock` in
   `rich-text-markdown.service.ts` have zero callers and are not a seam for live
   rules (they operate on a plain-text buffer, not the DOM). Separate cleanup.
8. **`onFormatCommand('undo')` truncates the redo branch.** Its trailing
   `applyMutation` pushes a fresh history entry, so redo-after-undo works
   through the private `undo()` but not through the toolbar command path.
   Pre-existing behaviour, unrelated to input rules, but surprising.
9. **Toolbar overflow menu / roving tabindex** (idea B4) and density tokens
   (B7). The Text style select bought back roughly three buttons of width on a
   phone; an overflow menu is the next lever if the toolbar grows again.
