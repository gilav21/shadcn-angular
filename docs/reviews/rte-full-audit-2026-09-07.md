# Rich Text Editor — full audit, 2026-09-07

## Series summary (rounds 13–20)

Eight independent adversarial audits, each run by an agent with **no context on
prior rounds**, each followed by fixes, sabotage-tested regression tests, and
browser verification. Rounds 15 onward were briefed to attack whatever the
previous round had just changed.

**Outcome: 27 fix commits, 88 findings triaged (69 tabulated below, the rest
recorded in prose), 2,249 tests passing, and the SonarQube done-gate green with
zero new issues on the changed code.**

Not every finding became a fix: several were reported CONFIRMED by an auditor and
did not reproduce, and those are recorded as not-bugs rather than quietly
dropped.

### What was found, by round

| Round | Findings | Headline |
| --- | --- | --- |
| 13 | 16 | Stale DOM references surviving `innerHTML` replacement — the dominant class described below |
| 14 | 4 | AI addon completely unreachable by keyboard (WCAG 2.1.1) plus three silent-to-AT surfaces |
| 15 | 17 | `<u>` destroyed by every markdown round-trip; **mention spoofing** via code fence; scriptable SVG in `href` |
| 16 | 15 | `if (x<y)` silently deleted the rest of the line in the default mode; forgeable fence tokens |
| 17 | 11 | **Open redirect** (`/\host`); `DOMException` from stale table refs after undo |
| 18 | 9 | A test of mine that could not fail; whole-document tag pairing deleting prose |
| 19 | 8 | My "per block" fix was a no-op (computed locality, then unioned it away) |
| 20 | 8 | Open redirect a third time; positional pairing; 887× colspan amplification |

### The three recurring patterns

**1. Stale DOM references.** An operation replaces nodes; a surviving reference
is then used against dead DOM, and the action *silently does nothing*. Found in
images, tables, fonts, selection, and the context menu. Now funnelled through a
single `replaceEditorHtml` seam that clears every reference a replacement
invalidates.

**2. Compounding corruption.** A round-trip that is not a fixed point, so the
document degrades a little on *every save and load*: underline gaining a visible
`</u>` each cycle, blockquote markers doubling inside code fences, a nested list
growing two characters of whitespace forever, `wrapBareTextInParagraph` adding a
nesting level per keystroke. Each was invisible for one cycle and unrecoverable
after ten.

**3. Tests that cannot fail for the reason they exist.** Thirteen found, **five
of them mine**. Three sub-species, in increasing subtlety:
- a weak assertion (trailing substring that passes either way);
- a test asserting broken behaviour as correct, sometimes with a comment
  admitting the spec predicted better;
- a **degenerate input** — the test *does* fail under sabotage, so it looks
  load-bearing, but the input is the one shape where the bug cannot manifest.

The third is the one that cost the most. Sabotage-testing proves an assertion is
load-bearing; it says nothing about whether the input is representative. Those
are two separate questions, and only the first was being asked. Two security
fixes shipped with passing sabotage tests and live bugs: a tag-pairing test using
a lone stray closing tag (unpaired under both implementations), and an
open-redirect test using only two-character backslash forms while single-
backslash and triple-slash both bypassed.

### On the value of the loop

**Eighteen of the findings were regressions I introduced while fixing earlier
ones.** By round 17 the auditors were mostly catching my own work rather than the
original code's — which is the argument for running the loop, not against it. The
open redirect took three attempts to close properly; each earlier fix was correct
for the shape I had tested and wrong for the general case.

Two pieces of tooling came out of this and now prevent whole classes of error:
`no-control-regex` in the eslint config (my Python editing scripts had written
literal `` and tab characters into four separate regexes, once making an
alternation silently never match), and the discipline of checking the SonarQube
gate's *analysed revision and coverage fingerprint* rather than its exit code —
the first gate run of the session exited 0 having never scanned at all.

### Deliberately not fixed

Recorded as decisions rather than quietly skipped: `<div>` vs `<p>` as the
browser's default block separator; Ctrl+H intercepted by Chrome; the counter's
"1 words" pluralisation (needs new strings across ten locales — a translation
change, and imposing English plural rules on nine other languages would be
worse); the AI panel's `role="dialog"` (a native `<dialog>` is `display:none`
until `.show()`, so adopting it changes behaviour on a working non-modal panel —
excluded via the project's documented `resourceKey` process, never an inline
disable).

---

## Round 13 — the original audit

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

---

## Round 16 — adversarial sweep (15 findings, all actionable ones fixed)

A third no-context auditor, briefed to attack the areas round 15 had just
changed. It found that three of the round-15 fixes were incomplete or wrong,
which is exactly what the brief was for.

It also disproved its own hypotheses honestly: ReDoS hammering (`*`x4000,
400x60 table bombs, 600-deep lists) topped out at 49ms; a brute-force of every
codepoint 0-0x3100 inside `java*script:` found zero bypasses; mXSS attempts,
`srcset`, `formaction`, `<base>`, CSS `expression()` were all correctly
stripped; table span ops, RTL, and toolbar a11y were clean.

| # | Sev | Finding | Fix | Commit |
|---|---|---|---|---|
| R16-1 | CRITICAL | `if (x<y) { return; }` in markdown mode **lost everything after `<y`**. The escape guessed at tags with a character class, so `<y` read as a tag open and DOMParser swallowed the line. | `escapeHtmlInContent` asks the sanitizer which tags actually survive. Content-bearing unsafe tags (`script`, `style`…) pass through so the sanitizer removes the subtree rather than the reader seeing an escaped payload. | `8a06d166` |
| R16-2 | HIGH | My round-15 passthrough fix listed **seven tags by hand**, so every other kept tag still broke: `<b>x</b>` rendered a literal `</b>` and corrupted permanently on round-trip. | Same allowlist-driven rule; the hand-picked list is gone. | `8a06d166` |
| R16-3 | HIGH | My code-fence tokens were **user-forgeable** — `protectRawTags` strips its own delimiters, `protectCodeFences` did not — so a document could render a fence body twice or erase text with an out-of-range index. | Strips its delimiters the same way. | `8a06d166` |
| R16-4 | HIGH | `selectedImage` kept handing out nodes that `undo`/`redo`/`writeValue` had detached; the overlay's align and delete buttons wrote to the detached copy while the visible image went untouched. | Every wholesale `innerHTML` write goes through one seam that clears the selection. | `8a06d166` |
| R16-5 | MEDIUM | Scrub-or-not was decided from the **MIME label**, while the magic-byte check accepts SVG whatever the label says — so `data:image/png;base64,<svg onload=…>` skipped scrubbing and was stored in "clean" content. Not a live XSS (Chrome won't render it as `<img>`), but the mismatch is the bug. | Scrub follows the payload. | `e735747e` |
| R16-6 | MEDIUM | `isUrlSafe` was a blocklist, so `blob:`, `filesystem:`, `view-source:`, `about:`, `ws:`, `file:` and protocol-relative `//evil` all reached a live `href`. | Allowlist of link schemes. | `4125c464` |
| R16-7 | MEDIUM | Keyboard resize ignored **which handle** was focused (every one grew on ArrowRight, including top-left) and emitted `resizeEnd` per keypress, so undo took N presses. | Uses the drag path's sign tables; a burst folds into one history entry. | `4125c464` |
| R16-8 | MEDIUM | Multi-paragraph paste **nested** `<p>` inside `<p>`, and the sanitized model then disagreed with the live DOM. | The enclosing block is split when the fragment carries blocks; inline pastes untouched. | `7b9872d2` |
| R16-9 | MEDIUM | Separator sized to the **widest** row (my round-15 change) made ragged tables invalid GFM; a `<br>` in a cell emitted a raw newline, so a one-row table came back as **two rows**. | Header decides the width; in-cell breaks become `<br>` via split/join (the obvious regex backtracks — lint caught it). | `db125977` |
| R16-10 | MEDIUM | `<details>` blocks wrapped in stray empty paragraphs; **three tests asserted them as correct**. | `parseParagraphs` knows `details`/`figure` are blocks; tests corrected. | `db125977` |
| R16-11 | LOW | No live region anywhere; `maxLength` enforcement entirely silent — keystrokes just stopped. | Counter is a polite status region showing `n / max`, destructive at the limit. No new locale strings. | `c845996c` |
| R16-12 | LOW | PDF font `<style>` accumulating in `document.head` unbounded. | Capped at twelve, oldest first. Teardown would break already-imported documents, so the bound is the fix. | `7b9872d2` |
| R16-13 | LOW | 48 signal members not `readonly`, against CLAUDE.md S2933. | Marked; none were reassigned. | `e735747e` |
| R16-14 | LOW | Resizer used the global `document` for its eight drag listeners despite injecting `DOCUMENT`. | Uses the injected one. | `7b9872d2` |
| R16-15 | LOW | The anchor sweep **collapsed real selections**. Deeper than reported: writing a text node's `data` collapses any selection inside it, so skipping the re-anchor was not enough. | Both boundaries captured and restored, offsets translated from pre-sweep text. | `e735747e` |

**Not fixed, and why:** the auditor reported a `:::details` body landing inside
its `<summary>`. It does not reproduce — with or without markup in the title,
the body lands correctly. Nothing to fix.

### A recurring hazard in my own tooling

Three separate regexes ended up with a literal `\x08` backspace where `\b`
belonged, because the Python heredocs used to edit files interpreted the
escape. Once, this silently made a regex alternation never match and cost a
long debugging detour chasing "impossible" output. A repo-wide sweep for
control characters now comes back clean, but the lesson is that the editing
method itself was injecting corruption into the code under repair.

Two of my own new tests also failed to discriminate and were caught by sabotage
runs rather than by passing — the same shape as the defect-locking tests the
auditors keep finding. The count of those across all rounds is now **eight**.

---

## Round 17 — adversarial sweep (11 findings, all addressed)

A fourth no-context auditor, briefed to attack what round 16 had just changed.
**Five of the eleven were regressions from my own round-15 and round-16 fixes** —
the loop is now mostly catching me, not the original code.

Its clean-area list was substantial and specific: the payload-content SVG scrub
genuinely closed the hole; the scheme allowlist refuses `javascript:`,
`blob:`, `about:`, `file:`, tab-obfuscated and fullwidth-colon variants; ReDoS
timings topped out at 30ms across the media-target, emphasis and toggle
patterns; PDF `@font-face` interpolation is not injectable because the family
name is generated; toolbar a11y, live regions, and nested-list/task-list/details
round-trips are all correct.

| # | Sev | Finding | Fix | Commit |
|---|---|---|---|---|
| R17-1 | CRITICAL | **Open redirect.** `isUrlSafe` rejected `//host` but not `/\host` or `\host`, which browsers normalize identically. The anchor resolved to `http://evil` (or `file://`) and was decorated with `rel="noopener noreferrer"`, so it read as vetted. `sanitizeImageSrc` already guarded this; `href` never did. | Both slash forms rejected. | `a053e285` |
| R17-2 | CRITICAL | Stale table refs → **DOMException**. `replaceEditorHtml` cleared only the image reference, so after an undo Bold threw: the handler saw a non-empty stale array, claimed it had handled the command, emptied the selection, then `collapseToStart()` threw. Formatting silently lost. | All four references cleared at the seam. | `42bcac16` |
| R17-3 | HIGH | Enter in a blockquote **always escaped it**, so a quoted paragraph could never be split, and Enter in a quoted list/table/code jumped out of the quote. | Only a blank quoted line exits — the original intent. | `42bcac16` |
| R17-4 | HIGH | My round-15 fence lifting **baked quote markers into the code body**, compounding `>` → `> >` → `> > >` per round-trip: exactly the corruption class the lift was meant to stop. | The opening fence's prefix is stripped from every body line and kept on the placeholder. | `c1bc1985` |
| R17-5 | HIGH | My round-16 paste fix **shredded tables**: `BLOCK_TAGS` held `TABLE` but not `TD`, so a paste inside a cell split the whole table (one became two, with a ragged row), and a `<p>` could land directly in `<ul>`. | Cells and list items already hold blocks; the split stops there. | `42bcac16` |
| R17-6 | MEDIUM | My round-16 escape rule made **prose about HTML into live markup**: "The `<table>` element has `<tr>` children" rendered a real table with the sentence swallowed into a cell. | Real markup comes in matched pairs; an unpaired non-void tag is text. | `a053e285` |
| R17-7 | MEDIUM | Header `colspan` produced a 1-cell header over a 2-dash separator (invalid GFM), and the next round-trip narrowed the separator — the table lost a column each cycle. | Rows padded to true width; stability pinned by test. | `4386ddbd` |
| R17-8 | MEDIUM | Fence in a list item — body carried the list indentation. | Prefix stripped. **The list still splits around the fence**; that is `parseLists`, not fence lifting, and the test says so rather than implying otherwise. | `c1bc1985` |
| R17-9 | MEDIUM | `[&_th]:text-left` was the one physical property in an otherwise logical stylesheet, so Hebrew headers sat opposite their own column bodies. | `text-start`. | `4386ddbd` |
| R17-10 | LOW | Vertical arrows on corner handles were **dead controls that ate page scroll** — with aspect locked the height follows the width, but `preventDefault` had already run. | The handler decides whether it can act before consuming the event. | `4386ddbd` |
| R17-11 | LOW | `freeSize` clamped width but not height, so a fast drag computed a 100,000px or negative height and the write was refused — reading as a frozen drag rather than a bound. | Height clamped at both ends. | `4386ddbd` |

### The tooling hazard, finally fixed at the root

A literal `\x08` backspace reached a **fourth** regex this round, because the
Python heredocs used to edit files interpret `\b`. One occurrence silently made
a regex alternation never match and cost a long detour chasing behaviour the
source could not produce. `no-control-regex` is now enabled in
`eslint.config.mjs` and runs via lint-staged on every commit; verified by
injecting the corruption and watching the rule reject it. Zero-width characters
in ordinary strings stay allowed — the editor uses them as caret anchors.

### Scoreboard across the series

Defects frozen into tests as asserted-correct: **eight**. Regressions I
introduced while fixing other findings: **eight** (three in round 16, five in
round 17). The independent-auditor loop is earning its cost primarily by
catching my own work.

---

## Round 18 — adversarial sweep (9 findings, 8 fixed, 1 recorded)

A fifth no-context auditor. Its sharpest finding was not a bug in the code but
a bug in **my testing**, and it was right to lead with it.

| # | Sev | Finding | Fix | Commit |
|---|---|---|---|---|
| R18-1 | HIGH | **A test I wrote last round asserted the broken behaviour as correct.** "keeps an unpaired block tag as text" used `<p>hello</p>` — which *is* paired — and asserted only a trailing substring, so it passed whether the tag became markup or stayed text. It could not fail for the reason it existed. | Rewritten with a genuinely unpaired tag, asserting the escaped output. | `16b47557` |
| R18-2 | HIGH | …and that is why this shipped: `pairedTagNames` counted across the **whole document**, so "Use the `<table>` element." matched an unrelated `</table>` far below and both became live markup — the words vanished and a real table was injected. The exact bug the matched-pair rule exists to stop. | Pairing decided per block. | `16b47557` |
| R18-3 | HIGH | A nested list inside a blockquote was never parsed: the body was joined with `<br>` and left as literal text, and `toMarkdown` re-emitted the `<br>` as trailing whitespace — so the document grew **two characters on every save/load, unbounded**. | Quoted content goes through the list parser. | `16b47557` |
| R18-4 | MEDIUM | Enter on a blank line in the **middle** of a quote inserted its paragraph after the whole quote, teleporting the caret past text the user was editing above, and left the blank line behind. | Exits only from the last line; the spent blank is always removed. | `16b47557` |
| R18-5 | MEDIUM | The keyboard resize path open-coded its clamp — `minWidth` as the *height* floor, no ceiling at all — so round 17's "clamped both ends" fix covered only the mouse. | Shares `clampHeight`. | `16b47557` |
| R18-6 | MEDIUM | `sanitizeSvgDataUrl` bailed unless it found `;base64,`, **silently deleting every URL-encoded SVG** — an ordinary, spec-legal inline image. Fail-closed, so never a security hole, but real content loss. An existing test asserted the deletion as correct. | Both encodings handled; that test fixed. | `16b47557` |
| R18-7 | LOW | An indented fence escaped its list item and split the list — the case I explicitly scoped out last round. | The parked token is carried by the item it is indented under. Better than the state I left it in. | `16b47557` |
| R18-8 | LOW | Counter had no `aria-describedby` from the textbox, so a screen-reader user tabbing in was never told a limit existed. | Composed with any consumer-supplied value. | `1ff6356f` |
| R18-9 | LOW | Counter reads "1 words". | **Not fixed, recorded.** Correct pluralisation needs new strings across ten locales — a translation change, not an audit fix, and imposing English plural rules on nine other languages would be worse than the current wording. | — |

Its clean list was again specific and useful: the URL guard held against every
backslash and case variant, markdown XSS vectors were all neutralised, SVG
scrubbing and token forgery were correct, ReDoS timings stayed ≤16ms, and the
`replaceEditorHtml` stale-ref clearing works as documented.

My first version of the keyboard max-height test also failed to discriminate —
the stubbed rect meant the ceiling was never reached — and the sabotage run
caught it, not the passing run.

### Scoreboard

Defects frozen into tests as asserted-correct: **ten** (two now mine).
Regressions introduced while fixing other findings: **eleven**.
The loop's main value is no longer finding bugs in the original code; it is
catching the ones I add and the tests I write that cannot fail.

---

## Round 19 — adversarial sweep (8 findings, all fixed)

A sixth no-context auditor, explicitly briefed to audit the **specs** as harshly
as the source. That instruction paid for itself immediately.

| # | Sev | Finding | Fix | Commit |
|---|---|---|---|---|
| R19-1 | CRITICAL | **My round-18 "per block" fix was a no-op.** I split into blocks, computed a set for each, then **unioned them into one document-wide set** — throwing the locality away again, while the comment claimed a fix the code did not implement. A genuine `<b>bold</b>` anywhere re-promoted every prose mention of `<b>` to markup: "wrap it in `<b>` tags" lost the word, and repeated round-trips fabricated an `<hr>` out of the wreckage. Reached through `writeValue`, so every form-bound markdown consumer. | Pairing travels with its block to the point of use. | `d1ff0a86` |
| R19-2 | HIGH | **Open redirect, again.** `https:\evil.com` bypassed the guard: the schemeless backslash forms were rejected, but `https:` is on the scheme allowlist, so a scheme-qualified backslash authority never reached the authority check. Decorated `rel="noopener noreferrer"`, reading as vetted. | Checked before *and* after the scheme, in string code — the character class for this is easy to get subtly wrong, and wrong here is an open redirect. | `d1ff0a86` |
| R19-3 | HIGH | `clampHeight` applied `maxWidth` — a **width** ceiling — to height, squashing every portrait image, contradicting that input's own docs. **My tests asserted the squashing as the contract.** | Shared minimum kept; width ceiling no longer applied to height. | `d1ff0a86` |
| R19-4 | MEDIUM | The indented-fence fix held for **one pass**: `toMarkdown` flattened the fence to column zero, so the next `toHtml` no longer saw an indented token and it escaped the list. The test checked a single conversion, never a round-trip. | Fences inside a list item are re-emitted indented; the test round-trips. | `ee643063` |
| R19-5 | MEDIUM | Nested blockquotes entirely unsupported — one `>` stripped, no recursion, second marker rendered as a literal character. | Recurses. | `ee643063` |
| R19-6 | MEDIUM | Four `BLOCK_TAGS` entries unreachable because `blockToSplit` tests `BLOCK_CONTAINER_TAGS` first — dead weight reading as if handled. | Sets made disjoint. | `ee643063` |
| R19-7 | LOW | `escapeEnclosingBlock` read a node's child index **after** possibly removing it, so `indexOf` returned -1 and the caret jumped to the start of the parent. | Insertion point captured first. | `ee643063` |
| R19-8 | LOW | Counter read "0 / 120 characters" — my round-16 change interpolated the limit into the `{count}` slot. Ungrammatical and unlocalizable, the separator hardcoded in the template. | Localized phrase intact; limit follows as "(120 max)". | `ee643063` |

### The lesson this round actually taught

Both R19-1 and R19-2 were fixes that shipped **with a passing sabotage test**.
My tests exercised a *degenerate* instance of each bug class — a lone stray
closing tag (unpaired in both blocks, so the union was empty either way), and a
*schemeless* backslash (never reaching the allowlist branch). Both tests fail
under sabotage, so a mechanical "can this test fail?" check passes them, and
both bugs were still live in their realistic form.

**Sabotage-testing proves an assertion is load-bearing. It does not prove the
input is representative.** That is a second, separate question, and this series
had not been asking it. The new tests use the realistic shape; sabotaging R19-1
now fails three tests where it used to fail one.

### Scoreboard

Defects frozen into tests as asserted-correct: **twelve** (four now mine).
Regressions introduced while fixing other findings: **fourteen**.

---

## Round 20 — adversarial sweep (8 findings, all addressed) + SonarQube gate GREEN

A seventh no-context auditor, briefed to hunt the **degenerate-input** test
failure mode specifically. Its headline was earned: I documented that trap in a
code comment in round 19, then shipped two more instances of it in the very
tests that comment introduces.

| # | Sev | Finding | Fix | Commit |
|---|---|---|---|---|
| R20-1 | CRITICAL | **Open redirect, third time.** My round-19 fix checked the first TWO characters for `\`, `/\`, `\/`. A single backslash (`https:\evil`) and three slashes (`https:///evil`) both resolved to the attacker host — confirmed by reading a real anchor's resolved `.href` — decorated `rel="noopener noreferrer"`. | Counts the delimiter run; the test enumerates nine shapes. | `f2ba7f2d` |
| R20-2 | HIGH | Same-block pairing counted tag **names**, so it could not tell the two `<b>`s apart in one paragraph: it deleted the prose mention and fabricated a stray `</b>`. With `<table>` it ejected the cell's own text. | Pairing resolved by **position**, with a stack. | `41181daa` |
| R20-3 | HIGH | `FENCE_PATTERN` allowed indentation only *before* quote markers, so a fence in a list in a quote never matched and became literal backticks. My tests covered quote-alone and list-alone — the homogeneous cases. | Prefix accepts both orders; body strip removes up to the indent width. | `41181daa` |
| R20-4 | HIGH | `wrapBareTextInParagraph` moved **every** top-level child into a `<p>` despite its name, compounding a nesting level and two empty paragraphs per keystroke, with DOM/model desync. | Wraps only bare nodes. | `71ae4827` |
| R20-5 | MEDIUM | `colspan` uncapped: one pasted `colspan="99999"` produced ~900 KB of markdown — **887× amplification**, a DoS through the clipboard. | Capped at HTML's own 1000. | `71ae4827` |
| R20-6 | MEDIUM | Removing the width ceiling from `clampHeight` last round left height with **no** bound, reintroducing the 100,000px drag that function's own comment says was fixed. | Bounded both ends. | `71ae4827` |
| R20-7 | MEDIUM | Ten SonarQube issues on the changed code. | Native `<output>` for status roles, comments reworded, optional chain, unnecessary assertion, `String.raw`. | `f2ba7f2d` |
| R20-8 | LOW | `Node.before()` preferred over `insertBefore`. | Applied. | `25606953` |

**Kept deliberately:** the AI panel's `role="dialog"`. It is a *non-modal*,
caret-anchored panel; a native `<dialog>` is `display:none` until `.show()` is
called imperatively, so adopting it is a behaviour change to working code for a
lint rule. Documented in `docs/sonarqube-accepted-findings.md` alongside the
existing drawer entry and excluded by `resourceKey`, per the project's process —
never an inline `eslint-disable`, which would ship into consumers' projects.

### 🟢 SonarQube done-gate: PASSED

```
QUALITY GATE: OK
  new_coverage                   = 90.4    ≥ 80   ok
  new_duplicated_lines_density   = 1.13    ≤ 3    ok
  new_security_hotspots_reviewed = 100.0   = 100  ok
  new_violations                 = 0       = 0    ok
NEW ISSUES ON CHANGED CODE: 0
```

Verified four ways, because **exit code 0 is not a verdict in this project**:
the CE task processed SUCCESS, the coverage fingerprint matches the current
tree, all four gate conditions report OK, and an independent issue query returns
zero.

The first gate attempt this session **exited 0 without scanning at all** —
coverage failed on a `rich-text-view` test (I had been scoping runs to
`rich-text-editor/`, missing the component that consumes it), so no fingerprint
was written and no analysis ran. A second attempt reported `ANALYSIS SUCCESSFUL`
against a revision *older* than the fixes being verified. Both would have read
as success to anyone checking the exit code.

That failing test was itself the **thirteenth** defect-locking test found: its
comment stated outright that the spec predicted a symmetric escape, the
implementation half-delivered, and it asserted the half-broken output.

### Scoreboard

Defects frozen into tests as asserted-correct: **thirteen** (five now mine).
Regressions introduced while fixing other findings: **eighteen**.
