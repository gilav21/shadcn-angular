# pdf2html TypeScript — Full Spec (v2)

> **Status:** Revised after Phase 1-4 learnings
> **Revised:** 2026-03-29
> **Owner:** gilav21
> **Reference:** [pdf2htmlEX](https://github.com/pdf2htmlEX/pdf2htmlEX) C++ source in `/pdf2htmlEX/`

---

## Lessons from v1

The first attempt tried to reuse the semantic parser's `extractPageContent` and bolt pixel-perfect features on top. This failed because:

1. `extractPageContent` merges characters into words — pdf2htmlEX processes each character individually
2. Width calculations use PDF `/Widths` arrays — pdf2htmlEX uses actual font glyph advance widths from Poppler
3. Space handling differs for CID vs single-byte fonts — pdf2htmlEX's `drawString` handles this at the byte level
4. Bottom-up patching created cascading issues that couldn't be resolved incrementally

**v2 approach: Complete top-down rewrite.** Build a new content stream processor in `pdf-pixel-perfect.ts` that mirrors the full `HTMLRenderer` pipeline from pdf2htmlEX. Do NOT import `extractPageContent`.

---

## Architecture

### pdf2htmlEX Pipeline (C++)

```
PDFDoc → Poppler engine → HTMLRenderer callbacks:
  ├─ startPage(pageNum, state)     → set page dimensions
  ├─ updateFont/CTM/Color/...      → mark state changes
  ├─ drawString(state, string)     → per-character processing:
  │   ├─ check_state_change()      → detect new line/state/clip
  │   ├─ prepare_text_line()       → open line, insert offsets
  │   └─ for each char:
  │       ├─ font->getNextChar()   → get unicode, advance width
  │       ├─ is_space? → append_padding_char + append_offset
  │       └─ else     → append_unicodes(unicode, width)
  ├─ stroke/fill/drawImage         → graphics (delegated to BackgroundRenderer)
  ├─ processLink                   → annotation overlays
  └─ endPage()                     → optimize + dump HTML
```

### TypeScript Translation

```
PdfReader → tokenize content stream → process operators:
  ├─ startPage(pageDict)           → set page dimensions
  ├─ Tf/Tm/cm/rg/...              → update graphics state, mark changes
  ├─ Tj/TJ/'/"                    → drawString equivalent:
  │   ├─ checkStateChange()        → detect new line/state/clip
  │   ├─ prepareTextLine()         → open line, insert offsets
  │   └─ for each char in string:
  │       ├─ pdfStringToUnicode()  → get unicode + char code
  │       ├─ font widths           → get advance width
  │       ├─ is_space? → line.appendOffset(space_advance)
  │       └─ else     → line.appendUnicodes([code], width)
  ├─ re/m/l/c + S/f/B             → graphics rendering
  ├─ annotations                   → link overlays
  └─ endPage()                     → optimize + dump HTML
```

### Key Difference from v1

| Aspect | v1 (wrong) | v2 (correct) |
|--------|-----------|-------------|
| Content stream processing | Reuse `extractPageContent` | New processor mirroring `HTMLRenderer` |
| Character granularity | Per-word or per-fragment TextItems | Per-character, matching `drawString` loop |
| Width calculation | `calcTextAdvance` from `/Widths` | Per-character advance from font widths, applied to positioning exactly as the C++ does |
| Space handling | Heuristic (`ch === ' '` or `code === 32`) | Exact byte-level check matching C++ `n == 1 && *p == ' '` |
| State change detection | Compare TextItem fields | Mirror `check_state_change()` with all flags |
| Line merging | Y-tolerance grouping | Mirror `check_state_change()` position merge logic |
| Optimization | Ad-hoc letter-spacing | 1:1 translation of `optimize_normal()` |
| HTML output | Custom rendering | 1:1 translation of `dump_text()` |

### File Structure

| File | Role |
|------|------|
| `packages/components/lib/pdf-pixel-perfect.ts` | Complete pixel-perfect renderer (standalone) |
| `packages/components/lib/pdf-parser.ts` | Semantic parser (unchanged, shared `PdfReader` only) |

The pixel-perfect module imports ONLY:
- `PdfReader` class (for PDF structure parsing)
- `PdfObject` type
- `buildFontInfo` / `FontInfo` (for font metric extraction)
- Low-level helpers: `getPageMediaBox`, `uint8ArrayToBase64`

It does NOT import: `extractPageContent`, `TextItem`, `ImageItem`, `PathRect`, or any extraction/rendering functions.

---

## Phase 1: PDF Parsing & Page Infrastructure

### Task 1.1 — PdfReader Integration
Reuse `PdfReader` for PDF structure parsing (xref, object resolution, stream decoding). This is the only shared component.

### Task 1.2 — Page Dimensions & Rotation
Extract MediaBox/CropBox, handle rotation (0/90/180/270), compute page width/height. Mirror `startPage()` in general.cc.

**Success:** Correct page dimensions for US Letter, A4, and rotated pages.
**Test:** Parse a rotated PDF, verify width/height are swapped correctly.

### Task 1.3 — Base CSS & Page Container
Generate base CSS matching `base.css.in` and page HTML structure matching `general.cc`.

**Success:** Page renders as white rectangle with shadow at correct dimensions.
**Test:** Generate HTML for blank page, verify structure matches pdf2htmlEX.

### Task 1.4 — Zoom Factor
Apply configurable zoom (default 1.3) to all coordinates. Mirror `text_scale_factor1 * text_scale_factor2`.

**Success:** Page dimensions match pdf2htmlEX output at same zoom.
**Test:** 612x792 page with zoom 1.3 → 795.6x1029.6.

---

## Phase 2: Font System

### Task 2.1 — Font Registry
Map each PDF font object to a unique ID. Extract font metrics (ascent, descent, em_size, space_width) from FontDescriptor. Mirror `install_font()` and `FontInfo` struct.

**Success:** Each unique font gets an ID with correct metrics.
**Test:** PDF with 3 fonts → registry has 3 entries with non-zero ascent/descent.

### Task 2.2 — Font Program Extraction
Extract raw font data from FontFile/FontFile2/FontFile3. Mirror `dump_embedded_font()` in font.cc.

**Success:** TrueType fonts extracted as raw bytes, CFF fonts identified.
**Test:** Extract font from PDF, verify byte signature matches format.

### Task 2.3 — @font-face Generation
Generate CSS @font-face rules with base64 data URIs. Mirror `export_remote_font()`.

**Success:** Embedded fonts render in browser with correct glyphs.
**Test:** Generate @font-face, embed in HTML, verify text renders with PDF font.

### Task 2.4 — Font CSS Classes
Generate `.ffN{font-family:'fN'}` classes. Each font gets its own family — no font-weight/font-style needed for embedded fonts (the glyphs carry the weight).

**Success:** Text uses embedded fonts, not system fallbacks.
**Test:** Bold title uses embedded bold font without CSS font-weight.

---

## Phase 3: Content Stream Processor

This is the CORE of the rewrite. Mirror `HTMLRenderer` callbacks.

### Task 3.1 — Graphics State Machine
Translate the full graphics state tracking from `state.cc`:

```typescript
interface RenderState {
    // PDF state (cur_* in C++)
    ctm: number[];
    textMatrix: number[];
    lineMatrix: number[];
    fontSize: number;
    fontName: string;
    fillColor: Color;
    strokeColor: Color;
    charSpace: number;
    wordSpace: number;
    horizScaling: number;
    rise: number;
    renderMode: number;
    lineWidth: number;

    // Derived state (draw_* in C++)
    drawTextScale: number;
    drawTx: number;
    drawTy: number;
    curTx: number;
    curTy: number;
    curTextTm: number[];  // effective text transform

    // Change flags
    allChanged: boolean;
    fontChanged: boolean;
    ctmChanged: boolean;
    textMatChanged: boolean;
    horizScaleChanged: boolean;
    riseChanged: boolean;
    fillColorChanged: boolean;
    strokeColorChanged: boolean;
    letterSpaceChanged: boolean;
    wordSpaceChanged: boolean;
    clipChanged: boolean;
    textPosChanged: boolean;
}
```

**Success:** State changes are detected exactly as in C++.
**Test:** Sequence `BT /F1 12 Tf 1 0 0 rg 72 700 Td` → correct state flags set.

### Task 3.2 — check_state_change()
1:1 translation of `check_state_change()` from state.cc lines 168-493. This is the decision engine:
- Detects clip changes → NLS_NEWCLIP
- Detects font/size changes → NLS_NEWSTATE or NLS_NEWLINE
- Computes draw_text_scale from CTM + TextMatrix (lines 266-322)
- Checks position compatibility — can text be merged into current line? (lines 324-410)
- Updates letter_space, word_space, fill_color, stroke_color

**Success:** Identical line-break decisions as pdf2htmlEX for same PDF.
**Test:** Multi-font paragraph → same number of lines and state changes as C++.

### Task 3.3 — prepare_text_line()
1:1 translation of `prepare_text_line()` from state.cc lines 496-540:
- If NLS_NEWCLIP → clip the page
- If NLS_NEWLINE → open new line with position
- Else → append horizontal offset to merge into current line
- If NLS_NEWSTATE → append state change

**Success:** Lines open/merge at the right points.
**Test:** Two Td operators with small dx → merged into one line with offset.

### Task 3.4 — drawString() Per-Character Loop
1:1 translation of `drawString()` from text.cc lines 26-187:

```typescript
for each character in string:
    getNextChar() → code, unicode, advance_width (ax, ay)

    width = font.getWidth(code)  // from font widths table

    tracer.draw_char()  // for covered text detection (skip for now)

    if is_space && space_as_offset:
        line.appendPaddingChar()
        line.appendOffset((ax * fontSize + letterSpace + wordSpace) * drawTextScale)
    else:
        unicode = check_unicode(u, code, font)
        line.appendUnicodes([unicode], advance_width)
        // handle word_space difference between PDF and HTML

    dx += ddx * horizScaling
    if is_space: dx += wordSpace * horizScaling

    curTx += dx
    drawTx += dx
```

**Success:** Each character positioned at its exact PDF coordinate.
**Test:** "Hello World" → 10 character items + 1 space offset, positions match PDF.

### Task 3.5 — TJ Array Processing
For TJ operator `[(H) -20 (e) -15 (l)]`:
- Each `(string)` → call drawString equivalent
- Each number → kern displacement: `textMatrix[4] -= (kern/1000) * fontSize * horizScaling`

**Success:** Kerning values produce correct character offsets.
**Test:** TJ with kerning → characters spaced according to kern values.

### Task 3.6 — Content Stream Operator Dispatch
Process all operators from tokenized content stream:
- Text: BT/ET, Tf, Td/TD, Tm, T*, Tc, Tw, Tz, Tr, Ts, Tj, TJ, ', "
- Graphics state: q/Q, cm, w, J, j, M, d, gs
- Color: g/G, rg/RG, k/K, cs/CS, sc/SC, scn/SCN
- Path: m, l, c, v, y, h, re + S, s, f, F, f*, B, B*, b, b*, n
- Image: Do (XObject), BI/ID/EI (inline image)
- Marked content: BMC, BDC, EMC

**Success:** All operators processed, state machine matches C++ behavior.
**Test:** Complex content stream with mixed operators produces correct output.

---

## Phase 4: TextLine Model (Already Partially Done)

### Task 4.1 — TextLine Class
1:1 translation of `HTMLTextLine` (already done in the rewrite). Verify:
- `appendUnicodes()` matches C++ exactly
- `appendOffset()` matches C++ exactly (offset coalescing at same index)
- `appendState()` matches C++ exactly

### Task 4.2 — optimize_normal()
1:1 translation (already done). Verify:
- Implicit zero-width slots counted correctly
- Letter-space optimization applies when dominant width > 50% of total slots
- Word-space optimization applies when no literal spaces exist
- Negative letter-space blocked

### Task 4.3 — dump_text()
1:1 translation (already done). Verify:
- Greedy state stack for minimal span nesting
- Whitespace span categories: near-zero skip, space match, threshold check
- Negative offset tracking for span stack safety

### Task 4.4 — State::begin()/end()
1:1 translation. First state goes on the div tag, subsequent states open spans with diff classes.

---

## Phase 5: CSS Class Deduplication (Already Done)

### Task 5.1-5.4 — State Managers
Already implemented and tested: NumericStateManager, ColorStateManager, TransformMatrixManager, AllStateManager.

---

## Phase 6: Graphics & Images

### Task 6.1 — Filled/Stroked Rectangles
Render PathRect items as positioned divs (already done).

### Task 6.2 — SVG Path Rendering
Convert Bezier paths to inline SVG elements.

### Task 6.3 — Image Extraction & Positioning
Extract images and position absolutely (already done).

### Task 6.4 — Annotations/Links
Render as transparent overlay divs (already done).

---

## Phase 7: Assembly & Integration

### Task 7.1 — Per-Page HTML Assembly
Z-order: background rects → SVG paths → images → text lines → link overlays.

### Task 7.2 — Global CSS Assembly
Base CSS + @font-face + font families + state manager classes.

### Task 7.3 — Standalone HTML Output
Self-contained HTML file with embedded CSS.

### Task 7.4 — File-Viewer Integration
`renderMode` input toggling between pixel-perfect and semantic.

---

## Phase 8: Validation

### Task 8.1 — Visual Regression
Side-by-side comparison with pdf2htmlEX output.

### Task 8.2 — Position Accuracy
Compare text left/bottom values between outputs.

### Task 8.3 — CSS Efficiency
Compare class count between outputs.

---

## Implementation Order

| Phase | What | Key Deliverable |
|-------|------|----------------|
| **1** | Page infrastructure | Blank pages with correct dimensions render |
| **2** | Font system | @font-face with embedded PDF fonts |
| **3** | Content stream processor | **THE CORE** — per-character text with exact positioning |
| **4** | TextLine model | Optimization + HTML dump (already partially done) |
| **5** | CSS deduplication | State managers (already done) |
| **6** | Graphics | Rects, SVG, images, links |
| **7** | Assembly | Complete output, file-viewer integration |
| **8** | Validation | Visual regression against pdf2htmlEX |

Phase 3 is the critical path. Everything else either exists or is straightforward. The content stream processor is what makes or breaks pixel-perfect output.

---

## C++ Files to Translate

| C++ File | TS Equivalent | Priority |
|----------|-------------|----------|
| `HTMLRenderer/state.cc` — `check_state_change()`, `prepare_text_line()` | New content stream processor | **P0 — must get right** |
| `HTMLRenderer/text.cc` — `drawString()` | Per-character processing loop | **P0 — must get right** |
| `HTMLTextLine.cc` — `optimize_normal()`, `dump_text()` | TextLine class (partially done) | **P0** |
| `HTMLTextPage.cc` — page-level line management + clips | TextPage class | P1 |
| `StateManager.h` — CSS class deduplication | Already done | Done |
| `HTMLState.h` — state structs | Already done | Done |
| `HTMLRenderer/font.cc` — font extraction | FontRegistry (partially done) | P1 |
| `HTMLRenderer/link.cc` — annotations | Already done | Done |
| `HTMLRenderer/draw.cc` — graphics | Minimal (delegates to BackgroundRenderer) | P2 |
| `base.css.in` — base CSS | Already done | Done |

---

## What Already Works (Keep)

- `AllStateManager` with all sub-managers (tested, 17 unit tests)
- `FontRegistry` with @font-face generation
- Base CSS matching `base.css.in`
- Graphics rendering (filled/stroked rects, images, annotations)
- `TextLine` class with `optimize_normal()` and `dump_text()` (needs verification against C++)
- Page container HTML structure
- Zoom factor support
- 105 passing tests
- Standalone HTML output

## What Must Be Rewritten (Phase 3) — DONE

Phase 3 content stream processor is implemented. `PixelPerfectProcessor` class in `pdf-pixel-perfect.ts` replaces `extractPageContent`. All 71 tests pass.

---

## Phase 3 Visual Comparison Results (2026-03-31)

Test PDF: `demo/public/DW2-3-Viruses-www.underwar.co.il.pdf` (14-page Hebrew document)
Reference: `demo/public/DW2-3-Viruses-www.underwar.co.il.html` (pdf2htmlEX C++ output)
Our output: `demo/public/pixel-perfect.html`

### Issue A: Character Overlapping at Hebrew-Latin Boundaries

**Symptom**: On multiple pages, Latin text fragments (e.g., "Windows", "Startup", "explorer.exe") overlap with adjacent Hebrew text. Characters render on top of each other at the boundary.

**Evidence (Page 1)**:
- Our output: "בתיקיהStartup" — no space, text runs together
- C++ reference: "בתיקיה Startup." — properly spaced with period
- Original PDF: shows "בתיקיה Startup." — space is intended

**Evidence (Page 10)**:
- Our output: "SMARTCARDSBLOOPY CD" — letters smashed together
- Our output: "Control Panel"ושם — Latin overlaps Hebrew

**Evidence from CSS comparison**:
- Our letter-spacing: tiny values (-0.07 to +0.07px)
- C++ letter-spacing: larger range (-0.37 to +0.08px)
- The C++ version uses more aggressive negative letter-spacing to tighten text, suggesting a different optimization outcome

**Root cause CONFIRMED and FIXED**: Missing `text_scale_factor2` (font_size_multiplier) from C++ `general.cc:326-327`.

```cpp
// C++ code we were missing:
text_scale_factor1 = max(zoom, font_size_multiplier);  // max(1.3, 4.0) = 4.0
text_scale_factor2 = zoom / text_scale_factor1;          // 1.3 / 4.0 = 0.325

// In drawTextScale calculation (state.cc:282):
new_draw_text_scale = 1.0/text_scale_factor2 * hypot(tm[2], tm[3]);
```

**Evidence before fix**: Our font-size=14.352px, transform:none. C++ font-size=44.160px, transform:matrix(0.325,...).
**Evidence after fix**: Our font-size=44.16px ✓, transform:matrix(0.325,0,0,0.325,0,0) ✓. Letter-spacing values now in same range as C++ (e.g., our ls5=-0.1844 matches C++ ls6=-0.1844).

**Remaining**: Some Hebrew-Latin boundary spaces still missing — this is a separate offset calculation issue, not related to font-size/transform.

### Issue B: Garbled Characters in Symbol-Encoded Fonts

**Symptom**: On Page 12 bullet list, text like "ImagePath" renders as "ΙμαγεΠατη" (Greek-looking symbols). "ObjectName" → "ΟβφεχτΝαμε", "Start" → "Σταρτ", "Error" → "Ερρορ".

**Evidence**:
- Our ff5: `font-family:'f5',Symbol;` — embedded Symbol font is VISIBLE
- C++ ff5: `font-family:sans-serif;visibility:hidden;` — C++ HIDES this font
- The HTML text content is correct ("ImagePath"), but the Symbol font maps Latin code points to Greek-like glyphs

**Root cause**: The C++ version (via FontForge) re-encodes fonts to proper Unicode mapping. When it can't process a font, it falls back to `visibility:hidden`. Our code embeds the raw font program without re-encoding, so Symbol-encoded fonts render with wrong glyphs.

**Note**: Checking against the original PDF: the original PDF DOES show "ImagePath" etc. in normal Latin text. So the C++ approach of hiding the Symbol font and letting another mechanism show the text is correct for visual fidelity. However, in the original PDF the text IS visible, so this needs investigation into what rendering layer shows it.

### Issue C: Things We Do BETTER Than pdf2htmlEX

**C++ hides text that should be visible:**
- Page 1 author line: "(cp77fk4r)" — C++ hides it, but original PDF shows it ✓
- Page 1 "Startup" heading — C++ hides it, but original PDF shows it ✓
- Our version correctly shows these. This is because the C++ covered-text-detector is overly aggressive.

### Issue D: Space Handling in Monospace Code Boxes — FIXED

**Was**: "C:\DocumentsandSettings" — spaces removed
**Fixed by**: Treating space characters (0x20) as regular characters with advance width instead of offsets. Spaces now render correctly: "C:\Documents and Settings\[User]\Start Menu\Programs"

### Next Investigation Steps

1. **For Issue A (overlapping)**: Add debug logging to compare our per-character advance widths against the widths that pdf2htmlEX computes (can extract from the C++ HTML's whitespace span widths). This will prove whether the widths match or differ.
2. **For Issue B (garbled)**: Investigate how pdf2htmlEX re-encodes Symbol fonts via FontForge. The fix likely requires either: (a) re-encoding font programs during extraction, or (b) detecting Symbol-encoded fonts and using ToUnicode + fallback system fonts.
3. **For both**: Compare the full per-page HTML structure (number of divs, span nesting, offset counts) between our output and C++ output to identify structural differences.

---

## Bug Tracker — Organized by Phase (2026-04-01)

Test PDF: `demo/public/DW2-3-Viruses-www.underwar.co.il.pdf` (14-page Hebrew RTL document)

### Phase 1 Bugs — Page Infrastructure

**No known bugs.** Page dimensions, rotation, base CSS, zoom all work correctly.

---

### Phase 2 Bugs — Font System

#### BUG-2A: Symbol font renders Latin as Greek glyphs — FIXED (2026-03-31)
- **Symptom**: Page 12 bullets: "ImagePath" → "ΙμαγεΠατη"
- **Evidence**: Our ff5 CSS was `font-family:'f5',Symbol;`. Symbol font maps Latin code points to Greek-like glyphs. HTML text content correct ("ImagePath") but rendered with wrong font.
- **Fix**: Detect Symbol/ZapfDingbats/Wingdings fonts by baseFont name; use `sans-serif` CSS fallback instead of embedding.

#### BUG-2B: Bullet markers render as □ instead of • — OPEN
- **Symptom**: Page 12 bullet list shows □ instead of filled bullet •
- **Introduced by**: BUG-2A fix (replaced Symbol font with sans-serif)
- **Root cause**: The bullet character code in the PDF maps via ToUnicode to a code point that sans-serif doesn't have a glyph for (possibly PUA).
- **Fix needed**: Investigate the ToUnicode mapping for the bullet char code. If it maps to a standard Unicode bullet (U+2022), sans-serif should work. If PUA, add character substitution.

#### BUG-2C: Font glyph width accuracy affects boundary spacing — OPEN (investigated 2026-04-01)
- **Symptom**: Hebrew-Latin boundaries have tight/missing spaces (e.g., "בתיקיהStartup"). Characters slightly overlap at language transitions.
- **Evidence**: Per-span offset comparison shows offsets match C++ within ~0.5px visual. But CID space characters in text flow have font glyph widths that differ from positioning expectations by ~1px at 14px font-size.
- **Root cause confirmed**: Literal CID space characters (U+0020 from CID fonts) in the HTML text flow render with the embedded font's space glyph width. This width doesn't exactly match the positioning calculated from `/Widths`. The C++ version avoids this via FontForge font normalization and dump_text word-space recovery.
- **Attempted fix (reverted)**: Converting CID spaces to padding + offset removed ALL Hebrew word spaces (too aggressive). The fix needs to be selective: only boundary spaces, not intra-word spaces.
- **Fix needed**: Either (a) parse glyph advances from embedded TTF/CFF font programs directly, or (b) implement C++ dump_text `single_space_offset()` matching logic to recover spaces from word-space CSS.

---

### Phase 3 Bugs — Content Stream Processor

#### BUG-3A: Missing text_scale_factor2 — FIXED (2026-03-31)
- See Issue A above for full evidence and fix details.

#### BUG-3B: RTL bracket/parenthesis mirroring — OPEN (font encoding issue)
- **Original symptom**: `]Windows[` instead of `[Windows]`, `]windows]` instead of `[windows]` in rendered output.
- **Attempted fix #1**: Added `mirrorBidiChar()` to swap ALL brackets for RTL fonts. Fixed brackets but caused REGRESSION — parentheses `(cp77fk4r)` became `)cp77fk4r(` (double-mirroring). Reverted.
- **Evidence from C++ comparison**:
  - Both DOMs have identical character codes: `[Windows]` (U+005B, U+005D)
  - C++ renders `[Windows]` visually (correct). Ours renders `]Windows[` (wrong).
  - C++ code box DOM: `]windows]`. C++ renders: `[windows]` (browser mirrors). Ours: `]windows]` (no mirror).
  - The C++ re-encoded fonts (FontForge) have properties that trigger consistent bidi glyph mirroring. Our raw embedded fonts don't.
- **Root cause**: FontForge re-encoding gives the C++ fonts correct bidi mirroring behavior. Without re-encoding, the browser applies mirroring inconsistently depending on font properties. Parentheses happen to work (PDF stores them in visual order), brackets don't (PDF stores them in logical order).
- **Fix needed**: Same as BUG-2C — requires font program processing (either FontForge-equivalent re-encoding, or font-level bidi property manipulation). This is Phase 2 (Font System) work.
- **Testing lesson**: HTML source ≠ visual rendering. CSS `unicode-bidi` + browser bidi + font properties ALL affect visual bracket rendering. Must always verify with screenshots.

#### BUG-3C: Punctuation characters overlapping adjacent letters — OPEN
- **Symptom**: `()` and `""` render on top of the first/last letter they surround.
- **Evidence**: User-provided screenshot (Image 1) shows `"SC.exe"`, `+S+H`, `Autorun.inf(` with overlapping at boundaries.
- **Root cause**: Related to BUG-2C — punctuation advance widths may differ between `/Widths` and actual font program. Also possibly a position merge issue where the offset between punctuation and letters is computed incorrectly.
- **Fix needed**: Same investigation as BUG-2C — compare per-character advance widths.

#### BUG-3D: Spaces in code boxes removed — FIXED (2026-03-31)
- See Issue D above.

#### BUG-3E: curTx not reset on Td — FIXED (2026-03-31)
- See x-position dedup fix above.

---

### Phase 4 Bugs — TextLine Model

**All functions 1:1 with C++ (2026-04-03).** F1-F8 rewrite complete per `htmltextline-1to1-spec.md`:
- F1 `appendUnicodes`: decomposed text (ligatures) support via negative indices
- F2 `appendOffset`: merge at same position
- F3 `appendState`: reuse at same position
- F4 `prepare`: one-arg `install()`, no snap-back
- F5 `optimizeNormal`: letter-space histogram + word-space via single_space_offset
- F6 `emitLineContent`: whitespace installAndSnap with dx residual, single_space_offset matching, negative offset guard, VA accumulation in greedy
- F7 `dump_chars`: handles positive/negative/padding chars
- F8 `lineStyleDiffClasses`: hash_umask/free logic for word-space, always emits letter-space
- Step 4: spaces converted to padding+offset (matching `space_as_offset` mode)

---

### Phase 5 Bugs — CSS Deduplication

**No known bugs.** State managers produce correct CSS.

---

### Phase 6 Bugs — Graphics & Images

#### BUG-6A: Most images not rendering — OPEN
- **Symptom**: Images throughout the document (screenshots, diagrams) show as empty space. Only JPEG images (DCTDecode) display.
- **Evidence**: Page 12 empty area below bullets; Page 11 missing image above "System Services" header. Header logo (JPEG) works.
- **Root cause**: `processImageXObject()` only handles `DCTDecode` (JPEG) and `JPXDecode` (JP2). FlateDecode images require color space decoding (DeviceRGB, DeviceGray, ICCBased, Indexed) to produce PNG data URIs.
- **Fix needed**: Implement FlateDecode → PNG conversion with color space support.

#### BUG-6B: Header logo missing shadow/gradient effect — OPEN
- **Symptom**: "digital whisper" logo appears but lacks shadow/fade effect from original PDF.
- **Root cause**: Shadow likely uses image soft masks (SMask), transparency groups, or blend modes — none implemented.
- **Fix needed**: Implement SMask support for image XObjects.

---

### Phase 7 Bugs — Assembly

**No known bugs.**

---

### Phase 8 Bugs — Validation

Phase 8 not started. Issues found during informal visual comparison documented above.

---

### Things We Do BETTER Than pdf2htmlEX

- Page 1 author line "(cp77fk4r)": C++ hides it, original PDF shows it — **we're correct** ✓
- Page 1 "Startup" heading: C++ hides it, original PDF shows it — **we're correct** ✓

---

### Phase Completion Status

| Phase | Status | Open Bugs | Fixed Bugs |
|-------|--------|-----------|------------|
| **1** Page Infrastructure | ✅ Complete | — | — |
| **2** Font System | ⚠️ Partial | Width normalization done (2026-04-03) | BUG-2A, width norm |
| **3** Content Stream Processor | ⚠️ Has bugs | BUG-3B (font encoding), BUG-3C | BUG-3A, BUG-3D, BUG-3E |
| **4** TextLine Model | ✅ Complete (1:1 C++) | — | F1-F8 rewrite (2026-04-03) |
| **5** CSS Deduplication | ✅ Complete | — | — |
| **6** Graphics & Images | ⚠️ Has bugs | BUG-6A, BUG-6B | — |
| **7** Assembly | ✅ Complete | — | — |
| **8** Validation | 🔲 Not started | — | — |

### opentype.js Integration (2026-04-01)

Integrated opentype.js for font processing — the single biggest quality improvement:

1. Parses embedded TTF/OTF font programs
2. Extracts accurate per-glyph advance widths (matches browser rendering)
3. Re-encodes CID fonts with correct Unicode cmap (fixes bidi mirroring)
4. Embeds re-encoded fonts via @font-face

**Bugs resolved:** BUG-2B (bullets •), BUG-2C (boundary spacing), BUG-3B (bracket mirroring), BUG-3C (punctuation overlap). CSS dropped from 1.39MB to 674KB.

**Remaining:** Some Hebrew-Latin boundary spacing still tight where glyphs are missing from the embedded font (advance=0, falls back to PDF /Widths).

**Next step**: Phase 6 (images).

---

### Visual Validation Report (2026-04-02) — Independent Third-Party

**Validator**: Independent agent with no knowledge of what was "fixed"
**Current**: pixel-perfect.html | **Reference**: Original PDF

#### PATTERN A: Missing spaces at Hebrew-Latin boundaries (~100 instances)
- Occurs at virtually EVERY transition between Hebrew and Latin text
- Examples: `םייקtradeoff`, `תכרעמWindows`, `היקיתבStartup`, `ץבוקבWininit.ini`
- **Severity**: major | **Pages**: ALL (1-14) | **Phase**: 2/3 (font width accuracy)

#### PATTERN B: Parentheses/brackets overlapping adjacent characters (~30 instances)
- `(` and `)` render ON TOP of first/last character they surround
- Makes `(L` look like `$`, `[W` look garbled
- **Severity**: major | **Pages**: 1, 3, 5, 7, 10, 12 | **Phase**: 2/3

#### PATTERN C: Second code box `]windows]` instead of `[windows]`
- Only second code box on page 3 affected
- **Severity**: major | **Phase**: 3 (content stream)

#### PATTERN D: Missing images throughout (~20 instances)
- No non-JPEG images render (screenshots, diagrams, figures)
- **Severity**: major | **Pages**: 4, 6, 8-13 | **Phase**: 6

#### PATTERN E: Header logo missing shadow effect
- Logo without shadow/gradient fading
- **Severity**: minor | **Phase**: 6

#### Summary: ~150 major issues, ~15 minor, ~5 cosmetic
- Phases 2-3 issues (A, B, C): boundary spacing from CID font glyph width mismatch
- Phase 6 issues (D, E): **expected, not yet implemented**

#### Attempted Fix: CID space → offset (2026-04-02) — REVERTED
Converting CID space characters to offsets (matching C++ space_as_offset) removed ALL Hebrew word spacing, making text completely unreadable. The C++ makes this work through dump_text() word-space recovery logic that converts offsets back to space characters using CSS word-spacing. Without implementing this recovery logic, CID space-to-offset is destructive.

#### Root cause analysis for Pattern A/B:
The boundary spacing issue comes from literal CID space characters (U+0020) in the text flow. These render with the font's space glyph width, which doesn't exactly match the positioning offsets. The C++ avoids this by:
1. Converting ALL spaces to padding+offset (space_as_offset)
2. In dump_text(), recovering visible spaces using word-spacing CSS mechanism
3. FontForge scaling glyph widths to match PDF /W entries

#### Attempted Fix #2: padding+offset with recovery rendering (2026-04-02) — REVERTED
Same result as Attempt #1. Converting ALL spaces (single-byte + CID) to padding+offset and adding `isPaddedSpace` flag to renderOffsetSpan still destroyed all spacing. Root cause: our `emitLineContent` processes offsets via map lookup (by text index), while C++ `dump_text` interleaves text and offset output with accumulated residual `dx` tracking. The `optimizeWordSpacing` absorbs space offsets to zero, and our offset rendering sees width=0 and skips them. The C++ recovery works because it tracks `dx` accumulation and matches against `single_space_offset()` in a completely different rendering model.

#### What's actually needed:
Rewrite `emitLineContent` to match the C++ `dump_text` interleaved processing model:
1. Process text chars and offsets in ORDER (not via map lookup)
2. Track accumulated residual `dx` across offsets
3. Implement `single_space_offset()` matching: `word_space + letter_space + space_width * font_size`
4. When `target ≈ single_space_offset`, emit CSS-controlled space span

This is a Phase 4 (TextLine Model) refactor — the current `emitLineContent` architecture doesn't support the C++ recovery model.

#### Attempted Fix #3: interleaved emitLineContent + CID-only offset (2026-04-02) — REVERTED
Rewrote emitLineContent to process offsets inline with dx tracking and isPaddedSpace recovery. CID spaces → padding+offset, single-byte spaces kept as chars. Result: Hebrew word spacing STILL destroyed despite recovery logic. The `optimizeWordSpacing` absorbs offsets to zero, and `<span class="_"> </span>` with no width class renders as zero-width (the word-spacing CSS is not set correctly because the optimization pipeline doesn't compute `single_space_offset` properly).

**Conclusion**: The CID space-to-offset approach is a dead end without a COMPLETE rewrite of both `optimizeNormal()` AND `emitLineContent()` to match the C++ TextLine model exactly. The current optimization pipeline (findDominantSpacing + applyLetterSpacing + optimizeWordSpacing) and rendering pipeline (map-based offset lookup) are architecturally incompatible with the C++ space recovery model.

**Phase 4 rewrite DONE (2026-04-03)**: 1:1 translation of all C++ HTMLTextLine functions (F1-F8) per `htmltextline-1to1-spec.md`. All 71 tests pass.

**Spacing fix (2026-04-03)**: Root cause found — Step 4 of htmltextline spec converted spaces to padding+offset (`space_as_offset=1` mode), but C++ defaults to `space_as_offset=0` where spaces are LITERAL characters. Reverted: spaces now kept as characters with word-spacing CSS controlling width. Hebrew inter-word spacing FIXED. Hebrew↔Latin boundary spacing (e.g., `בתיקייתStartup`) remains — this is a font transition issue where separate BT blocks don't create inter-word gaps.
