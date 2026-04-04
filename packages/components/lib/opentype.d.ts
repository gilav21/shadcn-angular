declare module 'opentype.js' {
    export class Font {
        readonly unitsPerEm: number;
        readonly ascender: number;
        readonly descender: number;
        readonly numGlyphs: number;
        readonly glyphs: GlyphSet;
        charToGlyph(char: string): Glyph;
        download(): unknown;
        toArrayBuffer?(): ArrayBuffer;
    }
    export class Glyph {
        readonly name: string;
        readonly unicode: number;
        readonly index: number;
        readonly advanceWidth: number;
        readonly path: Path;
        constructor(options: {
            name: string;
            unicode: number;
            advanceWidth: number;
            path: Path;
        });
    }
    export class Path {
        readonly commands: ReadonlyArray<PathCommand>;
        moveTo(x: number, y: number): void;
        lineTo(x: number, y: number): void;
        quadraticCurveTo(x1: number, y1: number, x: number, y: number): void;
        curveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void;
        closePath(): void;
    }
    export interface PathCommand {
        type: string;
        x?: number;
        y?: number;
        x1?: number;
        y1?: number;
        x2?: number;
        y2?: number;
    }
    export interface GlyphSet {
        get(index: number): Glyph;
    }
    export function parse(buffer: ArrayBuffer): Font;
}
