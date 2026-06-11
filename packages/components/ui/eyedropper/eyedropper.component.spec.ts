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
