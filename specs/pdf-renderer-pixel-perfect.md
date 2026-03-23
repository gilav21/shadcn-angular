# PDF Renderer: Full Spec & Roadmap to Pixel Perfect

> **Status:** In Progress
> **Last updated:** 2026-03-23
> **Owner:** gilav21

---

## Background

Mobile Android browsers (Chrome, default browser) cannot render PDFs inside `<iframe>` tags with blob URLs — they show a generic file icon with an "Open" button instead of inline content.

The project already has a comprehensive **4310-line custom PDF parser** (`packages/components/lib/pdf-parser.ts`) that extracts text, images, paths, tables, and document structure. However, the file-viewer component currently ignores this parser entirely and uses a plain `<iframe>`. This spec covers:

1. **Immediate fix** — Integrate the existing `parsePdfPaged()` into the file-viewer (replaces iframe, works everywhere including mobile)
2. **Full roadmap** — Every improvement needed to reach pixel-perfect rendering, ordered by impact

---

## Part 1: Immediate Fix — Wire Up `parsePdfPaged()`

**File:** `packages/components/ui/file-viewer.component.ts`

### Changes Required

1. Add `pdfPages` signal — stores parsed per-page `{ html, text, imageOnly, pageIndex }[]`
2. Add `currentPdfPageHtml` computed — returns `SafeHtml` for current page (mirrors `currentSlideHtml` used for PPTX)
3. Update `isPaginated` computed — add `|| t === 'pdf'` (enables prev/next buttons)
4. Update `isZoomable` computed — add `|| t === 'pdf'` (enables zoom controls)
5. Replace `processPdf(file)` method — call `parsePdfPaged(bytes.buffer)` instead of creating iframe blob URL
6. Update `processFile()` switch — pass `bytes` to `processPdf` (currently passes `file`)
7. Replace PDF template `@case ('pdf')` — `<div [innerHTML]="currentPdfPageHtml()" [style.zoom]="currentZoom()">` (same pattern as DOCX)
8. Remove `pdfSrc` signal (`SafeResourceUrl`) — no longer needed
9. Remove `SafeResourceUrl` from imports if unused elsewhere

### Expected Result

- PDF renders as paginated HTML on all devices (mobile + desktop)
- Page navigation works (prev/next in toolbar)
- Zoom works (existing toolbar zoom controls)
- Text is natively selectable
- RTL documents (Hebrew/Arabic) render correctly

---

## Part 2: Current Parser Capabilities Audit

What the parser already handles correctly:

| Feature | Notes |
|---------|-------|
| PDF structure | Traditional xref + xref streams + compressed object streams |
| Stream filters | FlateDecode, LZWDecode, ASCIIHex, ASCII85, RunLength, PNG predictors |
| Text extraction | Tj, TJ, `'`, `"` operators; char/word spacing; text rise |
| Font handling | Type0/CID, Type1, TrueType; standard 14 fonts; encoding differences |
| ToUnicode CMap | bfchar + bfrange parsing |
| Glyph name mapping | 200+ glyph names (Latin, Hebrew, Arabic, common symbols) |
| Font style detection | Bold/italic from font name, flags, FontWeight, ItalicAngle |
| Font family normalization | 50+ font family mappings (Times, Arial, Helvetica, etc.) |
| Color spaces | DeviceRGB, DeviceCMYK, DeviceGray, CalRGB, CalGray, ICCBased, Indexed, Separation |
| Images | XObject images (JPEG passthrough, JP2, raw pixels→PNG); inline images |
| Page rotation | 0°, 90°, 180°, 270° via CTM |
| Graphics state | q/Q save/restore, cm matrix concatenation, gs ExtGState |
| Path operations | m, l, re, c, v, y, h — stroke/fill detection |
| Table detection | Grid detection from horizontal/vertical line segments |
| RTL text | Hebrew/Arabic detection, visual order reversal, bracket mirroring |
| Structure tree | Tagged PDF (H1-H6, LI, P, Table, etc.) |
| Column detection | Two-column layout detection and reordering |
| Text merging | Char-by-char → word → line merging with gap analysis |
| Heading detection | Font size ratio + structure tree |
| Lists | Bullet (pattern-based + structure-based) + numbered lists |
| Underline detection | Thin horizontal lines near text baselines |
| Border boxes | Stroked rectangles containing text blocks |
| Text deduplication | Removes duplicate chars/words at same position |
| Opacity | fillOpacity, strokeOpacity from ExtGState (`ca`, `CA`) |
| Form XObjects | Recursive processing up to depth 10 with CTM inheritance |
| Marked content | BMC/BDC/EMC with MCID tracking for structure mapping |

---

## Part 3: Gap Analysis — What's Missing for Pixel Perfect

### Priority 1 — Critical (Affects Most PDFs)

#### 1.1 Page dimensions not passed to HTML output
**Problem:** `PdfPageResult` has no `pageWidth`/`pageHeight`. The rendered HTML has no notion of the page's physical size, making absolute positioning of any element impossible.
**Fix:** Extract MediaBox/CropBox dimensions in `extractPageContent`, pass `pageWidth` and `pageHeight` into `PdfPageResult`. Generate a wrapper `<div style="position:relative; width:Xpx; height:Ypx">` around each page.
**Files:** `pdf-parser.ts` — `PdfPageResult` interface, `buildPageResult()`, `extractPageContent()`

#### 1.2 Image positioning is lost
**Problem:** Images have exact `x`, `y` coordinates from the CTM transformation but `insertImagesBeforeY` inserts them inline by Y-order. Images overlapping text or positioned absolutely are misplaced.
**Fix:** Once the page has a sized container (1.1), place images as `<img style="position:absolute; left:Xpx; top:Ypx; width:Wpx; height:Hpx">`.
**Files:** `pdf-parser.ts` — `insertImagesBeforeY()`, `buildPageResult()`

#### 1.3 Background fill rectangles not rendered
**Problem:** Filled rectangles (`f`, `F`, `B` operators) become `PathRect` objects but are only used for structural detection (table grids, border boxes, underlines). Colored backgrounds — common in headers, callout boxes, highlighted cells — are completely dropped.
**Fix:** Render non-structural filled rects as `<div style="position:absolute; background-color:X; left:...; top:...; width:...; height:...">`.
**Files:** `pdf-parser.ts` — `textItemsToHtml()`, `buildPageResult()`

#### 1.4 Decorative lines and borders not rendered
**Problem:** Stroked horizontal/vertical lines (`S`, `s` operators) are extracted as `PathRect` but only used for table detection and underlines. Visible dividers, section rules, and frame borders are dropped.
**Fix:** Render non-structural stroked rects/lines as positioned `<div>` elements with appropriate `border` or `background-color`.
**Files:** `pdf-parser.ts` — `textItemsToHtml()`

#### 1.5 Image transparency (SMask) not supported
**Problem:** `rawPixelsToPng()` always generates RGB PNG (no alpha). Images with a soft mask (`SMask` entry in image dict) render without transparency — e.g., logos on colored backgrounds show white boxes.
**Fix:** Detect `SMask` key, decode the mask stream as grayscale, produce RGBA PNG by using mask values as alpha channel.
**Files:** `pdf-parser.ts` — `rawPixelsToPng()`, `buildImageDataUrl()`

#### 1.6 CCITTFaxDecode filter not implemented
**Problem:** Scanned/fax PDFs use CCITT Group 3/4 encoding. `CCF` appears in abbreviation tables (line 2557) but there is no decoder. Affected images are silently dropped.
**Fix:** Implement CCITT Group 3 (1D) and Group 4 (2D) decoders.
**Files:** `pdf-parser.ts` — `decodeStreamData()`

#### 1.7 JBIG2Decode filter not implemented
**Problem:** Some scanned PDFs use JBIG2 compression. No decoder exists; affected images are silently dropped.
**Fix:** Implement JBIG2 decoder or show a "image format not supported" placeholder.
**Files:** `pdf-parser.ts` — `decodeStreamData()`

---

### Priority 2 — Text Fidelity

#### 2.1 Letter/word spacing not reflected in HTML
**Problem:** `charSpacing` and `wordSpacing` are used for text advance calculation but not applied visually. Tight-tracked or loose-tracked text looks incorrect.
**Fix:** When `charSpacing` differs meaningfully from 0, add CSS `letter-spacing`; when `wordSpacing` differs, add CSS `word-spacing`. Pass these through `TextItem`.
**Files:** `pdf-parser.ts` — `TextItem` interface, `processTextShow()`, `wrapItemHtml()`

#### 2.2 Text rendering modes 1–7 not styled
**Problem:** Only mode 0 (fill) and mode 3 (invisible) are handled. Stroke text (mode 1), fill+stroke (mode 2), and clip modes (4–7) are ignored. Stroke text is common for watermarks, decorative headings.
**Fix:** Map modes to CSS: mode 1 → `-webkit-text-stroke: 1px color; color: transparent`, mode 2 → both fill and stroke. Pass render mode through `TextItem`.
**Files:** `pdf-parser.ts` — `TextItem`, `processTextShow()`, `wrapItemHtml()`

#### 2.3 Superscript/subscript (text rise) not styled
**Problem:** `textRise` shifts the text matrix Y but the HTML output doesn't apply `<sup>`/`<sub>` or CSS `vertical-align`. Footnote numbers and chemical formulas look like regular inline text.
**Fix:** Pass `textRise` through `TextItem`. In HTML output: positive rise → `<sup>`, negative → `<sub>`, or CSS `vertical-align: Xpx`.
**Files:** `pdf-parser.ts` — `TextItem`, `processTextShow()`, `wrapItemHtml()`

#### 2.4 Horizontal text scaling (Tz) not applied visually
**Problem:** `horizontalScaling` (set by `Tz` operator) is used for advance calculation only. Text that is visually stretched or compressed horizontally renders at normal width in HTML.
**Fix:** Pass `horizontalScaling` through `TextItem`. Apply CSS `display:inline-block; transform: scaleX(N)` when it differs from 100.
**Files:** `pdf-parser.ts` — `TextItem`, `processTextShow()`, `wrapItemHtml()`

#### 2.5 No font fallback for unmapped glyphs
**Problem:** When a glyph code has no ToUnicode mapping and no encoding difference entry, it produces empty string or raw byte. Missing glyphs appear as blanks, corrupting text.
**Fix:** Cascading fallback: ToUnicode → encoding differences → WinAnsiEncoding → MacRomanEncoding → standard encoding → `U+FFFD` replacement character.
**Files:** `pdf-parser.ts` — `pdfStringToUnicode()`, `decodeSingleByteString()`

#### 2.6 Type3 fonts not supported
**Problem:** Type3 fonts define custom glyph shapes as PDF content streams. Rare but used in math, music notation, and specialty documents. Currently produces no output.
**Fix:** Parse Type3 `CharProcs` streams, render each glyph to inline SVG.
**Files:** `pdf-parser.ts` — `buildFontInfo()`

---

### Priority 3 — Layout Precision

#### 3.1 Multi-column layout rendered sequentially
**Problem:** `detectColumns()` correctly detects two columns but reorders lines as left-column-first then right-column (for correct reading order). Visually this collapses the side-by-side layout to a single column.
**Fix:** For visual rendering mode, use CSS `columns: 2` or a flexbox grid to render columns side-by-side. Keep current sequential order for the `text` extraction field.
**Files:** `pdf-parser.ts` — `textItemsToHtml()`, `detectColumns()`

#### 3.2 Page margins/padding not applied
**Problem:** The HTML has no padding representing PDF margins. Text starts at the container edge instead of reflecting the original document's inset.
**Fix:** Calculate effective top/left/right/bottom margins as the gap between MediaBox edges and the content bounding box. Apply as `padding` on the page container.
**Files:** `pdf-parser.ts` — `buildPageResult()`

#### 3.3 Line spacing not preserved
**Problem:** Lines are grouped by Y position but actual vertical gaps between lines are lost. All text uses the browser's default `line-height`.
**Fix:** Calculate `margin-bottom` for each line or paragraph based on actual Y-delta between consecutive lines vs the expected single line-height.
**Files:** `pdf-parser.ts` — `processHtmlLine()`, `flushParagraph()`

#### 3.4 First-line paragraph indentation lost
**Problem:** First-line indentation (standard in formal/legal documents) is not detected. All paragraphs render flush left.
**Fix:** Detect when a paragraph's first line has a consistently larger X offset than subsequent lines and apply CSS `text-indent`.
**Files:** `pdf-parser.ts` — `processHtmlLine()`, paragraph detection logic

#### 3.5 Text alignment not detected
**Problem:** Center-aligned, right-aligned, and justified text is not detected. Everything renders left-aligned (or direction-flipped for RTL).
**Fix:** Analyze each line's X extent vs page width to classify alignment (center: line centered within page; right: line ends near right margin; justified: spans full width). Apply CSS `text-align`.
**Files:** `pdf-parser.ts` — `lineToHtmlContent()`, `processHtmlLine()`

---

### Priority 4 — Advanced Graphics

#### 4.1 Curved paths not rendered
**Problem:** Bézier curves (`c`, `v`, `y` operators) are parsed into `PathOp` structures but `emitPathRects` only handles rectangles (`re`) and straight lines (`l`). Logos, icons, and decorative curves are dropped.
**Fix:** Collect full path operations and convert to SVG `<path d="...">` elements with correct fill/stroke styling.
**Files:** `pdf-parser.ts` — `emitPathRects()`, new `pathToSvg()` function

#### 4.2 Clipping paths not supported
**Problem:** `W` and `W*` operators are in the `IGNORED_OPERATORS` set. Clipping is used for masking images, rounded corners, and complex layouts. Content that should be hidden by the clip region is shown, and content inside the clip that should be visible may be mispositioned.
**Fix:** Track active clipping paths in `GraphicsState`. Apply `clip-path` (SVG polygon) or `overflow:hidden` on a container.
**Files:** `pdf-parser.ts` — `IGNORED_OPERATORS`, `GraphicsState`, `ContentExtractionContext`

#### 4.3 Pattern fills not rendered
**Problem:** `Pattern` color space is parsed (returns 0 components) but patterns are never rendered. Tiled backgrounds and watermarks are dropped.
**Fix:** Parse `Pattern` resource dictionary, render tiling patterns as repeating SVG `<pattern>` fills.
**Files:** `pdf-parser.ts` — `processColorOperator()`, `processDoOperator()`

#### 4.4 Shading/gradients not rendered
**Problem:** `sh` (shading paint) is in `IGNORED_OPERATORS`. Axial and radial gradients used for backgrounds and decorative elements are dropped.
**Fix:** Parse shading dictionaries, convert axial → CSS `linear-gradient`, radial → CSS `radial-gradient`.
**Files:** `pdf-parser.ts` — `IGNORED_OPERATORS`, new `shadingToCss()` function

#### 4.5 Transparency groups not handled
**Problem:** Form XObjects with transparency group attributes (`/Group` dict with `/S /Transparency`) are processed without respect to group opacity or blend mode. Semi-transparent overlays render incorrectly.
**Fix:** Read `ca` (fill opacity) and `CA` (stroke opacity) from group dict, apply CSS `opacity` and `mix-blend-mode` on the form container.
**Files:** `pdf-parser.ts` — `processFormXObject()`

#### 4.6 Dash patterns not rendered
**Problem:** `d` (set dash array) is in `IGNORED_OPERATORS`. Dashed and dotted borders/lines render as solid.
**Fix:** Track dash array in `GraphicsState`. When rendering lines/rects, apply CSS `border-style: dashed/dotted` or SVG `stroke-dasharray`.
**Files:** `pdf-parser.ts` — `IGNORED_OPERATORS`, `GraphicsState`

---

### Priority 5 — Polish & Interactive

#### 5.1 CropBox precedence over MediaBox
**Problem:** `getPageMediaBox()` uses `MediaBox ?? CropBox` — wrong precedence. CropBox defines the visible page area and should take precedence when present.
**Fix:** Change to `CropBox ?? MediaBox`.
**Files:** `pdf-parser.ts` — `getPageMediaBox()`

#### 5.2 Annotations not extracted
**Problem:** PDF annotations (hyperlinks, comments, highlights, stamps, form fields) are not parsed or rendered. Links in PDFs appear as plain text.
**Fix:** Parse `Annots` array on each page. Render URI links as `<a href="...">` wrapping the covered text. Render highlight annotations as `<mark>`.
**Files:** `pdf-parser.ts` — `extractPageContent()`, new `extractAnnotations()` function

#### 5.3 Bookmarks/outline not extracted
**Problem:** Document outline (bookmarks) is not parsed. Useful for navigation in long multi-page PDFs.
**Fix:** Parse `Outlines` from catalog, expose as `PdfParseResultPaged.outline` array. File-viewer can show a bookmark panel.
**Files:** `pdf-parser.ts` — `parsePdfPaged()`, new `PdfOutlineItem` interface

#### 5.4 Optional content layers not respected
**Problem:** OCG/OCMD (layer visibility groups) are not parsed. Layer visibility defaults are ignored.
**Fix:** Parse `OCProperties` from catalog. Respect `ON`/`OFF` defaults when extracting content.
**Files:** `pdf-parser.ts` — `extractPageContent()`

---

## Implementation Roadmap

### Sprint 1 — Ship the Fix ✅ Done
- [x] **1.0** Integrate `parsePdfPaged()` into file-viewer (replace iframe, add pagination + zoom)
- [x] **1.1** Add `pageWidth` / `pageHeight` to `PdfPageResult` + fix CropBox precedence (Gap 5.1)
- [x] **1.2** Wrap page HTML in a sized container div using actual page dimensions + RTL detection

### Sprint 2 — Visual Fidelity Foundation ✅ Done
- [x] **2.1** Absolute-position images within page container (fixes Gap 1.2)
- [x] **2.2** Render background fill rectangles as positioned divs (fixes Gap 1.3)
- [x] **2.3** Render decorative lines and borders (fixes Gap 1.4)
- [x] **2.4** Image transparency via SMask → RGBA PNG (fixes Gap 1.5)
- [x] **2.5** Fix CropBox precedence over MediaBox (fixes Gap 5.1) — moved to Sprint 1

### Sprint 3 — Text Fidelity ✅ Done
- [x] **3.1** CSS `letter-spacing` from `charSpacing` (fixes Gap 2.1)
- [x] **3.2** CSS `word-spacing` from `wordSpacing` (fixes Gap 2.1)
- [x] **3.3** Text rendering modes 1–2 (stroke/fill+stroke) → CSS (fixes Gap 2.2)
- [x] **3.4** Superscript/subscript from `textRise` (fixes Gap 2.3)
- [x] **3.5** Horizontal scaling → CSS `scaleX()` (fixes Gap 2.4)
- [x] **3.6** Glyph fallback chain for unmapped codes (fixes Gap 2.5) — already handled by existing encoding differences + PDFDocEncoding fallback

### Sprint 4 — Layout Precision
- [ ] **4.1** Page margin detection and CSS padding (fixes Gap 3.2)
- [ ] **4.2** Line spacing preservation via `margin-bottom` (fixes Gap 3.3)
- [ ] **4.3** Text alignment detection: center / right / justify (fixes Gap 3.5)
- [ ] **4.4** First-line paragraph indentation (fixes Gap 3.4)
- [ ] **4.5** Side-by-side multi-column rendering (fixes Gap 3.1)

### Sprint 5 — Scanned Document Support
- [ ] **5.1** CCITTFaxDecode Group 3 (1D) decoder (fixes Gap 1.6)
- [ ] **5.2** CCITTFaxDecode Group 4 (2D) decoder (fixes Gap 1.6)
- [ ] **5.3** JBIG2Decode decoder or graceful placeholder (fixes Gap 1.7)

### Sprint 6 — Advanced Graphics
- [ ] **6.1** Full SVG path rendering for curves (fixes Gap 4.1)
- [ ] **6.2** Clipping path tracking and application (fixes Gap 4.2)
- [ ] **6.3** Dash pattern rendering (fixes Gap 4.6)
- [ ] **6.4** Transparency group opacity/blend mode (fixes Gap 4.5)
- [ ] **6.5** Axial/radial shading → CSS gradients (fixes Gap 4.4)
- [ ] **6.6** Tiling pattern fills (fixes Gap 4.3)

### Sprint 7 — Interactive & Navigation
- [ ] **7.1** Annotation extraction: links → `<a>`, highlights → `<mark>` (fixes Gap 5.2)
- [ ] **7.2** Bookmarks/outline extraction + file-viewer panel (fixes Gap 5.3)
- [ ] **7.3** Optional content layer visibility (fixes Gap 5.4)

### Sprint 8 — Advanced Fonts
- [ ] **8.1** Type3 font glyph rendering → inline SVG (fixes Gap 2.6)
- [ ] **8.2** CFF/OpenType embedded font metrics extraction

---

## Key Files

| File | Role |
|------|------|
| `packages/components/lib/pdf-parser.ts` | All parsing and HTML generation (4310 lines) |
| `packages/components/ui/file-viewer.component.ts` | Component integration |
| `packages/components/lib/inflate.ts` | FlateDecode (already used by parser) |

---

## Notes / Review Comments

> _Add your comments, questions, and decisions here as the spec evolves._

- [ ] **Decision needed:** Should the page container scale to fit the viewer width (like a real PDF viewer), or render at actual PDF points size? Current PPTX approach scales via CSS `transform: scale()`.
- [ ] **Decision needed:** Sprint 1 uses `[style.zoom]` for zoom (same as DOCX). Should we switch to `transform: scale()` for better mobile support?
- [ ] **Consider:** The `text` field in `PdfPageResult` is used by the rich-text editor. Any layout changes in the HTML output must not affect the `text` extraction output.
- [ ] **Consider:** Sprints 2–4 require the page-sized container from Sprint 1.2 — those tasks are blocked until 1.2 lands.
