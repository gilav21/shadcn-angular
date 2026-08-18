import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, PLATFORM_ID, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ColorPickerComponent } from './color-picker.component';
import { keyboardStep, readRecents, writeRecents } from './color-picker.utils';

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
                [inline]="inline()"
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
    inline = signal(false);
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

    describe('Inline mode', () => {
        it('renders the panel directly with no trigger or popover', () => {
            host.inline.set(true);
            fixture.detectChanges();

            expect(fixture.debugElement.query(By.css('ui-popover'))).toBeNull();
            expect(fixture.debugElement.query(By.css('[data-slot="color-picker-trigger"]'))).toBeNull();
            // The panel (preset swatches) renders directly, no second click needed.
            expect(fixture.debugElement.query(By.css('button[data-color-btn]'))).toBeTruthy();
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
        it('prevents default on mousedown so a drag does not extend a page text selection', async () => {
            await openAndGetPicker(fixture);
            const area = document.querySelector('div[role="slider"]') as HTMLElement;
            const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 });
            area.dispatchEvent(ev);
            expect(ev.defaultPrevented).toBe(true);
            window.dispatchEvent(new MouseEvent('mouseup')); // release the drag listeners
        });

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
            expect(presetButtons).toHaveLength(3);
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
            expect(picker.recents()).toHaveLength(2);
            expect(picker.recents()).toContain('#333333');
            expect(picker.recents()).not.toContain('#111111');
        });
    });

    describe('Harmonies', () => {
        it('exposes harmony groups only when showHarmonies is true', async () => {
            const picker = await openAndGetPicker(fixture);
            expect(picker.harmonyGroups()).toHaveLength(0);
            host.showHarmonies.set(true);
            fixture.detectChanges();
            const groups = picker.harmonyGroups();
            expect(groups).toHaveLength(5);
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
            const writeText = vi.fn((_text: string) => Promise.resolve());
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

    describe('Hue and alpha sliders', () => {
        function rangeEvent(value: number, max = 360): Event {
            const input = document.createElement('input');
            input.type = 'range';
            input.min = '0';
            input.max = String(max);
            input.value = String(value);
            const ev = new Event('input');
            Object.defineProperty(ev, 'target', { value: input });
            return ev;
        }

        it('onHueChange updates hue and recomputes the color', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.applyRgba({ r: 255, g: 0, b: 0, a: 1 });
            picker.onHueChange(rangeEvent(120));
            fixture.detectChanges();
            expect(picker.hue()).toBe(120);
            expect(picker.currentColor()).toBe('#00ff00');
        });

        it('onAlphaChange sets the alpha channel', async () => {
            host.alpha.set(true);
            fixture.detectChanges();
            const picker = await openAndGetPicker(fixture);
            picker.onAlphaChange(rangeEvent(50, 100));
            fixture.detectChanges();
            expect(picker.alphaValue()).toBeCloseTo(0.5, 1);
        });
    });

    describe('HSL channel inputs', () => {
        it('onHslChange updates saturation and lightness', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.applyRgba({ r: 128, g: 128, b: 128, a: 1 });
            picker.onHslChange('l', 100);
            fixture.detectChanges();
            expect(picker.currentColor()).toBe('#ffffff');
        });

        it('onHslChange clamps out-of-range input', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.onHslChange('s', 999);
            fixture.detectChanges();
            expect(picker.hsl().s).toBeLessThanOrEqual(100);
        });

        it('onHslHueChange rotates the hue', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.applyRgba({ r: 255, g: 0, b: 0, a: 1 });
            picker.onHslHueChange(240);
            fixture.detectChanges();
            expect(picker.currentColor()).toBe('#0000ff');
        });

        it('onHslHueChange clamps to 0..360', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.onHslHueChange(720);
            fixture.detectChanges();
            expect(picker.hsl().h).toBeLessThanOrEqual(360);
        });
    });

    describe('Area pointer drag', () => {
        it('onAreaMouseDown updates color from the pointer position', async () => {
            const picker = await openAndGetPicker(fixture);
            stubAreaRect(picker);
            picker.onAreaMouseDown(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));
            fixture.detectChanges();
            expect(picker.saturation()).toBe(0);
            expect(picker.value()).toBe(100);
            // release any global drag listeners
            document.dispatchEvent(new MouseEvent('mouseup'));
        });

        it('onAreaMouseDown is ignored when disabled', async () => {
            const picker = await openAndGetPicker(fixture);
            host.disabled.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
            stubAreaRect(picker);
            const before = picker.saturation();
            picker.onAreaMouseDown(new MouseEvent('mousedown', { clientX: 200, clientY: 0 }));
            fixture.detectChanges();
            expect(picker.saturation()).toBe(before);
        });

        it('onAreaTouchStart updates color from the first touch', async () => {
            const picker = await openAndGetPicker(fixture);
            stubAreaRect(picker);
            const ev = new Event('touchstart', { cancelable: true }) as unknown as TouchEvent;
            Object.defineProperty(ev, 'touches', { value: [{ clientX: 200, clientY: 0 }] });
            picker.hue.set(0);
            picker.onAreaTouchStart(ev);
            fixture.detectChanges();
            expect(picker.saturation()).toBe(100);
            expect(picker.value()).toBe(100);
            document.dispatchEvent(new Event('touchend'));
        });
    });

    describe('Eyedropper and extracted palette', () => {
        it('onEyedropperPick applies the picked color', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.onEyedropperPick('#ff8800');
            fixture.detectChanges();
            expect(picker.currentColor()).toBe('#ff8800');
        });

        it('applyExtracted applies a swatch from the palette', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.applyExtracted('#123456');
            fixture.detectChanges();
            expect(picker.currentColor()).toBe('#123456');
        });

        it('clearExtractedPalette empties the palette', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.extractedPalette.set(['#111111', '#222222']);
            picker.clearExtractedPalette();
            expect(picker.extractedPalette()).toEqual([]);
        });

        it('openImagePicker clicks the hidden file input', async () => {
            host.enableImagePick.set(true);
            fixture.detectChanges();
            const picker = await openAndGetPicker(fixture);
            const fileInput = (picker as unknown as { imageFile: () => { nativeElement: HTMLInputElement } | undefined }).imageFile();
            if (fileInput) {
                const spy = vi.spyOn(fileInput.nativeElement, 'click');
                picker.openImagePicker();
                expect(spy).toHaveBeenCalled();
            }
        });

        it('onImageSelected ignores an empty file selection', async () => {
            const picker = await openAndGetPicker(fixture);
            const input = document.createElement('input');
            input.type = 'file';
            const ev = new Event('change');
            Object.defineProperty(ev, 'target', { value: input });
            await expect(picker.onImageSelected(ev)).resolves.toBeUndefined();
            expect(picker.extractedPalette()).toEqual([]);
        });
    });

    describe('Copy format value', () => {
        it('copy writes the formatted value to the clipboard and flags the format', async () => {
            const picker = await openAndGetPicker(fixture);
            const writeText = vi.fn((_text: string) => Promise.resolve());
            Object.defineProperty(globalThis.navigator, 'clipboard', {
                value: { writeText },
                configurable: true,
            });
            picker.applyRgba({ r: 255, g: 0, b: 0, a: 1 });
            await picker.copy('hex');
            expect(writeText).toHaveBeenCalledWith('#ff0000');
            expect(picker.copiedFormat()).toBe('hex');
        });

        it('copy swallows clipboard rejections', async () => {
            const picker = await openAndGetPicker(fixture);
            const writeText = vi.fn((_text: string) => Promise.reject(new Error('denied')));
            Object.defineProperty(globalThis.navigator, 'clipboard', {
                value: { writeText },
                configurable: true,
            });
            await expect(picker.copy('rgb')).resolves.toBeUndefined();
            expect(picker.copiedFormat()).toBeNull();
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

        it('does not emit its initial colour before any interaction', async () => {
            const solo = TestBed.createComponent(ColorPickerComponent);
            const emitted: string[] = [];
            const changes: string[] = [];
            solo.componentInstance.colorChange.subscribe((value: string) => { emitted.push(value); });
            solo.componentInstance.registerOnChange((value: string) => { changes.push(value); });
            solo.detectChanges();
            await solo.whenStable();
            expect(emitted).toEqual([]);
            expect(changes).toEqual([]);
        });

        it('does not echo a written value back through onChange or colorChange', async () => {
            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent))
                .componentInstance as ColorPickerComponent;
            const changes: string[] = [];
            const emitted: string[] = [];
            picker.registerOnChange((value: string) => { changes.push(value); });
            picker.colorChange.subscribe((value: string) => { emitted.push(value); });

            picker.writeValue('#00ff00');
            fixture.detectChanges();
            await fixture.whenStable();

            expect(picker.currentColor()).toBe('#00ff00');
            expect(changes).toEqual([]);
            expect(emitted).toEqual([]);
        });

        it('still emits a user pick made after a write', async () => {
            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent))
                .componentInstance as ColorPickerComponent;
            picker.writeValue('#00ff00');
            fixture.detectChanges();
            await fixture.whenStable();

            const changes: string[] = [];
            picker.registerOnChange((value: string) => { changes.push(value); });
            picker.selectPreset('#ff0000');
            fixture.detectChanges();
            await fixture.whenStable();

            expect(changes).toEqual(['#ff0000']);
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
            const scripts = (fixture.debugElement.nativeElement as HTMLElement).querySelectorAll('script');
            expect(scripts).toHaveLength(0);
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

    describe('Derived color spaces', () => {
        it('exposes an OKLCH triple for the current color', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.applyRgba({ r: 255, g: 0, b: 0, a: 1 });
            const value = picker.oklch();
            expect(value.l).toBeGreaterThan(0);
            expect(value.c).toBeGreaterThan(0);
        });
    });

    describe('Compare slot no-op', () => {
        it('setCompareSlot on the active slot is a no-op', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.selectPreset('#ff0000');
            fixture.detectChanges();
            picker.setCompareSlot('a');
            expect(picker.compareActive()).toBe('a');
            expect(picker.currentColor()).toBe('#ff0000');
        });
    });

    describe('Area drag movement', () => {
        it('window mousemove during a drag re-maps the pointer to S/V', async () => {
            const picker = await openAndGetPicker(fixture);
            stubAreaRect(picker);
            picker.onAreaMouseDown(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));
            window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 100 }));
            fixture.detectChanges();
            expect(picker.saturation()).toBe(100);
            expect(picker.value()).toBe(0);
            window.dispatchEvent(new MouseEvent('mouseup'));
        });
    });

    describe('Guard clauses', () => {
        it('onAreaTouchStart ignores an empty touch list', async () => {
            const picker = await openAndGetPicker(fixture);
            const before = picker.saturation();
            const ev = new Event('touchstart', { cancelable: true }) as unknown as TouchEvent;
            Object.defineProperty(ev, 'touches', { value: [] });
            picker.onAreaTouchStart(ev);
            expect(picker.saturation()).toBe(before);
        });

        it('onAreaKeyDown does nothing while disabled', async () => {
            const picker = await openAndGetPicker(fixture);
            const before = picker.saturation();
            host.disabled.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
            picker.onAreaKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
            expect(picker.saturation()).toBe(before);
        });

        it('onAreaKeyDown ignores keys that do not move the marker', async () => {
            const picker = await openAndGetPicker(fixture);
            const before = picker.saturation();
            picker.onAreaKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));
            expect(picker.saturation()).toBe(before);
        });

        it('selectPreset ignores an unparseable color', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.selectPreset('not-a-color');
            fixture.detectChanges();
            expect(host.color()).toBe('#3b82f6');
        });
    });

    describe('Keyboard steps (remaining directions)', () => {
        it('ArrowLeft, ArrowUp, End, PageUp and PageDown all move the marker', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.saturation.set(50);
            picker.value.set(50);
            picker.onAreaKeyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
            expect(picker.saturation()).toBe(49);
            picker.onAreaKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
            expect(picker.value()).toBe(51);
            picker.onAreaKeyDown(new KeyboardEvent('keydown', { key: 'End' }));
            expect(picker.saturation()).toBe(100);
            picker.onAreaKeyDown(new KeyboardEvent('keydown', { key: 'PageDown' }));
            expect(picker.value()).toBe(41);
            picker.onAreaKeyDown(new KeyboardEvent('keydown', { key: 'PageUp' }));
            expect(picker.value()).toBe(51);
        });
    });

    describe('Image extraction', () => {
        function fileChangeEvent(file: File): Event {
            const input = document.createElement('input');
            input.type = 'file';
            Object.defineProperty(input, 'files', { value: [file], configurable: true });
            const ev = new Event('change');
            Object.defineProperty(ev, 'target', { value: input });
            return ev;
        }

        it('extracts a palette and applies the first color on success', async () => {
            const picker = await openAndGetPicker(fixture);
            const proto = HTMLCanvasElement.prototype as unknown as {
                getContext: (id: string, o?: unknown) => unknown;
            };
            const originalGetContext = proto.getContext;
            vi.stubGlobal('createImageBitmap', () =>
                Promise.resolve({ width: 2, height: 2, close: () => undefined }),
            );
            proto.getContext = () => ({
                drawImage: () => undefined,
                getImageData: () => ({
                    data: new Uint8ClampedArray([120, 80, 40, 255, 30, 60, 90, 255, 10, 20, 30, 255, 200, 150, 100, 255]),
                }),
            });
            const file = new File([new Uint8Array([1, 2, 3])], 'x.png', { type: 'image/png' });
            await picker.onImageSelected(fileChangeEvent(file));
            expect(picker.extractedPalette().length).toBeGreaterThan(0);
            expect(picker.currentColor()).toMatch(/^#[0-9a-f]{6}$/);
            proto.getContext = originalGetContext;
            vi.unstubAllGlobals();
        });

        it('clears the extracted palette when extraction throws', async () => {
            const picker = await openAndGetPicker(fixture);
            picker.extractedPalette.set(['#aaaaaa']);
            vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('decode failed')));
            const file = new File([new Uint8Array([1])], 'x.png', { type: 'image/png' });
            await picker.onImageSelected(fileChangeEvent(file));
            expect(picker.extractedPalette()).toEqual([]);
            vi.unstubAllGlobals();
        });
    });

    describe('Copy timers', () => {
        it('copy clears a pending timer on re-copy and resets the flag after 1.5s', async () => {
            const picker = await openAndGetPicker(fixture);
            const writeText = vi.fn((_text: string) => Promise.resolve());
            Object.defineProperty(globalThis.navigator, 'clipboard', { value: { writeText }, configurable: true });
            vi.useFakeTimers();
            await picker.copy('hex');
            expect(picker.copiedFormat()).toBe('hex');
            await picker.copy('rgb');
            expect(picker.copiedFormat()).toBe('rgb');
            vi.advanceTimersByTime(1500);
            expect(picker.copiedFormat()).toBeNull();
            vi.useRealTimers();
        });

        it('copyHarmony clears a pending timer on re-copy and resets after 1.5s', async () => {
            const picker = await openAndGetPicker(fixture);
            const writeText = vi.fn((_text: string) => Promise.resolve());
            Object.defineProperty(globalThis.navigator, 'clipboard', { value: { writeText }, configurable: true });
            vi.useFakeTimers();
            await picker.copyHarmony('#111111');
            await picker.copyHarmony('#222222');
            expect(picker.copiedHarmony()).toBe('#222222');
            vi.advanceTimersByTime(1500);
            expect(picker.copiedHarmony()).toBeNull();
            vi.useRealTimers();
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

describe('ColorPickerComponent — server platform', () => {
    it('copy and copyHarmony are inert when not running in a browser', async () => {
        await TestBed.configureTestingModule({
            imports: [ColorPickerComponent],
            providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
        }).compileComponents();
        const fixture = TestBed.createComponent(ColorPickerComponent);
        fixture.detectChanges();
        const picker = fixture.componentInstance;
        await picker.copyHarmony('#abcdef');
        await picker.copy('hex');
        expect(picker.copiedHarmony()).toBeNull();
        expect(picker.copiedFormat()).toBeNull();
    });
});

describe('ColorPickerComponent — controlled recents', () => {
    it('emits recentColorsChange instead of mutating internal state', async () => {
        await TestBed.configureTestingModule({ imports: [ColorPickerComponent] }).compileComponents();
        const fixture = TestBed.createComponent(ColorPickerComponent);
        fixture.componentRef.setInput('recentColors', []);
        fixture.componentRef.setInput('presets', ['#ff0000']);
        let emitted: string[] | null = null;
        fixture.componentInstance.recentColorsChange.subscribe((v: string[]) => { emitted = v; });
        fixture.detectChanges();
        fixture.componentInstance.selectPreset('#ff0000');
        expect(emitted).toEqual(['#ff0000']);
    });
});

describe('ColorPickerComponent — area not yet rendered', () => {
    it('updateFromAreaPosition is a no-op when the SV area is absent', async () => {
        await TestBed.configureTestingModule({ imports: [ColorPickerComponent] }).compileComponents();
        const fixture = TestBed.createComponent(ColorPickerComponent);
        fixture.detectChanges();
        const picker = fixture.componentInstance;
        const before = picker.saturation();
        (picker as unknown as { colorArea: () => undefined }).colorArea = () => undefined;
        (picker as unknown as { updateFromAreaPosition: (x: number, y: number) => void })
            .updateFromAreaPosition(5, 5);
        expect(picker.saturation()).toBe(before);
    });
});

describe('ColorPickerComponent — persisted recents', () => {
    afterEach(() => {
        globalThis.localStorage.clear();
    });

    it('hydrates recents from localStorage and persists later changes', async () => {
        globalThis.localStorage.setItem('ui-color-picker:swatches', JSON.stringify(['#111111', '#222222']));
        await TestBed.configureTestingModule({ imports: [ColorPickerComponent] }).compileComponents();
        const fixture = TestBed.createComponent(ColorPickerComponent);
        fixture.componentRef.setInput('storageKey', 'swatches');
        fixture.componentRef.setInput('presets', ['#333333']);
        fixture.detectChanges();
        const picker = fixture.componentInstance;
        expect(picker.recents()).toContain('#111111');
        picker.selectPreset('#333333');
        fixture.detectChanges();
        expect(globalThis.localStorage.getItem('ui-color-picker:swatches')).toContain('#333333');
    });
});

describe('color-picker.utils', () => {
    afterEach(() => {
        globalThis.localStorage.clear();
        vi.restoreAllMocks();
    });

    describe('keyboardStep', () => {
        it('maps every navigation key to a step and returns null otherwise', () => {
            expect(keyboardStep(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))).toEqual({ dSaturation: -1, dValue: 0 });
            expect(keyboardStep(new KeyboardEvent('keydown', { key: 'ArrowUp' }))).toEqual({ dSaturation: 0, dValue: 1 });
            expect(keyboardStep(new KeyboardEvent('keydown', { key: 'End' }))).toEqual({ dSaturation: 100, dValue: 0 });
            expect(keyboardStep(new KeyboardEvent('keydown', { key: 'PageUp' }))).toEqual({ dSaturation: 0, dValue: 10 });
            expect(keyboardStep(new KeyboardEvent('keydown', { key: 'PageDown' }))).toEqual({ dSaturation: 0, dValue: -10 });
            expect(keyboardStep(new KeyboardEvent('keydown', { key: 'Tab' }))).toBeNull();
        });
    });

    describe('readRecents', () => {
        it('returns an empty list for a null key', () => {
            expect(readRecents(null, 8)).toEqual([]);
        });

        it('returns an empty list when nothing is stored', () => {
            expect(readRecents('missing', 8)).toEqual([]);
        });

        it('filters non-strings and caps the result at max', () => {
            globalThis.localStorage.setItem('ui-color-picker:mixed', JSON.stringify(['#111', '#222', 5, '#333']));
            expect(readRecents('mixed', 2)).toEqual(['#111', '#222']);
        });

        it('returns an empty list when the stored value is not an array', () => {
            globalThis.localStorage.setItem('ui-color-picker:scalar', JSON.stringify(123));
            expect(readRecents('scalar', 8)).toEqual([]);
        });

        it('swallows malformed JSON and returns an empty list', () => {
            globalThis.localStorage.setItem('ui-color-picker:broken', '{not valid json');
            expect(readRecents('broken', 8)).toEqual([]);
        });
    });

    describe('writeRecents', () => {
        it('does nothing for a null key', () => {
            // setItem lives on Storage.prototype; spy there so it is a real mock
            // under both runners (the localStorage instance isn't spyable in jest).
            const spy = vi.spyOn(Storage.prototype, 'setItem');
            writeRecents(null, ['#fff']);
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });

        it('persists the list under the prefixed key', () => {
            writeRecents('persist', ['#ffffff', '#000000']);
            expect(globalThis.localStorage.getItem('ui-color-picker:persist')).toBe(JSON.stringify(['#ffffff', '#000000']));
        });

        it('swallows storage errors', () => {
            const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('quota exceeded');
            });
            expect(() => writeRecents('boom', ['#fff'])).not.toThrow();
            spy.mockRestore();
        });
    });
});
