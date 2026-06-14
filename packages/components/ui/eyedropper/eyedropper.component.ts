import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    inject,
    PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { cn } from '../../lib/utils';
import { createLocaleBindings, type LocaleInput } from '../../lib/i18n';
import { EYEDROPPER_LOCALES, type EyedropperLocale } from './eyedropper.locales';
import { onPointerDrag } from '../../lib/touch';
import { formatHex, type RGBA } from '../../lib/color';
import { IconComponent } from '../icon';

interface EyeDropperResult {
    sRGBHex: string;
}

type EyeDropperApi = new () => { open(): Promise<EyeDropperResult> };

type FallbackTarget = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | null;

export type EyedropperVariant = 'icon' | 'button';

/**
 * Standalone eyedropper. Prefers the native `window.EyeDropper` API
 * (available in Chromium-based browsers) and emits the picked hex
 * color via `(colorPick)`. When the native API is unavailable, an
 * optional `[fallbackTarget]` element (an `<img>`, `<canvas>`, or
 * `<video>`) enables in-page canvas-based sampling. With no native
 * API and no fallback target the button is disabled with an
 * explanatory tooltip.
 */
@Component({
    selector: 'ui-eyedropper',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [IconComponent],
    templateUrl: './eyedropper.component.html',
    host: { class: 'inline-block' },
})
export class EyedropperComponent {
    readonly class = input('');
    readonly disabled = input(false);
    /** Override for the button label / `aria-label`. Falls back to the locale's `pickColor`. */
    readonly label = input<string>();
    readonly variant = input<EyedropperVariant>('icon');

    /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
    readonly locale = input<LocaleInput<EyedropperLocale>>();
    private readonly i18n = createLocaleBindings(this.locale, EYEDROPPER_LOCALES);
    protected readonly t = this.i18n.t;
    protected readonly dir = this.i18n.dir;
    /** Effective label — explicit input wins; otherwise the locale's `pickColor`. */
    readonly resolvedLabel = computed(() => this.label() ?? this.t().pickColor ?? 'Pick color');
    /**
     * Element to sample from when the native EyeDropper API is unavailable.
     * Must be an `<img>` (with `crossorigin` set if cross-origin),
     * `<canvas>`, or `<video>`. Other elements aren't safely drawable
     * to a canvas without third-party libraries.
     */
    readonly fallbackTarget = input<FallbackTarget>(null);

    readonly colorPick = output<string>();
    readonly pickStart = output<void>();
    readonly pickCancel = output<void>();

    private readonly platformId = inject(PLATFORM_ID);
    private readonly isBrowser = isPlatformBrowser(this.platformId);

    readonly picking = signal(false);

    readonly hasNativeApi = computed(() =>
        this.isBrowser && typeof (globalThis as { EyeDropper?: unknown }).EyeDropper === 'function',
    );

    readonly isSupported = computed(() => this.hasNativeApi() || this.fallbackTarget() !== null);

    readonly isDisabled = computed(() => this.disabled() || !this.isSupported());

    readonly tooltip = computed(() =>
        this.isSupported()
            ? this.resolvedLabel()
            : (this.t().notSupported ?? 'Eyedropper not supported in this browser'),
    );

    readonly classes = computed(() =>
        cn(
            'inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background text-sm font-medium ring-offset-background transition-colors',
            'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            this.variant() === 'icon' ? 'h-9 w-9' : 'h-9 px-3',
            this.picking() && 'ring-2 ring-ring',
            this.class(),
        ),
    );

    async pick(): Promise<void> {
        if (this.isDisabled() || this.picking()) return;
        if (this.hasNativeApi()) {
            await this.pickNative();
            return;
        }
        const target = this.fallbackTarget();
        if (target) this.pickFromTarget(target);
    }

    private async pickNative(): Promise<void> {
        const ctor = (globalThis as { EyeDropper?: EyeDropperApi }).EyeDropper;
        if (!ctor) return;
        this.picking.set(true);
        this.pickStart.emit();
        try {
            const result = await new ctor().open();
            this.colorPick.emit(result.sRGBHex);
        } catch {
            this.pickCancel.emit();
        } finally {
            this.picking.set(false);
        }
    }

    private pickFromTarget(target: NonNullable<FallbackTarget>): void {
        const ctx = makeSamplingContext(target);
        if (!ctx) return;
        this.picking.set(true);
        this.pickStart.emit();
        const cleanup = installFallbackSampler(target, ctx, {
            onPick: (rgba) => {
                this.colorPick.emit(formatHex(rgba));
                this.picking.set(false);
                cleanup();
            },
            onCancel: () => {
                this.pickCancel.emit();
                this.picking.set(false);
                cleanup();
            },
        });
    }
}

interface SamplingContext {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    sourceWidth: number;
    sourceHeight: number;
}

function makeSamplingContext(target: NonNullable<FallbackTarget>): SamplingContext | null {
    const sourceWidth = naturalDimension(target, 'width');
    const sourceHeight = naturalDimension(target, 'height');
    if (sourceWidth === 0 || sourceHeight === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    try {
        ctx.drawImage(target, 0, 0, sourceWidth, sourceHeight);
    } catch {
        return null;
    }
    return { canvas, ctx, sourceWidth, sourceHeight };
}

function naturalDimension(target: NonNullable<FallbackTarget>, axis: 'width' | 'height'): number {
    if (target instanceof HTMLImageElement) {
        return axis === 'width' ? target.naturalWidth : target.naturalHeight;
    }
    if (target instanceof HTMLVideoElement) {
        return axis === 'width' ? target.videoWidth : target.videoHeight;
    }
    return axis === 'width' ? target.width : target.height;
}

interface SamplerCallbacks {
    onPick: (rgba: RGBA) => void;
    onCancel: () => void;
}

function installFallbackSampler(
    target: NonNullable<FallbackTarget>,
    sampling: SamplingContext,
    callbacks: SamplerCallbacks,
): () => void {
    const originalCursor = target.style.cursor;
    target.style.cursor = 'crosshair';
    let lastSample: RGBA | null = null;

    const sample = (clientX: number, clientY: number): RGBA | null => {
        const rect = target.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        const xRatio = (clientX - rect.left) / rect.width;
        const yRatio = (clientY - rect.top) / rect.height;
        if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) return null;
        const px = Math.min(sampling.sourceWidth - 1, Math.max(0, Math.floor(xRatio * sampling.sourceWidth)));
        const py = Math.min(sampling.sourceHeight - 1, Math.max(0, Math.floor(yRatio * sampling.sourceHeight)));
        const data = sampling.ctx.getImageData(px, py, 1, 1).data;
        return { r: data[0], g: data[1], b: data[2], a: data[3] / 255 };
    };

    const onMove = (x: number, y: number): void => {
        const s = sample(x, y);
        if (s) lastSample = s;
    };

    const onCommit = (event: Event): void => {
        const point = pointFromEvent(event as MouseEvent | TouchEvent);
        const final = point ? sample(point.x, point.y) : lastSample;
        if (final) callbacks.onPick(final);
        else callbacks.onCancel();
    };

    const onKey = (event: Event): void => {
        const key = (event as KeyboardEvent).key;
        if (key === 'Escape') {
            event.preventDefault();
            callbacks.onCancel();
        }
    };

    target.addEventListener('click', onCommit);
    target.addEventListener('touchend', onCommit);
    globalThis.addEventListener('keydown', onKey);
    const dragCleanup = onPointerDrag(onMove, () => { /* drag end is not a commit */ });

    return () => {
        target.style.cursor = originalCursor;
        target.removeEventListener('click', onCommit);
        target.removeEventListener('touchend', onCommit);
        globalThis.removeEventListener('keydown', onKey);
        dragCleanup();
    };
}

function pointFromEvent(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
    if ('clientX' in event) return { x: event.clientX, y: event.clientY };
    const touch = event.changedTouches?.[0];
    if (touch) return { x: touch.clientX, y: touch.clientY };
    return null;
}
