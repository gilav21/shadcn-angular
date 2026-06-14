import { describe, it, expect } from 'vitest';
import { quantizePixels, samplePixels, extractDominantColors } from './color-extract';
import type { ExtractOptions } from './color-extract';
import type { RGBA } from './color';

function mix(r: number, g: number, b: number, count: number): RGBA[] {
    return Array.from({ length: count }, () => ({ r, g, b, a: 1 }));
}

function nearest(palette: RGBA[], target: RGBA): RGBA {
    let best = palette[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const c of palette) {
        const d = (c.r - target.r) ** 2 + (c.g - target.g) ** 2 + (c.b - target.b) ** 2;
        if (d < bestDist) {
            bestDist = d;
            best = c;
        }
    }
    return best;
}

function rgbClose(a: RGBA, b: RGBA, tolerance: number): void {
    expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(tolerance);
}

describe('quantizePixels — median-cut', () => {
    it('returns 1 color for a single-color image', () => {
        const palette = quantizePixels(mix(200, 50, 50, 100), { count: 3, algorithm: 'median-cut' });
        expect(palette.length).toBeGreaterThanOrEqual(1);
        rgbClose(palette[0], { r: 200, g: 50, b: 50, a: 1 }, 5);
    });

    it('separates dominant colors from a 2-color mix', () => {
        const pixels = [
            ...mix(255, 0, 0, 100),
            ...mix(0, 0, 255, 100),
        ];
        const palette = quantizePixels(pixels, { count: 2, algorithm: 'median-cut' });
        expect(palette).toHaveLength(2);
        rgbClose(nearest(palette, { r: 255, g: 0, b: 0, a: 1 }), { r: 255, g: 0, b: 0, a: 1 }, 5);
        rgbClose(nearest(palette, { r: 0, g: 0, b: 255, a: 1 }), { r: 0, g: 0, b: 255, a: 1 }, 5);
    });

    it('returns up to `count` colors from a 3-color mix', () => {
        const pixels = [
            ...mix(255, 0, 0, 60),
            ...mix(0, 255, 0, 60),
            ...mix(0, 0, 255, 60),
        ];
        const palette = quantizePixels(pixels, { count: 3, algorithm: 'median-cut' });
        expect(palette).toHaveLength(3);
        rgbClose(nearest(palette, { r: 255, g: 0, b: 0, a: 1 }), { r: 255, g: 0, b: 0, a: 1 }, 5);
        rgbClose(nearest(palette, { r: 0, g: 255, b: 0, a: 1 }), { r: 0, g: 255, b: 0, a: 1 }, 5);
        rgbClose(nearest(palette, { r: 0, g: 0, b: 255, a: 1 }), { r: 0, g: 0, b: 255, a: 1 }, 5);
    });

    it('returns empty array for empty input', () => {
        expect(quantizePixels([], { count: 3 })).toEqual([]);
    });
});

describe('quantizePixels — k-means', () => {
    it('separates dominant colors from a 2-color mix', () => {
        const pixels = [
            ...mix(255, 0, 0, 200),
            ...mix(0, 0, 255, 200),
        ];
        const palette = quantizePixels(pixels, { count: 2, algorithm: 'k-means' });
        expect(palette).toHaveLength(2);
        rgbClose(nearest(palette, { r: 255, g: 0, b: 0, a: 1 }), { r: 255, g: 0, b: 0, a: 1 }, 10);
        rgbClose(nearest(palette, { r: 0, g: 0, b: 255, a: 1 }), { r: 0, g: 0, b: 255, a: 1 }, 10);
    });

    it('returns single average for count=1', () => {
        const palette = quantizePixels(mix(100, 100, 100, 50), { count: 1, algorithm: 'k-means' });
        expect(palette).toHaveLength(1);
        rgbClose(palette[0], { r: 100, g: 100, b: 100, a: 1 }, 5);
    });
});

describe('quantizePixels — ignoreBackground', () => {
    it('filters out near-white and near-black pixels', () => {
        const pixels = [
            ...mix(255, 255, 255, 1000),  // background
            ...mix(0, 0, 0, 1000),         // background
            ...mix(200, 100, 50, 100),    // foreground
        ];
        const palette = quantizePixels(pixels, { count: 1, algorithm: 'median-cut', ignoreBackground: true });
        rgbClose(palette[0], { r: 200, g: 100, b: 50, a: 1 }, 5);
    });

    it('returns empty when ignoreBackground removes every pixel', () => {
        const allWhite = mix(255, 255, 255, 50);
        expect(quantizePixels(allWhite, { ignoreBackground: true })).toEqual([]);
    });
});

// --- Canvas-backed sources for samplePixels / extractDominantColors ---

const FULL_OPTS: Required<ExtractOptions> = {
    count: 4,
    algorithm: 'median-cut',
    quality: 1,
    maxEdge: 256,
    ignoreBackground: false,
};

/** A solid-color canvas of the given size. */
function solidCanvas(r: number, g: number, b: number, w = 8, h = 8): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, 0, w, h);
    return canvas;
}

/** A canvas split left/right into two solid colors. */
function twoColorCanvas(a: [number, number, number], b: [number, number, number]): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = `rgb(${a[0]}, ${a[1]}, ${a[2]})`;
    ctx.fillRect(0, 0, 8, 16);
    ctx.fillStyle = `rgb(${b[0]}, ${b[1]}, ${b[2]})`;
    ctx.fillRect(8, 0, 8, 16);
    return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

describe('samplePixels', () => {
    it('samples opaque pixels from a solid canvas', async () => {
        const canvas = solidCanvas(120, 60, 30);
        const pixels = await samplePixels(canvas, FULL_OPTS);
        expect(pixels.length).toBeGreaterThan(0);
        rgbClose(pixels[0], { r: 120, g: 60, b: 30, a: 1 }, 2);
    });

    it('downscales according to maxEdge', async () => {
        const big = solidCanvas(10, 20, 30, 100, 100);
        const pixels = await samplePixels(big, { ...FULL_OPTS, maxEdge: 10, quality: 1 });
        // 100x100 scaled to a 10px max edge -> 10x10 = 100 pixels max.
        expect(pixels.length).toBeLessThanOrEqual(100);
        rgbClose(pixels[0], { r: 10, g: 20, b: 30, a: 1 }, 3);
    });

    it('skips transparent pixels (alpha < 0.5)', async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 4;
        canvas.height = 4;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, 4, 4); // fully transparent
        const pixels = await samplePixels(canvas, { ...FULL_OPTS, quality: 1 });
        expect(pixels).toEqual([]);
    });
});

describe('extractDominantColors', () => {
    it('returns the dominant color of a solid HTMLCanvasElement', async () => {
        const canvas = solidCanvas(10, 200, 90);
        const palette = await extractDominantColors(canvas, { count: 3, quality: 1 });
        expect(palette.length).toBeGreaterThanOrEqual(1);
        rgbClose(nearest(palette, { r: 10, g: 200, b: 90, a: 1 }), { r: 10, g: 200, b: 90, a: 1 }, 4);
    });

    it('separates two regions of a canvas into distinct palette colors', async () => {
        const canvas = twoColorCanvas([220, 20, 20], [20, 20, 220]);
        const palette = await extractDominantColors(canvas, { count: 2, quality: 1 });
        expect(palette).toHaveLength(2);
        rgbClose(nearest(palette, { r: 220, g: 20, b: 20, a: 1 }), { r: 220, g: 20, b: 20, a: 1 }, 8);
        rgbClose(nearest(palette, { r: 20, g: 20, b: 220, a: 1 }), { r: 20, g: 20, b: 220, a: 1 }, 8);
    });

    it('extracts from a Blob source via createImageBitmap', async () => {
        const blob = await canvasToBlob(solidCanvas(180, 40, 140, 12, 12));
        const palette = await extractDominantColors(blob, { count: 2, quality: 1 });
        rgbClose(nearest(palette, { r: 180, g: 40, b: 140, a: 1 }), { r: 180, g: 40, b: 140, a: 1 }, 6);
    });

    it('extracts from an ImageBitmap source', async () => {
        const bitmap = await createImageBitmap(solidCanvas(70, 130, 200, 10, 10));
        const palette = await extractDominantColors(bitmap, { count: 2, quality: 1 });
        rgbClose(nearest(palette, { r: 70, g: 130, b: 200, a: 1 }), { r: 70, g: 130, b: 200, a: 1 }, 6);
    });

    it('extracts from a loaded HTMLImageElement source', async () => {
        const blob = await canvasToBlob(solidCanvas(40, 160, 80, 10, 10));
        const url = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => reject(new Error('load failed')), { once: true });
            img.src = url;
        });
        const palette = await extractDominantColors(img, { count: 2, quality: 1 });
        URL.revokeObjectURL(url);
        rgbClose(nearest(palette, { r: 40, g: 160, b: 80, a: 1 }), { r: 40, g: 160, b: 80, a: 1 }, 6);
    });

    it('extracts from a string URL source', async () => {
        const blob = await canvasToBlob(solidCanvas(200, 200, 30, 10, 10));
        const url = URL.createObjectURL(blob);
        const palette = await extractDominantColors(url, { count: 2, quality: 1 });
        URL.revokeObjectURL(url);
        rgbClose(nearest(palette, { r: 200, g: 200, b: 30, a: 1 }), { r: 200, g: 200, b: 30, a: 1 }, 6);
    });

    it('runs the k-means path end-to-end on a canvas', async () => {
        const canvas = twoColorCanvas([240, 30, 30], [30, 240, 30]);
        const palette = await extractDominantColors(canvas, { count: 2, algorithm: 'k-means', quality: 1 });
        expect(palette).toHaveLength(2);
        rgbClose(nearest(palette, { r: 240, g: 30, b: 30, a: 1 }), { r: 240, g: 30, b: 30, a: 1 }, 12);
        rgbClose(nearest(palette, { r: 30, g: 240, b: 30, a: 1 }), { r: 30, g: 240, b: 30, a: 1 }, 12);
    });
});
