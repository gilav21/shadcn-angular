# Changelog

All notable changes to the **components** — what you get when you run
`npx @gilav21/shadcn-angular add <component>`.

Component and lib source is served live from `master`, so everything here
reaches you on merge with no npm publish. The CLI package keeps its own log in
[`packages/cli/CHANGELOG.md`](packages/cli/CHANGELOG.md), and the compiled
packages (`@gilav21/shadcn-angular-rte`, `-data-table`) ship on their own
release train.

Because the code lives in *your* project, an upgrade is opt-in per component:
`npx @gilav21/shadcn-angular diff <component>` shows what changed before you
take it, and `update` applies it. Breaking changes are also machine-readable —
the CLI reads them from the registry and prints the migration for the
components you actually have.

---

## Unreleased

Rich text editor: a consumer API, a read-only renderer, a privacy control for
remote images, and ~110 fixes from a 25-round adversarial audit.

### ⚠️ Breaking

**One breaking change.** Every other breaking entry the CLI reports for the
rich text editor — the addon extractions for images, links, tables, mentions,
emoji, colours, typography, slash-commands, history, file-import, AI and
outline — shipped in an earlier release and is unchanged here.

- **`[customToolbarItems]` / `(customToolbarAction)` are removed**, along with
  the `RichTextCustomToolbarItem` and `RichTextEditorRef` types, and the
  toolbar's `[customItems]` / `(customItemClick)` / `customButtonClasses`.

  There were three ways to add a toolbar button and the weakest looked the
  simplest. `customToolbarItems` handed you a ref whose inserts updated the
  model but recorded **no history entry**, so undo would not step over them
  cleanly.

  Migrate to the addon-host seam, which is now the only path:

  ```ts
  // Before — removed
  <ui-rich-text-editor [customToolbarItems]="items"
                       (customToolbarAction)="onAction($event)" />

  // After — a directive on the editor element
  @Directive({ selector: '[myToolbarButton]', standalone: true })
  export class MyToolbarButtonDirective {
      private readonly host = inject(RichTextEditorAddonHost);
      constructor() { this.host.toolbarSlots.register(/* ... */); }
  }
  ```

  A template still binding the old input fails to compile (NG8002) rather than
  silently ignoring it, and `npx @gilav21/shadcn-angular diff rich-text-editor`
  prints the mapping from every removed ref method to its host equivalent.

  No compat shim: the library is pre-1.0 and hedging with optional fields costs
  more than it saves.

### ✨ New — `ui-rich-text-view`

A read-only renderer for what the editor produced — same sanitizer, same
markdown parser, same typography, no editor on the page.

```html
<ui-rich-text-view [value]="post.body" />                <!-- markdown, default -->
<ui-rich-text-view mode="html" [value]="post.html" size="lg" dir="rtl" />
```

Install with `add rich-text-view`; it pulls the editor base for the two shared
services. Task-list checkboxes render their authored state but are frozen —
out of the tab order, and a click will not toggle them.

### 🔒 Remote images and tracking

A remote image is a silent outbound request every viewer's browser makes on
render, so any host named in a pasted document learns who opened it and when.
The industry answer is to proxy through your own backend; this editor has none,
so it offers the next best thing — you name the hosts you already trust.

**Nothing changes unless you opt in.** The default is an empty list, which
means no policy and today's behaviour exactly.

```html
<!-- See your exposure first: fires for EVERY remote image and CSS background,
     allowed or not, even with no policy set -->
<ui-rich-text-editor (remoteResource)="log($event)" />

<!-- Then restrict, on the editor and the view -->
<ui-rich-text-editor [allowedResourceHosts]="['cdn.acme.com', '*.assets.acme.com']" />
<ui-rich-text-view   [allowedResourceHosts]="hosts" />

<!-- Or once, for a page full of views -->
<div [uiRichTextResourcePolicy]="hosts">
  @for (post of posts; track post.id) {
    <ui-rich-text-view [value]="post.body" [inheritResourcePolicy]="true" />
  }
</div>
```

- **Set it on the view too.** A policy on the editor governs what an *author*
  can insert; it is not stored in the saved document, and the request fires
  when content is **rendered**.
- **Blocked images are reversible, not lost.** The `<img>` keeps its `alt` and
  its position, gains `data-blocked-src` with the original URL, and renders as
  a labelled placeholder. Allowing the host later restores it. Override the
  caption with `[blockedImageMessage]`.
- **Matching is on the parsed hostname**, exact and case-insensitive.
  `*.acme.com` matches by label, so `cdn.acme.com.evil.com` never passes.
- **`data:` and relative URLs are always permitted** — that is how a Word paste
  carries its images.
- **CSS `url()` still needs an allowlist.** Refused by default, as always; a
  background is invisible to the reader in a way a stray image is not.
- **What it does not do:** an allowlist narrows exposure to a party you
  *named*. `cdn.acme.com/logo.png?viewer=bob` still identifies the reader. It
  is a tracking control layered on the XSS guard, not a replacement for it.

### ✨ New features on the editor

- **A consumer API** — `RichTextEditorApi` with `setContent`, `focus`,
  `format`, `insertHtml`, `insertText`, `isEmpty`, `selection`, `undo`, `redo`
  and `markClean`, plus dirty tracking and a `(historyChange)` output.
- **Markdown input rules** — `# `, `- `, `> `, fences and inline markers
  transform as you type. On by default; `[markdownShortcuts]="false"` opts out.
- **Find & replace v2**, on an overlay that no longer lives in the content.
- **A Text style select**, now the toolbar default, with the caret's current
  block reported through `activeFormats`.
- **Print the document**, not the window onto it.
- **Spreadsheet-style table cell selection.**
- **A character limit** that is both shown and announced.
- **One `[locale]` binding localises every addon.**
- `[recordExternalWrites]`, `[findDebounceMs]`, `[historyDebounceMs]` and
  `[historyLimit]` for tuning.

### 🔐 Security fixes

Every one of these is in the sanitizer or a parser, so they apply to any
content your users can paste.

- A **backslash open-redirect** in link targets, plus a generalised off-origin
  authority check that also refuses `https:\host` and `https:///host`.
- **`data:` URLs validated by content**, not by their declared type —
  including payloads that only look like images once truncated. Every `data:`
  URL is refused as a *link* target.
- **CSS `url()` blocked however it is escaped** — `\75rl(`, comments, quoting.
  The previous substring test was the bypass.
- **SVG scrubbed by content** rather than by extension.
- A **decompression bomb** in file import, and a bounded `LZWDecode` in the PDF
  parser.
- **ReDoS**: find patterns that hang the tab, fence backtracking, and a
  quote-depth blind spot in the guard itself.
- **Link schemes allowlisted.**
- Whether a string is a tag is now decided **by the sanitizer**, not by
  guessing at characters.

### 🐛 Bug fixes

**Round-tripping no longer loses content.** Saving and reloading used to drop
or mangle: colour, highlight and font; `mark` / `sub` / `sup` / `small` /
`ins`; code spans and backslash escapes; hard line breaks; empty list items;
the paragraph after a list or a rule; nested and tight (`>>`) blockquotes; GFM
tables; percent-encoded PNG and JPEG images; single-cell tables from Word
pastes; fences longer than three characters; and plain-text pastes, which were
being reflowed.

**Editing**

- Redo no longer destroys text typed after an undo.
- Deleting across a table edge no longer eats the next block.
- Markdown lists no longer lose their text or split into one list per item.
- Tables size to their widest row instead of dropping cells; spanning cells
  pad correctly.
- Exiting a list produces a paragraph, not a browser-default `div`.
- A transformed block accepts typing again (the caret is anchored).
- Mention-select crash, stale table references, and popovers that stayed open
  when their content was replaced.

**Accessibility**

- The editor tells assistive tech what state it is in; combobox ARIA on
  suggestion popups; import status, the outline panel and emoji names are
  audible; the toolbar's roving tabindex actually roves; image resizing and the
  overlay buttons work from the keyboard; frozen task checkboxes stay in the
  accessibility tree.

**Touch and small screens**

- Table columns resize by touch; touch targets meet the 44×44 minimum; the
  outline panel becomes a full-width overlay below `md`.

**Performance**

- Each pasted subtree is converted once rather than repeatedly, which removes
  the quadratic walk that made large pastes slow enough to look hung.

### 📦 Compiled packages

`@gilav21/shadcn-angular-rte` and `@gilav21/shadcn-angular-data-table` are
built with ng-packagr from a registry closure, with `release:package` handling
everything up to `npm publish`.

They support **Angular 20 and 21**. The 21-only pin was dropped after
measuring: partial-Ivy `minVersion` across both packages tops out at 17.2.0,
and a real Angular 20.3.30 app installs the 21-toolchain-built tarball and
builds for production. Only the peer range had ever excluded 20.

### 🛠 CLI

- **`--preset`** installs a named addon bundle in one command.
- The **install summary groups components by why each one is there** —
  requested, dependency, or addon.
- Install-time output explains what owning the code means.

---

## Earlier releases

Component changes before this entry are recorded in the CLI changelog, which
covered both until the two were split.
