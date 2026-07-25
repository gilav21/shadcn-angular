import type {
    ImageItem,
    PathRect,
    PdfAnnotation,
    StructureMap,
    TextItem,
} from '../pdf-parser';

/** Options for {@link parsePdfReadable}. */
export interface PdfReadableOptions {
    /** Embed the PDF's fonts as `@font-face` data-URL rules (default true). */
    readonly embedFonts?: boolean;
    /** Include embedded images in the output (default true). */
    readonly includeImages?: boolean;
    /** Wrap each page in a page-width container with a page break between pages (default false). */
    readonly pageWrappers?: boolean;
    /** Prefix for generated CSS font-family names; defaults to a per-parse nonce. */
    readonly fontFamilyPrefix?: string;
}

/** Result of {@link parsePdfReadable}. */
export interface PdfReadableResult {
    /** Flowing semantic HTML using inline styles only (survives the RTE sanitizer). */
    readonly html: string;
    /** `@font-face` rules to inject into the document head; empty when fonts are not embedded. */
    readonly fontFaceCss: string;
    /** Plain-text content in reading order. */
    readonly text: string;
    /** True when the PDF has no extractable text and only images were emitted. */
    readonly imageOnly: boolean;
    readonly pageCount: number;
}

/** CSS family resolution for one PDF font resource. */
export interface FontMapping {
    /** Generated `@font-face` family name (with prefix), or '' when not embedded. */
    readonly family: string;
    /** Original PDF font family used as fallback stack entry. */
    readonly fallback: string;
    /** Whether an `@font-face` rule will exist for {@link family}. */
    readonly embedded: boolean;
}

/** Raw per-page extraction output (PDF coordinate space, bottom-up y). */
export interface PageExtract {
    readonly index: number;
    readonly width: number;
    readonly height: number;
    readonly items: TextItem[];
    readonly images: ImageItem[];
    readonly rects: PathRect[];
    readonly annotations: PdfAnnotation[];
}

export interface ExtractedDocument {
    readonly pages: PageExtract[];
    readonly structure: StructureMap;
    /** TextItem.fontName → CSS family mapping (empty when embedFonts is off). */
    readonly fonts: Map<string, FontMapping>;
}

export type BaselineShift = 'none' | 'sub' | 'sup';

/** Visual style of a run of text, used to group words into styled spans. */
export interface RunStyle {
    readonly fontName: string;
    /** Human font family from the PDF (e.g. 'Times New Roman'); '' when unknown. */
    readonly fontFamily: string;
    readonly fontSize: number;
    readonly color: string;
    readonly bold: boolean;
    readonly italic: boolean;
    readonly underline: boolean;
    readonly baselineShift: BaselineShift;
    /** PDF character spacing in pt (0 = normal); emitted as letter-spacing. */
    readonly letterSpacing: number;
    /** Link target URI, '' when the run is not a link. */
    readonly link: string;
}

/** A word: maximal run of glyph fragments with uniform style, no internal large gaps. */
export interface Word {
    text: string;
    readonly x: number;
    endX: number;
    /** Baseline y in PDF coordinates (bottom-up). */
    readonly y: number;
    readonly fontSize: number;
    /** Mutable: underline detection rewrites the style after path analysis. */
    style: RunStyle;
    readonly mcid: number;
    /** Whether a word gap precedes this word on its line (in logical order source). */
    spaceBefore: boolean;
    /** True when a column-sized gap precedes this word visually — a segment boundary. */
    readonly hardBreak: boolean;
}

export type TextDirection = 'ltr' | 'rtl';

/** A visual text line; words are stored in logical (reading) order. */
export interface Line {
    readonly words: Word[];
    readonly x: number;
    readonly endX: number;
    /** Baseline y in PDF coordinates. */
    readonly y: number;
    readonly fontSize: number;
    readonly dir: TextDirection;
    readonly page: number;
}

export type BlockAlign = '' | 'left' | 'right' | 'center' | 'justify';

export type HeadingLevel = 1 | 2 | 3 | 4;

export interface BlockStyle {
    align: BlockAlign;
    /** Horizontal offset of the whole block from the page's content start, in pt. */
    indentStart: number;
    /** First-line indent in pt (0 = none). */
    textIndent: number;
    /** Unitless line-height ratio (0 = unset). */
    lineHeight: number;
    /** Vertical spacing to the previous block in pt. */
    marginTop: number;
    dir: TextDirection | '';
    /** Background colour reconstructed from a filled rect behind the block; '' when none. */
    background: string;
    /** CSS border reconstructed from a stroked box (e.g. a button outline) the
     *  block sits inside; '' when none. Renders the block as a bordered,
     *  shrink-wrapped inline box. */
    border: string;
}

export interface ParagraphBlock {
    readonly kind: 'paragraph';
    readonly lines: Line[];
    readonly page: number;
    readonly style: BlockStyle;
}

export interface HeadingBlock {
    readonly kind: 'heading';
    /** Mutable: a document-wide post-pass re-ranks levels by size/bold signature. */
    level: HeadingLevel;
    readonly lines: Line[];
    readonly page: number;
    readonly style: BlockStyle;
}

export interface ListItemModel {
    /** Nesting level, 0-based. */
    readonly level: number;
    readonly lines: Line[];
}

export interface ListBlock {
    readonly kind: 'list';
    readonly ordered: boolean;
    readonly items: ListItemModel[];
    readonly page: number;
    readonly style: BlockStyle;
}

export interface BlockquoteBlock {
    readonly kind: 'blockquote';
    readonly lines: Line[];
    readonly page: number;
    readonly style: BlockStyle;
}

export interface TableCellModel {
    readonly lines: Line[];
    /** Background reconstructed from a saturated fill behind the cell (e.g. a
     *  highlighted total); '' or absent when none. Keeps light-on-color text
     *  (invisible on the white reading surface) readable. */
    background?: string;
}

export interface TableBlock {
    readonly kind: 'table';
    readonly rows: TableCellModel[][];
    readonly ruled: boolean;
    readonly headerRow: boolean;
    readonly page: number;
    readonly style: BlockStyle;
}

export interface ImageBlock {
    readonly kind: 'image';
    readonly image: ImageItem;
    readonly float: '' | 'left' | 'right';
    readonly page: number;
    readonly style: BlockStyle;
}

export interface RuleBlock {
    readonly kind: 'rule';
    readonly page: number;
    readonly style: BlockStyle;
    /** Vertical position (PDF coords) used to order the rule among blocks. */
    readonly top: number;
}

/** One column of a {@link ColumnsBlock}: its blocks and its share of the row width. */
export interface ColumnGroup {
    readonly blocks: DocBlock[];
    /** Fraction (0-1) of the row width, from the detected column geometry. */
    readonly widthRatio: number;
}

/**
 * Adjacent regions the layout analysis found side by side in one vertical band
 * (a two-column CV header, a receipt's left/right columns). Rendered as one
 * borderless table row so the columns sit next to each other instead of
 * stacking. Detection-driven only — never synthesized where no column gutter
 * was found.
 */
export interface ColumnsBlock {
    readonly kind: 'columns';
    readonly columns: ColumnGroup[];
    readonly page: number;
    readonly style: BlockStyle;
}

export type DocBlock =
    | ParagraphBlock
    | HeadingBlock
    | ListBlock
    | BlockquoteBlock
    | TableBlock
    | ImageBlock
    | RuleBlock
    | ColumnsBlock;

export interface PageModel {
    readonly index: number;
    readonly width: number;
    readonly height: number;
    readonly blocks: DocBlock[];
}

export interface DocModel {
    readonly pages: PageModel[];
    /** Modal body font size in pt (char-count weighted). */
    readonly bodyFontSize: number;
}
