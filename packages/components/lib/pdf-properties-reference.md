# PDF Properties Reference — Parser Audit

> Comprehensive audit of every PDF content stream operator, property, and feature
> against our custom parser (`pdf-parser.ts`).
>
> **Legend:** ✅ Handled | ⚠️ Partial/Tracked but not applied | ❌ Missing

---

## 1. Text State Operators

| Operator | PDF Spec Name | Purpose | Status | Parser Location | Notes |
|----------|---------------|---------|--------|-----------------|-------|
| `Tc` | Character spacing | Extra spacing between characters | ✅ | `processTextStateOperator` L1949, `calcTextAdvance` L1500 | Applied to advance calc |
| `Tw` | Word spacing | Extra spacing for space chars (code 32) | ✅ | `processTextStateOperator` L1950, `calcTextAdvance` L1508 | Correctly filters code 32 |
| `Tz` | Horizontal scaling | Scale factor (percentage) | ✅ | `processTextStateOperator` L1951, `calcTextAdvance` L1506 | Applied as `hs/100` |
| `TL` | Text leading | Distance between baselines | ✅ | `processTextStateOperator` L1948 | Used by `T*`, `TD`, `'`, `"` |
| `Tf` | Font (name + size) | Set current font resource and size | ✅ | `processTextStateOperator` L1954-1958 | Resolves from operand stack |
| `Tr` | Text render mode | 0=fill, 1=stroke, 2=both, 3=invisible... | ✅ | `processTextStateOperator` L1953, `isInvisibleTextMode` L1512 | Modes 3,7 filtered |
| `Ts` | Text rise | Vertical offset for super/subscript | ⚠️ | `processTextStateOperator` L1952 | Stored but NOT applied |

---

## 2. Text Positioning Operators

| Operator | Purpose | Status | Parser Location | Notes |
|----------|---------|--------|-----------------|-------|
| `Td` | Move text position by (tx, ty) | ✅ | `processMatrixOperator` L1983-1987 | Multiplies with lineMatrix |
| `TD` | Move + set leading to -ty | ✅ | `processMatrixOperator` L1989-1994 | Sets `gs.leading = -ty` |
| `Tm` | Set text matrix directly | ✅ | `processMatrixOperator` L1975-1981 | Also resets lineMatrix |
| `T*` | Move to next line using leading | ✅ | `processMatrixOperator` L1996-1999 | `[1,0,0,1,0,-leading] × lineMatrix` |

---

## 3. Text Show Operators

| Operator | Purpose | Status | Parser Location | Notes |
|----------|---------|--------|-----------------|-------|
| `Tj` | Show single text string | ✅ | `processTextShowToken` L2052-2054 | Via `processTextShow()` |
| `TJ` | Show array of strings + positioning | ✅ | `processTextShowToken` L2070-2072 | Via `processTJOperator()`, handles kerning |
| `'` | Move to next line + show string | ✅ | `processTextShowToken` L2056-2060 | Applies leading first |
| `"` | Set word/char spacing + nextline + show | ✅ | `processTextShowToken` L2062-2068 | Sets Tw, Tc, then leading+show |

---

## 4. Color Operators

### 4.1 Device Color (Direct)

| Operator | Color Model | Target | Status | Parser Location |
|----------|-------------|--------|--------|-----------------|
| `g` | Gray | Fill | ✅ | `processColorOperator` L1622-1623 |
| `G` | Gray | Stroke | ✅ | `processStrokeColorOperator` L1767-1768 |
| `rg` | RGB | Fill | ✅ | `processColorOperator` L1615-1621 |
| `RG` | RGB | Stroke | ✅ | `processStrokeColorOperator` L1760-1765 |
| `k` | CMYK | Fill | ✅ | `processColorOperator` L1625-1631 |
| `K` | CMYK | Stroke | ✅ | `processStrokeColorOperator` L1770-1776 |

### 4.2 Generic Color (Color Space Dependent)

| Operator | Target | Status | Parser Location | Notes |
|----------|--------|--------|-----------------|-------|
| `cs` | Set fill color space | ✅ | `processColorSpaceOperator` L2167-2170 | |
| `CS` | Set stroke color space | ✅ | `processColorSpaceOperator` L2172-2175 | |
| `sc` | Set fill color | ✅ | `processColorOperator` L1633-1651 | Resolves based on current color space |
| `scn` | Set fill color (with name) | ✅ | `processColorOperator` L1633-1651 | Same handler as `sc` |
| `SC` | Set stroke color | ✅ | `processStrokeColorSpaceOperator` L2180-2201 | |
| `SCN` | Set stroke color (with name) | ✅ | `processStrokeColorSpaceOperator` L2180-2201 | |

---

## 5. Color Spaces

| Color Space | Components | Status | Parser Location | Notes |
|-------------|-----------|--------|-----------------|-------|
| `DeviceRGB` | 3 | ✅ | `resolveColorSpaceComponents` L2133 | |
| `DeviceGray` | 1 | ✅ | L2134 | |
| `DeviceCMYK` | 4 | ✅ | L2135 | |
| `CalRGB` | 3 | ✅ | L2133, L2153 | Treated as DeviceRGB |
| `CalGray` | 1 | ✅ | L2134, L2154 | Treated as DeviceGray |
| `ICCBased` | N (1,3,4) | ✅ | L2147-2151 | Reads N from ICC stream dict |
| `Indexed` | varies | ✅ | L2155-2159 | Resolves base color space |
| `Separation` | 1 | ⚠️ | L2161 | Returns 1 component — may produce wrong color for complex tint transforms |
| `DeviceN` | 1 | ⚠️ | L2161 | Returns 1 component — limited accuracy |
| `Pattern` | 0 | ⚠️ | L2162 | Detected, returns 0 — no rendering |
| `Lab` | 3 | ❌ | — | Not handled |

---

## 6. Graphics State Operators

| Operator | Purpose | Status | Parser Location | Notes |
|----------|---------|--------|-----------------|-------|
| `q` | Save graphics state | ✅ | `processStateToken` L2039 | Deep clone via `structuredClone` |
| `Q` | Restore graphics state | ✅ | `processStateToken` L2040-2044 | |
| `cm` | Modify CTM (concatenate matrix) | ✅ | `processMatrixOperator` L1968-1973 | 6-element affine matrix |
| `w` | Set line width | ✅ | `processPathBuildOperator` L1829-1831 | |
| `BT` | Begin text object | ✅ | `processStateToken` L2046 | Resets text + line matrix |
| `ET` | End text object | ✅ | `processStateToken` L2047 | |
| `BX` | Begin compatibility section | ✅ | `processContentToken` L2204 | Increments counter |
| `EX` | End compatibility section | ✅ | `processContentToken` L2205 | Decrements counter |

---

## 7. ExtGState Properties (via `gs` operator)

Handled in `processGsOperator()` (L2093-2130):

| Property | Purpose | Status | Notes |
|----------|---------|--------|-------|
| `Font` | Font array [ref, size] | ✅ | L2103-2117 |
| `LW` | Line width | ✅ | L2119-2123 |
| `CA` | Stroke opacity | ⚠️ | L2125-2126 — Stored in `gs.strokeOpacity` but never applied to HTML output |
| `ca` | Fill opacity | ⚠️ | L2128-2129 — Stored in `gs.fillOpacity` but **not used to filter invisible text** |
| `BM` | Blend mode | ❌ | Not read from ExtGState dict |
| `SMask` | Soft mask | ❌ | Not read — could make text invisible/transparent |
| `AIS` | Alpha is shape | ❌ | Not read |
| `TK` | Text knockout | ❌ | Not read |
| `SA` | Stroke adjustment | ❌ | Not relevant for text extraction |
| `OP` / `op` | Overprint | ❌ | Not relevant for text extraction |
| `OPM` | Overprint mode | ❌ | Not relevant for text extraction |
| `FL` | Flatness | ❌ | Not relevant for text extraction |
| `LC` | Line cap style | ❌ | Not relevant for text extraction |
| `LJ` | Line join style | ❌ | Not relevant for text extraction |
| `ML` | Miter limit | ❌ | Not relevant for text extraction |
| `D` | Dash pattern | ❌ | Not relevant for text extraction |
| `RI` | Rendering intent | ❌ | Not relevant for text extraction |
| `HT` | Halftone | ❌ | Not relevant for text extraction |
| `TR` / `TR2` | Transfer function | ❌ | Not relevant for text extraction |
| `BG` / `BG2` | Black generation | ❌ | Not relevant for text extraction |
| `UCR` / `UCR2` | Undercolor removal | ❌ | Not relevant for text extraction |

---

## 8. Path Construction & Painting Operators

### 8.1 Path Construction

| Operator | Purpose | Status | Parser Location |
|----------|---------|--------|-----------------|
| `m` | Move to (x, y) | ✅ | `processPathBuildOperator` L1787-1791 |
| `l` | Line to (x, y) | ✅ | L1793-1797 |
| `re` | Rectangle (x, y, w, h) | ✅ | L1799-1805 |
| `c` | Cubic Bézier (6 args) | ✅ | L1807-1812 — Tracked but only rects emitted |
| `v` | Bézier (replicated initial) | ✅ | L1814-1818 — Same |
| `y` | Bézier (replicated final) | ✅ | L1820-1825 — Same |
| `h` | Close subpath | ✅ | L1826-1828 |

### 8.2 Path Painting

| Operator | Purpose | Status | Parser Location |
|----------|---------|--------|-----------------|
| `S` | Stroke path | ✅ | `processPathPaintOperator` L1917-1921 |
| `s` | Close + stroke | ✅ | L1918 |
| `f` | Fill (winding) | ✅ | L1922-1927 |
| `F` | Fill (winding, compat) | ✅ | L1923 |
| `f*` | Fill (even-odd) | ✅ | L1924 |
| `B` | Fill + stroke | ✅ | L1928-1934 |
| `B*` | Fill + stroke (even-odd) | ✅ | L1929 |
| `b` | Close + fill + stroke | ✅ | L1930 |
| `b*` | Close + fill + stroke (even-odd) | ✅ | L1931 |
| `n` | End path (no paint) | ✅ | L1935-1937 |

### 8.3 Clipping Path

| Operator | Purpose | Status | Notes |
|----------|---------|--------|-------|
| `W` | Clip (winding rule) | ❌ Ignored | In `IGNORED_OPERATORS` |
| `W*` | Clip (even-odd rule) | ❌ Ignored | In `IGNORED_OPERATORS` |

---

## 9. XObject & Resource Operators

| Operator | Purpose | Status | Parser Location | Notes |
|----------|---------|--------|-----------------|-------|
| `Do` (Image) | Render external image | ✅ | `processDoOperator` L1657-1673 | Converts to data URL |
| `Do` (Form) | Render Form XObject | ✅ | `processFormXObject` L1694-1746 | Recursive, depth limit 10 |
| `Do` (PostScript) | PostScript XObject | ❌ | — | Not handled (rare) |
| `BI` | Begin inline image | ⚠️ | `processResourceToken` L2082-2088 | DCTDecode inline images skipped (L2419) |
| `ID` | Inline image data | ⚠️ | Within `parseInlineImage` | |
| `EI` | End inline image | ❌ Ignored | `IGNORED_OPERATORS` | Consumed by inline parser |
| `sh` | Shading fill | ❌ Ignored | `IGNORED_OPERATORS` | |

---

## 10. Marked Content Operators

| Operator | Purpose | Status | Notes |
|----------|---------|--------|-------|
| `BMC` | Begin marked content | ❌ Ignored | In `IGNORED_OPERATORS`. Carries structure tag name. |
| `BDC` | Begin marked content (with props) | ❌ Ignored | In `IGNORED_OPERATORS`. Carries `/MCID` + structure type for tagged PDFs. |
| `EMC` | End marked content | ❌ Ignored | In `IGNORED_OPERATORS` |
| `MP` | Marked content point | ❌ Ignored | In `IGNORED_OPERATORS` |
| `DP` | Marked content point (with props) | ❌ Ignored | In `IGNORED_OPERATORS` |

**Impact:** Tagged PDFs use `BDC`/`EMC` to associate text with structure elements
(H1, P, Table, L, LI, Span). Ignoring these means we rely entirely on
heuristics for heading/list/table detection.

---

## 11. Ignored Operators (Explicitly Skipped)

| Operator | Purpose | Impact of Ignoring |
|----------|---------|-------------------|
| `ri` | Rendering intent | None — cosmetic |
| `J` | Line cap style | None — path styling |
| `j` | Line join style | None — path styling |
| `M` | Miter limit | None — path styling |
| `d` | Dash pattern | Minor — can't detect dashed underlines/borders |
| `i` | Flatness tolerance | None — rendering hint |
| `W` / `W*` | Clipping path | Minor — text outside clip area still extracted |
| `sh` | Shading fill | None — decorative |

---

## 12. Font Properties

### 12.1 Font Dictionary Properties

| Property | Purpose | Status | Parser Location | Notes |
|----------|---------|--------|-----------------|-------|
| `BaseFont` | Font name (e.g. "Arial-Bold") | ⚠️ | `processGsOperator` L2111-2114 | Stored but **not analyzed for bold/italic** |
| `Subtype` | Font type (Type0, Type1, TrueType, etc.) | ✅ | `buildFontInfo` L1446 | Used for Type0 composite font detection |
| `Encoding` | Character encoding name/dict | ✅ | L1447-1461 | Handles names + Differences array |
| `ToUnicode` | CMap for char→unicode mapping | ✅ | L1451-1457 | Full CMap parser |
| `FirstChar` | First char code in Widths array | ✅ | `buildStandardFontWidths` L1333 | |
| `LastChar` | Last char code in Widths array | ✅ | L1334 | |
| `Widths` | Per-character width array | ✅ | L1335-1340 | |
| `DescendantFonts` | CIDFont reference (for Type0) | ✅ | `buildType0FontWidths` | |
| `W` / `DW` | CID font widths | ✅ | `setCIDWidthsFromArray`, `setCIDWidthsFromRange` | |

### 12.2 FontDescriptor Properties

| Property | Purpose | Status | Notes |
|----------|---------|--------|-------|
| `FontDescriptor` (dict ref) | Font metadata container | ⚠️ | Only `MissingWidth` read (L1342-1345) |
| `MissingWidth` | Default width for missing glyphs | ✅ | L1345 |
| `Flags` | Font flags bitfield | ❌ **Missing** | Bit 1=FixedPitch, 2=Serif, 3=Symbolic, 6=**Italic**, 19=**ForceBold** |
| `FontWeight` | Weight (100-900) | ❌ **Missing** | 700+ indicates bold |
| `ItalicAngle` | Angle of italic slant | ❌ **Missing** | Non-zero indicates italic |
| `FontBBox` | Bounding box | ❌ Not used | Not needed for text extraction |
| `Ascent` | Ascender height | ❌ Not used | Could improve line grouping |
| `Descent` | Descender depth | ❌ Not used | Could improve baseline calc |
| `CapHeight` | Capital letter height | ❌ Not used | |
| `StemV` | Vertical stem width | ❌ Not used | Correlates with boldness |
| `XHeight` | x-height | ❌ Not used | |

---

## 13. Stream Filters (Decompression)

| Filter | Short Name | Status | Parser Location | Notes |
|--------|-----------|--------|-----------------|-------|
| `FlateDecode` | `Fl` | ✅ | Custom `zlibInflate` | |
| `ASCIIHexDecode` | `AHx` | ✅ | `decodeASCIIHex` L5 | |
| `ASCII85Decode` | `A85` | ✅ | `decodeASCII85` L20 | |
| `LZWDecode` | `LZW` | ✅ | `decodeLZW` L103 | |
| `RunLengthDecode` | `RL` | ✅ | `decodeRunLength` L140 | |
| `DCTDecode` | `DCT` | ✅ | Pass-through for images | Not decoded, JPEG bytes kept as-is |
| `JPXDecode` | — | ✅ | Pass-through for images | JPEG2000 bytes kept as-is |
| `CCITTFaxDecode` | `CCF` | ❌ | — | Used in fax/scanned documents |
| `JBIG2Decode` | — | ❌ | — | Used in some scanned docs |
| `Crypt` | — | ❌ | — | Encryption-related |

### Predictor Support

| Predictor | Status | Notes |
|-----------|--------|-------|
| PNG predictors (10-14) | ✅ | `applyPngPredictor` L162-202 — Sub, Up, Average, Paeth |
| TIFF predictor (2) | ❌ | Not implemented |

---

## 14. Image Handling

### 14.1 External Images (via `Do`)

| Feature | Status | Notes |
|---------|--------|-------|
| JPEG (DCTDecode) | ✅ | Pass-through as `data:image/jpeg` |
| JPEG2000 (JPXDecode) | ✅ | Pass-through as `data:image/jp2` |
| Raw pixel → PNG | ✅ | Full PNG encoder with CRC32, zlib, predictor |
| DeviceRGB images | ✅ | |
| DeviceGray images | ✅ | |
| DeviceCMYK images | ✅ | Converted to RGB |
| Indexed (palette) images | ✅ | Palette lookup + expansion |
| ICCBased images | ✅ | Resolved via component count |
| Image masks | ⚠️ | Detected but limited support |
| SMask (soft mask) | ❌ | Not applied |
| Matte | ❌ | Not applied |

### 14.2 Inline Images (via `BI`/`ID`/`EI`)

| Feature | Status | Notes |
|---------|--------|-------|
| FlateDecode inline | ✅ | Decoded and converted to PNG |
| DCTDecode inline | ❌ | **Explicitly skipped** (L2419) |
| Raw pixel inline | ✅ | Converted to PNG |

---

## 15. Page Properties

| Property | Status | Parser Location | Notes |
|----------|--------|-----------------|-------|
| `MediaBox` | ✅ | `getPageMediaBox` L2230-2236 | Falls back to US Letter |
| `CropBox` | ✅ | L2231 | Used if MediaBox absent |
| `Rotate` | ✅ | `buildRotationCtm` L2238-2253 | Handles 0°, 90°, 180°, 270° |
| `Contents` | ✅ | `extractPageContent` L2261 | Handles both single stream and array |
| `Resources` | ✅ | L2269-2278 | Font, XObject, ExtGState, ColorSpace |
| `BleedBox` | ❌ | — | Not needed |
| `TrimBox` | ❌ | — | Not needed |
| `ArtBox` | ❌ | — | Not needed |
| `UserUnit` | ❌ | — | Rare; could affect coordinate scaling |

---

## 16. Document-Level Properties

| Property | Status | Notes |
|----------|--------|-------|
| PDF Header (`%PDF-x.x`) | ✅ | Validated in `parsePdf` L3761-3769 |
| Cross-reference table (traditional) | ✅ | `parseTraditionalXRef` |
| Cross-reference stream | ✅ | `parseXRefStream` |
| Trailer dictionary | ✅ | `parseTrailerDict` |
| Previous xref (`/Prev`) | ✅ | Follows chain for incremental updates |
| Catalog (`/Root`) | ✅ | `getRoot()` L843 |
| Page tree (`/Pages`) | ✅ | `getPages()` L850 |
| Encryption (`/Encrypt`) | ✅ | Detected, throws error |
| **StructTreeRoot** | ❌ **Missing** | Not read from catalog — no tagged PDF support |
| **MarkInfo** | ❌ **Missing** | Not read — indicates if PDF is tagged |
| Metadata | ❌ | Not extracted (title, author, etc.) |
| Outlines (bookmarks) | ❌ | Not relevant for text extraction |
| Names / Dests | ❌ | Not relevant for text extraction |

---

## 17. HTML Output Features

### 17.1 Semantic Elements

| Feature | Detection Method | Status | Notes |
|---------|-----------------|--------|-------|
| Headings (h1-h6) | Font size ratio to body | ✅ | `getHeadingLevel` L3037-3044 |
| Paragraphs | Line spacing heuristic | ✅ | `isParagraphBreak` in `textItemsToHtml` |
| Bullet lists | Unicode bullet char patterns | ✅ | `BULLET_PATTERN` L3208 |
| Numbered lists | `\d{1,3}[.)]` pattern | ✅ | `NUMBERED_PATTERN` L3209 |
| Tables (grid) | Path rectangle clustering | ✅ | `detectTableGrids` L3497 |
| Border boxes | Large stroked rectangles | ✅ | `detectBorderBoxes` L3511 |
| Two-column layout | Large gap detection | ✅ | `lineToTableRowHtml` L3075 |
| Multi-column | Column gap analysis | ✅ | `detectColumns` L3177 |

### 17.2 Inline Formatting

| Feature | Status | Notes |
|---------|--------|-------|
| Text color | ✅ | `<span style="color:">` for non-black text |
| Underline | ✅ | Via thin horizontal line detection → `<u>` |
| **Bold** | ⚠️ | **Only in table cells, by size heuristic** (L3579). Font name "Bold" not used anywhere. |
| **Italic** | ❌ | **Not detected or output at all** |
| **Font family** | ❌ | Tracked internally but **never output** to HTML |
| **Text opacity** | ❌ | `fillOpacity` tracked but not output |
| **Superscript** | ❌ | `textRise` not applied to position |
| **Subscript** | ❌ | Same |
| **Strikethrough** | ❌ | Would need mid-height line detection |
| **Letter spacing** | ❌ | Used for position calc only |
| **Background color** | ❌ | No detection of filled rects behind text |
| **Text alignment** | ❌ | Position data available but not analyzed |

### 17.3 Text Direction

| Feature | Status | Notes |
|---------|--------|-------|
| RTL detection | ✅ | `isRTLChar` checks Hebrew, Arabic, Persian, Syriac, Thaana |
| RTL line ordering | ✅ | `isLineRTL` with 30% threshold |
| `dir="rtl"` attribute | ✅ | Applied to `<p>`, `<td>`, `<ul>`/`<ol>`, `<div>`, headings |
| Bracket mirroring | ✅ | `mirrorBracket` + `fixVisualOrderRTL` |
| BiDi mixed text | ✅ | RTL chars reverse-ordered within LTR context |

---

## 18. Internal Data Structures

### GraphicsState (L1100-1119)

```typescript
interface GraphicsState {
  ctm: number[];              // Current transformation matrix [a,b,c,d,e,f]
  fontSize: number;           // From Tf operator
  fontName: string;           // Font resource name
  fillColor: string;          // Hex color (#RRGGBB)
  strokeColor: string;        // Hex color
  lineWidth: number;          // From w operator
  textMatrix: number[];       // From Tm, Td, TD, T*
  lineMatrix: number[];       // Line start position
  leading: number;            // From TL, TD operators
  charSpacing: number;        // From Tc
  wordSpacing: number;        // From Tw
  textRise: number;           // From Ts — ⚠️ NOT APPLIED
  horizontalScaling: number;  // From Tz (percentage)
  textRenderMode: number;     // From Tr
  fillColorSpace: string;     // From cs
  strokeColorSpace: string;   // From CS
  strokeOpacity: number;      // From ExtGState CA — ⚠️ NOT APPLIED
  fillOpacity: number;        // From ExtGState ca — ⚠️ NOT APPLIED
}
```

### TextItem (L220-228)

```typescript
interface TextItem {
  text: string;       // Decoded Unicode content
  fontSize: number;   // Effective font size (pts, 2 decimal)
  x: number;          // Start X position (2 decimal)
  y: number;          // Y position (2 decimal)
  endX: number;       // End X position (2 decimal)
  page: number;       // Zero-indexed page number
  color: string;      // Fill color hex
  // MISSING: bold, italic, fontFamily, textRise, opacity
}
```

### FontInfo (L230-235)

```typescript
interface FontInfo {
  isTwoByte: boolean;            // Type0 composite font
  widths: Map<number, number>;   // Char code → width
  defaultWidth: number;          // Fallback width
  toUnicode: Map<number, string>; // Char code → Unicode
  // MISSING: isBold, isItalic, familyName
}
```

---

## 19. Known Edge Cases & Limitations

1. **Encrypted PDFs** — Detected and rejected (L3780-3782, L3891-3893)
2. **Linearized PDFs** — Not specifically optimized for (works but reads full file)
3. **Object streams** — Supported via `compressedObjects` map
4. **Incremental updates** — Supported via xref `/Prev` chain
5. **Form XObject recursion** — Capped at depth 10 (L1695)
6. **Character-by-character PDFs** — Special merging logic with gap detection (L2855-2979)
7. **Overlapping text duplicates** — Deduplication via coordinate matching (L2741-2812)
8. **Empty/corrupt pages** — Caught with try/catch, skipped (L3793-3801)
9. **Missing fonts** — Falls back to 600 default width
10. **Page rotation** — Handled for 0°, 90°, 180°, 270° (L2238-2253)
