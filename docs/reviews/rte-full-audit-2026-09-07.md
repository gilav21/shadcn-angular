# Rich Text Editor — full audit, 2026-09-07

Scope: the whole editor, not just the toolbar. Base component, 14 addons,
sanitizer, paste normalizer, file-import parsers, image lifecycle,
accessibility, responsive and touch.

Method: five parallel code-analysis agents plus browser verification by the
coordinator. **Every bug listed as CONFIRMED below was reproduced in a real
browser with an A/B control** — the control shows the same action succeeding
when the triggering step is removed. Findings that were code-only, or that the
browser contradicted, are recorded separately and explicitly *not* claimed as
bugs.

A note on method: the deepest findings came from reading code, not from
clicking. The browser only confirms a bug you already thought to look for.

---

## The dominant bug class

Nine of the confirmed findings share one root cause:

> **An operation replaces DOM nodes, and a stale reference to the old nodes
> survives and is then used.**

`undo()`, `redo()`, `writeValue()` and `setContent()` all assign
`editorDiv.nativeElement.innerHTML = html`, which detaches every existing node.
Any addon or menu holding an element reference across that moment is then
mutating dead DOM. Because `mutateContent`/`applyMutation` finish by re-reading
the *live* editor, the mutation is invisible: **the action silently does
nothing** — no error, no console warning, no history entry.

This class has been fixed at least four times in this file already
(`reSaveLiveSelection` for fonts, `tableContextMenuTarget` inside `retagRowCells`,
`restoreSelection`'s `preferLive` guard, `retryAutoUpload`'s `isConnected`
check). Each fix was applied at one call site while a sibling was left
untouched. That is why the class keeps coming back.

**Systemic fix worth considering:** a liveness guard at the base
(`mutateContent` / `applyMutation` rejecting or re-resolving a target that fails
`editor.contains(el)`), rather than another per-site patch.

---

## CONFIRMED bugs — reproduced in browser with A/B control

### 1. Table context menu acts on detached DOM after undo
**Severity: high** (silent data-loss-shaped failure; user believes the action ran)

Repro: right-click a merged cell → menu opens → press Ctrl+Z while the menu is
still open → click **Split Cell**.

| | measured |
|---|---|
| With undo | `htmlChanged: false`, colspan still `"2"` — **nothing happened** |
| Control (no undo) | `htmlChanged: true`, cell split into two |

Cause: `closeTableContextMenu()` (`rich-text-editor.component.ts:2581`) never
clears `tableContextMenuTarget` (field `:438`); only the three delete methods do
(`:3625`, `:3723`, `:3737`). `splitCell()` null-checks the target but never
checks `isConnected`, and **no use of that field anywhere has a liveness guard**.
`target.closest('table')` on a detached node happily returns the old detached
table. ~12 menu actions share the field.

The menu stays open across the undo because its own
`(mousedown)="$event.preventDefault()"` keeps the editor focused.

### 2. Multi-cell selection goes stale after a header retag
**Severity: high** (same silent-failure shape)

Repro: shift-click to select two cells → right-click one → **Toggle Header Row**
→ apply a cell background.

| | measured |
|---|---|
| With retag | cells became `<th>`, but `.rte-cell-selected` count `0`, `setCellColor` changed **nothing** |
| Control (no retag) | both `a1` and `b1` get the background |

Cause: `retagRowCells` (`:3797-3805`) carefully re-points
`tableContextMenuTarget` to the replacement cell —
`if (wasTarget) this.tableContextMenuTarget = replacement;` — with a comment
explaining the historical bug it fixes, but **never touches `tableCellSelected`
or `tableCellSelectAnchor`**. The fix was applied to one field and not the one
beside it.

Note `setTableBorders` survives this by accident: it filters on
`table.contains(c)` at `:3833`. That filter is the model for the fix.

### 3. Inline code has no toggle-off — it nests
**Severity: medium** (visible corruption of the document model)

Repro: select a word → Inline Code → re-select → Inline Code again.

```
<p><code>hello</code> world</p>
   ->  <p><code><code>hello</code></code> world</p>     // code code count: 1
```

Cause: `wrapSelectionWithTag` (`:2506-2527`) unconditionally creates a **new**
element and never checks for an existing `CODE` ancestor.
`findAncestorByTag(..., 'CODE')` exists but is used only by the Enter handler.

Meanwhile `detectBlockFormats` (`:5156`) *does* report `code` as active, so the
toolbar shows the button pressed — it looks like a toggle and behaves like a
wrapper. Bold, italic, underline and strikethrough all toggle off cleanly
(verified: no residual tag for any of the four).

Related, same function: for a **non-collapsed** selection the caret is placed
*after* the `</code>`, so typing continues outside the code run; for a collapsed
caret it is placed *inside*. Two different behaviours from one function — worth
confirming against intended UX.

### 4. Two toolbar buttons stay below the 44px touch minimum
**Severity: medium** (WCAG 2.5.8; project rule is zero-tolerance)

The global rule in `demo/src/styles.css:168` and
`packages/cli/src/templates/styles.ts:320` is
`@media (pointer: coarse) { button:not([data-slot]) { min-height: 44px } }`.

Measured by selector matching (independent of the current pointer type):

- **23 of 25** toolbar buttons match and grow to 44px on touch.
- **2 do not**: `rte-images-button` ("Insert Image") and
  `rte-file-import-button` ("Import File") — both put `data-slot` on the
  `<button>` itself (`images-button.html:5`, `file-import-button.html:3`), so
  the `:not([data-slot])` selector excludes them. They keep a 28x28 box on a
  phone.

Base toolbar buttons put `data-slot` on a *wrapper*, not the button — which is
why they are unaffected.

### 5. Toolbar has no roving tabindex
**Severity: medium** (a11y; = known review item B4, still unfixed)

Measured: 25 buttons, **25 tab stops**, zero `tabIndex = -1`. `role="toolbar"`
and `aria-label` are present, so it *announces* as a toolbar but does not
*behave* as one. WAI-ARIA's toolbar pattern requires a single tab stop plus
arrow-key navigation. A keyboard user presses Tab 25 times to cross it.

### 6. Sanitizer `href`/`src` asymmetry on `data:image/svg+xml`
**Severity: low** — real inconsistency, **not** currently exploitable

Same payload, two outcomes (measured):

| attribute | result |
|---|---|
| `<img src="data:image/svg+xml;base64,…<script>…">` | script **stripped** (decodes to a bare `<svg/>`) |
| `<a href="data:image/svg+xml;base64,…<script>…">` | href kept **verbatim, script intact** |

Cause: the `href` case in `applyAllowedAttribute` calls the generic
`sanitizeUrl`, which accepts any allowed `data:` image mime. The SVG-specific
`sanitizeSvgDataUrl` is only reached from `sanitizeImageSrc` (the `src` path).

**Exploitability is low and I verified that rather than assuming it:** a real
anchor click on a `data:` URL opened nothing — Chrome has blocked top-level
`data:` navigation since v60. Worth fixing because the asymmetry is clearly
unintended, not because it is live.

### 7. `inflate()` has no output-size ceiling (zip/PDF decompression bomb)
**Severity: high** (denial of service on file import)

Empirically proven by running the real function:

```
compressedInputBytes:  20388
outputBytesProduced:   20971520     // 20 MB from 20 KB, in 200 ms
capArgumentExists:     false        // inflate() takes no size cap at all
```

Both guards in `zip-reader.ts` — the per-entry `maxFileSize` (`:230`) and the
total `maxUncompressed` (`:287-293`) — test `entry.uncompressedSize`, a field
read from the archive's own headers and therefore **attacker-controlled**. A
crafted zip that under-declares its size passes both gates, and
`inflateCompressedBlock` (`inflate.ts:172-189`) then grows a plain JS
`number[]` via `.push()` in an unbounded `for(;;)` loop. CRC is only checkable
*after* decompression completes, which is too late.

Ordinary deflate reaches 1029:1 on repetitive input (measured), so a few MB of
input can target gigabytes of output. The same `inflate` backs PDF
`FlateDecode` (`pdf-parser.ts:1324`) with no cap found near that call site.

**Fix shape:** pass a max-output budget into `inflate()` and abort when exceeded,
rather than trusting declared sizes.

### 8. Image auto-upload resolves against a detached `<img>`
**Severity: medium**

`onAutoUploadSuccess` (`images.directive.ts:506-520`) and
`handleAutoUploadError` (`:522-532`) close over the `<img>` captured before a
network round-trip, then mutate it with **no `isConnected` check** — and emit
`autoImageUploadComplete` regardless. If undo/redo/`setContent` lands during the
upload window (seconds, realistically), the src swap hits a dead node, the
success event fires anyway, and any base64 blob left in the live document is
now untracked and will never retry.

The sibling `retryAutoUpload` (`:543`) **does** check `img.isConnected` — the
same fixed-here-missed-there pattern as bugs 1 and 2.

### 9. `maxLength` is bypassable by every insert path
**Severity: medium** (data integrity)

Enforced only in `onBeforeInput` (typing, `:1580`) and `handlePasteMaxLength`
(paste, `:1644`). Every other insert path skips it:
`insertTextFromOverlay`, `insertTextAtCaret`, `insertHtmlAtCaret`,
`mutateContent`. Grep across all 14 addon folders for `maxLength`: **zero hits**.

So with the budget exhausted a user can still insert emoji, links, images and
tables. Worst case is a base64 image — hundreds of KB in one action — or a
table's markup.

---

## LIKELY — code-traced, not yet browser-reproduced

| # | Finding | Where |
|---|---|---|
| 10 | Actions addon's `ApplyTarget` (existing/image) is captured before a modal dialog opens and used on confirm with no liveness check. The dialog can stay open indefinitely, and `resolveParams` may await an app-supplied network call. | `actions/rich-text-actions.directive.ts:161-190, 456-523` |
| 11 | AI addon's streaming `draftEl` is held across a network-backed Observable; Accept/Discard mutate it without checking it is still attached. `discard()` calls `commitContent()` even when the draft is gone. | `ai/rich-text-ai.directive.ts:115-116, 286-372` |
| 12 | Links addon's `editingAnchor` is captured when the edit popover opens; undo/redo while it is open detaches it and the save silently no-ops. | `links/rich-text-links.directive.ts:88, 181-191, 254-268` |
| 13 | Images addon's `selectedImage` never revalidated with `isConnected`; native Backspace deletion of a selected image leaves the resize/align overlay bound to a detached node, and its buttons remain clickable. | `images/rich-text-images.directive.ts:152, 384-404` |
| 14 | Slash-commands' `triggerRange`/`anchorBlock` captured on menu open, used in `select()`; a DOM rebuild between the two (e.g. History quick-apply, which renders in the top layer above the menu) passes a stale Range to `removeSlashTriggerText`. | `slash-commands/…directive.ts:107-108, 244-267` |
| 15 | AI addon: no timeout and no explicit cancel. A provider that never emits leaves the panel in `loading` forever; **Discard** is the only escape and is not labelled as a cancel. Two runs can overlap. | `ai/rich-text-ai.directive.ts` |
| 16 | Image resize handles are plain `<div>`s with no `tabindex`/`role`/keydown — resizing is impossible by keyboard. (Align/delete *are* real buttons and work.) | `images/rich-text-images-resizer.component.html:10-28` |
| 17 | No overall file-size cap before `file.arrayBuffer()` on import — the whole file is buffered in memory before any parser-level guard applies. | `file-import/…directive.ts:219-233` |
| 18 | `looksLikePdfText` condition (b) — "no blank-line pairs and ≥5 lines" — is broad enough to misclassify ordinary multi-line plain text (addresses, code, CSV) as PDF text and restructure it with heading/list heuristics. | `rich-text-paste-normalizer.service.ts:1009-1010` |
| 19 | `<font>` tags in generic (non-Office) HTML paste are unwrapped without colour/face conversion, losing styling. `convertFontElements` is only called on the Office/Docs paths. | `rich-text-paste-normalizer.service.ts:932` |
| 20 | PDF import injects extracted `@font-face` CSS straight into `document.head`, bypassing the sanitizer entirely. Safety depends on `FontRegistry.dumpAllFontFaceCss()` escaping font names — not audited. | `file-import/…directive.ts:254-262` |

---

## Feature gaps (not bugs — absent by design or omission)

- **Images cannot be moved.** No `draggable`/`dragstart` anywhere; an image can
  only be relocated by native cut/paste of surrounding content.
- **No captions** (`figure`/`figcaption`): zero references.
- **No `loading="lazy"`** on inserted images.
- **Alt text only on URL insert.** Pasted, dropped and uploaded images get the
  raw `file.name` as alt — no prompt.
- **File import cannot be cancelled** once started; the overlay is busy-only.

---

## Verified SAFE (so coverage is legible)

**Paste security — 10 payloads, tested live in the browser.** All neutralised:
`<script>` removed with contents; `onerror` stripped; `javascript:` href
dropped; `<iframe>` removed; `position:fixed` and `position:absolute` stripped
(`position` is not in the allowlist at all); `background:url()`, `opacity`,
`transform` stripped; `data:image/svg+xml` in **`src`** properly SVG-sanitised.
Only `width`/`height` (`100vw`/`100vh`) survive, which cannot overlay anything
without `position` — cosmetic, not exploitable.

Also confirmed safe by reading: `srcset` and `formaction` never allowlisted;
`expression()` blocked; protocol-relative and backslash image `src` rejected;
`data:` image URLs magic-byte validated; inline `<svg>` pasted as HTML has its
script children dropped; zip path traversal (`../`) validated and rejected;
encrypted PDFs and encrypted zip entries both cleanly rejected; file type
detected by **magic bytes, not extension**; file-import output goes through the
*same* sanitizer as paste.

**Other areas checked with no bug found:**

- **Responsive at 320px**: page does not scroll horizontally
  (`scrollWidth == clientWidth == 320`); the toolbar overflows into its own
  scroll container by design (`scrollWidth 945 > clientWidth 241`).
- **Toolbar `aria-pressed`**: all 17 pressable items are genuinely reported —
  headings/blockquote/codeBlock via the `BLOCK_FORMAT_TAGS` lookup (`:5122`),
  taskList via a dataset check, alignment via `addAlignmentFormat`.
- **Repeated Tab indent**: `getParentListItem()` re-derives the item from the
  live selection every call; offset-based caret capture is immune to
  re-parenting. A regression test at `spec.ts:1994` presses indent twice with
  **no caret re-seeding** — the correct shape.
- **Font pickers**: `reSaveLiveSelection` re-anchors to the spans `execCommand`
  produced *and* updates `savedRange`, so a second pick from the still-open
  panel works.
- **Colour picker**: the `userTouched` provenance guard correctly prevents the
  seeding emission from colouring text on open. The typography picker lacks the
  guard but is safe anyway — `ui-autocomplete`'s `writeValue` deliberately does
  not echo through `onChange`.
- **Find/replace `<mark>` leak**: fixed architecturally. Highlights are
  geometry-only `<div>`s painted into a **sibling** overlay
  (`#editorContainer`), never into `#editorDiv`, so they cannot reach
  `htmlContent`, the form value or history.
- **History**: redo branch correctly discarded on new typing; markdown
  transforms are one undo step; `setContent` flushes pending history first.
- **Outline addon**: headings re-queried fresh every time, never cached.
- **Addon teardown**: every `register*` in the audited addons has a matching
  cleanup that actually runs.
- **Image alignment** survives sanitisation on every round-trip; **resize is one
  history entry per drag**, not per mousemove; **touch resize works**
  (`touchstart`/`touchmove`/`touchend` with `touch-action: none`).
- **Disabled/readonly**: gated at every live entry point — paste, drop,
  dragover, file import, toolbar buttons, Ctrl+K.

---

## Claims investigated and NOT upheld

Recorded so they are not re-raised:

1. **"bold/italic/underline/strikethrough may not toggle off."** Rated LIKELY by
   an agent from the fact that these commands lack the `reSaveLiveSelection`
   protection the font commands have. **Disproved in browser:** all four toggle
   off cleanly with no residual tag.

2. **"Task-list Backspace on the first of several rows leaves the caret
   nowhere."** The code reading is correct — neither branch fires when
   `previous === null` but siblings remain (`:1318-1326`). **But measured
   behaviour is fine:** the caret anchors on the `UL` and typing lands correctly
   inside the new first row (`<span>Xtwo</span>`, zero stray text nodes). The
   browser's own caret normalisation recovers it. A latent code gap worth
   tidying, not a user-visible bug.

3. **"Link insert has no disabled guard."** True — `insertLink` and
   `insertHtmlAtCaret` have no internal guard, and I confirmed content *can* be
   inserted into a disabled editor by calling the API directly. **But both user
   entry points are gated** (Ctrl+K has `when: canEdit`, the button has
   `[disabled]`), and an exhaustive search found no third ungated entry point.
   Hardening, not a bug.

---

## Process note

Four browser agents were originally dispatched in parallel. There is only **one**
shared browser in a session, so they typed over each other — one agent found text
it had never written, and observations were corrupted. All visual results from
that window were discarded and the work redone as code analysis, with the
coordinator doing browser verification serially. Any future audit of this kind
should treat the browser as a single exclusive resource.

---

## Suggested fix order

1. **7** (`inflate` cap) — DoS, and the fix is a bounded-output parameter.
2. **1** and **2** (stale table refs) — silent failures on common actions;
   consider the systemic `editor.contains` guard rather than two more patches.
3. **3** (inline code toggle) — visible document corruption.
4. **9** (`maxLength` bypass) — one guard at the shared insert seam covers all addons.
5. **8**, then **10-14** — same class as 1/2; an `isConnected` check each.
6. **4**, **5**, **16** — accessibility and touch, all small and self-contained.
7. **6** — sanitizer symmetry; low urgency, low cost.

---

## Round 14 — accessibility sweep (all fixed)

An independent auditor with no context on prior rounds was asked to be harsh,
nit-picky and adversarial. It returned four findings, all accessibility, all
now fixed. Each fix was proven by a test that was then sabotage-tested (the
guard was broken and the test confirmed failing) and re-verified in the browser.

| # | Severity | Finding | Fix | Commit |
|---|---|---|---|---|
| R14-1 | CRITICAL | AI addon unreachable by keyboard. `handleTabKey` (`rich-text-editor.component.ts:1189`) intercepts Tab unconditionally, so with the Ask AI chip up, Tab **replaced the selected text with a literal tab** and focus never left the editor — none of the panel's 8 controls could be reached. WCAG 2.1.1 failure plus data loss. Reproduced in the browser: `textAfterTab: "\t"`, `selectionDestroyed: true`, `focusStillInEditor: true`. | The AI directive registers a keydown interceptor that consumes Tab as far as the base is concerned (so `handleTabKey` never runs and never calls `preventDefault`) while leaving the browser's native focus move intact. Mentions and slash-commands already special-case Tab to accept the highlighted option; this surface has nothing to accept, so it gets out of the way. | `f620116f` |
| R14-2 | HIGH | File-import busy layer and failure banner were plain divs inside `@if` blocks. A live region inserted already holding its text is not reliably announced, so an import that spun and then failed was **completely silent** to assistive tech. | Two always-mounted regions carry the text — polite `status` for progress, assertive `alert` for failure (the user would otherwise wait for content that is never coming). The visual layers are `aria-hidden` so nothing is announced twice. | `fd6cc202` |
| R14-3 | MEDIUM | Outline panel — a jump-to-section landmark — rendered as anonymous divs with no role, accessible name, or heading semantics. | Now a `<nav>` named by its own visible `<h2>` via `aria-labelledby`, entries as an `<ol>` of `<li>`. Reachable from the landmark rotor; entry count and position are announced. | `fd6cc202` |
| R14-4 | MEDIUM | 1,572 emoji buttons whose only accessible name was the glyph, which readers announce inconsistently and often as "unknown character". | Names come from the keyword list that already powers search. 715 emoji had no keywords at all — generated from the Unicode character database, with the 247 flags given their ISO code (`flag un`) rather than the raw "regional indicator symbol letter" spelling. Three keywords are joined rather than one because a single leading word collided ~600 times ("person" alone led 37 entries); that cuts ambiguous names to 158, the residue being cases needing direction words the data does not carry. | `fd6cc202` |

Deliberately not fixed, recorded as decisions rather than defects:

- **`<div>` vs `<p>` on Enter** — the browser's default block separator. Changing
  it is its own change with its own round-trip consequences, not an audit fix.
- **Ctrl+H** — intercepted by Chrome's History shortcut before the page sees it.
  Not something the component can win.

---

## Round 15 — adversarial sweep (17 findings, all actionable ones fixed)

A second no-context auditor. It also *disproved* four of its own hypotheses and
retracted two false alarms rather than padding the list — the sanitizer core is
genuinely solid (every classic XSS vector correctly stripped), no ReDoS exists
(the suspicious pattern benchmarked flat at 0ms because its alternation
branches are disjoint), undo/redo across the delta/keyframe boundary is
byte-exact over 12 bursts, the toolbar roving tabindex *is* implemented, RTL is
correctly wired, and 320px does not break the page.

**Three of the top findings were regressions I introduced in earlier rounds** —
the asymmetric `<` escape came from my round-12 edit to `escapeHtmlInContent`,
and the fence-spoofing path from `protectRawTags`, which I extended. That is
the argument for the independent-auditor loop in one line.

| # | Severity | Finding | Fix | Commit |
|---|---|---|---|---|
| R15-1 | CRITICAL | `<u>` destroyed by markdown round-trip, compounding: `hello` → `hello</u>` → `hello</u></u>`, unbounded. The escape let `<u` through (`u` matches `\w`) but escaped `</u` (`/` does not). Default mode, default toolbar button — this ate user data on every persist. | Paired passthrough tags (`u`, `sub`, `sup`, `mark`, `kbd`, `ins`, `del`) are protected as pairs. | `dcf312ca` |
| R15-2 | CRITICAL | Code blocks containing `</div>` escaped twice, rendering visible `&lt;/div&gt;`. | Fences lifted out before any escaping. | `dcf312ca` |
| R15-3 | HIGH | **Mention spoofing.** `protectRawTags` lifted `<span>` out before the fence body was escaped and restored it *live*, so markup hidden in a code fence became a real element — forging `data-mention-id="admin"` in any app that treats it as an identity claim. | Same reorder: a fence is inert text, escaped exactly once. | `dcf312ca` |
| R15-4 | HIGH | `isAllowedDataUrl` returned `true` unconditionally for `data:image/svg+xml`; the `src` path compensates via `sanitizeSvgDataUrl`, the `href` path never did. | `href` refuses the `data:` scheme outright. Chrome blocks top-level `data:` navigation, so this was an allow-list hole, not demonstrated execution — stated as such. | `fcc9e949` |
| R15-5 | HIGH | Image align/delete buttons bound `(mousedown)` only — focusable and completely inert to Enter. | `(click)` bound alongside, with a `detail === 0` guard so a mouse press does not act twice. `aria-label` + `aria-pressed` added. | `9a1bf668` |
| R15-6 | HIGH | `\u200B` caret anchors never removed once real text arrived. One ArrowRight from block start moved past the anchor, not the first letter, so the next character landed **before** it. One dead keypress per block. | Spent anchors swept on input, caret re-anchored. | `a76843cf` |
| R15-7 | HIGH | `maxLength` counted raw `textContent` while the counter counted the stripped value — measured 12 vs 11. Input refused one character early per anchor, counter still showing room. | All four length reads go through one helper. | `a76843cf` |
| R15-8 | MEDIUM | Tables emitted a separator row only when a row held a `<th>`, so headerless and colspan tables produced markdown `parseTables` refused — returning as a paragraph of literal pipes. | Separator always emitted, sized to the widest row counting colspan. | `1215882d` |
| R15-9 | MEDIUM | `splitTableRow` compared a character against `'\\'` — a **two-character** string nothing can equal — so the pipe escape never fired. | Fixed to a single backslash. | `1215882d` |
| R15-10 | MEDIUM | Eight resize handles were bare divs (no tabindex/role/name/keys) at 12×12px. | Focusable named buttons; arrow keys resize (Shift for larger steps); 44px hit area via inset pseudo-element, painted size unchanged. | `f2e45ed1` |
| R15-13 | MEDIUM | `<style>` appended to `document.head` with no teardown, outliving every editor. | Refcounted: shared while any editor needs it, removed with the last. | `f2e45ed1` |
| R15-14 | MEDIUM | Enter exiting a list produced `<div>`; every other block path builds `<p>`. | Dedicated branch exits into `<p>`; nested items still outdent. | `637608a3` |
| R15-15 | LOW | 22 toolbar icon spans missing `aria-hidden` (one already had it). | Added. | `f2e45ed1` |
| R15-16 | LOW | Overlay buttons used `[title]` as their only accessible name. | `aria-label` added. | `9a1bf668` |

**R15-11 and R15-12** are the recurring "tests that lock in defects" pattern —
a green test named *"keeps underline as `<u>`"* that only tested the outbound
leg, and a code-block escaping test using an opening tag only, avoiding the
broken case. Both are corrected in the fixes above. That is now **seven** such
findings across all rounds; the shape is a reliable review heuristic, not a
coincidence.

**R15-17** (100MB file-import read into memory) is left as recorded. The
auditor labelled it SUSPECTED and did not reproduce it; the bound is documented
as deliberate. Flagged, not treated as a defect.

Two of my own tests failed to discriminate and were caught by sabotage runs,
not by passing: the `maxLength` test passed because the sweep had already
removed the evidence (retargeted to put the anchor in a separate block), and
the escaped-pipe test's input never carried the escape it claimed to test
(`'\|'` in a TS single-quoted string is just `'|'`).
