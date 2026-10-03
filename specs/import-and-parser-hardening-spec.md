# Import & Parser Hardening — attribute grammar, SVG node types, linear highlighting

> **Status:** Spec — ready for an executing agent
> **Date:** 2026-10-03
> **Source:** codebase review (lib parsers + RTE file import) and its parser
> audit follow-up.
> **Verified against:** `6fae7f7f` (branch `docs/codebase-review-fix-specs`).
> This document is append-only history. Never delete a task row, a superseded
> decision or a fixed bug — mark it and add the new entry below.

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.

**Merge-order note (not a prerequisite):** `specs/parser-resource-limits-spec.md`
(written separately — allocation bombs, recursion/reference cycles, ReDoS, xref
loops from the completed deep parser audit) also edits
`packages/components/lib/parsers/pdf-parser.ts`, and may touch other files under
`lib/parsers/`. The two specs are independent; whichever merges second rebases
and re-runs `npx vitest --run packages/components/lib/parsers`. Neither may
implement the other's items.

**Invariants (each task states which one it serves):**

- **I-1 (attributes):** every attribute value the importers emit is validated to
  its expected grammar or escaped — no raw document string reaches an attribute.
  For a CSS value "escaped" is not enough: a value must match the grammar of its
  property (a colour is a colour), because an escaped `red;background:url(…)`
  still adds a declaration.
- **I-2 (outputs):** an output documented as "the inserted HTML" emits exactly
  what was inserted — the sanitized markup, never the raw import.
- **I-3 (SVG):** `sanitizeSvg` output is inert in **any** context it may be
  parsed in, including the HTML parser (`innerHTML`), not only `<img src>`:
  only allow-listed elements, allow-listed attributes and text survive.
- **I-4 (highlighting):** `tokenizeLine` is linear in the line length for every
  pattern set, terminates for every caller-supplied pattern, and yields the same
  tokens as the current tokenizer.

**Publish verdict:** **no CLI publish** — nothing under `packages/cli/src/**`
changes; component and lib source go live on merge; the registry edit (a new lib
file in two `libFiles[]` lists) is registry **data**. **`@gilav21/shadcn-angular-rte`:
release REQUIRED** — its closure (`lib/parsers/docx-*`, `pdf-parser.ts`,
`pdf-readable/*`, `svg-sanitizer.ts`, `code-highlight.ts`, the file-import
directive) changes and the change is a security fix package users need:
`npm run release:package -- rte patch`. **`@gilav21/shadcn-angular-data-table`:**
closure (`lib/parsers/xlsx.ts` only among parsers) untouched — no release.
Re-verify both with `release-cli` / `release-package` in Task 8.

---

## 0. Step-0 verification — what the review believed vs. what is true

Paths relative to `packages/components/` unless stated; lines at `6fae7f7f`.

| # | Review claim | What the source says | Consequence |
|---|---|---|---|
| V-1 | DOCX: `docx-parser.ts:~354,~426,~433` build `#${raw}` without validation; `docx-to-editor-html.ts:~265-270` writes them into `style="…"`; `w:val='x" onmouseover="…'` injects an attribute. | ✅ Confirmed, and **wider**. Unvalidated parse sites: run colour `parseColorElement` `:352-355`; highlight fallback `:426`; run shading `:433`; paragraph shading `:555`; border colour `parseSingleBorder :589`; cell shading `buildCellStyle :1119`; theme colours `parseThemeColors :1422, :1427` (feed run colours via `applyTintShade`); paragraph `jc` copied raw into `alignment` (`:640`, `:1634`); cell `vAlign` raw (`:1125`); `rFonts` raw (`parseFontFamily :411-419`). Emit side (`lib/parsers/docx-to-editor-html.ts`): run styles `buildRunSpanStyle :264-273` (colour, highlight, background raw; font-family through `escapeAttr` only → no attribute breakout but **CSS declaration injection**, e.g. `Arial;background-image:url(//tracker)`); paragraph `text-align`/`background-color` `:148, :176`; borders `formatBorder :195-199` (style is mapped through an allowlist `:208-214` ✅, colour raw); cell `background-color`/`vertical-align` `:415-416`. Every `style="…"` is written **unescaped** (`:135, :140, :257-258, :325, :401`). Hyperlinks: `escapeAttr` only, no scheme check (`:287`; source `docx-parser.ts:827`). Numeric values (`formatPt`, `twipsToPt`, spans) are numbers ✅. The image `dataUrl` uses a byte-sniffed MIME (`docx-parser.ts:482-484`) ✅. | One shared validator module; validate at parse **and** escape at emit (§D.4 set A). |
| V-2 | The editor sanitizer cleans this on insert, but `rich-text-file-import.directive.ts:~321` emits RAW HTML through `fileImportComplete`. | ✅ Confirmed: `insertImported` (`ui/rich-text-editor/addons/file-import/rich-text-file-import.directive.ts:314-322`) calls `host.insertHtmlAtCaret(html)` — which sanitizes (`rich-text-editor.component.ts:3246` → `insertHtmlFragment :6214-6216` → `sanitizer.sanitize`) — then emits the **unsanitized** `html`. The output's JSDoc (`:111`) says "Emits the inserted HTML" — false. The existing test (`rich-text-file-import.directive.spec.ts:252-263`) asserts only `completes.length === 1` (shape, not content), which is why this survived. | I-2; fix that test (case 1). |
| V-3 | File-viewer validates against `CSS_COLOR` and is safe — reuse it. | ✅ Confirmed: `ui/file-viewer/file-viewer.component.ts:50-112` — `CSS_COLOR`, `cssColor`, `cssFontFamily` (escapes `'`/`\`, drops controls, appends `,sans-serif`), `imageDataUrl`, `safeLinkHref` (`#fragment` or absolute http/https/mailto via `new URL`), `cssBorder`; and the whole style attribute is HTML-escaped (`styleAttr :1744`). These are module-private functions in a component file. | Extract to `lib/parsers/markup-safety.ts`, file-viewer imports them (§D.4 set B). |
| V-4 | "Check the other parsers that emit HTML (pptx, xlsx, doc, pdf-semantic)." | `pptx-parser.ts`, `ppt-parser.ts`, `doc-parser.ts`, `doc-enhanced-parser.ts`, `xlsx-reader.ts` emit **structured data, no markup** (no HTML literals); their markup is built by file-viewer (hardened, V-3). The lib files that emit markup: `docx-to-editor-html.ts` (V-1), `pdf-parser.ts` (V-5), `pdf-readable/readable-emit.ts` (V-6), `pdf-pixel-perfect.ts`, `code-highlight.ts` (DOM, constant classes ✅). `pdf-pixel-perfect.ts`: links through `safeLinkUri` (`:303-313`, used `:3320`), font families generated (`familyNameFor :826-828`), image MIMEs constant, styles numeric — ✅ safe by reading. | pixel-perfect untouched; sampled once as a regression guard (T-11). |
| V-5 | (coordinator) `pdf-parser.ts:4928` `buildItemStyles` emits `font-family: '${item.fontFamily}'` unescaped; `parsePdf` is publicly exported via `ui/index.ts`; link URIs (~4963) escaped only, `javascript:` not blocked. | ✅ **Reproduced** at `6fae7f7f` with `PdfBuilder` and `/BaseFont /X#27#22#3E#3Cimg#20src#3Dx#20onerror#3Dalert#281#29#3E`: output contains `<span style="font-family: 'X'"><img src=x onerror=alert(1)>`. Name `#xx` escapes are decoded by the lexer (`:1129`); `normalizeFontFamily` (`:2379-2392`) keeps quotes and angle brackets. ✅ **Reproduced** `javascript:alert(2)` link: `<a href="javascript:alert(2)" …>` from **`parsePdfPaged`** — ⚠️ the flat `parsePdf` does not render link annotations at all; `wrapItemHtml :4947-4965` gets a URI only on the paged path (`tryExtractLinkAnnotation :3895-3915` has no scheme check). Colours are hex built from numbers (`:2912-2941`, `:3055-3066`) ✅. ⚠️ `ui/index.ts:74` is the repo's library barrel — the CLI does not install it (no root `index.ts` in `registry.json`). Consumers get `parsePdf`/`parsePdfPaged` as exports of the copied `lib/parsers/pdf-parser.ts` (libFiles of file-viewer `registry.json:1513` and the RTE file-import addon `:5625`). **No shipped UI renders `parsePdf*` HTML** (the RTE uses `parsePdfReadable`, the file-viewer `renderPixelPerfectPaged`), so exposure is any consumer calling the exported function and rendering its `html`. | I-1 fix in `pdf-parser.ts` (two sinks). |
| V-6 | (coordinator) `readable-emit` doesn't filter link schemes (the editor sanitizer re-checks it) — decide in or out. | ✅ **Reproduced**: `parsePdfReadable` emits `<a href="javascript:alert(3)" target="_blank" rel="noopener">` (`pdf-readable/readable-emit.ts:422`, `escapeHtml` only). Font family is safe (`sanitizeFamilyName :542-544` strips `'"\;`). Consumers: the RTE import (sanitized on insert; **raw** on `fileImportComplete` until V-2 is fixed) and the demo `demo/src/app/demos/data-display/pdf-readable-compare-demo.component.ts`, which renders through `bypassSecurityTrustHtml` (`eslint.config.mjs:208`). | **In scope** — same invariant, one helper call. |
| V-7 | `svg-sanitizer.ts:~68-86` walks only `.children`, so comments and PIs survive; mXSS if output reaches `innerHTML`; current consumers only use it as `<img>` src (latent). Find every consumer. | ✅ Confirmed (`lib/parsers/svg-sanitizer.ts:68-86`) and **reproduced in jsdom**: `<svg><!--><img src=x onerror=alert(1)>--><rect/></svg>` and `<svg><?x ><img src=x onerror=alert(2)>?><rect/></svg>` both serialize unchanged and yield a live `<img onerror>` after `innerHTML`. Consumers (complete): `ui/file-viewer/file-viewer.component.ts:497-505` (Blob URL → `<img [src]>`, `.html:82`) and `ui/rich-text-editor/rich-text-sanitizer.service.ts:1502-1530` `sanitizeSvgDataUrl` (data URL → `img src`). Both are `<img>` contexts, where SVG never runs script → **latent**. But `sanitizeSvg` ships into consumers' projects as a lib file whose name promises sanitization. Also latent: `DANGEROUS_URL_PATTERN :15` does not strip ASCII tab/newline before testing (`java\tscript:`), and CDATA sections survive. | I-3. |
| V-8 | `code-highlight.ts:~202-234` is quadratic; 70 KB line 195 ms, 300 KB 3.3 s; "the editor re-highlights on idle". | ✅ Confirmed (`lib/code-highlight.ts:218-257`: every step slices `line.slice(cursor)` and re-runs every pattern on it). **Re-measured** here (TS patterns, minified-style line): 10 KB 6 ms, 70 KB 183 ms, 300 KB 3,210 ms. ⚠️ "On idle" → a **debounce timer** after typing re-highlights the caret's code block (`codeHighlightTimer`, `highlightCaretCodeBlock`, `rich-text-editor.component.ts:~8900-8936`), and every `replaceEditorHtml` (setContent, undo/redo, import) re-highlights the **whole document** (`:764-769`). Consumers: `ui/code-block/code-block.component.ts:173`, the editor, `ui/rich-text-view/rich-text-view.component.ts:14`. ⚠️ **Two semantic notes the review did not make:** (1) a regex run on a slice sees an artificial word boundary at the slice start, so `\b` can behave differently from a whole-line search — no built-in pattern uses `^` or lookbehind, and analysis finds no built-in line where this changes the output, but the equivalence test (T-15) is the arbiter; (2) a caller-supplied `LanguagePattern` (public type) that matches the empty string makes today's loop spin forever (`cursor += 0`). | I-4. |
| V-9 | "A deep audit of the binary parsers … was never completed — list as follow-up." | ⚠️ **Superseded:** the audit completed; its resource-limit findings are in `specs/parser-resource-limits-spec.md`. | Cross-reference only (merge-order note above). |

---

## B. Product Manager section

### B.1 Business logic

Documents a user imports are hostile input. Everything the library derives from
them and writes into markup — colours, font names, alignments, link targets,
SVG nodes — must have the shape its slot expects, or not appear. Outputs that
hand imported markup to the consuming application hand over the same safe
markup the editor shows. And highlighting one long line of code must not freeze
the page.

### B.2 Why the customer wants this

| Pain today | Workaround forced today |
|---|---|
| "We log/preview `fileImportComplete`'s HTML in an audit panel. A crafted `.docx` put an `onmouseover` handler on our page." | Run the payload through their own sanitizer — after discovering the output is raw. |
| "We call `parsePdfPaged` and show `pages[i].html`. A PDF with a weird font name broke out of the `style` attribute; a link ran `javascript:`." | Post-process the HTML, or not use the exported parser. |
| "Our security review flagged `sanitizeSvg` — comments survive." | Re-sanitize, or never use it outside `<img>`. |
| "Pasting a minified bundle into a code block freezes the editor for seconds after every keystroke pause." | Don't put long lines in code blocks. |

### B.3 Use cases = definition of done

**Attribute grammar (I-1)**

- **UC-1** A `.docx` whose every colour/fill/highlight/theme-colour/border-colour,
  `jc`, `vAlign` and `rFonts` value carries a breakout payload
  (`x" onmouseover="alert(1)`) or a declaration payload
  (`red;background-image:url(//t)`) renders via `parseDocx` →
  `renderDocxForEditor` to markup in which every element has only allow-listed
  attributes, no `on*` attribute, and every style declaration has an
  allow-listed property with a grammar-valid value.
- **UC-2** The same features with valid values keep their meaning:
  `w:color="FF0000"` → `color:#FF0000`; highlight `yellow` → the mapped colour;
  `shd fill="FFFF00"` → `background-color:#FFFF00`; `jc="both"` →
  `text-align:justify`, `jc="center"` → `text-align:center`; `vAlign="center"` →
  `vertical-align:middle`; `rFonts ascii="Times New Roman"` → a `font-family`
  that resolves to Times New Roman; theme colour + tint still resolves.
- **UC-3** A DOCX hyperlink whose target is `javascript:`, `JaVaScRiPt:`,
  `java\tscript:`, `data:` or `vbscript:` renders its text **unlinked**; `https:`,
  `http:`, `mailto:` and an internal bookmark (`#bookmark-…`) stay links.
- **UC-4** `parsePdfPaged` / `parsePdf` on a PDF whose second font's `/BaseFont`
  decodes to `X'"><img src=x onerror=alert(1)>` emit markup that passes the
  UC-1 inertness check and still carries that run's `font-family` (escaped and
  quoted); a `javascript:` link annotation renders its text unlinked; an
  `https:` one stays a link.
- **UC-5** `parsePdfReadable` on a PDF with a `javascript:` link annotation
  renders the text unlinked; an `https:` link stays.
- **UC-6** `parsePdfPaged` output for a benign PDF is byte-identical before and
  after this spec except where a value changed under UC-4 (no collateral change).

**Outputs (I-2)**

- **UC-7** `(fileImportComplete)` emits the sanitized markup that was inserted:
  for the UC-1 hostile `.docx` it contains no `on*` attribute and no
  `javascript:` URL; `sanitizer.sanitize(emitted) === emitted`; for a benign
  `.docx` it contains the document's text and its run colour.

**SVG (I-3)**

- **UC-8** `sanitizeSvg` output, parsed with the HTML parser, contains only
  allow-listed SVG elements and attributes plus text for inputs carrying a
  comment payload, a processing-instruction payload, a CDATA payload, each
  nested inside allowed elements, and a `<!-->` short comment; CDATA content
  survives as escaped text.
- **UC-9** `href` / `xlink:href` values whose scheme is `javascript:`,
  `vbscript:` or `data:` after the browser's normalisation (leading
  controls/whitespace, embedded tab/newline/CR, mixed case) are removed.
- **UC-10** A real-world SVG icon (gradients, paths, `<text>`, `<title>`) keeps
  every allow-listed node and attribute (fidelity); the existing 28
  `svg-sanitizer.spec.ts` tests stay green.

**Highlighting (I-4)**

- **UC-11** `tokenizeLine` on a 300 KB minified TypeScript line finishes in
  < 300 ms (was 3.2 s) in the unit run.
- **UC-12** For every line of the real-code corpus in all 12 languages
  (§F.7) and for seeded random lines, the new `tokenizeLine` returns tokens
  deep-equal to the pre-change implementation, and the concatenated token texts
  equal the input line.
- **UC-13** A caller-supplied pattern able to match the empty string (`/x*/`)
  terminates, and the tokens still cover the line exactly.

**Shared helpers**

- **UC-14** `cssColor`, `cssFontFamily`, `safeLinkHref`, `imageDataUrl` live in
  one exported module `lib/parsers/markup-safety.ts`; `file-viewer` imports them
  and renders byte-identically (its existing specs stay green).

### B.4 Explicitly out of scope

- Resource limits (allocation bombs, recursion, cycles, ReDoS, xref loops) —
  `specs/parser-resource-limits-spec.md`.
- `pdf-pixel-perfect.ts` (verified safe, V-4) — only sampled by T-11; its
  `safeLinkUri` is **not** deduplicated here (avoids a third spec editing that
  6 k-line file; record the dedupe as a follow-up).
- `readable-emit`'s font-family handling (safe, V-6).
- The RTE sanitizer's own rules; `xlsx.ts` (export, not import).
- `sanitizeSvg` `style` values with `url(…)` and `<image href="https://…">`:
  harmless in `<img>` (no external loads), only relevant inline — record as a
  follow-up if inline SVG rendering is ever added.
- Changing which formats file-import accepts, or the import UX.
- Highlighting across lines, new languages, or the highlight DOM structure.

---

## C. QA section — tests are written FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them
> pass. Mutation-check each change per CLAUDE.md "Writing Tests" step 6.

### C.1 Traceability table

Files (all under `packages/components/`): `SAFE` = `lib/parsers/markup-safety.spec.ts`
(new); `INERT` = `lib/parsers/inert-markup-fixtures.ts` (new test helper — not a
test file itself, `*-fixtures.ts` is test scaffolding for Sonar and ESLint);
`DOCXP` = `lib/parsers/docx-parser.spec.ts`; `DOCXH` =
`lib/parsers/docx-to-editor-html.spec.ts`; `PDF` = `lib/parsers/pdf-parser.spec.ts`;
`READ` = `lib/parsers/pdf-readable/pdf-readable.spec.ts`; `PIX` =
`lib/parsers/pdf-pixel-perfect.spec.ts`; `IMPORT` =
`ui/rich-text-editor/addons/file-import/rich-text-file-import.directive.spec.ts`;
`SVG` = `lib/parsers/svg-sanitizer.spec.ts`; `HL` = `lib/code-highlight.spec.ts`;
`FV` = `ui/file-viewer/file-viewer.component{,.browser}.spec.ts` (existing, must stay green).

| Test ID | Test name | Proves | Type |
|---|---|---|---|
| T-1 | `cssColor accepts colour syntax and rejects anything that can end or add a declaration` — accept `#abc`, `#abcd`, `#aabbcc`, `#aabbccdd`, `rgb(1, 2, 3)`, `rgba(1 2 3 / 50%)`, `hsl(120 50% 50%)`, `red`; reject `#x" onmouseover="a`, `red;x:y`, `url(x)`, `expression(1)`, `'red'`, `` | UC-1, UC-14 | unit (SAFE) |
| T-2 | `cssFontFamily quotes the name, escapes quote and backslash, drops control characters` — `Times New Roman` → `'Times New Roman'`; `X'"><img…` → a single CSS string whose `'` is escaped; `A\\B` escaped; `\u0000`/`\u007f` dropped | UC-1, UC-4 | unit (SAFE) |
| T-3 | `safeLinkHref keeps #fragments and absolute http/https/mailto, rejects every other scheme after browser normalisation` — `JaVaScRiPt:`, `\tjavascript:`, `java\nscript:`, `data:`, `vbscript:`, relative `a/b` | UC-3, UC-4, UC-5 | unit (SAFE) |
| T-4 | `docx keyword maps: jc and vAlign map to CSS keywords; unknown values map to nothing` — `both→justify`, `center→center`, `left/start→left`, `right/end→right`, `distribute→justify`; vAlign `top/center/bottom → top/middle/bottom`; `x" onclick` → `undefined` | UC-1, UC-2 | unit (SAFE) |
| T-5 | `parseDocx: every colour-typed field of a hostile document is undefined or a 6-hex colour; alignment and verticalAlign are CSS keywords or undefined` — one in-code `.docx` (the spec's `makeZip`/`docx` helpers, `docx-parser.spec.ts:40-80`) carrying the two payloads in every slot listed in V-1, including `theme/theme1.xml` | UC-1 | unit (DOCXP) |
| T-6 | `parse + render of the hostile docx is inert` — `assertInertMarkup(renderDocxForEditor(parseDocx(bytes)))` | UC-1 | unit (DOCXH) |
| T-7 | `parse + render keeps the meaning of valid values` — the UC-2 list, asserting the exact declarations | UC-2 | unit (DOCXH) |
| T-8 | `hyperlinks: unsafe schemes render unlinked text, safe schemes and bookmarks stay links` | UC-3 | unit (DOCXH) |
| T-9 | `parsePdfPaged: a hostile BaseFont cannot leave the style attribute and the run keeps its font-family; a javascript: link renders unlinked, https stays` — `PdfBuilder` with a body font + the hostile font (the hostile run must differ from the body font or `buildItemStyles` skips it, `:4928`) and two link annotations; also run `parsePdf` on the same bytes and assert inertness | UC-4 | unit (PDF) |
| T-10 | `parsePdfReadable: a javascript: link renders unlinked; https stays a link` | UC-5 | unit (READ) |
| T-11 | `pixel-perfect output of the hostile PDF is inert` (regression sample of V-4's verified-safe emitter; no code change expected) | UC-1 | unit (PIX) |
| T-12 | `benign PDF output is unchanged` — golden: capture `parsePdfPaged(benign).pages.map(p => p.html)` **before** Task 4 into the spec as an inline literal, assert equality after | UC-6 | unit (PDF) |
| T-13 | **fix** the existing `imports a DOCX file and inserts its text, emitting fileImportComplete` (`:252-263`, case 1 — its assertion was shape only): assert the emitted string contains the document text, is a sanitize fixed point, and — with a second, hostile `docxFile` variant (coloured run with the V-1 payload, `javascript:` hyperlink) — contains no `on*` attribute and no `javascript:` | UC-7 | unit (IMPORT) |
| T-14 | `sanitizeSvg output parsed as HTML is inert` — UC-8 payloads (comment, PI, CDATA, `<!-->`, each also nested two levels deep inside `<g>`), plus UC-9 URL forms; parse the output with `DOMParser('text/html')` inside a `<div>` and assert every element is in the SVG allowlist (plus the wrapper), no `on*` attribute, no comment/PI node, CDATA text present as text | UC-8, UC-9 | unit (SVG) |
| T-15 | `tokenizeLine equals the reference tokenizer on real code in every language and on seeded random lines; tokens concatenate to the line` — reference = the pre-change `tokenizeLine`/`findBestMatch` copied verbatim into the spec as `referenceTokenizeLine` (test oracle) | UC-12 | unit (HL) |
| T-16 | `a 300 KB minified line tokenizes in under 300 ms` — budget assertion (precedent: `rich-text-markdown.service.spec.ts:1277-1287`); also asserts tokens of its first 20 KB equal the reference | UC-11 | perf (HL) |
| T-17 | `a pattern that can match the empty string terminates and the tokens cover the line` | UC-13 | unit (HL) |
| T-18 | `a real SVG icon survives intact` — node/attribute inventory before vs after | UC-10 | unit (SVG) |
| T-19 | file-viewer existing specs green after the helper extraction (no new test — UC-14 behaviour is "unchanged"; T-1…T-3 test the moved functions) | UC-14 | unit (FV, existing) |

Every UC appears: UC-1 T-1, T-2, T-4, T-5, T-6, T-11; UC-2 T-4, T-7; UC-3 T-3,
T-8; UC-4 T-2, T-3, T-9; UC-5 T-3, T-10; UC-6 T-12; UC-7 T-13; UC-8 T-14; UC-9
T-14; UC-10 T-18; UC-11 T-16; UC-12 T-15; UC-13 T-17; UC-14 T-1…T-3, T-19.

### C.2 Test types covered

- **Unit, both legs** (`npm run test-visual`, `npm run test:portable`): every
  file above. They are DOM-only (DOMParser/XMLSerializer), no layout — they run
  in jsdom and Chromium. Run the browser leg for SVG (T-14): jsdom's and
  Chromium's HTML parsers agree on comment/PI handling, but the browser leg is
  the authority.
- **The inertness check** lives in one helper, `assertInertMarkup(html, policy)`
  in `INERT` (§F.2), so T-6, T-9, T-11, T-13 assert the same rule.
- **Perf:** T-16 is a measured assertion with a 10× margin over the expected
  linear time and ~11× under today's time. No `*.workload.spec.ts` is needed —
  the budget test asserts.
- **E2E:** no new spec. Impacted harnesses must stay green: `rte-file-import`,
  `file-viewer`, `code-block`, `rich-text-editor` (expands to all `rte-*`),
  `rich-text-view` — get the authoritative list from
  `npm run e2e:impact -- --base origin/master`.
- **Storybook:** no visual change.

### C.3 Edge cases and failure modes the tests must cover

| Case | Covered by |
|---|---|
| `w:color="auto"` / missing value — no declaration (unchanged behaviour) | T-7 |
| 3-hex or 8-hex `w:val` (not legal OOXML) — dropped, not passed through | T-5 |
| Theme colour with tint **and** a hostile `srgbClr val` — tint math never runs on a non-hex string | T-5 |
| Highlight value present in `HIGHLIGHT_COLOR_MAP` vs absent | T-7, T-5 |
| Font name containing `;`, `"`, `'`, `\`, newline | T-2, T-6 |
| `#bookmark-` anchor containing `"` — escaped, link kept | T-8 |
| A link whose `new URL` normalises (`HTTPS://EXAMPLE.com/a b`) — emitted as the normalised `href` | T-3 |
| PDF: hostile font equal to the body font (no span emitted) — still inert | T-9 (second case) |
| PDF flat `parsePdf` path (no link rendering) — inert | T-9 |
| fileImportComplete for a PDF import (the `atDesignMeasure` wrapper `<div style="min-width:…pt">`) — emitted value is the sanitized wrapper | T-13 (PDF variant, using the existing PDF fixture in that spec if present; otherwise `PdfBuilder`) |
| SVG: comment inside `<title>` / `<text>` (text-bearing elements) | T-14 |
| SVG: no-root-element input / parsererror — still `null` (unchanged) | existing SVG tests |
| Highlight: empty line, single char, line of only spaces, a line ending inside an unterminated string | T-15 corpus |
| Highlight: an `/i` keyword pattern (SQL) and patterns with backreferences (`(["'])…\1`) | T-15 corpus (SQL, TS strings) |
| Highlight: caller patterns that already carry the `g` or `y` flag | T-17 (second case) |

### C.4 Coverage expectation

- `lib/parsers/markup-safety.ts`: 100% lines and branches (pure).
- Changed lines in `docx-parser.ts`, `docx-to-editor-html.ts`, `pdf-parser.ts`,
  `readable-emit.ts`, `svg-sanitizer.ts`, `code-highlight.ts`,
  `rich-text-file-import.directive.ts`, `file-viewer.component.ts`: 100% of the
  introduced lines; overall file coverage must not drop (record before/after
  from `npm run coverage` in Task 1's retrospective).

---

## D. Architecture section

### D.1 Usability — the public API shape

No component input/output changes. New exported module (copied into consumers'
projects with the parsers):

```ts
// lib/parsers/markup-safety.ts  (NEW)
/** Hex, functional rgb()/rgba()/hsl()/hsla() with numeric arguments, or a bare keyword — else undefined. */
export function cssColor(value: string | undefined): string | undefined;
/** A font name as one quoted CSS string ('…'), quote/backslash escaped, controls dropped. No generic fallback. */
export function cssFontFamily(name: string): string;
/** An in-document #fragment, or an absolute http/https/mailto URL as the browser parses it — else undefined. */
export function safeLinkHref(href: string): string | undefined;
/** A base64 image data URL — else undefined. */
export function imageDataUrl(value: string | undefined): string | undefined;
/** HTML-escape a value for a double-quoted attribute (& " < >). */
export function escapeAttribute(value: string): string;
```

(`file-viewer`'s `cssFontFamily` appended `,sans-serif`; the shared one does not
— file-viewer appends it at its three call sites, `:703, :1140, :1240`, so its
output stays byte-identical.)

DOCX keyword maps (`textAlignFromJc`, `verticalAlignFromVAlign`) live in
`docx-parser.ts` next to the parse sites — they are OOXML vocabulary, not general
markup safety.

Changed contract, documented in JSDoc:

```ts
/** Emits the sanitized HTML that was inserted — the same markup the editor now holds. */
readonly fileImportComplete = output<string>();
```

### D.2 Efficiency

- Validation: one anchored regex test or a `new URL` per emitted value — noise
  next to parsing.
- `fileImportComplete`: the directive sanitizes once and inserts the sanitized
  string; `insertHtmlAtCaret` sanitizes again (idempotent, linear —
  `rich-text-sanitizer.workload.spec.ts` is the existing measure). One extra
  linear pass per import; accepted (§D.4 set C).
- SVG: walking `childNodes` instead of `children` adds text nodes to the walk —
  still one linear pass.
- Highlighting: from O(n²) to O(n·p) for p patterns (each pattern's regex
  scans forward from the cursor and its next match is cached until the cursor
  passes it). Budget: 300 KB line < 300 ms (T-16); expected tens of ms.

### D.3 DX for the consuming developer

- Imported markup in `fileImportComplete` is now safe to render; nothing to
  learn. The JSDoc says it is the inserted, sanitized HTML.
- `parsePdf*`, `parseDocx` + `renderDocxForEditor`, `parsePdfReadable` output
  is safe to render without a second sanitizer pass for the attribute/link
  classes in I-1 (they still should not render untrusted markup without the
  editor's sanitizer in general — the JSDoc of each exported function says so).
- `markup-safety.ts` is reusable by consumers who build their own markup from
  parsed models (the same functions the file-viewer uses).

### D.4 Implementation options

**Option set A — where I-1 is enforced**

**Option A-1 — Parse-time only** (model fields hold only valid values)
Pros: every emitter benefits; the model's types (`color: string` meaning hex)
become true. Cons: emitters still interpolate unescaped; a future model field
re-opens the hole.

**Option A-2 — Emit-time only** (validate + escape in each emitter)
Pros: the boundary where strings become markup. Cons: three emitters, each
must remember; the model still lies to consumers who build their own markup.

**Option A-3 — Both: grammar at the parse site for values the parser types
(colours, OOXML keywords), plus one escaping attribute writer at emit**
Pros: defence in depth with no duplicated grammar — parse validates meaning,
emit guarantees no breakout for anything (including future fields). Cons: two
touch points per sink.

**✅ Chosen: A-3** — for DOCX (both layers), and emit-time for PDF (the PDF model
values are already numeric/hex except the font name and URI, which are fixed at
the emit sinks).

**Option set B — shared helpers**

**Option B-1 — Extract file-viewer's helpers to `lib/parsers/markup-safety.ts`; file-viewer, docx, pdf-parser, readable-emit import them**
Pros: one grammar, already proven in file-viewer; Sonar duplication avoided.
Cons: file-viewer is touched (behaviour-neutral; its specs guard it).

**Option B-2 — Copy the helpers into each emitter**
Cons: four copies of security-relevant grammar drift apart — the exact way
`readable-emit` and `pdf-parser` ended up with different font handling.

**Option B-3 — Run every emitter's output through the RTE sanitizer**
Cons: lib → ui dependency inversion (the sanitizer lives in
`ui/rich-text-editor/`, injects `DOCUMENT`); strips styles file-viewer needs
(V-3's comment `:50-56` explains why Angular's own sanitizer was rejected too).

**✅ Chosen: B-1.**

**Option set C — `fileImportComplete` (I-2)**

**Option C-1 — The directive sanitizes (inject `RichTextSanitizerService`), inserts the sanitized string, emits it**
Pros: the output is exactly what was inserted; no host-contract change.
Cons: one extra linear sanitize pass (idempotent).

**Option C-2 — Change the host contract: `insertHtmlAtCaret(html): string` returns the inserted markup**
Pros: no double pass. Cons: abstract host member change → `docs/rich-text-editor.md`
host table drift test and every host implementation; larger blast radius than
the fix.

**Option C-3 — Emit nothing (`output<void>`)**
Cons: breaks consumers who use the payload.

**✅ Chosen: C-1.**

**Option set D — SVG node types (I-3)**

**Option D-1 — Walk `childNodes`; keep element (allow-listed) and text nodes; replace CDATA with an equivalent text node; remove every other node type; normalise URL values (strip ASCII whitespace/controls) before the scheme test**
Pros: a small change to the existing allowlist walker; text is escaped by
`XMLSerializer`. Cons: still a "remove the bad" walker over a parsed tree.

**Option D-2 — Rebuild: construct a fresh SVG document copying only allow-listed elements/attributes/text**
Pros: constructive (nothing unexpected can survive). Cons: a rewrite of a
working module for a latent issue; more fidelity risk.

**Option D-3 — Document as `<img>`-only and leave it**
Cons: the exported name promises sanitization; the next consumer inlines it.

**✅ Chosen: D-1**, with D-2 recorded as the route if inline SVG rendering is
ever added.

**Option set E — linear tokenizer (I-4)**

**Option E-1 — Per-pattern global clone (`g` flag, cached in a `WeakMap` keyed by the pattern's `RegExp`), `lastIndex = cursor`, cache each pattern's next match until the cursor passes its start**
Pros: keeps "first pattern at the lowest index wins" exactly; backreferences
untouched; O(n·p). Cons: whole-line context for `\b` (V-8 note 1) — the
equivalence test decides.

**Option E-2 — Sticky (`y`) regexes tried at every position**
Cons: O(n·p) attempts **including** every position inside plain text, and text
runs must be accumulated char by char; slower in the common case.

**Option E-3 — One combined alternation per language (`(p0)|(p1)|…`, `g`)**
Pros: one scan; JS alternation order = pattern order, so tie-break is
preserved. Cons: capture-group renumbering breaks the backreferences in the
string patterns (`(["'])…\1`, `(?=(\\?))\2`); caller-supplied patterns would
need the same rewriting — fragile.

**✅ Chosen: E-1.** Empty matches (UC-13) are treated as "no match here":
re-search from `index + 1`.

### D.5 Risks

| Risk | Mitigation |
|---|---|
| T-15 finds a divergence caused by `\b` at an artificial slice boundary | The invariant is "same tokens as today". Stop, record the line in §G, and make the new tokenizer reproduce today's output for that case (e.g. by testing the candidate match against `remaining`-semantics only when the char before the cursor is a word char). Do **not** weaken T-15. |
| Fidelity regressions in DOCX import (a colour that used to pass now dropped) | T-7 asserts each valid form; OOXML `ST_HexColor` is 6 hex digits or `auto` — accept exactly that (case-insensitive), plus the highlight keyword map. |
| `cssFontFamily` quoting changes DOCX output (`font-family:Times New Roman` → `'Times New Roman'`) | Equivalent CSS; the editor sanitizer canonicalises style values (`rich-text-sanitizer.service.ts:1585-1604`). T-7 asserts the family resolves, not the byte form. |
| `markup-safety.ts` reached only through lazily imported lib files — `sync-registry` misses it (memory: `sync-registry-misses-lazy-lib-imports`) | After `sync-registry --fix`, check `registry.json`: it must be in the `libFiles` of `file-viewer` (static import — sync finds it) **and** of the RTE file-import addon (reached via lazy `docx-to-editor-html`/`pdf-parser`/`readable-emit` — **hand-add** if missing). `npm run e2e -- rte-file-import` and `npm run stage:package -- rte` + package build are the proof. |
| Golden T-12 captured after the change by mistake | Task 1 captures it on the unmodified tree and commits it with the failing tests. |
| Two specs editing `pdf-parser.ts` concurrently | Merge-order note at the top; keep this spec's edit to `buildItemStyles`/`wrapItemHtml` only. |
| Sonar S3776 in the new tokenizer loop | Extract `nextMatchFor(patternIndex)` and the choose-earliest step; each < 15. |
| `documentation.json` / `api-docs` regen noise if JSDoc changes trigger `docs:check` | Run `npm run docs:check`; if it asks for regen, run the **full** `docs:regen` and restore `documentation.json` (memory). |

---

## E. Task table (ordered = implementation order)

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Write failing tests T-1…T-18 and the `INERT` helper (§F.2); create `markup-safety.ts` with exported signatures that throw, so specs compile and fail on assertions; capture T-12's golden and T-15's reference oracle **on the unmodified tree**; record pre-change coverage. | all UC | ⬜ Not started | — | — | — |
| 2 | `markup-safety.ts`: move `cssColor`, `cssFontFamily` (quoted name only), `safeLinkHref`, `imageDataUrl` from file-viewer, add `escapeAttribute`; file-viewer imports them (appends `,sans-serif` at its 3 call sites). T-1…T-3 green; FV specs green. (I-1) | UC-14 | ⬜ Not started | — | — | — |
| 3 | DOCX (I-1): parse-site validation (§F.3) + emitter escaping/validation (§F.4) + hyperlink scheme check. T-4…T-8 green. | UC-1, UC-2, UC-3 | ⬜ Not started | — | — | — |
| 4 | PDF (I-1): `pdf-parser.ts` font-family + link (§F.5); `readable-emit.ts` link (§F.5). T-9…T-12 green. | UC-4, UC-5, UC-6 | ⬜ Not started | — | — | — |
| 5 | File import (I-2): sanitize-then-insert-then-emit (§F.6); JSDoc. Fixed T-13 green; `rte-file-import` e2e green. | UC-7 | ⬜ Not started | — | — | — |
| 6 | SVG (I-3): node-type walk + URL normalisation (§F.8). T-14, T-18 green; `rich-text-sanitizer.service.spec.ts` and FV green. | UC-8, UC-9, UC-10 | ⬜ Not started | — | — | — |
| 7 | Tokenizer (I-4): E-1 (§F.7). T-15…T-17 green; code-block, rich-text-editor, rich-text-view specs green. | UC-11, UC-12, UC-13 | ⬜ Not started | — | — | — |
| 8 | Gates: `npm run lint`, `npm run typecheck`, `npm run test-visual` (zero failures, pre-existing included), `npm run test:portable`, `npm run test:cli`, `sync-registry --fix` + registry check (lazy-import caveat, D.5), `npm run e2e:impact -- --base origin/master` then every listed spec, `npm run stage:package -- rte` + package build, `npm run sonar:gate` (four-point verification, CLAUDE.md §4); run `release-cli` (expect: no publish) and `release-package` (expect: rte pending) and record both; record the follow-ups (§F.9). | all | ⬜ Not started | — | — | — |

## Definition of Done (per task)

A task row may be marked ✅ Done only when **all** of these pass:

1. **Fully tested** — every test named for this task is written and passing.
2. **Fully covered** — no uncovered lines introduced in the files touched.
3. **Zero lint errors** — `npm run lint` clean.
4. **Zero SonarQube issues** — the **full server scan** (`npm run sonar:gate`
   against `http://localhost:9000` — coverage re-measured unless the tree
   fingerprint proves it current) run and clean on the changed code. eslint is NOT a substitute. If the token, server, or Docker
   is unavailable, the task is **blocked, not done** — stop and tell the user.
5. **Review gate ≥ 91** — invoke the `review-gate` skill and reach a score of
   at least 91 from a fresh independent reviewer.

Then, and only then, update this spec's task row with:

- **Completed** — the date/time (`date +"%Y-%m-%d %H:%M"`).
- **Score** — the review-gate score.
- **Retrospective** — 1–2 sentences: what went well, and what to improve later.

Marking a row Done without all five is a process violation, not a shortcut.

---

## F. Implementation notes for the executing agent (normative)

Re-locate every cited line first. Run the consumers, not just the edited folder
(CLAUDE.md "Fixing Bugs" §5):

```bash
npx vitest --run packages/components/lib/parsers packages/components/lib/code-highlight.spec.ts \
  packages/components/ui/rich-text-editor packages/components/ui/rich-text-view \
  packages/components/ui/code-block packages/components/ui/file-viewer
```

### F.1 Payloads (one list, used everywhere)

In `INERT`: `BREAKOUT = 'x" onmouseover="alert(1)'`, `DECLARATION =
'red;background-image:url(//t.invalid/x)'`, `TAG_BREAKOUT = "X'\"><img src=x onerror=alert(1)>"`,
`UNSAFE_URLS = ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' \tjavascript:alert(1)',
'java\nscript:alert(1)', 'data:text/html,<script>1</script>', 'vbscript:x']`.
DOCX attribute values must be XML-escaped when written into the fixture XML
(`&quot;`, `&lt;`), so the **parsed** value is the payload.

### F.2 `assertInertMarkup(html, policy)` (in `INERT`)

Parse with `new DOMParser().parseFromString(`<body>${html}`, 'text/html')`.
For every element: tag ∈ `policy.tags`; every attribute name ∈
`policy.attributes` and not `/^on/i`; for `href`/`src`: `safeLinkHref` /
`imageDataUrl` (or the policy's own check) accepts it; for `style`: split
declarations on `;` outside quotes and parentheses, each `prop:value` with
`prop ∈ policy.styleProperties` and the value accepted by the property's
grammar (colour props → `cssColor`; `font-family` → a single quoted string
optionally followed by `,<generic>`; lengths → `^-?\d+(\.\d+)?(pt|px|%|em)$`;
keyword props → their allowed set; compound `border-*` → `<len> <style>
<colour>`). Also assert no comment nodes. Export one DOCX policy and one PDF
policy (the PDF policy allows the declarations `buildItemStyles` emits). The
helper returns a list of violations; tests assert it is empty so a failure
prints every violation.

### F.3 DOCX parse sites (`docx-parser.ts`)

- Add `hexColor(raw: string | null | undefined): string | undefined` —
  `^[0-9A-Fa-f]{6}$` → `#${raw}`, else `undefined` (OOXML `ST_HexColor`; `auto`
  already handled by callers). Use it at `:354, :426` (after the
  `HIGHLIGHT_COLOR_MAP` lookup), `:433, :555, :589` (fallback `#000000` stays
  for an absent/`auto` colour, an **invalid** one also falls back), `:1119,
  :1422, :1427` (theme map: skip invalid entries).
- `applyTintShade` must only receive a validated hex (guaranteed by the theme
  map) — no change needed beyond that.
- `textAlignFromJc` / `verticalAlignFromVAlign` keyword maps (T-4 values) at
  `:640, :1634, :1125`; unknown → field left `undefined`.
- Hyperlink `:827`: leave the parsed `href` as-is in the model (it is data);
  the emitter decides (F.4).

### F.4 DOCX emitter (`docx-to-editor-html.ts`)

- Every `style="…"` (`:135, :140, :257-258, :325, :376, :401`) is written via
  `escapeAttribute(styleString)`.
- `buildRunSpanStyle :264-273`: colours via `cssColor` (defence in depth —
  the parse layer already validated); `font-family:${cssFontFamily(name)}`
  (replacing `escapeAttr`).
- `buildParagraphStyle :148, :176` and `buildCellStyle :415-416`: values are
  already validated by F.3; pass colours through `cssColor` anyway.
- `formatBorder :195-199`: colour through `cssColor`, omit when undefined.
- Hyperlink `:286-288`: `const href = safeLinkHref(run.href)`; when undefined,
  return the run's `html` unlinked.
- Remove the now-unused local `escapeAttr` if every caller moved (no dead code,
  ts6133).

### F.5 PDF sinks

- `pdf-parser.ts` `buildItemStyles :4928`: `font-family: ${cssFontFamily(item.fontFamily)}`;
  `wrapItemHtml :4951`: `style="${escapeAttribute(styles.join('; '))}"`;
  `:4961-4963`: `const safeUri = safeLinkHref(linkUri)`; when undefined, do not
  wrap in `<a>`; otherwise `href="${escapeAttribute(safeUri)}"`.
  `lineToHtmlContentWithUnderlines` (`:5409`) must reach the same
  `wrapItemHtml` — verify, do not assume.
- `pdf-readable/readable-emit.ts:422`: `const href = safeLinkHref(style.link)`;
  unlinked when undefined.

### F.6 File import (`rich-text-file-import.directive.ts:314-322`)

```ts
private readonly sanitizer = inject(RichTextSanitizerService);

private insertImported(html: string): void {
  const safe = this.sanitizer.sanitize(html);
  if (!safe.trim()) { this.reportError(this.i18n.t().importFailed); return; }
  this.host.restoreSelection();
  this.host.insertHtmlAtCaret(safe);
  this.fileImportComplete.emit(safe);
}
```

Import `RichTextSanitizerService` through the editor barrel (`'../..'`, the
same import the directive already uses for `RichTextEditorAddonHost`), never a
deep path. Update the output's JSDoc (`:111`). Note: an import that sanitizes
to empty now reports `importFailed` — that is the honest outcome (nothing was
inserted); cover it in T-13 (extra case).

### F.7 Tokenizer (`lib/code-highlight.ts:218-257`)

- `const GLOBAL = new WeakMap<RegExp, RegExp>()`; `globalOf(re)` returns a
  cached `new RegExp(re.source, re.flags.replace(/[gy]/g, '') + 'g')`.
- Per line: `next: (Match | null | undefined)[]` (undefined = needs search).
  For each pattern whose cached match is `undefined` or starts before `cursor`,
  set `lastIndex = cursor`, `exec`; skip zero-length matches by retrying from
  `index + 1` (UC-13); store `null` when none remain. Choose the minimum index,
  first pattern on ties (same as today's strict `<`). Emit text up to it, then
  the token; advance.
- Corpus for T-15 (real code, repo-local, read with `fs` in the spec; all
  paths below were checked to be tracked at `6fae7f7f`): TS
  `packages/components/lib/code-highlight.ts`; JS `scripts/coverage.mjs`; JSON
  `packages/components/registry.json` (first 2,000 lines); CSS
  `packages/components/ui/data-table/data-table.component.css`; HTML
  `packages/components/ui/result/result.component.html`; YAML
  `.github/workflows/e2e.yml`. The repo tracks **no** `.svg`, `.py`, `.sql`,
  `.sh`, `.java` or `.cs` files, so XML/Python/Java/C#/SQL/Bash use the sample
  snippets already in `ui/code-block/code-block.stories.ts` (36 `language`
  entries), `code-block.component.spec.ts` and `lib/code-highlight.spec.ts`;
  for XML also tokenize the serialized output of T-18's icon. Seeded fuzz:
  5,000 lines of 0–120 chars drawn from a token alphabet (`const`, `"a\"b"`,
  `'x'`, `// c`, `#`, digits, `foo(`, `<a`, `x=`, `@d`, `$v`, `--`, `/*`, `*/`,
  spaces, `{`, `:`), fixed seed, all languages.

### F.8 SVG (`lib/parsers/svg-sanitizer.ts`)

- `processElement`: iterate `Array.from(element.childNodes)`; element →
  existing logic; text node → keep; CDATA section → replace with
  `ownerDocument.createTextNode(node.data)`; anything else (comment, PI,
  doctype, entity reference) → remove.
- `sanitizeUrlAttr`: test the scheme on
  `value.replace(/[\u0000- \u007f]+/g, '')` (browsers strip leading
  C0/space and embedded tab/LF/CR before resolving a scheme). Keep the regex
  `^(javascript|vbscript|data):` (case-insensitive) on the stripped string.
- Keep the root check and `parsererror` handling unchanged.

### F.9 Follow-ups to record (do not start)

1. Deduplicate `pdf-pixel-perfect.ts` `safeLinkUri` onto `markup-safety.ts`
   (after `parser-resource-limits-spec` merges, to avoid a three-way edit).
2. Constructive SVG rebuild (D-2) + `url(…)`/external `href` policy if inline
   SVG rendering is ever added.
3. Exported parse functions' JSDoc: state the trust model of their `html`
   output (safe attributes/links, not a general sanitizer).

---

## G. Corrections recorded by this spec (⚠️ — never rewrite silently)

1. ⚠️ DOCX sinks are wider than the three cited lines: border colours, theme
   colours, `jc`, `vAlign`, unquoted font names (declaration injection) and
   unescaped `style` attributes everywhere; link schemes unchecked (V-1).
2. ⚠️ `parsePdf` is exported from `ui/index.ts`, but that barrel is not
   installed by the CLI; consumers reach it as an export of the copied
   `pdf-parser.ts`, and no shipped UI renders its HTML (V-5).
3. ⚠️ The `javascript:` link reproduces through `parsePdfPaged`; flat `parsePdf`
   renders no links at all (V-5).
4. ⚠️ Readable-emit link scheme: brought **in** scope (demo renders it through
   `bypassSecurityTrustHtml`; file-import emitted it raw) (V-6).
5. ⚠️ "Re-highlights on idle" → debounce after typing, plus whole-document
   re-highlight on every `replaceEditorHtml` (V-8).
6. ⚠️ The tokenizer has a second, unreported defect: an empty-matching
   caller pattern loops forever (V-8, UC-13).
7. ⚠️ "Binary-parser audit never completed" → completed; findings live in
   `specs/parser-resource-limits-spec.md` (V-9).

**Corrections found while executing this spec (append-only):**

_(none yet)_

---

## H. Completion Log

| Row | Date | Task | Reviewer score | Notes |
|---|---|---|---|---|
| — | — | — | — | — |
