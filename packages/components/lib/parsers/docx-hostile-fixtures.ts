// Shared test fixture: a .docx whose every colour, keyword, font and link slot
// carries one hostile payload, built in code. NOT a registry component; test
// scaffolding for the DOCX parser, DOCX renderer and file-import specs.
import { buildStoredZip } from './zip-test-fixtures';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';

/** Escapes a value for a double-quoted XML attribute, so the PARSED value is the payload. */
export function xmlAttr(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

export const CONTROL_COLOR = '00FF00';
export const HOSTILE_LINK_TEXT = 'hostile link';

/**
 * A document with `payload` in every attribute slot the importers read: run
 * colour, highlight, shading, font; paragraph alignment, shading, border colour;
 * cell shading, vertical alignment, border colour; table border colour; theme
 * colours (srgb and sys) reached through `themeColor`; a style definition; a
 * hyperlink target and bookmark anchor. One valid run (colour {@link CONTROL_COLOR})
 * proves a walk over the result is not vacuous.
 */
export function hostileDocx(payload: string): Uint8Array {
    const p = xmlAttr(payload);
    const runs = [
        `<w:r><w:rPr><w:color w:val="${p}"/><w:highlight w:val="${p}"/><w:shd w:val="clear" w:fill="${p}"/>`
        + `<w:rFonts w:ascii="${p}"/></w:rPr><w:t>hostile run</w:t></w:r>`,
        '<w:r><w:rPr><w:color w:themeColor="accent1" w:themeTint="80"/></w:rPr><w:t>theme srgb</w:t></w:r>',
        '<w:r><w:rPr><w:color w:themeColor="dk1"/></w:rPr><w:t>theme sys</w:t></w:r>',
        `<w:r><w:rPr><w:color w:val="${CONTROL_COLOR}"/></w:rPr><w:t>control</w:t></w:r>`,
        '<w:hyperlink r:id="rId1"><w:r><w:t>script link</w:t></w:r></w:hyperlink>',
        `<w:hyperlink w:anchor="${p}"><w:r><w:t>${HOSTILE_LINK_TEXT}</w:t></w:r></w:hyperlink>`,
    ].join('');
    const paragraph = `<w:p><w:pPr><w:jc w:val="${p}"/><w:shd w:fill="${p}"/>`
        + `<w:pBdr><w:top w:val="single" w:sz="4" w:color="${p}"/></w:pBdr></w:pPr>${runs}</w:p>`;
    const styled = '<w:p><w:pPr><w:pStyle w:val="Evil"/></w:pPr><w:r><w:t>styled</w:t></w:r></w:p>';
    const table = `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="${p}"/></w:tblBorders></w:tblPr>`
        + `<w:tr><w:tc><w:tcPr><w:shd w:fill="${p}"/><w:vAlign w:val="${p}"/>`
        + `<w:tcBorders><w:top w:val="single" w:sz="4" w:color="${p}"/></w:tcBorders></w:tcPr>`
        + '<w:p><w:r><w:t>cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';

    return buildStoredZip([
        {
            path: 'word/document.xml',
            content: `<?xml version="1.0"?><w:document ${W} ${R}><w:body>${paragraph}${styled}${table}</w:body></w:document>`,
        },
        {
            path: 'word/_rels/document.xml.rels',
            content: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                + '<Relationship Id="rId1" Type="x" Target="javascript:alert(1)"/></Relationships>',
        },
        {
            path: 'word/styles.xml',
            content: `<?xml version="1.0"?><w:styles ${W}><w:style w:styleId="Evil">`
                + `<w:pPr><w:jc w:val="${p}"/></w:pPr>`
                + `<w:rPr><w:color w:val="${p}"/><w:rFonts w:ascii="${p}"/></w:rPr></w:style></w:styles>`,
        },
        {
            path: 'word/theme/theme1.xml',
            content: `<?xml version="1.0"?><a:theme ${A}><a:themeElements><a:clrScheme name="x">`
                + `<a:dk1><a:sysClr val="windowText" lastClr="${p}"/></a:dk1>`
                + `<a:accent1><a:srgbClr val="${p}"/></a:accent1>`
                + '</a:clrScheme></a:themeElements></a:theme>',
        },
    ]);
}
