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
            if (response.reject) return Promise.reject(new Error('cancelled'));
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

describe('EyedropperComponent — canvas fallback sampler', () => {
    let fixture: ComponentFixture<EyedropperHostComponent>;
    let host: EyedropperHostComponent;
    let originalEyeDropper: unknown;
    let canvas: HTMLCanvasElement;

    function button(): HTMLButtonElement {
        return fixture.debugElement.query(By.css('button[data-slot="eyedropper-trigger"]')).nativeElement;
    }

    /** A 10×10 canvas painted a solid colour, with a deterministic on-screen rect. */
    function paintedCanvas(rgb: [number, number, number]): HTMLCanvasElement {
        const c = document.createElement('canvas');
        c.width = 10;
        c.height = 10;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        ctx.fillRect(0, 0, 10, 10);
        c.getBoundingClientRect = () =>
            ({ left: 100, top: 100, right: 200, bottom: 200, width: 100, height: 100, x: 100, y: 100 }) as DOMRect;
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
        canvas = paintedCanvas([255, 0, 0]);
        document.body.appendChild(canvas);
    });

    afterEach(() => {
        // End any still-active sampling session so its global keydown/mousemove
        // listeners are removed before the next test (prevents emits into a destroyed
        // component — NG0953 — when a later test dispatches a window event).
        globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        if (fixture && !fixture.componentRef.hostView.destroyed) fixture.destroy();
        restoreNativeEyeDropper(originalEyeDropper);
        canvas.remove();
    });

    it('emits pickStart and enters picking state when the fallback pick begins', () => {
        setupWithTarget(canvas);
        button().click();
        fixture.detectChanges();
        expect(host.started()).toBe(1);
        expect(button().getAttribute('aria-pressed')).toBe('true');
    });

    it('sets a crosshair cursor on the target while sampling', () => {
        setupWithTarget(canvas);
        button().click();
        expect(canvas.style.cursor).toBe('crosshair');
    });

    it('emits colorPick with the sampled hex on click and restores state', () => {
        setupWithTarget(canvas);
        button().click();
        // Click at the centre of the (stubbed) on-screen rect.
        canvas.dispatchEvent(new MouseEvent('click', { clientX: 150, clientY: 150, bubbles: true }));
        expect(host.picked()).toBe('#ff0000');
        expect(host.started()).toBe(1);
        expect(button().getAttribute('aria-pressed')).toBe('false');
        // Cursor restored after commit.
        expect(canvas.style.cursor).toBe('');
    });

    it('samples the position tracked from a window mousemove when the commit has no coordinates', () => {
        canvas.remove();
        canvas = paintedCanvas([0, 128, 255]);
        document.body.appendChild(canvas);
        setupWithTarget(canvas);
        button().click();
        // Drag updates lastSample via the window mousemove listener.
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 150 }));
        // A bare touchend (no changedTouches coords) commits the tracked sample.
        canvas.dispatchEvent(new Event('touchend', { bubbles: true }));
        expect(host.picked()).toBe('#0080ff');
    });

    it('cancels (no colorPick) when committing outside the target bounds', () => {
        setupWithTarget(canvas);
        button().click();
        canvas.dispatchEvent(new MouseEvent('click', { clientX: 9999, clientY: 9999, bubbles: true }));
        expect(host.picked()).toBeNull();
        expect(host.cancelled()).toBe(1);
        expect(button().getAttribute('aria-pressed')).toBe('false');
    });

    it('cancels when Escape is pressed during sampling', () => {
        setupWithTarget(canvas);
        button().click();
        globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(host.cancelled()).toBe(1);
        expect(host.picked()).toBeNull();
    });

    it('ignores non-Escape keys during sampling', () => {
        setupWithTarget(canvas);
        button().click();
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
        button().click();
        // makeSamplingContext returns null → no pick session begins.
        expect(host.started()).toBe(0);
        expect(button().getAttribute('aria-pressed')).toBe('false');
    });

    it('samples an image fallback target using its natural dimensions', () => {
        // A canvas drawn as the image source is drawable; use a canvas-backed data URL.
        const dataUrl = canvas.toDataURL();
        const img = document.createElement('img');
        Object.defineProperty(img, 'naturalWidth', { value: 10 });
        Object.defineProperty(img, 'naturalHeight', { value: 10 });
        img.getBoundingClientRect = () =>
            ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0 }) as DOMRect;
        img.src = dataUrl;
        document.body.appendChild(img);
        setupWithTarget(img);
        button().click();
        // naturalDimension(img) returned 10×10 → a sampling context was created.
        expect(host.started()).toBe(1);
        img.remove();
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
