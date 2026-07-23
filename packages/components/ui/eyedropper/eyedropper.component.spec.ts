import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EyedropperComponent } from './eyedropper.component';

interface GlobalWithEyeDropper {
    EyeDropper?: unknown;
}

function deleteNativeEyeDropper(): unknown {
    const g = globalThis as GlobalWithEyeDropper;
    const saved = g.EyeDropper;
    delete g.EyeDropper;
    return saved;
}

function restoreNativeEyeDropper(saved: unknown): void {
    if (saved !== undefined) {
        (globalThis as GlobalWithEyeDropper).EyeDropper = saved;
    }
}

function installFakeEyeDropper(response: { sRGBHex?: string; reject?: boolean }): () => void {
    const saved = deleteNativeEyeDropper();
    class FakeEyeDropper {
        open(): Promise<{ sRGBHex: string }> {
            // Reject on a later task (calling reject, never throwing) so the
            // awaiting handler is already attached: an eager Promise.reject
            // trips zone.js's unhandled-rejection tracking and a throw inside
            // a .then callback trips its task-error reporting under the jest leg.
            if (response.reject) {
                return new Promise((_resolve, reject) => setTimeout(() => reject(new Error('cancelled')), 0));
            }
            return Promise.resolve({ sRGBHex: response.sRGBHex ?? '#000000' });
        }
    }
    (globalThis as GlobalWithEyeDropper).EyeDropper = FakeEyeDropper;
    return () => {
        delete (globalThis as GlobalWithEyeDropper).EyeDropper;
        restoreNativeEyeDropper(saved);
    };
}

@Component({
    template: `
        <ui-eyedropper
            [disabled]="disabled()"
            [variant]="variant()"
            [label]="label()"
            [fallbackTarget]="fallbackTarget()"
            (colorPick)="onPick($event)"
            (pickStart)="started.set(started() + 1)"
            (pickCancel)="cancelled.set(cancelled() + 1)"
        />
    `,
    imports: [EyedropperComponent],
})
class EyedropperHostComponent {
    disabled = signal(false);
    variant = signal<'icon' | 'button'>('icon');
    label = signal('Pick color');
    fallbackTarget = signal<HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | null>(null);
    picked = signal<string | null>(null);
    started = signal(0);
    cancelled = signal(0);
    onPick(hex: string): void {
        this.picked.set(hex);
    }
}

describe('EyedropperComponent', () => {
    let fixture: ComponentFixture<EyedropperHostComponent>;
    let host: EyedropperHostComponent;
    let originalEyeDropper: unknown;

    beforeEach(() => {
        originalEyeDropper = (globalThis as GlobalWithEyeDropper).EyeDropper;
    });

    afterEach(() => {
        restoreNativeEyeDropper(originalEyeDropper);
    });

    function setup(): void {
        TestBed.configureTestingModule({ imports: [EyedropperHostComponent] });
        fixture = TestBed.createComponent(EyedropperHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    }

    function button(): HTMLButtonElement {
        return fixture.debugElement.query(By.css('button[data-slot="eyedropper-trigger"]')).nativeElement;
    }

    it('renders the trigger button', () => {
        deleteNativeEyeDropper();
        setup();
        expect(button()).toBeTruthy();
    });

    it('is disabled when native API absent and no fallback target', () => {
        deleteNativeEyeDropper();
        setup();
        expect(button().disabled).toBe(true);
    });

    it('is enabled when native EyeDropper exists', () => {
        const restore = installFakeEyeDropper({ sRGBHex: '#abcdef' });
        setup();
        expect(button().disabled).toBe(false);
        restore();
    });

    it('emits colorPick with the native API result', async () => {
        const restore = installFakeEyeDropper({ sRGBHex: '#abcdef' });
        setup();
        button().click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        fixture.detectChanges();
        expect(host.picked()).toBe('#abcdef');
        expect(host.started()).toBe(1);
        restore();
    });

    it('emits pickCancel when the native API rejects', async () => {
        const restore = installFakeEyeDropper({ reject: true });
        setup();
        button().click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        fixture.detectChanges();
        expect(host.cancelled()).toBe(1);
        expect(host.picked()).toBeNull();
        restore();
    });

    it('renders only icon when variant=icon', () => {
        deleteNativeEyeDropper();
        setup();
        expect(button().textContent?.trim()).toBe('');
    });

    it('renders label text when variant=button', () => {
        deleteNativeEyeDropper();
        setup();
        host.variant.set('button');
        host.label.set('Sample color');
        fixture.detectChanges();
        expect(button().textContent?.trim()).toBe('Sample color');
    });

    it('forwards disabled input to button regardless of API support', () => {
        const restore = installFakeEyeDropper({ sRGBHex: '#000000' });
        setup();
        host.disabled.set(true);
        fixture.detectChanges();
        expect(button().disabled).toBe(true);
        restore();
    });

    it('exposes aria-pressed=false initially', () => {
        deleteNativeEyeDropper();
        setup();
        expect(button().getAttribute('aria-pressed')).toBe('false');
    });

    it('is enabled when a fallback target is provided even without native API', () => {
        deleteNativeEyeDropper();
        setup();
        const img = document.createElement('img');
        host.fallbackTarget.set(img);
        fixture.detectChanges();
        expect(button().disabled).toBe(false);
    });
});

/**
 * The fallback sampler relies on `<canvas>` 2D rendering (`getContext`,
 * `drawImage`, `getImageData`) which jsdom does not implement. We stub
 * `HTMLCanvasElement.prototype.getContext` with a controllable fake so the
 * sampler's logic (coordinate math, commit/cancel, cleanup) runs headlessly.
 */
type CanvasStubMode = 'ok' | 'nullContext' | 'throwDraw';

interface CanvasContextStub {
    mode: CanvasStubMode;
    restore(): void;
}

function stubCanvasContext(): CanvasContextStub {
    const proto = HTMLCanvasElement.prototype as unknown as {
        getContext: (...args: unknown[]) => unknown;
    };
    const original = proto.getContext;
    const stub: CanvasContextStub = {
        mode: 'ok',
        restore(): void {
            proto.getContext = original;
        },
    };
    proto.getContext = function (): unknown {
        if (stub.mode === 'nullContext') return null;
        return {
            fillStyle: '',
            fillRect: (): void => { /* noop */ },
            drawImage: (): void => {
                if (stub.mode === 'throwDraw') throw new Error('tainted canvas');
            },
            getImageData: (): { data: Uint8ClampedArray } => ({
                data: new Uint8ClampedArray([255, 0, 0, 255]),
            }),
        };
    };
    return stub;
}

const ON_SCREEN_RECT: DOMRect = {
    left: 100, top: 100, right: 200, bottom: 200, width: 100, height: 100, x: 100, y: 100,
} as DOMRect;

describe('EyedropperComponent — canvas fallback sampler', () => {
    let fixture: ComponentFixture<EyedropperHostComponent>;
    let host: EyedropperHostComponent;
    let originalEyeDropper: unknown;
    let canvasStub: CanvasContextStub;
    let canvas: HTMLCanvasElement;

    function button(): HTMLButtonElement {
        return fixture.debugElement.query(By.css('button[data-slot="eyedropper-trigger"]')).nativeElement;
    }

    function clickTrigger(): void {
        button().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }

    /** A 10×10 canvas with a deterministic on-screen rect (context is stubbed). */
    function fakeCanvas(): HTMLCanvasElement {
        const c = document.createElement('canvas');
        c.width = 10;
        c.height = 10;
        c.getBoundingClientRect = (): DOMRect => ON_SCREEN_RECT;
        return c;
    }

    function setupWithTarget(target: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement | null): void {
        deleteNativeEyeDropper();
        TestBed.configureTestingModule({ imports: [EyedropperHostComponent] });
        fixture = TestBed.createComponent(EyedropperHostComponent);
        host = fixture.componentInstance;
        host.fallbackTarget.set(target);
        fixture.detectChanges();
    }

    beforeEach(() => {
        originalEyeDropper = (globalThis as GlobalWithEyeDropper).EyeDropper;
        canvasStub = stubCanvasContext();
        canvas = fakeCanvas();
        document.body.appendChild(canvas);
    });

    afterEach(() => {
        // End any still-active sampling session so its global keydown/mousemove
        // listeners are removed before the next test (prevents emits into a destroyed
        // component — NG0953 — when a later test dispatches a window event).
        globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        if (fixture && !fixture.componentRef.hostView.destroyed) fixture.destroy();
        restoreNativeEyeDropper(originalEyeDropper);
        canvasStub.restore();
        canvas.remove();
    });

    it('emits pickStart and enters picking state when the fallback pick begins', () => {
        setupWithTarget(canvas);
        clickTrigger();
        fixture.detectChanges();
        expect(host.started()).toBe(1);
        expect(button().getAttribute('aria-pressed')).toBe('true');
    });

    it('sets a crosshair cursor on the target while sampling', () => {
        setupWithTarget(canvas);
        clickTrigger();
        expect(canvas.style.cursor).toBe('crosshair');
    });

    it('emits colorPick with the sampled hex on click and restores state', () => {
        setupWithTarget(canvas);
        clickTrigger();
        // Click at the centre of the (stubbed) on-screen rect.
        canvas.dispatchEvent(new MouseEvent('click', { clientX: 150, clientY: 150, bubbles: true }));
        expect(host.picked()).toBe('#ff0000');
        expect(host.started()).toBe(1);
        expect(button().getAttribute('aria-pressed')).toBe('false');
        // Cursor restored after commit.
        expect(canvas.style.cursor).toBe('');
    });

    it('samples the position tracked from a window mousemove when the commit has no coordinates', () => {
        setupWithTarget(canvas);
        clickTrigger();
        // Drag updates lastSample via the window mousemove listener.
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 150 }));
        // A bare touchend (no changedTouches coords) commits the tracked sample.
        canvas.dispatchEvent(new Event('touchend', { bubbles: true }));
        expect(host.picked()).toBe('#ff0000');
    });

    it('samples from a touchend that carries changedTouches coordinates', () => {
        setupWithTarget(canvas);
        clickTrigger();
        const touchend = new Event('touchend', { bubbles: true });
        Object.defineProperty(touchend, 'changedTouches', { value: [{ clientX: 150, clientY: 150 }] });
        canvas.dispatchEvent(touchend);
        expect(host.picked()).toBe('#ff0000');
    });

    it('cancels (no colorPick) when committing outside the target bounds', () => {
        setupWithTarget(canvas);
        clickTrigger();
        canvas.dispatchEvent(new MouseEvent('click', { clientX: 9999, clientY: 9999, bubbles: true }));
        expect(host.picked()).toBeNull();
        expect(host.cancelled()).toBe(1);
        expect(button().getAttribute('aria-pressed')).toBe('false');
    });

    it('cancels when Escape is pressed during sampling', () => {
        setupWithTarget(canvas);
        clickTrigger();
        globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(host.cancelled()).toBe(1);
        expect(host.picked()).toBeNull();
    });

    it('ignores non-Escape keys during sampling', () => {
        setupWithTarget(canvas);
        clickTrigger();
        globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
        fixture.detectChanges();
        expect(host.cancelled()).toBe(0);
        expect(button().getAttribute('aria-pressed')).toBe('true');
    });

    it('does not start sampling when the canvas has zero source dimensions', () => {
        const empty = document.createElement('canvas');
        empty.width = 0;
        empty.height = 0;
        setupWithTarget(empty);
        clickTrigger();
        // makeSamplingContext returns null → no pick session begins.
        expect(host.started()).toBe(0);
        expect(button().getAttribute('aria-pressed')).toBe('false');
    });

    it('does not start sampling when a 2D context cannot be created', () => {
        setupWithTarget(canvas);
        canvasStub.mode = 'nullContext';
        clickTrigger();
        expect(host.started()).toBe(0);
        expect(button().getAttribute('aria-pressed')).toBe('false');
    });

    it('does not start sampling when the source is tainted and drawImage throws', () => {
        setupWithTarget(canvas);
        canvasStub.mode = 'throwDraw';
        clickTrigger();
        expect(host.started()).toBe(0);
        expect(button().getAttribute('aria-pressed')).toBe('false');
    });

    it('samples an image fallback target using its natural dimensions', () => {
        const img = document.createElement('img');
        Object.defineProperty(img, 'naturalWidth', { value: 10 });
        Object.defineProperty(img, 'naturalHeight', { value: 10 });
        img.getBoundingClientRect = (): DOMRect =>
            ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0 }) as DOMRect;
        img.src = 'about:blank';
        document.body.appendChild(img);
        setupWithTarget(img);
        clickTrigger();
        // naturalDimension(img) returned 10×10 → a sampling context was created.
        expect(host.started()).toBe(1);
        img.remove();
    });

    it('samples a video fallback target using its video dimensions', () => {
        const video = document.createElement('video');
        Object.defineProperty(video, 'videoWidth', { value: 10 });
        Object.defineProperty(video, 'videoHeight', { value: 10 });
        video.getBoundingClientRect = (): DOMRect => ON_SCREEN_RECT;
        document.body.appendChild(video);
        setupWithTarget(video);
        clickTrigger();
        // naturalDimension(video) returned 10×10 → a sampling context was created.
        expect(host.started()).toBe(1);
        video.dispatchEvent(new MouseEvent('click', { clientX: 150, clientY: 150, bubbles: true }));
        expect(host.picked()).toBe('#ff0000');
        video.remove();
    });
});

describe('EyedropperComponent — i18n integration', () => {
    async function setup(opts: { locale?: string; providerLocale?: string } = {}) {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [EyedropperComponent],
            providers: opts.providerLocale ? [provideUiLocale(opts.providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(EyedropperComponent);
        if (opts.locale) fixture.componentRef.setInput('locale', opts.locale);
        fixture.detectChanges();
        return fixture;
    }

    it('defaults button aria-label to English "Pick color"', async () => {
        const fixture = await setup();
        const button = fixture.nativeElement.querySelector('[data-slot="eyedropper-trigger"]');
        expect(button.getAttribute('aria-label')).toBe('Pick color');
    });

    it('localises button aria-label and applies dir="rtl" when locale="he"', async () => {
        const fixture = await setup({ locale: 'he' });
        const button = fixture.nativeElement.querySelector('[data-slot="eyedropper-trigger"]');
        expect(button.getAttribute('aria-label')).toBe('בחר צבע');
        expect(button.getAttribute('dir')).toBe('rtl');
    });

    it('explicit label input wins over the locale', async () => {
        const fixture = await setup({ locale: 'he' });
        fixture.componentRef.setInput('label', 'CUSTOM_LABEL');
        fixture.detectChanges();
        const button = fixture.nativeElement.querySelector('[data-slot="eyedropper-trigger"]');
        expect(button.getAttribute('aria-label')).toBe('CUSTOM_LABEL');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup({ providerLocale: 'fr' });
        const button = fixture.nativeElement.querySelector('[data-slot="eyedropper-trigger"]');
        expect(button.getAttribute('aria-label')).toBe('Choisir une couleur');
    });
});
