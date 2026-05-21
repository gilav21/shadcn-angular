import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    forwardRef,
    ElementRef,
    viewChild,
    output,
    effect,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { cn } from '../../lib/utils';
import { onPointerDrag } from '../../lib/touch';
import { PopoverComponent, PopoverTriggerComponent, PopoverContentComponent } from '../popover';
import { InputComponent } from '../input';
import { TabsComponent, TabsListComponent, TabsTriggerComponent, TabsContentComponent } from '../tabs';

interface HSL {
    h: number;
    s: number;
    l: number;
}

interface HSV {
    h: number;
    s: number;
    v: number;
}

interface RGB {
    r: number;
    g: number;
    b: number;
}

@Component({
    selector: 'ui-color-picker',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        PopoverComponent,
        PopoverTriggerComponent,
        PopoverContentComponent,
        InputComponent,
        TabsComponent,
        TabsListComponent,
        TabsTriggerComponent,
        TabsContentComponent,
    ],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => ColorPickerComponent),
            multi: true,
        },
    ],
    templateUrl: './color-picker.component.html',
    host: { class: 'inline-block' },
})
export class ColorPickerComponent implements ControlValueAccessor {
    presets = input<string[]>([]);
    disabled = input(false);
    class = input('');

    colorChange = output<string>();

    open = signal(false);
    currentColor = signal('#000000');

    hue = signal(0);
    /** HSV saturation (0..100) — drives the area's X axis. */
    saturation = signal(100);
    /** HSV value (0..100) — drives the area's Y axis (top = 100). */
    value = signal(100);

    /** HSL view of `currentColor` — used by the HSL input tab. */
    hsl = computed(() => this.hexToHsl(this.currentColor()));

    colorArea = viewChild<ElementRef<HTMLDivElement>>('colorArea');

    private onChange: (value: string) => void = () => { };
    private onTouched: () => void = () => { };
    private readonly formDisabled = signal(false);
    private isDragging = false;
    private dragCleanup: (() => void) | null = null;

    hasTrigger = signal(false);

    isDisabled = computed(() => this.disabled() || this.formDisabled());

    hexInput = computed(() => this.currentColor());

    rgb = computed(() => this.hexToRgb(this.currentColor()));

    areaBackground = computed(() => {
        const h = this.hue();
        return `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h}, 100%, 50%))`;
    });

    triggerClasses = computed(() =>
        cn(
            'flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            this.isDisabled() && 'cursor-not-allowed opacity-50',
            this.class()
        )
    );

    constructor() {
        effect(() => {
            const color = this.currentColor();
            this.onChange(color);
            this.colorChange.emit(color);
        }, { allowSignalWrites: true });
    }

    onAreaMouseDown(event: MouseEvent) {
        if (this.isDisabled()) return;
        this.startAreaDrag(event.clientX, event.clientY);
    }

    onAreaTouchStart(event: TouchEvent) {
        if (this.isDisabled()) return;
        if (event.touches.length === 0) return;
        event.preventDefault();
        this.startAreaDrag(event.touches[0].clientX, event.touches[0].clientY);
    }

    private startAreaDrag(clientX: number, clientY: number) {
        this.isDragging = true;
        this.updateFromAreaPosition(clientX, clientY);

        this.dragCleanup = onPointerDrag(
            (moveX, moveY) => {
                if (this.isDragging) {
                    this.updateFromAreaPosition(moveX, moveY);
                }
            },
            () => {
                this.isDragging = false;
                this.dragCleanup = null;
            },
        );
    }

    private updateFromAreaPosition(clientX: number, clientY: number) {
        const area = this.colorArea()?.nativeElement;
        if (!area) return;

        const rect = area.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

        this.saturation.set(Math.round(x * 100));
        this.value.set(Math.round((1 - y) * 100));
        this.updateColorFromHSV();
    }

    onHueChange(event: Event) {
        const value = +(event.target as HTMLInputElement).value;
        this.hue.set(value);
        this.updateColorFromHSV();
    }

    selectPreset(color: string) {
        this.setColor(color);
        this.onTouched();
    }

    onHexInput(value: string) {
        if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
            this.setColor(value);
        }
    }

    onRgbChange(channel: 'r' | 'g' | 'b', value: number) {
        const current = this.rgb();
        const newRgb = { ...current, [channel]: Math.max(0, Math.min(255, value)) };
        const hex = this.rgbToHex(newRgb);
        this.setColor(hex);
    }

    updateColorFromHSV() {
        const hex = this.hsvToHex({ h: this.hue(), s: this.saturation(), v: this.value() });
        this.currentColor.set(hex);
        this.onTouched();
    }

    /** Called by the HSL input tab — sets the color from HSL and syncs HSV state. */
    onHslChange(channel: 's' | 'l', input: number) {
        const current = this.hsl();
        const next: HSL = { ...current, [channel]: Math.max(0, Math.min(100, input)) };
        this.setColor(this.hslToHex(next));
    }

    private setColor(hex: string) {
        this.currentColor.set(hex);
        const hsv = this.hexToHsv(hex);
        this.hue.set(hsv.h);
        this.saturation.set(hsv.s);
        this.value.set(hsv.v);
    }

    private hexToRgb(hex: string): RGB {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? {
                r: Number.parseInt(result[1], 16),
                g: Number.parseInt(result[2], 16),
                b: Number.parseInt(result[3], 16),
            }
            : { r: 0, g: 0, b: 0 };
    }

    private rgbToHex(rgb: RGB): string {
        return `#${[rgb.r, rgb.g, rgb.b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
    }

    private hexToHsl(hex: string): HSL {
        const rgb = this.hexToRgb(hex);
        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
                case r:
                    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                    break;
                case g:
                    h = ((b - r) / d + 2) / 6;
                    break;
                case b:
                    h = ((r - g) / d + 4) / 6;
                    break;
            }
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100),
        };
    }

    private hexToHsv(hex: string): HSV {
        const rgb = this.hexToRgb(hex);
        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        let h = 0;

        if (d !== 0) {
            switch (max) {
                case r:
                    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                    break;
                case g:
                    h = ((b - r) / d + 2) / 6;
                    break;
                case b:
                    h = ((r - g) / d + 4) / 6;
                    break;
            }
        }

        const s = max === 0 ? 0 : d / max;
        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            v: Math.round(max * 100),
        };
    }

    private hsvToHex(hsv: HSV): string {
        const h = hsv.h / 360;
        const s = hsv.s / 100;
        const v = hsv.v / 100;

        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);

        let r = 0;
        let g = 0;
        let b = 0;
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }

        return this.rgbToHex({
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255),
        });
    }

    private hslToHex(hsl: HSL): string {
        const h = hsl.h / 360;
        const s = hsl.s / 100;
        const l = hsl.l / 100;

        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p: number, q: number, t: number) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }

        return this.rgbToHex({
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255),
        });
    }

    writeValue(value: string): void {
        if (value) {
            this.setColor(value);
        }
    }

    registerOnChange(fn: (value: string) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.formDisabled.set(isDisabled);
    }
}
