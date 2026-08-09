import { describe, expect, it } from 'vitest';
import { parsePptx } from './pptx-parser';
import type {
    PptxConnectorElement,
    PptxImageElement,
    PptxShapeElement,
    PptxTableElement,
    PptxTextFrame,
} from './pptx-parser';

// ---------------------------------------------------------------------------
// Minimal STORED (uncompressed) ZIP builder — matches what zip-reader expects:
// a local-file-header + data section, then a central directory, then EOCD.
// CRC32 must be correct (zip-reader validates it).
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c;
    }
    return table;
})();

function crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of data) {
        crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number): number[] {
    return [n & 0xff, (n >>> 8) & 0xff];
}

function u32(n: number): number[] {
    return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

interface ZipFile {
    readonly path: string;
    readonly data: Uint8Array;
}

function buildZip(files: ReadonlyArray<{ path: string; content: string | Uint8Array }>): Uint8Array {
    const enc = new TextEncoder();
    const normalized: ZipFile[] = files.map(f => ({
        path: f.path,
        data: typeof f.content === 'string' ? enc.encode(f.content) : f.content,
    }));

    const localChunks: number[] = [];
    const centralChunks: number[] = [];
    const offsets: number[] = [];

    for (const file of normalized) {
        const nameBytes = enc.encode(file.path);
        const crc = crc32(file.data);
        const offset = localChunks.length;
        offsets.push(offset);

        // Local file header
        localChunks.push(...u32(0x04034b50));
        localChunks.push(...u16(20)); // version needed
        localChunks.push(...u16(0)); // flags
        localChunks.push(...u16(0)); // method 0 = stored
        localChunks.push(...u16(0)); // mod time
        localChunks.push(...u16(0)); // mod date
        localChunks.push(...u32(crc));
        localChunks.push(...u32(file.data.length)); // compressed size
        localChunks.push(...u32(file.data.length)); // uncompressed size
        localChunks.push(...u16(nameBytes.length));
        localChunks.push(...u16(0)); // extra len
        localChunks.push(...nameBytes);
        localChunks.push(...file.data);
    }

    const centralStart = localChunks.length;
    for (let i = 0; i < normalized.length; i++) {
        const file = normalized[i];
        const nameBytes = enc.encode(file.path);
        const crc = crc32(file.data);

        centralChunks.push(...u32(0x02014b50));
        centralChunks.push(...u16(20)); // version made by
        centralChunks.push(...u16(20)); // version needed
        centralChunks.push(...u16(0)); // flags
        centralChunks.push(...u16(0)); // method
        centralChunks.push(...u16(0)); // mod time
        centralChunks.push(...u16(0)); // mod date
        centralChunks.push(...u32(crc));
        centralChunks.push(...u32(file.data.length));
        centralChunks.push(...u32(file.data.length));
        centralChunks.push(...u16(nameBytes.length));
        centralChunks.push(...u16(0)); // extra len
        centralChunks.push(...u16(0)); // comment len
        centralChunks.push(...u16(0)); // disk number
        centralChunks.push(...u16(0)); // internal attrs
        centralChunks.push(...u32(0)); // external attrs
        centralChunks.push(...u32(offsets[i]));
        centralChunks.push(...nameBytes);
    }

    const centralSize = centralChunks.length;
    const eocd: number[] = [];
    eocd.push(...u32(0x06054b50));
    eocd.push(...u16(0)); // disk
    eocd.push(...u16(0)); // disk with central dir
    eocd.push(...u16(normalized.length));
    eocd.push(...u16(normalized.length));
    eocd.push(...u32(centralSize));
    eocd.push(...u32(centralStart));
    eocd.push(...u16(0)); // comment len

    return new Uint8Array([...localChunks, ...centralChunks, ...eocd]);
}

// A tiny valid 1x1 PNG (correct magic bytes so isValidImageMagicBytes passes).
const PNG_BYTES = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89,
]);

// ---------------------------------------------------------------------------
// XML fixture fragments
// ---------------------------------------------------------------------------

const CONTENT_TYPES = `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>`;

function presentationXml(slideIds: ReadonlyArray<{ id: number; rId: string }>, cx = 9144000, cy = 6858000): string {
    const ids = slideIds.map(s => `<p:sldId id="${s.id}" r:id="${s.rId}"/>`).join('');
    return `<?xml version="1.0"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>${ids}</p:sldIdLst>
  <p:sldSz cx="${cx}" cy="${cy}"/>
</p:presentation>`;
}

function presentationRels(rels: ReadonlyArray<{ id: string; target: string }>): string {
    const items = rels.map(r =>
        `<Relationship Id="${r.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="${r.target}"/>`,
    ).join('');
    return `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items}</Relationships>`;
}

const THEME_XML = `<?xml version="1.0"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:themeElements>
    <a:clrScheme name="Office">
      <a:dk1><a:srgbClr val="000000"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="44546A"/></a:dk2>
      <a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
      <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
      <a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
      <a:accent3><a:srgbClr val="A5A5A5"/></a:accent3>
      <a:accent4><a:srgbClr val="FFC000"/></a:accent4>
      <a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>
      <a:accent6><a:srgbClr val="70AD47"/></a:accent6>
      <a:hlink><a:srgbClr val="0563C1"/></a:hlink>
      <a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
    </a:clrScheme>
  </a:themeElements>
</a:theme>`;

const NS_DECL =
    `xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" ` +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`;

function slideXml(body: string): string {
    return `<?xml version="1.0"?>
<p:sld ${NS_DECL}>
  <p:cSld>
    <p:spTree>
      ${body}
    </p:spTree>
  </p:cSld>
</p:sld>`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function buildSinglePptx(
    slideBody: string,
    extraFiles: ReadonlyArray<{ path: string; content: string | Uint8Array }> = [],
): Uint8Array {
    return buildZip([
        { path: 'ppt/presentation.xml', content: presentationXml([{ id: 256, rId: 'rId1' }]) },
        { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels([{ id: 'rId1', target: 'slides/slide1.xml' }]) },
        { path: 'ppt/theme/theme1.xml', content: THEME_XML },
        { path: 'ppt/slides/slide1.xml', content: slideXml(slideBody) },
        ...extraFiles,
    ]);
}

function firstTextFrame(zip: Uint8Array): PptxTextFrame {
    const result = parsePptx(zip);
    return result.slides[0].elements.find(e => e.type === 'text') as PptxTextFrame;
}

function firstShape(zip: Uint8Array): PptxShapeElement {
    const result = parsePptx(zip);
    return result.slides[0].elements.find(e => e.type === 'shape') as PptxShapeElement;
}

function styledRunSlide(rPrInner: string): string {
    return `
      <p:sp>
        <p:nvSpPr><p:cNvPr id="50" name="r"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/>
          <a:p><a:r><a:rPr>${rPrInner}</a:rPr><a:t>Run</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>`;
}

function shapeSlide(spPrInner: string): string {
    return `
      <p:sp>
        <p:nvSpPr><p:cNvPr id="51" name="s"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="952500"/></a:xfrm>
          <a:prstGeom prst="rect"/>
          ${spPrInner}
        </p:spPr>
      </p:sp>`;
}

describe('parsePptx — color modifiers', () => {
    it('applies lumMod, lumOff and emits a darkened/lightened color', () => {
        const tf = firstTextFrame(buildSinglePptx(styledRunSlide(
            `<a:solidFill><a:srgbClr val="808080"><a:lumMod val="50000"/><a:lumOff val="10000"/></a:srgbClr></a:solidFill>`,
        )));
        const color = tf.paragraphs[0].runs[0].color!;
        expect(color).toMatch(/^#[0-9a-f]{6}$/);
        // lumMod halves lightness then lumOff adds — distinct from base #808080
        expect(color).not.toBe('#808080');
    });

    it('applies tint and shade modifiers', () => {
        const tinted = firstTextFrame(buildSinglePptx(styledRunSlide(
            `<a:solidFill><a:srgbClr val="000000"><a:tint val="50000"/></a:srgbClr></a:solidFill>`,
        ))).paragraphs[0].runs[0].color!;
        // tint lightens black towards gray
        expect(tinted).not.toBe('#000000');

        const shaded = firstTextFrame(buildSinglePptx(styledRunSlide(
            `<a:solidFill><a:srgbClr val="ffffff"><a:shade val="50000"/></a:srgbClr></a:solidFill>`,
        ))).paragraphs[0].runs[0].color!;
        // shade darkens white → #808080-ish
        expect(shaded).toBe('#808080');
    });

    it('returns transparent when alpha is 0', () => {
        const tf = firstTextFrame(buildSinglePptx(styledRunSlide(
            `<a:solidFill><a:srgbClr val="FF0000"><a:alpha val="0"/></a:srgbClr></a:solidFill>`,
        )));
        expect(tf.paragraphs[0].runs[0].color).toBe('transparent');
    });

    it('emits rgba when alpha is partial', () => {
        const tf = firstTextFrame(buildSinglePptx(styledRunSlide(
            `<a:solidFill><a:srgbClr val="FF0000"><a:alpha val="50000"/></a:srgbClr></a:solidFill>`,
        )));
        expect(tf.paragraphs[0].runs[0].color).toMatch(/^rgba\(\d+,\d+,\d+,0\.5\)$/);
    });
});

describe('parsePptx — run effects, outline & underline', () => {
    it('parses an outer shadow effect on a run', () => {
        const tf = firstTextFrame(buildSinglePptx(styledRunSlide(
            `<a:effectLst><a:outerShdw blurRad="50800" dist="38100" dir="2700000"><a:srgbClr val="000000"><a:alpha val="40000"/></a:srgbClr></a:outerShdw></a:effectLst>`,
        )));
        const eff = tf.paragraphs[0].runs[0].effects!;
        expect(eff.outerShadow).toBeDefined();
        expect(eff.outerShadow!.blur).toBeCloseTo(50800 / 12700, 5);
        expect(eff.outerShadow!.color).toMatch(/^rgba\(/);
    });

    it('parses glow, blur, soft-edge and reflection effects', () => {
        const tf = firstTextFrame(buildSinglePptx(styledRunSlide(
            `<a:effectLst>
               <a:glow rad="63500"><a:srgbClr val="FFFF00"/></a:glow>
               <a:blur rad="25400"/>
               <a:softEdge rad="12700"/>
               <a:reflection blurRad="6350" stA="60000" endA="0" dist="5080" dir="5400000" sy="-100000"/>
             </a:effectLst>`,
        )));
        const eff = tf.paragraphs[0].runs[0].effects!;
        expect(eff.glow!.radius).toBeCloseTo(63500 / 12700, 5);
        expect(eff.blur).toBeCloseTo(25400 / 12700, 5);
        expect(eff.softEdge).toBeCloseTo(1, 5);
        expect(eff.reflection!.startOpacity).toBeCloseTo(0.6, 5);
        expect(eff.reflection!.scaleY).toBeCloseTo(-1, 5);
    });

    it('parses an inner shadow via effectDag', () => {
        const tf = firstTextFrame(buildSinglePptx(styledRunSlide(
            `<a:effectDag><a:innerShdw blurRad="25400" dist="12700" dir="0"><a:srgbClr val="333333"/></a:innerShdw></a:effectDag>`,
        )));
        expect(tf.paragraphs[0].runs[0].effects!.innerShadow).toBeDefined();
    });

    it('parses text outline (ln) and underline line (uLn)', () => {
        const tf = firstTextFrame(buildSinglePptx(styledRunSlide(
            `<a:ln w="12700"><a:solidFill><a:srgbClr val="112233"/></a:solidFill><a:prstDash val="dash"/></a:ln>
             <a:uLn w="6350" cmpd="dbl"><a:solidFill><a:srgbClr val="445566"/></a:solidFill><a:prstDash val="dot"/></a:uLn>`,
        )));
        const run = tf.paragraphs[0].runs[0];
        expect(run.textOutline!.width).toBeCloseTo(1, 5);
        expect(run.textOutline!.color).toBe('#112233');
        expect(run.textOutline!.dashStyle).toBe('dash');
        expect(run.underlineStyle!.width).toBeCloseTo(0.5, 5);
        expect(run.underlineStyle!.compound).toBe('dbl');
        expect(run.underlineStyle!.dashStyle).toBe('dot');
    });

    it('parses run attributes: baseline, cap, spc, highlight, hyperlink, tooltip, sym', () => {
        const body = `
          <p:sp>
            <p:nvSpPr><p:cNvPr id="52" name="r"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
            <p:txBody><a:bodyPr/>
              <a:p><a:r>
                <a:rPr baseline="30000" cap="all" spc="200">
                  <a:solidFill><a:srgbClr val="000000"/></a:solidFill>
                  <a:highlight><a:srgbClr val="FFFF00"/></a:highlight>
                  <a:sym typeface="Wingdings"/>
                  <a:hlinkClick/>
                  <a:hlinkMouseOver tooltip="Hover me"/>
                </a:rPr>
                <a:t>Link</a:t>
              </a:r></a:p>
            </p:txBody>
          </p:sp>`;
        const run = firstTextFrame(buildSinglePptx(body)).paragraphs[0].runs[0];
        expect(run.baseline).toBe(30000);
        expect(run.cap).toBe('all');
        expect(run.spc).toBe(2);
        expect(run.highlight).toBe('#ffff00');
        expect(run.isHyperlink).toBe(true);
        expect(run.hoverTooltip).toBe('Hover me');
        expect(run.symFont).toBe('Wingdings');
    });

    it('parses noFill, gradient fill and pattern fill on runs', () => {
        const noFill = firstTextFrame(buildSinglePptx(styledRunSlide(`<a:noFill/>`)))
            .paragraphs[0].runs[0];
        expect(noFill.noFill).toBe(true);

        const grad = firstTextFrame(buildSinglePptx(styledRunSlide(
            `<a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="FF0000"/></a:gs><a:gs pos="100000"><a:srgbClr val="00FF00"/></a:gs></a:gsLst><a:path path="circle"/></a:gradFill>`,
        ))).paragraphs[0].runs[0];
        expect(grad.gradientFill!.type).toBe('radial');

        const patt = firstTextFrame(buildSinglePptx(styledRunSlide(
            `<a:pattFill prst="cross"><a:fgClr><a:srgbClr val="000000"/></a:fgClr><a:bgClr><a:srgbClr val="FFFFFF"/></a:bgClr></a:pattFill>`,
        ))).paragraphs[0].runs[0];
        expect(patt.patternFill!.preset).toBe('cross');
        expect(patt.patternFill!.fgColor).toBe('#000000');
    });
});

describe('parsePptx — paragraph spacing & tabs', () => {
    it('parses spacing before/after in points and line spacing percent', () => {
        const body = `
          <p:sp>
            <p:nvSpPr><p:cNvPr id="53" name="p"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
            <p:txBody><a:bodyPr/>
              <a:p>
                <a:pPr defTabSz="914400" fontAlgn="ctr">
                  <a:lnSpc><a:spcPct val="150000"/></a:lnSpc>
                  <a:spcBef><a:spcPts val="1200"/></a:spcBef>
                  <a:spcAft><a:spcPts val="600"/></a:spcAft>
                  <a:tabLst><a:tab pos="457200" algn="ctr"/></a:tabLst>
                </a:pPr>
                <a:r><a:t>Spaced</a:t></a:r>
              </a:p>
            </p:txBody>
          </p:sp>`;
        const para = firstTextFrame(buildSinglePptx(body)).paragraphs[0];
        expect(para.spacingBefore).toBeCloseTo(12, 5);
        expect(para.spacingAfter).toBeCloseTo(6, 5);
        expect(para.lineSpacing).toBeCloseTo(1.5, 5);
        expect(para.fontAlign).toBe('ctr');
        expect(para.defaultTabSize).toBe(Math.round(914400 / 9525));
        expect(para.tabs).toHaveLength(1);
        expect(para.tabs![0].alignment).toBe('ctr');
        expect(para.tabs![0].position).toBeCloseTo(457200 / 9525, 5);
    });

    it('parses line spacing in points', () => {
        const body = `
          <p:sp>
            <p:nvSpPr><p:cNvPr id="54" name="p"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
            <p:txBody><a:bodyPr/>
              <a:p><a:pPr><a:lnSpc><a:spcPts val="2400"/></a:lnSpc></a:pPr><a:r><a:t>L</a:t></a:r></a:p>
            </p:txBody>
          </p:sp>`;
        const para = firstTextFrame(buildSinglePptx(body)).paragraphs[0];
        // 2400/100/12 = 2
        expect(para.lineSpacing).toBeCloseTo(2, 5);
    });
});

describe('parsePptx — shape fills, line styles, effects', () => {
    it('parses pattern fill, dash style and shadow on a shape', () => {
        const shape = firstShape(buildSinglePptx(shapeSlide(
            `<a:pattFill prst="dkUpDiag"><a:fgClr><a:srgbClr val="111111"/></a:fgClr><a:bgClr><a:srgbClr val="eeeeee"/></a:bgClr></a:pattFill>
             <a:ln w="38100"><a:solidFill><a:srgbClr val="abcabc"/></a:solidFill><a:prstDash val="sysDash"/></a:ln>
             <a:effectLst><a:outerShdw blurRad="25400"><a:srgbClr val="000000"/></a:outerShdw></a:effectLst>`,
        )));
        expect(shape.patternFill!.preset).toBe('dkUpDiag');
        expect(shape.borderWidth).toBe(Math.round(38100 / 12700));
        expect(shape.borderColor).toBe('#abcabc');
        expect(shape.dashStyle).toBe('sysDash');
        expect(shape.effects!.outerShadow).toBeDefined();
    });

    it('parses an image fill on a shape via media relationships', () => {
        const slideRels = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rIdF" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/fill.png"/>
        </Relationships>`;
        const shape = firstShape(buildSinglePptx(shapeSlide(
            `<a:blipFill><a:blip r:embed="rIdF"/></a:blipFill>`,
        ), [
            { path: 'ppt/slides/_rels/slide1.xml.rels', content: slideRels },
            { path: 'ppt/media/fill.png', content: PNG_BYTES },
        ]));
        expect(shape.imageFill!.startsWith('data:image/png;base64,')).toBe(true);
    });

    it('returns null shape (no element) when shape has explicit noFill and no line', () => {
        const result = parsePptx(buildSinglePptx(shapeSlide(`<a:noFill/>`)));
        const shape = result.slides[0].elements.find(e => e.type === 'shape');
        expect(shape).toBeUndefined();
    });

    it('uses style fillRef/lnRef references when spPr has no explicit fill', () => {
        const body = `
          <p:sp>
            <p:nvSpPr><p:cNvPr id="55" name="s"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr>
              <a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm>
              <a:prstGeom prst="roundRect"/>
            </p:spPr>
            <p:style>
              <a:lnRef idx="2"><a:schemeClr val="accent1"/></a:lnRef>
              <a:fillRef idx="1"><a:schemeClr val="accent2"/></a:fillRef>
            </p:style>
          </p:sp>`;
        const shape = firstShape(buildSinglePptx(body));
        expect(shape.shapeType).toBe('roundRect');
        // No explicit fill in spPr → implicit noFill blocks the style fillRef,
        // but the lnRef border still applies (idx=2 → borderWidth 2).
        expect(shape.fillColor).toBeUndefined();
        expect(shape.borderColor).toBe('#4472c4');
        expect(shape.borderWidth).toBe(2);
    });
});

describe('parsePptx — slide size & structure', () => {
    it('parses slide dimensions from sldSz (EMU → px) and slide count', () => {
        const slide = slideXml(`
          <p:sp>
            <p:nvSpPr><p:cNvPr id="1" name="t"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1905000" cy="952500"/></a:xfrm></p:spPr>
            <p:txBody><a:bodyPr/><a:p><a:r><a:t>Hello</a:t></a:r></a:p></p:txBody>
          </p:sp>`);

        const zip = buildZip([
            { path: '[Content_Types].xml', content: CONTENT_TYPES },
            { path: 'ppt/presentation.xml', content: presentationXml([{ id: 256, rId: 'rId1' }]) },
            { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels([{ id: 'rId1', target: 'slides/slide1.xml' }]) },
            { path: 'ppt/theme/theme1.xml', content: THEME_XML },
            { path: 'ppt/slides/slide1.xml', content: slide },
        ]);

        const result = parsePptx(zip);
        // 9144000 / 9525 = 960, 6858000 / 9525 = 720
        expect(result.slideWidth).toBe(960);
        expect(result.slideHeight).toBe(720);
        expect(result.slides).toHaveLength(1);
        expect(result.slides[0].index).toBe(0);
        expect(result.slides[0].width).toBe(960);
        expect(result.slides[0].height).toBe(720);
    });

    it('falls back to 960x540 defaults when no sldSz present', () => {
        const zip = buildZip([
            { path: 'ppt/presentation.xml', content: `<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"></p:presentation>` },
            { path: 'ppt/slides/slide1.xml', content: slideXml(`<p:sp><p:txBody><a:p><a:r><a:t>X</a:t></a:r></a:p></p:txBody></p:sp>`) },
        ]);
        const result = parsePptx(zip);
        expect(result.slideWidth).toBe(960);
        expect(result.slideHeight).toBe(540);
        // No sldIdLst → falls back to filesystem scan and finds slide1.xml
        expect(result.slides).toHaveLength(1);
    });
});

describe('parsePptx — text frames, runs & formatting', () => {
    function singleSlide(body: string, presCx = 9144000, presCy = 6858000): ReturnType<typeof parsePptx> {
        const zip = buildZip([
            { path: 'ppt/presentation.xml', content: presentationXml([{ id: 256, rId: 'rId1' }], presCx, presCy) },
            { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels([{ id: 'rId1', target: 'slides/slide1.xml' }]) },
            { path: 'ppt/theme/theme1.xml', content: THEME_XML },
            { path: 'ppt/slides/slide1.xml', content: slideXml(body) },
        ]);
        return parsePptx(zip);
    }

    it('extracts text run with bold/italic/underline/strike/size/color formatting', () => {
        const result = singleSlide(`
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="100000" y="200000"/><a:ext cx="3810000" cy="952500"/></a:xfrm></p:spPr>
            <p:txBody><a:bodyPr/>
              <a:p>
                <a:r>
                  <a:rPr b="1" i="1" u="sng" strike="sngStrike" sz="2400">
                    <a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>
                    <a:latin typeface="Arial"/>
                  </a:rPr>
                  <a:t>Styled Title</a:t>
                </a:r>
              </a:p>
            </p:txBody>
          </p:sp>`);

        const slide = result.slides[0];
        expect(slide.title).toBe('Styled Title');

        const textFrame = slide.elements.find(e => e.type === 'text') as PptxTextFrame;
        expect(textFrame).toBeDefined();
        // 100000/9525 = 10.5 → round 11 ; 200000/9525 = 21
        expect(textFrame.x).toBe(Math.round(100000 / 9525));
        expect(textFrame.y).toBe(Math.round(200000 / 9525));
        expect(textFrame.width).toBe(Math.round(3810000 / 9525));

        const run = textFrame.paragraphs[0].runs[0];
        expect(run.text).toBe('Styled Title');
        expect(run.bold).toBe(true);
        expect(run.italic).toBe(true);
        expect(run.underline).toBe(true);
        expect(run.strikethrough).toBe(true);
        expect(run.fontSize).toBe(24);
        // Colors round-trip through HSL → emitted lowercase
        expect(run.color).toBe('#ff0000');
        expect(run.fontFamily).toBe('Arial');
    });

    it('resolves scheme colors via the theme color map', () => {
        const result = singleSlide(`
          <p:sp>
            <p:nvSpPr><p:cNvPr id="3" name="t"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
            <p:txBody><a:bodyPr/>
              <a:p><a:r>
                <a:rPr><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:rPr>
                <a:t>Accent</a:t>
              </a:r></a:p>
            </p:txBody>
          </p:sp>`);
        const tf = result.slides[0].elements.find(e => e.type === 'text') as PptxTextFrame;
        expect(tf.paragraphs[0].runs[0].color).toBe('#4472c4');
    });

    it('parses paragraph alignment, level, bullet char and rtl', () => {
        const result = singleSlide(`
          <p:sp>
            <p:nvSpPr><p:cNvPr id="4" name="b"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
            <p:txBody><a:bodyPr/>
              <a:p>
                <a:pPr algn="ctr" lvl="2" rtl="1" marL="457200" indent="-228600">
                  <a:buChar char="-"/>
                </a:pPr>
                <a:r><a:t>Bulleted</a:t></a:r>
              </a:p>
            </p:txBody>
          </p:sp>`);
        const tf = result.slides[0].elements.find(e => e.type === 'text') as PptxTextFrame;
        const para = tf.paragraphs[0];
        expect(para.alignment).toBe('ctr');
        expect(para.level).toBe(2);
        expect(para.rtl).toBe(true);
        expect(para.marginLeft).toBe(Math.round(457200 / 9525));
        expect(para.indent).toBe(Math.round(-228600 / 9525));
        expect(para.bullet?.type).toBe('char');
        expect(para.bullet?.char).toBe('-');
    });

    it('parses autonumber bullet with startAt and a buNone bullet', () => {
        const result = singleSlide(`
          <p:sp>
            <p:nvSpPr><p:cNvPr id="5" name="b"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
            <p:txBody><a:bodyPr/>
              <a:p><a:pPr><a:buAutoNum type="arabicParenR" startAt="3"/></a:pPr><a:r><a:t>One</a:t></a:r></a:p>
              <a:p><a:pPr><a:buNone/></a:pPr><a:r><a:t>Two</a:t></a:r></a:p>
            </p:txBody>
          </p:sp>`);
        const tf = result.slides[0].elements.find(e => e.type === 'text') as PptxTextFrame;
        expect(tf.paragraphs[0].bullet?.type).toBe('autoNum');
        expect(tf.paragraphs[0].bullet?.autoNumScheme).toBe('arabicParenR');
        expect(tf.paragraphs[0].bullet?.startAt).toBe(3);
        expect(tf.paragraphs[1].bullet?.type).toBe('none');
    });

    it('parses multiple paragraphs and the title is the first text shape', () => {
        const result = singleSlide(`
          <p:sp>
            <p:nvSpPr><p:cNvPr id="6" name="m"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
            <p:txBody><a:bodyPr/>
              <a:p><a:r><a:t>First line</a:t></a:r></a:p>
              <a:p><a:r><a:t>Second </a:t></a:r><a:r><a:t>line</a:t></a:r></a:p>
            </p:txBody>
          </p:sp>`);
        const tf = result.slides[0].elements.find(e => e.type === 'text') as PptxTextFrame;
        expect(tf.paragraphs).toHaveLength(2);
        expect(tf.paragraphs[1].runs.map(r => r.text).join('')).toBe('Second line');
        // Title concatenates all paragraph text of the first text frame
        expect(result.slides[0].title).toBe('First lineSecond line');
    });

    it('applies normAutofit fontScale below 1', () => {
        const result = singleSlide(`
          <p:sp>
            <p:nvSpPr><p:cNvPr id="7" name="f"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
            <p:txBody><a:bodyPr><a:normAutofit fontScale="80000"/></a:bodyPr>
              <a:p><a:r><a:t>Scaled</a:t></a:r></a:p>
            </p:txBody>
          </p:sp>`);
        const tf = result.slides[0].elements.find(e => e.type === 'text') as PptxTextFrame;
        expect(tf.fontScale).toBeCloseTo(0.8, 5);
    });
});

describe('parsePptx — shapes & connectors', () => {
    function slideWith(body: string): ReturnType<typeof parsePptx> {
        const zip = buildZip([
            { path: 'ppt/presentation.xml', content: presentationXml([{ id: 256, rId: 'rId1' }]) },
            { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels([{ id: 'rId1', target: 'slides/slide1.xml' }]) },
            { path: 'ppt/theme/theme1.xml', content: THEME_XML },
            { path: 'ppt/slides/slide1.xml', content: slideXml(body) },
        ]);
        return parsePptx(zip);
    }

    it('parses a filled rect shape with border and rotation', () => {
        const result = slideWith(`
          <p:sp>
            <p:nvSpPr><p:cNvPr id="8" name="rect"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr>
              <a:xfrm rot="2700000"><a:off x="190500" y="381000"/><a:ext cx="952500" cy="476250"/></a:xfrm>
              <a:prstGeom prst="rect"/>
              <a:solidFill><a:srgbClr val="00FF00"/></a:solidFill>
              <a:ln w="25400"><a:solidFill><a:srgbClr val="0000FF"/></a:solidFill></a:ln>
            </p:spPr>
          </p:sp>`);
        const shape = result.slides[0].elements.find(e => e.type === 'shape') as PptxShapeElement;
        expect(shape.shapeType).toBe('rect');
        expect(shape.x).toBe(Math.round(190500 / 9525));
        expect(shape.y).toBe(Math.round(381000 / 9525));
        expect(shape.width).toBe(Math.round(952500 / 9525));
        expect(shape.fillColor).toBe('#00ff00');
        expect(shape.borderColor).toBe('#0000ff');
        expect(shape.borderWidth).toBe(2); // 25400/12700
        expect(shape.rotation).toBe(45); // 2700000/60000
    });

    it('parses a line shape as a connector with arrow ends and dash', () => {
        const result = slideWith(`
          <p:sp>
            <p:nvSpPr><p:cNvPr id="9" name="line"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr>
              <a:xfrm flipH="1"><a:off x="0" y="0"/><a:ext cx="952500" cy="0"/></a:xfrm>
              <a:prstGeom prst="line"/>
              <a:ln w="12700">
                <a:solidFill><a:srgbClr val="123456"/></a:solidFill>
                <a:prstDash val="dash"/>
                <a:tailEnd type="triangle"/>
              </a:ln>
            </p:spPr>
          </p:sp>`);
        const conn = result.slides[0].elements.find(e => e.type === 'connector') as PptxConnectorElement;
        expect(conn.connectorType).toBe('line');
        expect(conn.color).toBe('#123456');
        expect(conn.lineWidth).toBe(1);
        expect(conn.dashStyle).toBe('dash');
        expect(conn.tailEnd).toBe(true);
        expect(conn.flipH).toBe(true);
    });

    it('parses a cxnSp connector element', () => {
        const result = slideWith(`
          <p:cxnSp>
            <p:nvCxnSpPr><p:cNvPr id="10" name="c"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>
            <p:spPr>
              <a:xfrm><a:off x="95250" y="95250"/><a:ext cx="476250" cy="190500"/></a:xfrm>
              <a:prstGeom prst="straightConnector1"/>
              <a:ln w="19050"><a:solidFill><a:srgbClr val="ABCDEF"/></a:solidFill></a:ln>
            </p:spPr>
          </p:cxnSp>`);
        const conn = result.slides[0].elements.find(e => e.type === 'connector') as PptxConnectorElement;
        expect(conn.connectorType).toBe('straightConnector1');
        expect(conn.color).toBe('#abcdef');
        expect(conn.lineWidth).toBe(Math.round(19050 / 12700));
        expect(conn.x).toBe(Math.round(95250 / 9525));
    });

    it('parses a shape with gradient fill', () => {
        const result = slideWith(`
          <p:sp>
            <p:nvSpPr><p:cNvPr id="11" name="g"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr>
              <a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm>
              <a:prstGeom prst="ellipse"/>
              <a:gradFill>
                <a:gsLst>
                  <a:gs pos="0"><a:srgbClr val="FF0000"/></a:gs>
                  <a:gs pos="100000"><a:srgbClr val="0000FF"/></a:gs>
                </a:gsLst>
                <a:lin ang="5400000"/>
              </a:gradFill>
            </p:spPr>
          </p:sp>`);
        const shape = result.slides[0].elements.find(e => e.type === 'shape') as PptxShapeElement;
        expect(shape.shapeType).toBe('ellipse');
        expect(shape.gradientFill?.type).toBe('linear');
        expect(shape.gradientFill?.stops).toHaveLength(2);
        expect(shape.gradientFill?.stops[0].color).toBe('#ff0000');
        expect(shape.gradientFill?.stops[1].position).toBe(100);
        // 5400000/60000 + 90 = 90 + 90 = 180
        expect(shape.gradientFill?.angle).toBe(180);
    });
});

describe('parsePptx — tables', () => {
    it('parses a graphicFrame table with rows, cells, widths and cell formatting', () => {
        const tableBody = `
          <p:graphicFrame>
            <p:nvGraphicFramePr><p:cNvPr id="12" name="tbl"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
            <p:xfrm><a:off x="190500" y="190500"/><a:ext cx="3810000" cy="1905000"/></p:xfrm>
            <a:graphic><a:graphicData>
              <a:tbl>
                <a:tblGrid>
                  <a:gridCol w="1905000"/>
                  <a:gridCol w="1905000"/>
                </a:tblGrid>
                <a:tr h="380000">
                  <a:tc><a:txBody><a:p><a:r><a:rPr b="1"/><a:t>H1</a:t></a:r></a:p></a:txBody>
                    <a:tcPr><a:solidFill><a:srgbClr val="EEEEEE"/></a:solidFill></a:tcPr></a:tc>
                  <a:tc><a:txBody><a:p><a:r><a:t>H2</a:t></a:r></a:p></a:txBody></a:tc>
                </a:tr>
                <a:tr h="380000">
                  <a:tc><a:txBody><a:p><a:r><a:rPr><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:rPr><a:t>R1C1</a:t></a:r></a:p></a:txBody></a:tc>
                  <a:tc><a:txBody><a:p><a:r><a:t>R1C2</a:t></a:r></a:p></a:txBody></a:tc>
                </a:tr>
              </a:tbl>
            </a:graphicData></a:graphic>
          </p:graphicFrame>`;
        const zip = buildZip([
            { path: 'ppt/presentation.xml', content: presentationXml([{ id: 256, rId: 'rId1' }]) },
            { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels([{ id: 'rId1', target: 'slides/slide1.xml' }]) },
            { path: 'ppt/theme/theme1.xml', content: THEME_XML },
            { path: 'ppt/slides/slide1.xml', content: slideXml(tableBody) },
        ]);
        const result = parsePptx(zip);
        const table = result.slides[0].elements.find(e => e.type === 'table') as PptxTableElement;
        expect(table).toBeDefined();
        expect(table.rows).toHaveLength(2);
        expect(table.rows[0]).toHaveLength(2);
        expect(table.rows[0][0].text).toBe('H1');
        expect(table.rows[0][0].bold).toBe(true);
        expect(table.rows[0][0].fillColor).toBe('#eeeeee');
        expect(table.rows[0][1].text).toBe('H2');
        expect(table.rows[1][0].text).toBe('R1C1');
        expect(table.rows[1][0].color).toBe('#ff0000');
        expect(table.rows[1][1].text).toBe('R1C2');
        expect(table.columnWidths).toEqual([200, 200]);
        expect(table.x).toBe(Math.round(190500 / 9525));
    });
});

describe('parsePptx — images & background', () => {
    it('parses an embedded image (pic) via media relationships', () => {
        const slideRels = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rIdImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
        </Relationships>`;
        const picBody = `
          <p:pic>
            <p:nvPicPr><p:cNvPr id="13" name="pic"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
            <p:blipFill><a:blip r:embed="rIdImg"/></p:blipFill>
            <p:spPr><a:xfrm><a:off x="95250" y="95250"/><a:ext cx="952500" cy="952500"/></a:xfrm></p:spPr>
          </p:pic>`;
        const zip = buildZip([
            { path: 'ppt/presentation.xml', content: presentationXml([{ id: 256, rId: 'rId1' }]) },
            { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels([{ id: 'rId1', target: 'slides/slide1.xml' }]) },
            { path: 'ppt/theme/theme1.xml', content: THEME_XML },
            { path: 'ppt/slides/slide1.xml', content: slideXml(picBody) },
            { path: 'ppt/slides/_rels/slide1.xml.rels', content: slideRels },
            { path: 'ppt/media/image1.png', content: PNG_BYTES },
        ]);
        const result = parsePptx(zip);
        const img = result.slides[0].elements.find(e => e.type === 'image') as PptxImageElement;
        expect(img).toBeDefined();
        expect(img.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
        expect(img.x).toBe(Math.round(95250 / 9525));
        expect(img.width).toBe(Math.round(952500 / 9525));
    });

    it('parses a solid slide background color', () => {
        const body = slideXml(`<p:sp><p:txBody><a:p><a:r><a:t>x</a:t></a:r></a:p></p:txBody></p:sp>`)
            .replace('<p:cSld>', `<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="123123"/></a:solidFill></p:bgPr></p:bg>`);
        const zip = buildZip([
            { path: 'ppt/presentation.xml', content: presentationXml([{ id: 256, rId: 'rId1' }]) },
            { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels([{ id: 'rId1', target: 'slides/slide1.xml' }]) },
            { path: 'ppt/theme/theme1.xml', content: THEME_XML },
            { path: 'ppt/slides/slide1.xml', content: body },
        ]);
        const result = parsePptx(zip);
        expect(result.slides[0].backgroundColor).toBe('#123123');
    });
});

describe('parsePptx — multiple slides & fallbacks', () => {
    it('parses two slides in declared order via relationships', () => {
        const s1 = slideXml(`<p:sp><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>Slide One</a:t></a:r></a:p></p:txBody></p:sp>`);
        const s2 = slideXml(`<p:sp><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>Slide Two</a:t></a:r></a:p></p:txBody></p:sp>`);
        const zip = buildZip([
            { path: 'ppt/presentation.xml', content: presentationXml([{ id: 256, rId: 'rId1' }, { id: 257, rId: 'rId2' }]) },
            { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels([
                { id: 'rId1', target: 'slides/slide1.xml' },
                { id: 'rId2', target: 'slides/slide2.xml' },
            ]) },
            { path: 'ppt/theme/theme1.xml', content: THEME_XML },
            { path: 'ppt/slides/slide1.xml', content: s1 },
            { path: 'ppt/slides/slide2.xml', content: s2 },
        ]);
        const result = parsePptx(zip);
        expect(result.slides).toHaveLength(2);
        expect(result.slides[0].title).toBe('Slide One');
        expect(result.slides[1].title).toBe('Slide Two');
        expect(result.slides[1].index).toBe(1);
    });

    it('uses filesystem fallback scan when there is no sldIdLst', () => {
        const zip = buildZip([
            { path: 'ppt/presentation.xml', content: `<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldSz cx="9144000" cy="6858000"/></p:presentation>` },
            { path: 'ppt/theme/theme1.xml', content: THEME_XML },
            { path: 'ppt/slides/slide1.xml', content: slideXml(`<p:sp><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>FS Slide</a:t></a:r></a:p></p:txBody></p:sp>`) },
            { path: 'ppt/slides/slide2.xml', content: slideXml(`<p:sp><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>FS Slide 2</a:t></a:r></a:p></p:txBody></p:sp>`) },
        ]);
        const result = parsePptx(zip);
        expect(result.slides).toHaveLength(2);
        expect(result.slides[0].title).toBe('FS Slide');
        expect(result.slides[1].title).toBe('FS Slide 2');
    });

    it('returns zero slides when presentation references a missing slide target', () => {
        const zip = buildZip([
            { path: 'ppt/presentation.xml', content: presentationXml([{ id: 256, rId: 'rId1' }]) },
            { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels([{ id: 'rId1', target: 'slides/missing.xml' }]) },
            { path: 'ppt/theme/theme1.xml', content: THEME_XML },
        ]);
        const result = parsePptx(zip);
        expect(result.slides).toHaveLength(0);
    });
});

describe('parsePptx — grouped shapes', () => {
    it('applies group transform offset to inner shapes', () => {
        const body = `
          <p:grpSp>
            <p:nvGrpSpPr><p:cNvPr id="14" name="grp"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
            <p:grpSpPr>
              <a:xfrm>
                <a:off x="952500" y="952500"/><a:ext cx="1905000" cy="1905000"/>
                <a:chOff x="0" y="0"/><a:chExt cx="1905000" cy="1905000"/>
              </a:xfrm>
            </p:grpSpPr>
            <p:sp>
              <p:nvSpPr><p:cNvPr id="15" name="inner"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
              <p:spPr>
                <a:xfrm><a:off x="0" y="0"/><a:ext cx="476250" cy="476250"/></a:xfrm>
                <a:prstGeom prst="rect"/>
                <a:solidFill><a:srgbClr val="999999"/></a:solidFill>
              </p:spPr>
            </p:sp>
          </p:grpSp>`;
        const zip = buildZip([
            { path: 'ppt/presentation.xml', content: presentationXml([{ id: 256, rId: 'rId1' }]) },
            { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels([{ id: 'rId1', target: 'slides/slide1.xml' }]) },
            { path: 'ppt/theme/theme1.xml', content: THEME_XML },
            { path: 'ppt/slides/slide1.xml', content: slideXml(body) },
        ]);
        const result = parsePptx(zip);
        const shape = result.slides[0].elements.find(e => e.type === 'shape') as PptxShapeElement;
        expect(shape).toBeDefined();
        expect(shape.fillColor).toBe('#999999');
        // scale 1, dx = 952500/9525 = 100; inner x 0 → 100
        expect(shape.x).toBe(Math.round(952500 / 9525));
        expect(shape.y).toBe(Math.round(952500 / 9525));
    });
});

// ---------------------------------------------------------------------------
// Slide + layout + master fixtures (relationship chain)
// ---------------------------------------------------------------------------

const PKG_RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE_RELS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function relsXml(items: ReadonlyArray<{ id: string; type: string; target: string }>): string {
    const body = items
        .map(r => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`)
        .join('');
    return `<?xml version="1.0"?><Relationships xmlns="${PKG_RELS_NS}">${body}</Relationships>`;
}

function masterXml(body: string): string {
    return `<?xml version="1.0"?>
<p:sldMaster ${NS_DECL}>
  <p:cSld><p:spTree>${body}</p:spTree></p:cSld>
  <p:txStyles>
    <p:titleStyle><a:lvl1pPr><a:defRPr sz="4400" b="1"><a:solidFill><a:srgbClr val="203040"/></a:solidFill></a:defRPr></a:lvl1pPr></p:titleStyle>
    <p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"><a:solidFill><a:srgbClr val="556677"/></a:solidFill></a:defRPr></a:lvl1pPr></p:bodyStyle>
  </p:txStyles>
</p:sldMaster>`;
}

function layoutXml(body: string): string {
    return `<?xml version="1.0"?>
<p:sldLayout ${NS_DECL}>
  <p:cSld><p:spTree>${body}</p:spTree></p:cSld>
</p:sldLayout>`;
}

const SLIDE_LAYOUT_RELTYPE = `${OFFICE_RELS}/slideLayout`;
const SLIDE_MASTER_RELTYPE = `${OFFICE_RELS}/slideMaster`;

function buildPptxWithLayoutMaster(
    slideBody: string,
    layoutBody: string,
    masterBody: string,
    slideRels: ReadonlyArray<{ id: string; type: string; target: string }> = [],
): Uint8Array {
    return buildZip([
        { path: 'ppt/presentation.xml', content: presentationXml([{ id: 256, rId: 'rId1' }]) },
        { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels([{ id: 'rId1', target: 'slides/slide1.xml' }]) },
        { path: 'ppt/theme/theme1.xml', content: THEME_XML },
        { path: 'ppt/slides/slide1.xml', content: slideXml(slideBody) },
        { path: 'ppt/slides/_rels/slide1.xml.rels', content: relsXml([
            { id: 'rIdL', type: SLIDE_LAYOUT_RELTYPE, target: '../slideLayouts/slideLayout1.xml' },
            ...slideRels,
        ]) },
        { path: 'ppt/slideLayouts/slideLayout1.xml', content: layoutXml(layoutBody) },
        { path: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', content: relsXml([
            { id: 'rIdM', type: SLIDE_MASTER_RELTYPE, target: '../slideMasters/slideMaster1.xml' },
        ]) },
        { path: 'ppt/slideMasters/slideMaster1.xml', content: masterXml(masterBody) },
        { path: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', content: relsXml([]) },
    ]);
}

describe('parsePptx — layout, master & inheritance', () => {
    it('inherits title font size and color from master titleStyle', () => {
        const slideBody = `
          <p:sp>
            <p:nvSpPr><p:cNvPr id="60" name="title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
            <p:txBody><a:bodyPr/><a:p><a:r><a:t>Inherited Title</a:t></a:r></a:p></p:txBody>
          </p:sp>`;
        const result = parsePptx(buildPptxWithLayoutMaster(slideBody, '', ''));
        const tf = result.slides[0].elements.find(e => e.type === 'text') as PptxTextFrame;
        const run = tf.paragraphs[0].runs[0];
        expect(run.text).toBe('Inherited Title');
        expect(run.fontSize).toBe(44);
        expect(run.bold).toBe(true);
        expect(run.color).toBe('#203040');
    });

    it('inherits body font size from master bodyStyle for non-title placeholders', () => {
        const slideBody = `
          <p:sp>
            <p:nvSpPr><p:cNvPr id="61" name="body"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
            <p:txBody><a:bodyPr/><a:p><a:r><a:t>Body text</a:t></a:r></a:p></p:txBody>
          </p:sp>`;
        const layoutBody = `
          <p:sp>
            <p:nvSpPr><p:cNvPr id="62" name="bodyPh"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="285750" y="571500"/><a:ext cx="3810000" cy="1905000"/></a:xfrm></p:spPr>
          </p:sp>`;
        const result = parsePptx(buildPptxWithLayoutMaster(slideBody, layoutBody, ''));
        const tf = result.slides[0].elements.find(e => e.type === 'text') as PptxTextFrame;
        expect(tf.paragraphs[0].runs[0].fontSize).toBe(18);
        expect(tf.x).toBe(Math.round(285750 / 9525));
        expect(tf.y).toBe(Math.round(571500 / 9525));
    });

    it('renders non-placeholder shapes from the layout as background elements', () => {
        const slideBody = `
          <p:sp>
            <p:nvSpPr><p:cNvPr id="63" name="t"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
            <p:txBody><a:bodyPr/><a:p><a:r><a:t>Slide content</a:t></a:r></a:p></p:txBody>
          </p:sp>`;
        const layoutBody = `
          <p:sp>
            <p:nvSpPr><p:cNvPr id="64" name="deco"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr>
              <a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="95250"/></a:xfrm>
              <a:prstGeom prst="rect"/>
              <a:solidFill><a:srgbClr val="abcdef"/></a:solidFill>
            </p:spPr>
          </p:sp>`;
        const result = parsePptx(buildPptxWithLayoutMaster(slideBody, layoutBody, ''));
        const shapes = result.slides[0].elements.filter(e => e.type === 'shape') as PptxShapeElement[];
        expect(shapes.some(s => s.fillColor === '#abcdef')).toBe(true);
    });

    it('falls back to layout background color when slide has none', () => {
        const slideBody = `<p:sp><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>x</a:t></a:r></a:p></p:txBody></p:sp>`;
        const layoutWithBg = layoutXml('').replace('<p:cSld>', '<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="334455"/></a:solidFill></p:bgPr></p:bg>');
        const zip = buildZip([
            { path: 'ppt/presentation.xml', content: presentationXml([{ id: 256, rId: 'rId1' }]) },
            { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels([{ id: 'rId1', target: 'slides/slide1.xml' }]) },
            { path: 'ppt/theme/theme1.xml', content: THEME_XML },
            { path: 'ppt/slides/slide1.xml', content: slideXml(slideBody) },
            { path: 'ppt/slides/_rels/slide1.xml.rels', content: relsXml([{ id: 'rIdL', type: SLIDE_LAYOUT_RELTYPE, target: '../slideLayouts/slideLayout1.xml' }]) },
            { path: 'ppt/slideLayouts/slideLayout1.xml', content: layoutWithBg },
            { path: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', content: relsXml([]) },
        ]);
        const result = parsePptx(zip);
        expect(result.slides[0].backgroundColor).toBe('#334455');
    });
});

describe('parsePptx — bullet styling, fields & gradient background', () => {
    it('parses bullet color, size percent, font and size points', () => {
        const body = `
          <p:sp>
            <p:nvSpPr><p:cNvPr id="70" name="b"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
            <p:txBody><a:bodyPr/>
              <a:p>
                <a:pPr>
                  <a:buClr><a:srgbClr val="ff8800"/></a:buClr>
                  <a:buSzPct val="75000"/>
                  <a:buSzPts val="1400"/>
                  <a:buFont typeface="Wingdings"/>
                  <a:buChar char="*"/>
                </a:pPr>
                <a:r><a:t>Styled bullet</a:t></a:r>
              </a:p>
            </p:txBody>
          </p:sp>`;
        const bullet = firstTextFrame(buildSinglePptx(body)).paragraphs[0].bullet!;
        expect(bullet.type).toBe('char');
        expect(bullet.char).toBe('*');
        expect(bullet.color).toBe('#ff8800');
        expect(bullet.sizePercent).toBe(75);
        expect(bullet.sizePoints).toBe(14);
        expect(bullet.fontFamily).toBe('Wingdings');
    });

    it('parses a field run (a:fld) as text', () => {
        const body = `
          <p:sp>
            <p:nvSpPr><p:cNvPr id="71" name="f"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
            <p:txBody><a:bodyPr/>
              <a:p>
                <a:fld id="{GUID}" type="slidenum"><a:rPr/><a:t>7</a:t></a:fld>
              </a:p>
            </p:txBody>
          </p:sp>`;
        const tf = firstTextFrame(buildSinglePptx(body));
        expect(tf.paragraphs[0].runs.map(r => r.text).join('')).toBe('7');
    });

    it('parses a gradient slide background (first gradient stop color)', () => {
        const body = slideXml(`<p:sp><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>x</a:t></a:r></a:p></p:txBody></p:sp>`)
            .replace('<p:cSld>', `<p:cSld><p:bg><p:bgPr><a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="010203"/></a:gs><a:gs pos="100000"><a:srgbClr val="040506"/></a:gs></a:gsLst></a:gradFill></p:bgPr></p:bg>`);
        const zip = buildZip([
            { path: 'ppt/presentation.xml', content: presentationXml([{ id: 256, rId: 'rId1' }]) },
            { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels([{ id: 'rId1', target: 'slides/slide1.xml' }]) },
            { path: 'ppt/theme/theme1.xml', content: THEME_XML },
            { path: 'ppt/slides/slide1.xml', content: body },
        ]);
        const result = parsePptx(zip);
        expect(result.slides[0].backgroundColor).toBe('#010203');
    });

    it('parses a slide background image (blipFill)', () => {
        const slideRels = relsXml([{ id: 'rIdBg', type: `${OFFICE_RELS}/image`, target: '../media/bg.png' }]);
        const body = slideXml(`<p:sp><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>x</a:t></a:r></a:p></p:txBody></p:sp>`)
            .replace('<p:cSld>', `<p:cSld><p:bg><p:bgPr><a:blipFill><a:blip r:embed="rIdBg"/></a:blipFill></p:bgPr></p:bg>`);
        const zip = buildZip([
            { path: 'ppt/presentation.xml', content: presentationXml([{ id: 256, rId: 'rId1' }]) },
            { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels([{ id: 'rId1', target: 'slides/slide1.xml' }]) },
            { path: 'ppt/theme/theme1.xml', content: THEME_XML },
            { path: 'ppt/slides/slide1.xml', content: body },
            { path: 'ppt/slides/_rels/slide1.xml.rels', content: slideRels },
            { path: 'ppt/media/bg.png', content: PNG_BYTES },
        ]);
        const result = parsePptx(zip);
        expect(result.slides[0].backgroundImage!.startsWith('data:image/png;base64,')).toBe(true);
    });
});

const JPEG_BYTES = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
const GIF_BYTES = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00]);

describe('parsePptx — additional branch coverage', () => {
    it('guesses jpeg and gif mime types from magic bytes', () => {
        const mk = (file: string, bytes: Uint8Array): PptxImageElement => {
            const slideRels = relsXml([{ id: 'rIdI', type: `${OFFICE_RELS}/image`, target: `../media/${file}` }]);
            const picBody = `
              <p:pic>
                <p:nvPicPr><p:cNvPr id="80" name="p"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
                <p:blipFill><a:blip r:embed="rIdI"/></p:blipFill>
                <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
              </p:pic>`;
            const zip = buildSinglePptx(picBody, [
                { path: 'ppt/slides/_rels/slide1.xml.rels', content: slideRels },
                { path: `ppt/media/${file}`, content: bytes },
            ]);
            return parsePptx(zip).slides[0].elements.find(e => e.type === 'image') as PptxImageElement;
        };
        expect(mk('a.jpg', JPEG_BYTES).dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
        expect(mk('a.gif', GIF_BYTES).dataUrl.startsWith('data:image/gif;base64,')).toBe(true);
    });

    it('resolves theme colors defined via sysClr (lastClr)', () => {
        const themeSys = THEME_XML.replace(
            '<a:dk1><a:srgbClr val="000000"/></a:dk1>',
            '<a:dk1><a:sysClr val="windowText" lastClr="0A0B0C"/></a:dk1>',
        );
        const zip = buildZip([
            { path: 'ppt/presentation.xml', content: presentationXml([{ id: 256, rId: 'rId1' }]) },
            { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels([{ id: 'rId1', target: 'slides/slide1.xml' }]) },
            { path: 'ppt/theme/theme1.xml', content: themeSys },
            { path: 'ppt/slides/slide1.xml', content: slideXml(styledRunSlide(`<a:solidFill><a:schemeClr val="tx1"/></a:solidFill>`)) },
        ]);
        const tf = parsePptx(zip).slides[0].elements.find(e => e.type === 'text') as PptxTextFrame;
        // tx1 aliases to dk1 → #0A0B0C, lowercased through hsl
        expect(tf.paragraphs[0].runs[0].color).toBe('#0a0b0c');
    });

    it('falls back to paragraph plain text when there are only br elements at run level', () => {
        const body = `
          <p:sp>
            <p:nvSpPr><p:cNvPr id="81" name="t"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
            <p:txBody><a:bodyPr/>
              <a:p>Plain inline text</a:p>
            </p:txBody>
          </p:sp>`;
        const tf = firstTextFrame(buildSinglePptx(body));
        expect(tf.paragraphs[0].runs[0].text).toBe('Plain inline text');
    });

    it('parses an image bullet (buBlip)', () => {
        const slideRels = relsXml([{ id: 'rIdBu', type: `${OFFICE_RELS}/image`, target: '../media/bullet.png' }]);
        const body = `
          <p:sp>
            <p:nvSpPr><p:cNvPr id="82" name="b"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
            <p:txBody><a:bodyPr/>
              <a:p><a:pPr><a:buBlip><a:blip r:embed="rIdBu"/></a:buBlip></a:pPr><a:r><a:t>Image bullet</a:t></a:r></a:p>
            </p:txBody>
          </p:sp>`;
        const tf = firstTextFrame(buildSinglePptx(body, [
            { path: 'ppt/slides/_rels/slide1.xml.rels', content: slideRels },
            { path: 'ppt/media/bullet.png', content: PNG_BYTES },
        ]));
        const bullet = tf.paragraphs[0].bullet!;
        expect(bullet.imageDataUrl!.startsWith('data:image/png;base64,')).toBe(true);
    });

    it('resolves connector color from a style lnRef when ln has no fill', () => {
        const body = `
          <p:cxnSp>
            <p:nvCxnSpPr><p:cNvPr id="83" name="c"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>
            <p:spPr>
              <a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm>
              <a:prstGeom prst="straightConnector1"/>
            </p:spPr>
            <p:style>
              <a:lnRef idx="3"><a:schemeClr val="accent3"/></a:lnRef>
            </p:style>
          </p:cxnSp>`;
        const conn = parsePptx(buildSinglePptx(body)).slides[0].elements.find(e => e.type === 'connector') as PptxConnectorElement;
        expect(conn.color).toBe('#a5a5a5');
        expect(conn.lineWidth).toBe(3);
    });

    it('reads background color from a bgRef on the slide', () => {
        const body = slideXml(`<p:sp><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>x</a:t></a:r></a:p></p:txBody></p:sp>`)
            .replace('<p:cSld>', `<p:cSld><p:bg><p:bgRef idx="1001"><a:solidFill><a:srgbClr val="778899"/></a:solidFill></p:bgRef></p:bg>`);
        const zip = buildZip([
            { path: 'ppt/presentation.xml', content: presentationXml([{ id: 256, rId: 'rId1' }]) },
            { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels([{ id: 'rId1', target: 'slides/slide1.xml' }]) },
            { path: 'ppt/theme/theme1.xml', content: THEME_XML },
            { path: 'ppt/slides/slide1.xml', content: body },
        ]);
        expect(parsePptx(zip).slides[0].backgroundColor).toBe('#778899');
    });
});

/**
 * Fallback paths a well-formed deck from PowerPoint rarely takes, but that real
 * decks hit constantly: East-Asian and complex-script typefaces, percentage
 * paragraph spacing, list-level defaults, and a line that inherits its colour
 * from the shape's style reference.
 */
describe('parsePptx — inherited and alternate property paths', () => {
    it('falls back to the East Asian typeface when there is no latin one', () => {
        const frame = firstTextFrame(buildSinglePptx(styledRunSlide('<a:ea typeface="MS Mincho"/>')));

        expect(frame.paragraphs[0].runs[0].fontFamily).toBe('MS Mincho');
    });

    it('falls back to the complex-script typeface when latin and ea are absent', () => {
        const frame = firstTextFrame(buildSinglePptx(styledRunSlide('<a:cs typeface="Arial Unicode"/>')));

        expect(frame.paragraphs[0].runs[0].fontFamily).toBe('Arial Unicode');
    });

    it('ignores a theme-placeholder typeface and keeps looking', () => {
        // `+mn-ea` is a theme reference, not a real face — taking it literally
        // would put a placeholder token into the rendered font stack.
        const frame = firstTextFrame(buildSinglePptx(
            styledRunSlide('<a:ea typeface="+mn-ea"/><a:cs typeface="Tahoma"/>'),
        ));

        expect(frame.paragraphs[0].runs[0].fontFamily).toBe('Tahoma');
    });

    it('reads paragraph spacing given as a percentage of line height', () => {
        const frame = firstTextFrame(buildSinglePptx(`
      <p:sp>
        <p:nvSpPr><p:cNvPr id="60" name="p"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/>
          <a:p>
            <a:pPr>
              <a:spcBef><a:spcPct val="100000"/></a:spcBef>
              <a:spcAft><a:spcPct val="50000"/></a:spcAft>
            </a:pPr>
            <a:r><a:t>Pct</a:t></a:r>
          </a:p>
        </p:txBody>
      </p:sp>`));

        // 100000 = 100% of a 12pt line; 50% is half of it.
        expect(frame.paragraphs[0].spacingBefore).toBeCloseTo(12, 5);
        expect(frame.paragraphs[0].spacingAfter).toBeCloseTo(6, 5);
    });

    it('inherits run properties from the list style for the paragraph level', () => {
        const frame = firstTextFrame(buildSinglePptx(`
      <p:sp>
        <p:nvSpPr><p:cNvPr id="61" name="l"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle>
            <a:lvl2pPr><a:defRPr sz="3200" b="1"><a:latin typeface="Georgia"/></a:defRPr></a:lvl2pPr>
          </a:lstStyle>
          <a:p><a:pPr lvl="1"/><a:r><a:t>Level two</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>`));

        // The run carries no rPr of its own, so everything comes from lvl2pPr.
        const run = frame.paragraphs[0].runs[0];
        expect(run.fontSize).toBe(32);
        expect(run.bold).toBe(true);
        expect(run.fontFamily).toBe('Georgia');
    });

    it('leaves the run untouched when the list style has no entry for its level', () => {
        const frame = firstTextFrame(buildSinglePptx(`
      <p:sp>
        <p:nvSpPr><p:cNvPr id="62" name="l"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle><a:lvl2pPr><a:defRPr sz="3200"/></a:lvl2pPr></a:lstStyle>
          <a:p><a:r><a:t>Level one</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>`));

        expect(frame.paragraphs[0].runs[0].fontSize).toBeUndefined();
    });

    it('takes the outline colour from the shape style reference when the line has none', () => {
        // `a:ln` sets a width but no colour, so `lnRef` has to supply it.
        const shape = firstShape(buildSinglePptx(`
      <p:sp>
        <p:nvSpPr><p:cNvPr id="63" name="s"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="952500"/></a:xfrm>
          <a:prstGeom prst="rect"/>
          <a:ln w="38100"/>
        </p:spPr>
        <p:style>
          <a:lnRef idx="2"><a:srgbClr val="112233"/></a:lnRef>
        </p:style>
      </p:sp>`));

        expect(shape.borderColor).toBe('#112233');
    });

    /** Connectors resolve their own colour, separately from shapes. */
    function firstConnector(zip: Uint8Array): PptxConnectorElement {
        const result = parsePptx(zip);
        return result.slides[0].elements.find(e => e.type === 'connector') as PptxConnectorElement;
    }

    it('gives a line-shape connector its colour from the style reference', () => {
        // A `p:sp` whose geometry is a connector type is routed to the connector
        // path, where an `a:ln` without a colour must fall back to `lnRef`.
        const conn = firstConnector(buildSinglePptx(`
      <p:sp>
        <p:nvSpPr><p:cNvPr id="64" name="c"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="476250" cy="190500"/></a:xfrm>
          <a:prstGeom prst="straightConnector1"/>
          <a:ln/>
        </p:spPr>
        <p:style>
          <a:lnRef idx="2"><a:srgbClr val="112233"/></a:lnRef>
        </p:style>
      </p:sp>`));

        expect(conn.color).toBe('#112233');
    });

    it('defaults a line shape to black when nothing names a colour', () => {
        const conn = firstConnector(buildSinglePptx(`
      <p:sp>
        <p:nvSpPr><p:cNvPr id="65" name="c"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="476250" cy="190500"/></a:xfrm>
          <a:prstGeom prst="bentConnector3"/>
        </p:spPr>
      </p:sp>`));

        expect(conn.color).toBe('#000');
        expect(conn.connectorType).toBe('bentConnector3');
    });
});

describe('parsePptx — group flips and background fills', () => {
    function slideWithBody(body: string): Uint8Array {
        return buildZip([
            { path: 'ppt/presentation.xml', content: presentationXml([{ id: 256, rId: 'rId1' }]) },
            { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels([{ id: 'rId1', target: 'slides/slide1.xml' }]) },
            { path: 'ppt/theme/theme1.xml', content: THEME_XML },
            { path: 'ppt/slides/slide1.xml', content: slideXml(body) },
        ]);
    }

    /** A group whose transform mirrors its children on the given axes. */
    function flippedGroup(flip: string, inner: string): string {
        return `
      <p:grpSp>
        <p:nvGrpSpPr><p:cNvPr id="70" name="grp"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
        <p:grpSpPr>
          <a:xfrm ${flip}>
            <a:off x="0" y="0"/><a:ext cx="1905000" cy="1905000"/>
            <a:chOff x="0" y="0"/><a:chExt cx="1905000" cy="1905000"/>
          </a:xfrm>
        </p:grpSpPr>
        ${inner}
      </p:grpSp>`;
    }

    const innerRect = `
      <p:sp>
        <p:nvSpPr><p:cNvPr id="71" name="inner"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="476250" cy="476250"/></a:xfrm>
          <a:prstGeom prst="rect"/>
          <a:solidFill><a:srgbClr val="999999"/></a:solidFill>
        </p:spPr>
      </p:sp>`;

    it('mirrors a child horizontally when the group is flipped', () => {
        const result = parsePptx(slideWithBody(flippedGroup('flipH="1"', innerRect)));
        const shape = result.slides[0].elements.find(e => e.type === 'shape') as PptxShapeElement;

        // Group is 200px wide, child is 50px at x=0, so mirroring puts it at 150.
        expect(shape.x).toBe(Math.round(1905000 / 9525) - Math.round(476250 / 9525));
        expect(shape.y).toBe(0);
    });

    it('mirrors a child vertically when the group is flipped', () => {
        const result = parsePptx(slideWithBody(flippedGroup('flipV="1"', innerRect)));
        const shape = result.slides[0].elements.find(e => e.type === 'shape') as PptxShapeElement;

        expect(shape.y).toBe(Math.round(1905000 / 9525) - Math.round(476250 / 9525));
        expect(shape.x).toBe(0);
    });

    it('inverts a connector\u2019s own flip flags when its group is flipped', () => {
        const connector = `
      <p:sp>
        <p:nvSpPr><p:cNvPr id="72" name="c"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm flipH="1"><a:off x="0" y="0"/><a:ext cx="476250" cy="190500"/></a:xfrm>
          <a:prstGeom prst="straightConnector1"/>
        </p:spPr>
      </p:sp>`;
        const result = parsePptx(slideWithBody(flippedGroup('flipH="1"', connector)));
        const conn = result.slides[0].elements.find(e => e.type === 'connector') as PptxConnectorElement;

        // Its own flipH cancels against the group's, leaving it unflipped.
        expect(conn.flipH).toBeFalsy();
    });

    it('takes the slide background from the first gradient stop', () => {
        const body = `<p:sp>
        <p:nvSpPr><p:cNvPr id="73" name="s"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
      </p:sp>`;
        const slide = slideXml(body).replace(
            '<p:cSld>',
            `<p:cSld><p:bg><p:bgPr><a:gradFill><a:gsLst>`
            + `<a:gs pos="0"><a:srgbClr val="AABBCC"/></a:gs>`
            + `<a:gs pos="100000"><a:srgbClr val="DDEEFF"/></a:gs>`
            + `</a:gsLst></a:gradFill></p:bgPr></p:bg>`,
        );
        const zip = buildZip([
            { path: 'ppt/presentation.xml', content: presentationXml([{ id: 256, rId: 'rId1' }]) },
            { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels([{ id: 'rId1', target: 'slides/slide1.xml' }]) },
            { path: 'ppt/theme/theme1.xml', content: THEME_XML },
            { path: 'ppt/slides/slide1.xml', content: slide },
        ]);

        expect(parsePptx(zip).slides[0].backgroundColor).toBe('#aabbcc');
    });
});
