import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ColorPickerComponent } from './color-picker.component';

// Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-color-picker
                [ngModel]="color()"
                (ngModelChange)="color.set($event)"
                [presets]="presets()"
                [disabled]="disabled()"
            />
        </div>
    `,
    imports: [ColorPickerComponent, FormsModule]
})
class ColorPickerTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
    color = signal('#3b82f6');
    presets = signal<string[]>(['#ef4444', '#22c55e', '#3b82f6']);
    disabled = signal(false);
}

describe('ColorPickerComponent', () => {
    let fixture: ComponentFixture<ColorPickerTestHostComponent>;
    let component: ColorPickerTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ColorPickerTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ColorPickerTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
    });

    describe('Basic Rendering', () => {
        it('should create color picker component', () => {
            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent));
            expect(picker).toBeTruthy();
        });

        it('should display color swatch in trigger', () => {
            const swatch = fixture.debugElement.query(By.css('[style*="background"]'));
            expect(swatch).toBeTruthy();
        });
    });

    describe('Popover', () => {
        it('should open popover on click', async () => {
            const trigger = fixture.debugElement.query(By.css('button'));
            trigger.nativeElement.click();
            fixture.detectChanges();
            await fixture.whenStable();

            const popoverContent = fixture.debugElement.query(By.css('ui-popover-content'));
            expect(popoverContent).toBeTruthy();
        });
    });

    describe('Color Selection', () => {
        it('should select preset color', async () => {
            // Open popover
            const trigger = fixture.debugElement.query(By.css('button'));
            trigger.nativeElement.click();
            fixture.detectChanges();
            await fixture.whenStable();

            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent)).componentInstance as ColorPickerComponent;
            picker.selectPreset('#ef4444');
            fixture.detectChanges();
            await fixture.whenStable();

            expect(component.color()).toBe('#ef4444');
        });

        it('should update color via hex input', async () => {
            const trigger = fixture.debugElement.query(By.css('button'));
            trigger.nativeElement.click();
            fixture.detectChanges();
            await fixture.whenStable();

            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent)).componentInstance as ColorPickerComponent;
            picker.onHexInput('#ff0000');
            fixture.detectChanges();

            expect(component.color()).toBe('#ff0000');
        });

        it('should reject invalid hex input', async () => {
            const trigger = fixture.debugElement.query(By.css('button'));
            trigger.nativeElement.click();
            fixture.detectChanges();

            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent)).componentInstance as ColorPickerComponent;
            const previousColor = component.color();
            picker.onHexInput('invalid');
            fixture.detectChanges();

            expect(component.color()).toBe(previousColor);
        });

        it('should update color via RGB input', async () => {
            const trigger = fixture.debugElement.query(By.css('button'));
            trigger.nativeElement.click();
            fixture.detectChanges();

            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent)).componentInstance as ColorPickerComponent;
            picker.onRgbChange('r', 255);
            picker.onRgbChange('g', 0);
            picker.onRgbChange('b', 0);
            fixture.detectChanges();

            expect(component.color()).toBe('#ff0000');
        });
    });

    describe('Disabled State', () => {
        beforeEach(async () => {
            component.disabled.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('should have disabled trigger button', () => {
            const trigger = fixture.debugElement.query(By.css('button'));
            expect(trigger.nativeElement.disabled).toBe(true);
        });

        it('should have opacity class', () => {
            const trigger = fixture.debugElement.query(By.css('button'));
            expect(trigger.nativeElement.className).toContain('opacity-50');
        });
    });

    describe('Presets', () => {
        it('should render preset swatches', async () => {
            const trigger = fixture.debugElement.query(By.css('button'));
            trigger.nativeElement.click();
            fixture.detectChanges();
            await fixture.whenStable();

            // Wait for popover content
            const presetButtons = fixture.debugElement.queryAll(By.css('[aria-label*="Select #"]'));
            expect(presetButtons.length).toBe(3);
        });
    });

    describe('Color Conversion', () => {
        it('should convert hex to RGB correctly', () => {
            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent)).componentInstance as ColorPickerComponent;

            // Access private method via bracket notation for testing
            const rgb = (picker as any).hexToRgb('#ff0000');
            expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
        });

        it('should convert RGB to hex correctly', () => {
            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent)).componentInstance as ColorPickerComponent;

            const hex = (picker as any).rgbToHex({ r: 0, g: 255, b: 0 });
            expect(hex).toBe('#00ff00');
        });

        it('should handle edge case colors', () => {
            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent)).componentInstance as ColorPickerComponent;

            const black = (picker as any).hexToRgb('#000000');
            expect(black).toEqual({ r: 0, g: 0, b: 0 });

            const white = (picker as any).hexToRgb('#ffffff');
            expect(white).toEqual({ r: 255, g: 255, b: 255 });
        });
    });

    describe('RTL Support', () => {
        it('should render in LTR mode', () => {
            const container = fixture.debugElement.query(By.css('[dir="ltr"]'));
            expect(container).toBeTruthy();
        });

        it('should render in RTL mode', async () => {
            component.dir.set('rtl');
            fixture.detectChanges();
            await fixture.whenStable();

            const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
            expect(container).toBeTruthy();
        });

        it('should maintain picker in RTL', async () => {
            component.dir.set('rtl');
            fixture.detectChanges();
            await fixture.whenStable();

            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent));
            expect(picker).toBeTruthy();
        });
    });

    describe('Accessibility', () => {
        it('should have accessible preset buttons', async () => {
            const trigger = fixture.debugElement.query(By.css('button'));
            trigger.nativeElement.click();
            fixture.detectChanges();
            await fixture.whenStable();

            const presetButtons = fixture.debugElement.queryAll(By.css('[aria-label*="Select"]'));
            presetButtons.forEach(btn => {
                expect(btn.nativeElement.getAttribute('aria-label')).toBeTruthy();
            });
        });

        it('should have labeled inputs', async () => {
            const trigger = fixture.debugElement.query(By.css('button'));
            trigger.nativeElement.click();
            fixture.detectChanges();
            await fixture.whenStable();

            const labels = fixture.debugElement.queryAll(By.css('label'));
            expect(labels.length).toBeGreaterThan(0);
        });
    });

    describe('Security', () => {
        it('should validate hex format before accepting', async () => {
            await fixture.whenStable();
            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent)).componentInstance as ColorPickerComponent;

            // These should not update color
            picker.onHexInput('<script>alert(1)</script>');
            picker.onHexInput('javascript:alert(1)');
            picker.onHexInput('#gggggg'); // Invalid hex chars

            // Color should remain unchanged
            expect(component.color()).toBe('#3b82f6');
        });

        it('should clamp RGB values to valid range', () => {
            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent)).componentInstance as ColorPickerComponent;

            // RGB values should be clamped
            picker.onRgbChange('r', 500);
            fixture.detectChanges();

            const rgb = picker.rgb();
            expect(rgb.r).toBeLessThanOrEqual(255);
        });

        it('should handle negative RGB values', () => {
            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent)).componentInstance as ColorPickerComponent;

            picker.onRgbChange('r', -100);
            fixture.detectChanges();

            const rgb = picker.rgb();
            expect(rgb.r).toBeGreaterThanOrEqual(0);
        });

        it('should not execute scripts in presets', () => {
            // Set presets with malicious content
            component.presets.set(['<script>alert(1)</script>']);
            fixture.detectChanges();

            const trigger = fixture.debugElement.query(By.css('button'));
            trigger.nativeElement.click();
            fixture.detectChanges();

            // Should not render script tags
            const content = fixture.debugElement.nativeElement.innerHTML;
            expect(content).not.toContain('<script>alert');
        });
    });

    describe('ControlValueAccessor', () => {
        it('should implement writeValue', () => {
            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent)).componentInstance as ColorPickerComponent;

            picker.writeValue('#00ff00');
            fixture.detectChanges();

            expect(picker.currentColor()).toBe('#00ff00');
        });

        it('should handle null in writeValue', () => {
            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent)).componentInstance as ColorPickerComponent;

            expect(() => picker.writeValue(null as any)).not.toThrow();
        });

        it('should call onChange when color changes', async () => {
            const picker = fixture.debugElement.query(By.directive(ColorPickerComponent)).componentInstance as ColorPickerComponent;
            let changedValue = '';

            picker.registerOnChange((value: string) => {
                changedValue = value;
            });

            picker.selectPreset('#ff0000');
            fixture.detectChanges();
            await fixture.whenStable();

            expect(changedValue).toBe('#ff0000');
        });
    });
});
