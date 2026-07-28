/**
 * Minimal PDF builder for testing.
 * Produces a valid PDF 1.4 document with one or more pages and configurable
 * fonts, content streams, link annotations, and an optional structure tree.
 * Shared by the parser spec suites; never shipped to consumers.
 */
export class PdfBuilder {
    private readonly objects: { num: number; content: string }[] = [];
    private nextObj = 1;
    private readonly fonts: { name: string; baseFont: string; descriptor?: string }[] = [];
    private readonly pageStreams: string[] = [];
    private readonly annotations: { page: number; rect: [number, number, number, number]; uri: string }[] = [];
    private structTreeObjNum = 0;
    private readonly pageWidth: number;
    private readonly pageHeight: number;

    constructor(width = 612, height = 792) {
        this.pageWidth = width;
        this.pageHeight = height;
    }

    addFont(name: string, baseFont: string, opts?: {
        flags?: number;
        fontWeight?: number;
        italicAngle?: number;
    }): this {
        let descriptor: string | undefined;
        if (opts) {
            const descriptorObj = this.nextObj++;
            const parts: string[] = [
                `/Type /FontDescriptor`,
                `/FontName /${baseFont}`,
            ];
            if (opts.flags !== undefined) parts.push(`/Flags ${opts.flags}`);
            if (opts.fontWeight !== undefined) parts.push(`/FontWeight ${opts.fontWeight}`);
            if (opts.italicAngle !== undefined) parts.push(`/ItalicAngle ${opts.italicAngle}`);
            this.objects.push({
                num: descriptorObj,
                content: `<< ${parts.join(' ')} >>`,
            });
            descriptor = `${descriptorObj} 0 R`;
        }
        this.fonts.push({ name, baseFont, descriptor });
        return this;
    }

    /** Sets the first page's content stream (legacy single-page API). */
    setContent(stream: string): this {
        this.pageStreams[0] = stream;
        return this;
    }

    /** Appends an additional page with its own content stream. */
    addPage(stream: string): this {
        this.pageStreams.push(stream);
        return this;
    }

    /** Adds a URI link annotation to a page (0-based index). */
    addLinkAnnotation(page: number, rect: [number, number, number, number], uri: string): this {
        this.annotations.push({ page, rect, uri });
        return this;
    }

    addStructureTree(structType: string, mcid: number): this {
        const structElemObj = this.nextObj++;
        this.objects.push({
            num: structElemObj,
            content: `<< /Type /StructElem /S /${structType} /K << /Type /MCR /MCID ${mcid} /Pg PAGE_REF >> >>`,
        });

        const structTreeObj = this.nextObj++;
        this.objects.push({
            num: structTreeObj,
            content: `<< /Type /StructTreeRoot /K ${structElemObj} 0 R >>`,
        });
        this.structTreeObjNum = structTreeObj;
        return this;
    }

    build(): ArrayBuffer {
        const catalogObj = this.nextObj++;
        const pagesObj = this.nextObj++;
        const streams = this.pageStreams.length > 0 ? this.pageStreams : [''];
        const pageObjNums = streams.map(() => this.nextObj++);
        const contentObjNums = streams.map(() => this.nextObj++);

        const fontEntries: string[] = [];
        const fontObjects: { num: number; content: string }[] = [];
        for (const font of this.fonts) {
            const fontObjNum = this.nextObj++;
            const parts = [
                `/Type /Font`,
                `/Subtype /Type1`,
                `/BaseFont /${font.baseFont}`,
            ];
            if (font.descriptor) {
                parts.push(`/FontDescriptor ${font.descriptor}`);
            }
            fontObjects.push({
                num: fontObjNum,
                content: `<< ${parts.join(' ')} >>`,
            });
            fontEntries.push(`/${font.name} ${fontObjNum} 0 R`);
        }

        const resourcesDict = fontEntries.length > 0
            ? `<< /Font << ${fontEntries.join(' ')} >> >>`
            : `<< >>`;

        const catalogParts = [`/Type /Catalog`, `/Pages ${pagesObj} 0 R`];
        if (this.structTreeObjNum > 0) {
            catalogParts.push(`/StructTreeRoot ${this.structTreeObjNum} 0 R`);
        }

        const kids = pageObjNums.map(num => `${num} 0 R`).join(' ');
        const pageObjects = streams.map((stream, i) => {
            const annots = this.annotations
                .filter(a => a.page === i)
                .map(a => `<< /Subtype /Link /Rect [${a.rect.join(' ')}] /A << /S /URI /URI (${a.uri}) >> >>`);
            const annotsEntry = annots.length > 0 ? ` /Annots [${annots.join(' ')}]` : '';
            return [
                {
                    num: pageObjNums[i],
                    content: `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] /Resources ${resourcesDict} /Contents ${contentObjNums[i]} 0 R${annotsEntry} >>`,
                },
                {
                    num: contentObjNums[i],
                    content: `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
                },
            ];
        }).flat();

        const allObjects: { num: number; content: string }[] = [
            ...this.objects,
            ...fontObjects,
            { num: catalogObj, content: `<< ${catalogParts.join(' ')} >>` },
            { num: pagesObj, content: `<< /Type /Pages /Kids [${kids}] /Count ${streams.length} >>` },
            ...pageObjects,
        ];

        allObjects.sort((a, b) => a.num - b.num);

        let body = '%PDF-1.4\n';
        const offsets = new Map<number, number>();

        for (const obj of allObjects) {
            let content = obj.content;
            if (content.includes('PAGE_REF')) {
                content = content.replaceAll('PAGE_REF', `${pageObjNums[0]} 0 R`);
            }
            offsets.set(obj.num, body.length);
            body += `${obj.num} 0 obj\n${content}\nendobj\n`;
        }

        const xrefOffset = body.length;
        const totalObjects = allObjects.length + 1;
        let xref = `xref\n0 ${totalObjects}\n`;
        xref += '0000000000 65535 f \n';
        for (let i = 1; i < totalObjects; i++) {
            const off = offsets.get(i) ?? 0;
            xref += `${String(off).padStart(10, '0')} 00000 n \n`;
        }

        const trailer = `trailer\n<< /Size ${totalObjects} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

        const fullPdf = body + xref + trailer;
        return new TextEncoder().encode(fullPdf).buffer;
    }
}
