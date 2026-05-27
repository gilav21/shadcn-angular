import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ColorPickerComponent } from './color-picker.component';

@Component({
    template: `
        <div [dir]="dir()">
            <ui-color-picker
                [ngModel]="color()"
                (ngModelChange)="color.set($event)"
                [presets]="presets()"
                [disabled]="disabled()"
                [alpha]="alpha()"
                [showHarmonies]="showHarmonies()"
                [showContrast]="showContrast()"
                [contrastBackground]="contrastBackground()"
                [enableImagePick]="enableImagePick()"
                [enableEyedropper]="enableEyedropper()"
                [formats]="formats()"
                [maxRecent]="maxRecent()"
            />
        </div>
    `,
    imports: [ColorPickerComponent, FormsModule],
})
class ColorPickerTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
    color = signal('#3b82f6');
    presets = signal<string[]>(['#ef4444', '#22c55e', '#3b82f6']);
    disabled = signal(false);
    alpha = signal(false);
    showHarmonies = signal(false);
    showContrast = signal(false);
    contrastBackground = signal('#ffffff');
    enableImagePick = signal(false);
    enableEyedropper = signal(true);
    formats = signal<readonly ('hex' | 'rgb' | 'hsl' | 'oklch')[]>(['hex', 'rgb', 'hsl']);
    maxRecent = signal(8);
}

function stubAreaRect(picker: ColorPickerComponent): HTMLDivElement {
    const area = picker.colorArea()!.nativeElement;
    (area as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () => ({
        left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);
    return area;
}

async function openAndGetPicker(
    fixture: ComponentFixture<ColorPickerTestHostComponent>,
): Promise<ColorPickerComponent> {
    const trigger = fixture.debugElement.query(By.css('button'));
    trigger.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.debugElement.query(By.directive(ColorPickerComponent)).componentInstance as ColorPickerComponent;
}

describe('ColorPickerComponent', () => {
    let fixture: ComponentFixture<ColorPickerTestHostComponent>;
    let host: ColorPickerTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [ColorPickerTestHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(ColorPickerTestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
    });

    describe('Basic Rendering', () => {
        it('renders the picker', () => {
            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent));
            expect(picker).toBeTruthy();
        });

        it('renders the trigger swatch', () => {
            const swatch = fixture.debugElement.query(By.css('[style*="background"]'));
            expect(swatch).toBeTruthy();
        });
    });

    describe('Popover', () => {
        it('opens on trigger click', async () => {
            const trigger = fixture.debugElement.query(By.css('button'));
            trigger.nativeElement.click();
            fixture.detectChanges();
            await fixture.whenStable();
            const popoverContent = fixture.debugElement.query(By.css('ui-popover-content'));
            expect(popoverContent).toBeTruthy();
        });
    });

    describe('Color selection', () => {
        it('applies a preset color', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.selectPreset('#ef4444');
            fixture.detectChanges();
            await fixture.whenStable();
            expect(host.color()).toBe('#ef4444');
        });

        it('parses hex via onHexInput', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.onHexInput('#ff0000');
            fixture.detectChanges();
            expect(host.color()).toBe('#ff0000');
        });

        it('ignores invalid hex input', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.onHexInput('invalid');
            fixture.detectChanges();
            expect(host.color()).toBe('#3b82f6');
        });

        it('updates color via RGB channel input', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.onRgbChange('r', 255);
            picker.onRgbChange('g', 0);
            picker.onRgbChange('b', 0);
            fixture.detectChanges();
            expect(host.color()).toBe('#ff0000');
        });

        it('clamps RGB to 0..255', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.onRgbChange('r', 500);
            fixture.detectChanges();
            expect(picker.rgb().r).toBeLessThanOrEqual(255);
            picker.onRgbChange('r', -100);
            fixture.detectChanges();
            expect(picker.rgb().r).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Saturation/Value area', () => {
        it('top-left selects white', async () => {
            const picker = await openAndGetPicker(fixture);
            stubAreaRect(picker);
            (picker as unknown as { updateFromAreaPosition: (x: number, y: number) => void })
                .updateFromAreaPosition(0, 0);
            fixture.detectChanges();
            expect(picker.saturation()).toBe(0);
            expect(picker.value()).toBe(100);
            expect(picker.currentColor()).toBe('#ffffff');
        });

        it('top-right selects pure hue', async () => {
            const picker = await openAndGetPicker(fixture);
            stubAreaRect(picker);
            picker.hue.set(0);
            (picker as unknown as { updateFromAreaPosition: (x: number, y: number) => void })
                .updateFromAreaPosition(200, 0);
            fixture.detectChanges();
            expect(picker.currentColor()).toBe('#ff0000');
        });

        it('bottom selects black', async () => {
            const picker = await openAndGetPicker(fixture);
            stubAreaRect(picker);
            (picker as unknown as { updateFromAreaPosition: (x: number, y: number) => void })
                .updateFromAreaPosition(100, 100);
            fixture.detectChanges();
            expect(picker.currentColor()).toBe('#000000');
        });
    });

    describe('Keyboard nav on SV area', () => {
        it('ArrowRight increases saturation', async () => {
            const picker = await openAndGetPicker(fixture);
            const startS = picker.saturation();
            picker.onAreaKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
            expect(picker.saturation()).toBe(Math.min(100, startS + 1));
        });

        it('Shift+ArrowDown decreases value by 10', async () => {
            const picker = await openAndGetPicker(fixture);
            const startV = picker.value();
            picker.onAreaKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true }));
            expect(picker.value()).toBe(Math.max(0, startV - 10));
        });

        it('Home clamps saturation to 0', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.saturation.set(50);
            picker.onAreaKeyDown(new KeyboardEvent('keydown', { key: 'Home' }));
            expect(picker.saturation()).toBe(0);
        });
    });

    describe('Disabled state', () => {
        beforeEach(async () => {
            host.disabled.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('disables trigger', () => {
            const trigger = fixture.debugElement.query(By.css('button'));
            expect(trigger.nativeElement.disabled).toBe(true);
        });

        it('applies opacity class', () => {
            const trigger = fixture.debugElement.query(By.css('button'));
            expect(trigger.nativeElement.className).toContain('opacity-50');
        });
    });

    describe('Presets', () => {
        it('renders all preset swatches', async () => {
            await openAndGetPicker(fixture);
            const presetButtons = fixture.debugElement.queryAll(By.css('[aria-label^="Select #"]'));
            expect(presetButtons.length).toBe(3);
        });
    });

    describe('Alpha channel', () => {
        beforeEach(async () => {
            host.alpha.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('emits 8-char hex when alpha < 1', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.setAlpha(0.5);
            fixture.detectChanges();
            await fixture.whenStable();
            expect(host.color()).toMatch(/^#[0-9a-f]{8}$/);
        });

        it('emits 6-char hex when alpha === 1', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.setAlpha(1);
            fixture.detectChanges();
            await fixture.whenStable();
            expect(host.color()).toMatch(/^#[0-9a-f]{6}$/);
        });
    });

    describe('Recent colors', () => {
        it('records a preset selection in recents', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.selectPreset('#ef4444');
            fixture.detectChanges();
            expect(picker.recents()).toContain('#ef4444');
        });

        it('dedupes recent entries', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.selectPreset('#ef4444');
            picker.selectPreset('#22c55e');
            picker.selectPreset('#ef4444');
            fixture.detectChanges();
            const count = picker.recents().filter(c => c === '#ef4444').length;
            expect(count).toBe(1);
            expect(picker.recents()[0]).toBe('#ef4444');
        });

        it('caps recents at maxRecent', async () => {
            host.maxRecent.set(2);
            fixture.detectChanges();
            const picker = await openAndGetPicker(fixture);
            picker.selectPreset('#111111');
            picker.selectPreset('#222222');
            picker.selectPreset('#333333');
            fixture.detectChanges();
            expect(picker.recents().length).toBe(2);
            expect(picker.recents()).toContain('#333333');
            expect(picker.recents()).not.toContain('#111111');
        });
    });

    describe('Harmonies', () => {
        it('exposes harmony groups only when showHarmonies is true', async () => {
            const picker = await openAndGetPicker(fixture);
            expect(picker.harmonyGroups().length).toBe(0);
            host.showHarmonies.set(true);
            fixture.detectChanges();
            const groups = picker.harmonyGroups();
            expect(groups.length).toBe(5);
            expect(groups.map(g => g.label)).toEqual([
                'Readable',
                'Opposite',
                'Neighbors',
                'Trio',
                'Quartet',
            ]);
        });

        it('Readable row recommends black first for a light color', async () => {
            host.showHarmonies.set(true);
            fixture.detectChanges();
            const picker = await openAndGetPicker(fixture);
            picker.selectPreset('#ffff00');
            fixture.detectChanges();
            const readable = picker.harmonyGroups()[0];
            expect(readable.label).toBe('Readable');
            expect(readable.swatches[0]).toBe('#000000');
            expect(readable.swatches[1]).toBe('#ffffff');
        });

        it('Readable row recommends white first for a dark color', async () => {
            host.showHarmonies.set(true);
            fixture.detectChanges();
            const picker = await openAndGetPicker(fixture);
            picker.selectPreset('#000080');
            fixture.detectChanges();
            const readable = picker.harmonyGroups()[0];
            expect(readable.swatches[0]).toBe('#ffffff');
            expect(readable.swatches[1]).toBe('#000000');
        });

        it('copyHarmony writes to clipboard and exposes the copied hex', async () => {
            host.showHarmonies.set(true);
            fixture.detectChanges();
            const picker = await openAndGetPicker(fixture);
            const writeText = vi.fn().mockResolvedValue(undefined);
            Object.defineProperty(globalThis.navigator, 'clipboard', {
                value: { writeText },
                configurable: true,
            });
            await picker.copyHarmony('#abcdef');
            expect(writeText).toHaveBeenCalledWith('#abcdef');
            expect(picker.copiedHarmony()).toBe('#abcdef');
        });

        it('copyHarmony does not change the picker selection', async () => {
            host.showHarmonies.set(true);
            fixture.detectChanges();
            const picker = await openAndGetPicker(fixture);
            picker.selectPreset('#112233');
            fixture.detectChanges();
            const before = picker.currentColor();
            await picker.copyHarmony('#abcdef');
            fixture.detectChanges();
            expect(picker.currentColor()).toBe(before);
        });
    });

    describe('Contrast', () => {
        it('computes a contrast ratio against the background', async () => {
            host.showContrast.set(true);
            host.contrastBackground.set('#000000');
            fixture.detectChanges();
            const picker = await openAndGetPicker(fixture);
            picker.selectPreset('#ffffff');
            fixture.detectChanges();
            expect(picker.contrastRatioValue()).toBeCloseTo(21, 0);
            expect(picker.contrastBadge()?.label).toBe('AAA');
        });

        it('routes picker writes to the active compare slot', async () => {
            host.showContrast.set(true);
            fixture.detectChanges();
            const picker = await openAndGetPicker(fixture);

            picker.selectPreset('#ff0000');
            fixture.detectChanges();
            expect(picker.compareAHex()).toBe('#ff0000');

            picker.setCompareSlot('b');
            picker.selectPreset('#00ff00');
            fixture.detectChanges();
            expect(picker.compareBHex()).toBe('#00ff00');
            expect(picker.compareAHex()).toBe('#ff0000');

            picker.setCompareSlot('a');
            expect(picker.currentColor()).toBe('#ff0000');
        });

        it('compares against the second slot, not the background input', async () => {
            host.showContrast.set(true);
            host.contrastBackground.set('#ffffff');
            fixture.detectChanges();
            const picker = await openAndGetPicker(fixture);
            picker.selectPreset('#000000');
            fixture.detectChanges();
            picker.setCompareSlot('b');
            fixture.detectChanges();
            picker.selectPreset('#ffffff');
            fixture.detectChanges();
            picker.setCompareSlot('a');
            fixture.detectChanges();
            expect(picker.compareAHex()).toBe('#000000');
            expect(picker.compareBHex()).toBe('#ffffff');
            expect(picker.contrastRatioValue()).toBeCloseTo(21, 0);
        });
    });

    describe('Formats / OKLCH tab', () => {
        it('exposes oklch when included in formats', async () => {
            host.formats.set(['hex', 'rgb', 'hsl', 'oklch']);
            fixture.detectChanges();
            const picker = await openAndGetPicker(fixture);
            expect(picker.formatValues().oklch).toMatch(/^oklch\(/);
        });
    });

    describe('ControlValueAccessor', () => {
        it('parses any color format in writeValue', () => {
            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent))
                .componentInstance as ColorPickerComponent;
            picker.writeValue('rgb(0, 255, 0)');
            fixture.detectChanges();
            expect(picker.currentColor()).toBe('#00ff00');
        });

        it('handles null in writeValue', () => {
            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent))
                .componentInstance as ColorPickerComponent;
            expect(() => picker.writeValue(null)).not.toThrow();
        });

        it('emits via onChange when color changes', async () => {
            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent))
                .componentInstance as ColorPickerComponent;
            let changed = '';
            picker.registerOnChange((value: string) => { changed = value; });
            picker.selectPreset('#ff0000');
            fixture.detectChanges();
            await fixture.whenStable();
            expect(changed).toBe('#ff0000');
        });
    });

    describe('Security', () => {
        it('rejects non-color strings on hex input', async () => {
            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent))
                .componentInstance as ColorPickerComponent;
            picker.onHexInput('<script>alert(1)</script>');
            picker.onHexInput('javascript:alert(1)');
            picker.onHexInput('#gggggg');
            fixture.detectChanges();
            expect(host.color()).toBe('#3b82f6');
        });

        it('does not render script content from presets', async () => {
            host.presets.set(['<script>alert(1)</script>']);
            fixture.detectChanges();
            const trigger = fixture.debugElement.query(By.css('button'));
            trigger.nativeElement.click();
            fixture.detectChanges();
            const html = fixture.debugElement.nativeElement.innerHTML as string;
            expect(html).not.toContain('<script>alert');
        });
    });

    describe('RTL', () => {
        it('renders in RTL', async () => {
            host.dir.set('rtl');
            fixture.detectChanges();
            await fixture.whenStable();
            const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
            expect(container).toBeTruthy();
        });
    });
});

describe('ColorPickerComponent — i18n integration', () => {
    async function setup(opts: { locale?: string; providerLocale?: string } = {}) {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [ColorPickerComponent],
            providers: opts.providerLocale ? [provideUiLocale(opts.providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(ColorPickerComponent);
        if (opts.locale) fixture.componentRef.setInput('locale', opts.locale);
        (fixture.componentInstance as unknown as { open: { set: (v: boolean) => void } }).open.set(true);
        fixture.detectChanges();
        return fixture;
    }

    it('defaults aria-labels and section text to English', async () => {
        const fixture = await setup();
        // Saturation/value handle aria-label
        const satValue = document.querySelector('[aria-label="Saturation and value"]');
        expect(satValue).toBeTruthy();
        function readT(f: typeof fixture) {
            return (f.componentInstance as unknown as { t: () => Record<string, string> }).t();
        }
        expect(readT(fixture)['recent']).toBe('Recent');
    });

    it('localises the resolved locale when locale="he"', async () => {
        const fixture = await setup({ locale: 'he' });
        const t = (fixture.componentInstance as unknown as { t: () => Record<string, string> }).t();
        expect(t['code']).toBe('he');
        expect(t['saturationValue']).toBe('רוויה וערך');
        expect(t['hue']).toBe('גוון');
        expect(t['copyHex']).toBe('העתק hex');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup({ providerLocale: 'de' });
        const t = (fixture.componentInstance as unknown as { t: () => Record<string, string> }).t();
        expect(t['code']).toBe('de');
        expect(t['pickColorFromImage']).toBe('Farbe aus Bild wählen');
    });
});
