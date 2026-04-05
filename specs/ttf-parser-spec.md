# Replace opentype.js with custom TrueType reader + writer

## Goal

Remove the 500KB opentype.js dependency by implementing our own TrueType parser and font builder. This fixes the Angular build error and gives us control over the full code.

## Phase 1: TrueType Reader (~150 lines)

Replaces `opentype.parse()` + all read-only API calls. Handles 99% of PDFs.

### Phase 1 Tasks

- [ ] **1.1** Create `packages/components/lib/ttf-parser.ts` with the core parser
  - Parse TTF/OTF file header (offset table: sfVersion, numTables)
  - Parse table directory (tag, offset, length for each table)
  - Utility: `getTable(tag)` → returns DataView of table data

- [ ] **1.2** Parse `head` table → extract `unitsPerEm`

- [ ] **1.3** Parse `hhea` table → extract `ascender`, `descender`, `numberOfHMetrics`

- [ ] **1.4** Parse `maxp` table → extract `numGlyphs`

- [ ] **1.5** Parse `hmtx` table → build `advanceWidths: Map<number, number>` (GID → width)
  - First `numberOfHMetrics` entries have advanceWidth + leftSideBearing
  - Remaining glyphs reuse the last advanceWidth

- [ ] **1.6** Parse `cmap` table → build `unicodeToGid: Map<number, number>`
  - Support Format 4 (BMP, most common)
  - Support Format 12 (full Unicode, for CJK/emoji fonts)
  - Pick the best Unicode platform subtable (platformID 3/1 or 0/3)

- [ ] **1.7** Create `TtfFont` class with the API we need:

  ```typescript
  class TtfFont {
    readonly unitsPerEm: number;
    readonly ascender: number;
    readonly descender: number;
    readonly numGlyphs: number;
    getAdvanceWidth(gid: number): number;
    charToGlyphIndex(codepoint: number): number; // returns GID
  }
  ```

- [ ] **1.8** Replace `opentype.parse()` calls in `pdf-pixel-perfect.ts` with `new TtfFont(buffer)`
  - `processEmbeddedFont` → use TtfFont for glyph widths
  - `fontNeedsReencoding` → use TtfFont for coverage check
  - Bracket glyph fixup → use TtfFont for glyph index comparison

- [ ] **1.9** Remove `opentype.js` import and all opentype type references
  - Remove fallback font loading (NotoSans) — not needed with system fonts
  - Remove `getFallbackFont()`, `setFallbackFontData()`
  - Update `test-pixel-perfect.ts` to remove fallback font setup

- [ ] **1.10** Verify: Angular build passes, all 3 test PDFs render correctly

## Phase 2: Custom TTF Writer for Re-encoding (~300 lines)

Replaces `new opentype.Font()` + `toArrayBuffer()`. Needed for Symbol/custom fonts.

### Phase 2 Tasks

- [ ] **2.1** Add glyph outline parser to `TtfFont`
  - Parse `loca` table (short or long format) → glyph offsets
  - Parse `glyf` table → extract raw glyph data per GID (as byte slices, NOT parsed paths)
  - Store as `getRawGlyph(gid): Uint8Array | null`

- [ ] **2.2** Create `ttf-builder.ts` with `buildTtf()` function
  - Input: array of `{ unicode: number; advanceWidth: number; glyphData: Uint8Array }`
  - Plus font metrics: familyName, unitsPerEm, ascender, descender
  - Output: `Uint8Array` (complete TTF binary)

- [ ] **2.3** Build required tables:
  - `head` — font header (unitsPerEm, dates, flags)
  - `hhea` — horizontal header (ascender, descender, numberOfHMetrics)
  - `hmtx` — horizontal metrics (advanceWidth per glyph)
  - `maxp` — version 1.0, numGlyphs
  - `cmap` — Format 4 subtable mapping Unicode → GID
  - `loca` — glyph offsets (short format for small fonts)
  - `glyf` — raw glyph data (copied from source, scaled if needed)
  - `name` — font name records (familyName, styleName)
  - `OS/2` — minimal OS/2 table for browser compatibility
  - `post` — version 3.0 (no glyph names, smallest)

- [ ] **2.4** Table assembly and checksums
  - Compute per-table checksums (uint32 sum of padded data)
  - Build offset table + table directory
  - Compute head.checksumAdjust (0xB1B0AFBA - wholeFileChecksum)

- [ ] **2.5** Update `reEncodeFont()` to use custom builder
  - Replace `new opentype.Glyph/Font/Path` with raw glyph data copying
  - Use `TtfFont.getRawGlyph(gid)` to get source glyph bytes
  - Scale advance widths as before (no need to scale paths — copy raw bytes)
  - Call `buildTtf()` instead of `opentype.Font.toArrayBuffer()`

- [ ] **2.6** Handle glyph path scaling (for width adjustments)
  - When PDF /Widths differ from font widths, the glyph needs horizontal scaling
  - Parse TrueType glyph outlines (`glyf` simple/compound format)
  - Scale x-coordinates in the raw glyph data
  - This is the most complex part — ~100 lines for simple glyphs

- [ ] **2.7** Remove opentype.js from package.json dependencies

- [ ] **2.8** Verify: Angular build passes, all 3 PDFs render correctly, Symbol fonts render correctly

## Key simplification vs opentype.js

opentype.js parses EVERYTHING (kerning, GSUB, GPOS, CFF, etc.). We want our implementation to cover the full spectrum too — a complete TrueType/OpenType reader and writer that handles all table types, so we never hit a font we can't process.

**Critical insight for Phase 2:** We DON'T need to parse glyph outlines into path commands. We can copy raw `glyf` table bytes directly from the source font to the output font, only modifying the `cmap` table to remap Unicode points. This dramatically simplifies the writer.

## Current opentype.js API usage reference

### Read APIs (Phase 1 replaces these)

| API                                      | Purpose              | Used in                                                      |
| ---------------------------------------- | -------------------- | ------------------------------------------------------------ |
| `opentype.parse(buffer)`                 | Parse font binary    | `processEmbeddedFont`, `getFallbackFont`                     |
| `font.unitsPerEm`                        | Design units per em  | `processEmbeddedFont`, `reEncodeFont`                        |
| `font.numGlyphs`                         | Total glyphs         | `processEmbeddedFont`                                        |
| `font.ascender/descender`                | Vertical metrics     | `reEncodeFont`                                               |
| `font.glyphs.get(gid)`                   | Glyph by GID         | `processEmbeddedFont`, `reEncodeFont`                        |
| `font.charToGlyph(char)`                 | Glyph by Unicode     | `fontNeedsReencoding`, bracket fixup, `reEncodeFont`         |
| `glyph.advanceWidth`                     | Glyph width          | Throughout                                                   |
| `glyph.index`                            | Glyph ID             | Coverage check, bracket fixup                                |

### Write APIs (Phase 2 replaces these)

| API                                      | Purpose              | Used in                                                      |
| ---------------------------------------- | -------------------- | ------------------------------------------------------------ |
| `new opentype.Font(...)`                 | Create font          | `reEncodeFont`                                               |
| `new opentype.Glyph(...)`                | Create glyph         | `reEncodeFont`                                               |
| `new opentype.Path()`                    | Create path          | `reEncodeFont`, `scalePathX`, `scalePath`                    |
| `path.moveTo/lineTo/curveTo/closePath`   | Build outlines       | `scalePathX`, `scalePath`                                    |
| `font.toArrayBuffer()`                   | Serialize to TTF     | `reEncodeFont`                                               |

## Files to modify

- `packages/components/lib/ttf-parser.ts` — NEW (Phase 1)
- `packages/components/lib/ttf-builder.ts` — NEW (Phase 2)
- `packages/components/lib/pdf-pixel-perfect.ts` — Replace opentype imports
- `scripts/test-pixel-perfect.ts` — Remove fallback font setup
- `package.json` — Remove opentype.js dependency (Phase 2)
