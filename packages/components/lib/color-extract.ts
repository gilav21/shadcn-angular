/**
 * Image-based dominant color extraction.
 *
 * Two algorithms supported:
 *   - `median-cut` (default): the classic Leptonica / Color Thief approach.
 *     Recursively splits the longest axis of a 3D RGB box at the median.
 *     Fast, deterministic, good quality.
 *   - `k-means`: k-means++ initialization, iterates until convergence.
 *     Slower but produces smoother perceptual grouping for posters / photos.
 *
 * Pure functions — accepts URL / Blob / File / HTMLImageElement /
 * HTMLCanvasElement / ImageBitmap. Sampling is decoupled from quantization
 * so callers can provide their own pixel arrays via `quantizePixels`.
 */

import type { RGBA } from './color';

export type ExtractAlgorithm = 'median-cut' | 'k-means';

export interface ExtractOptions {
    /** Number of colors to return. Default 6. */
    count?: number;
    /** Algorithm. Default 'median-cut'. */
    algorithm?: ExtractAlgorithm;
    /** Sample every Nth pixel for speed. Default 10. */
    quality?: number;
    /** Max edge of working canvas in pixels (further downscale). Default 256. */
    maxEdge?: number;
    /** Drop near-white / near-black pixels before quantizing. Default false. */
    ignoreBackground?: boolean;
}

export type ImageSource =
    | string
    | Blob
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap;

const DEFAULTS: Required<ExtractOptions> = {
    count: 6,
    algorithm: 'median-cut',
    quality: 10,
    maxEdge: 256,
    ignoreBackground: false,
};

function withDefaults(opts: ExtractOptions | undefined): Required<ExtractOptions> {
    return opts ? { ...DEFAULTS, ...opts } : { ...DEFAULTS };
}

/**
 * Extract a palette of dominant colors from an image source.
 *
 * @example
 * ```ts
 * const palette = await extractDominantColors(imageElement, { count: 5 });
 * // palette: [{ r, g, b, a: 1 }, ...]
 * ```
 */
export async function extractDominantColors(
    source: ImageSource,
    opts?: ExtractOptions,
): Promise<RGBA[]> {
    const resolved = withDefaults(opts);
    const pixels = await samplePixels(source, resolved);
    return quantizePixels(pixels, resolved);
}

/**
 * Lower-level: quantize a pre-sampled pixel array.
 * Useful for testing and for callers that already have pixel data.
 */
export function quantizePixels(pixels: RGBA[], opts?: ExtractOptions): RGBA[] {
    const resolved = withDefaults(opts);
    const filtered = resolved.ignoreBackground ? pixels.filter(notNearGrayscaleExtreme) : pixels;
    if (filtered.length === 0) return [];
    if (resolved.algorithm === 'k-means') {
        return kmeansPalette(filtered, resolved.count);
    }
    return medianCutPalette(filtered, resolved.count);
}

function notNearGrayscaleExtreme(p: RGBA): boolean {
    const avg = (p.r + p.g + p.b) / 3;
    return avg > 18 && avg < 240;
}

/**
 * Load any supported source, downscale to maxEdge, and sample pixels
 * at the given stride. Returns flat RGBA array.
 */
export async function samplePixels(
    source: ImageSource,
    opts: Required<ExtractOptions>,
): Promise<RGBA[]> {
    const bitmap = await sourceToBitmap(source);
    const { canvas, ctx } = makeWorkingCanvas(bitmap.width, bitmap.height, opts.maxEdge);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if ('close' in bitmap && typeof bitmap.close === 'function') {
        bitmap.close();
    }
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return stridePixels(data, opts.quality);
}

interface DrawableSource {
    width: number;
    height: number;
    close?: () => void;
}

async function sourceToBitmap(source: ImageSource): Promise<ImageBitmap | HTMLImageElement | HTMLCanvasElement> {
    if (typeof source === 'string') {
        const response = await fetch(source);
        const blob = await response.blob();
        return await createImageBitmap(blob);
    }
    if (source instanceof Blob) {
        return await createImageBitmap(source);
    }
    if (source instanceof HTMLImageElement) {
        if (!source.complete) {
            await new Promise<void>((resolve, reject) => {
                source.addEventListener('load', () => resolve(), { once: true });
                source.addEventListener('error', () => reject(new Error('Image failed to load')), { once: true });
            });
        }
        return source;
    }
    return source;
}

function makeWorkingCanvas(srcW: number, srcH: number, maxEdge: number): {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
} {
    const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    return { canvas, ctx };
}

function stridePixels(data: Uint8ClampedArray, quality: number): RGBA[] {
    const stride = Math.max(1, Math.floor(quality)) * 4;
    const out: RGBA[] = [];
    for (let i = 0; i < data.length; i += stride) {
        const a = data[i + 3] / 255;
        if (a < 0.5) continue;
        out.push({ r: data[i], g: data[i + 1], b: data[i + 2], a: 1 });
    }
    return out;
}

interface VBox {
    pixels: RGBA[];
    rMin: number; rMax: number;
    gMin: number; gMax: number;
    bMin: number; bMax: number;
}

function makeVBox(pixels: RGBA[]): VBox {
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (const p of pixels) {
        if (p.r < rMin) rMin = p.r;
        if (p.r > rMax) rMax = p.r;
        if (p.g < gMin) gMin = p.g;
        if (p.g > gMax) gMax = p.g;
        if (p.b < bMin) bMin = p.b;
        if (p.b > bMax) bMax = p.b;
    }
    return { pixels, rMin, rMax, gMin, gMax, bMin, bMax };
}

function vboxLongestAxis(box: VBox): 'r' | 'g' | 'b' {
    const dr = box.rMax - box.rMin;
    const dg = box.gMax - box.gMin;
    const db = box.bMax - box.bMin;
    if (dr >= dg && dr >= db) return 'r';
    if (dg >= db) return 'g';
    return 'b';
}

function vboxVolume(box: VBox): number {
    return (box.rMax - box.rMin + 1) * (box.gMax - box.gMin + 1) * (box.bMax - box.bMin + 1);
}

function splitVBox(box: VBox): [VBox, VBox] | null {
    if (box.pixels.length < 2) return null;
    const axis = vboxLongestAxis(box);
    const [min, max] = axisRange(box, axis);
    if (max === min) return null;
    const midValue = (min + max) / 2;
    const left: RGBA[] = [];
    const right: RGBA[] = [];
    for (const p of box.pixels) {
        if (p[axis] <= midValue) left.push(p);
        else right.push(p);
    }
    if (left.length === 0 || right.length === 0) return null;
    return [makeVBox(left), makeVBox(right)];
}

function axisRange(box: VBox, axis: 'r' | 'g' | 'b'): [number, number] {
    if (axis === 'r') return [box.rMin, box.rMax];
    if (axis === 'g') return [box.gMin, box.gMax];
    return [box.bMin, box.bMax];
}

function medianCutPalette(pixels: RGBA[], count: number): RGBA[] {
    if (count <= 1) return [averageColor(pixels)];
    let boxes: VBox[] = [makeVBox(pixels)];
    while (boxes.length < count) {
        boxes.sort((a, b) => vboxVolume(b) * b.pixels.length - vboxVolume(a) * a.pixels.length);
        const target = boxes.shift();
        if (!target) break;
        const split = splitVBox(target);
        if (!split) {
            boxes.push(target);
            break;
        }
        boxes.push(split[0], split[1]);
    }
    return boxes.map(b => averageColor(b.pixels));
}

function averageColor(pixels: RGBA[]): RGBA {
    let r = 0, g = 0, b = 0;
    for (const p of pixels) {
        r += p.r;
        g += p.g;
        b += p.b;
    }
    const n = pixels.length;
    return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n), a: 1 };
}

const KMEANS_MAX_ITER = 20;
const KMEANS_CONVERGE_EPS = 1;

function kmeansPalette(pixels: RGBA[], count: number): RGBA[] {
    if (count <= 1) return [averageColor(pixels)];
    let centroids = kmeansInit(pixels, count);
    for (let iter = 0; iter < KMEANS_MAX_ITER; iter++) {
        const clusters = kmeansAssign(pixels, centroids);
        const next = kmeansUpdate(clusters, centroids);
        if (centroidsConverged(centroids, next)) {
            centroids = next;
            break;
        }
        centroids = next;
    }
    return centroids;
}

function kmeansInit(pixels: RGBA[], k: number): RGBA[] {
    const centroids: RGBA[] = [pixels[Math.floor(Math.random() * pixels.length)]];
    while (centroids.length < k) {
        const distances = pixels.map(p => minSquaredDistance(p, centroids));
        const total = distances.reduce((acc, d) => acc + d, 0);
        if (total === 0) {
            centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);
            continue;
        }
        const target = Math.random() * total;
        let cumulative = 0;
        for (let i = 0; i < pixels.length; i++) {
            cumulative += distances[i];
            if (cumulative >= target) {
                centroids.push(pixels[i]);
                break;
            }
        }
    }
    return centroids;
}

function minSquaredDistance(p: RGBA, centroids: RGBA[]): number {
    let min = Number.POSITIVE_INFINITY;
    for (const c of centroids) {
        const d = squaredDistance(p, c);
        if (d < min) min = d;
    }
    return min;
}

function squaredDistance(a: RGBA, b: RGBA): number {
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return dr * dr + dg * dg + db * db;
}

function kmeansAssign(pixels: RGBA[], centroids: RGBA[]): RGBA[][] {
    const clusters: RGBA[][] = centroids.map(() => []);
    for (const p of pixels) {
        let best = 0;
        let bestDist = Number.POSITIVE_INFINITY;
        for (let i = 0; i < centroids.length; i++) {
            const d = squaredDistance(p, centroids[i]);
            if (d < bestDist) {
                bestDist = d;
                best = i;
            }
        }
        clusters[best].push(p);
    }
    return clusters;
}

function kmeansUpdate(clusters: RGBA[][], prev: RGBA[]): RGBA[] {
    return clusters.map((cluster, i) => (cluster.length === 0 ? prev[i] : averageColor(cluster)));
}

function centroidsConverged(prev: RGBA[], next: RGBA[]): boolean {
    for (let i = 0; i < prev.length; i++) {
        const d = Math.sqrt(squaredDistance(prev[i], next[i]));
        if (d > KMEANS_CONVERGE_EPS) return false;
    }
    return true;
}
