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
import { cn } from '../lib/utils';
import { PopoverComponent, PopoverTriggerComponent, PopoverContentComponent } from './popover.component';
import { InputComponent } from './input.component';
import { TabsComponent, TabsListComponent, TabsTriggerComponent, TabsContentComponent } from './tabs.component';

interface HSL {
    h: number;
    s: number;
    l: number;
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
    template: `
    <ui-popover [open]="open()" (openChange)="open.set($event)">
      <ui-popover-trigger>
        <ng-content select="[colorPickerTrigger]" />
        @if (!hasTrigger()) {
          <button
            type="button"
            [class]="triggerClasses()"
            [disabled]="isDisabled()"
          >
            <span
              class="h-6 w-6 rounded border"
              [style.backgroundColor]="currentColor()"
            ></span>
            <span class="flex-1 text-left text-sm truncate">{{ currentColor() || 'Select color' }}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-4 w-4 opacity-50"
            >
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
        }
      </ui-popover-trigger>
      <ui-popover-content class="w-64 p-3" align="start" [restoreFocus]="false">
        <div class="space-y-3">
          <!-- Color Area -->
          <div
            #colorArea
            class="relative h-32 w-full cursor-crosshair rounded-md"
            [style.background]="areaBackground()"
            (mousedown)="onAreaMouseDown($event)"
          >
            <div
              class="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
              [style.left.%]="saturation()"
              [style.top.%]="100 - lightness()"
              [style.backgroundColor]="currentColor()"
            ></div>
          </div>

          <!-- Hue Slider -->
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">Hue</label>
            <input
              type="range"
              min="0"
              max="360"
              [value]="hue()"
              (input)="onHueChange($event)"
              class="w-full h-3 rounded-md cursor-pointer appearance-none"
              style="background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)"
            />
          </div>

          <!-- Presets -->
          @if (presets().length > 0) {
            <div class="space-y-1">
              <label class="text-xs text-muted-foreground">Presets</label>
              <div class="flex flex-wrap gap-1">
                @for (color of presets(); track color) {
                  <button
                    type="button"
                    class="h-6 w-6 rounded border cursor-pointer hover:scale-110 transition-transform"
                    [style.backgroundColor]="color"
                    [class.ring-2]="currentColor() === color"
                    [class.ring-primary]="currentColor() === color"
                    (click)="selectPreset(color)"
                    [attr.aria-label]="'Select ' + color"
                  ></button>
                }
              </div>
            </div>
          }

          <!-- Input Tabs -->
          <ui-tabs value="hex">
            <ui-tabs-list class="flex justify-start w-full h-8 gap-1">
              <ui-tabs-trigger value="hex" class="text-xs">HEX</ui-tabs-trigger>
              <ui-tabs-trigger value="rgb" class="text-xs">RGB</ui-tabs-trigger>
              <ui-tabs-trigger value="hsl" class="text-xs">HSL</ui-tabs-trigger>
            </ui-tabs-list>
            <ui-tabs-content value="hex" class="mt-2">
              <ui-input
                type="text"
                [ngModel]="hexInput()"
                (ngModelChange)="onHexInput($event)"
                placeholder="#000000"
                class="h-8 text-xs font-mono"
              />
            </ui-tabs-content>
            <ui-tabs-content value="rgb" class="mt-2">
              <div class="grid grid-cols-3 gap-2">
                <div>
                  <label class="text-xs text-muted-foreground">R</label>
                  <ui-input
                    type="number"
                    min="0"
                    max="255"
                    [ngModel]="rgb().r"
                    (ngModelChange)="onRgbChange('r', $event)"
                    class="h-8 text-xs"
                  />
                </div>
                <div>
                  <label class="text-xs text-muted-foreground">G</label>
                  <ui-input
                    type="number"
                    min="0"
                    max="255"
                    [ngModel]="rgb().g"
                    (ngModelChange)="onRgbChange('g', $event)"
                    class="h-8 text-xs"
                  />
                </div>
                <div>
                  <label class="text-xs text-muted-foreground">B</label>
                  <ui-input
                    type="number"
                    min="0"
                    max="255"
                    [ngModel]="rgb().b"
                    (ngModelChange)="onRgbChange('b', $event)"
                    class="h-8 text-xs"
                  />
                </div>
              </div>
            </ui-tabs-content>
            <ui-tabs-content value="hsl" class="mt-2">
              <div class="grid grid-cols-3 gap-2">
                <div>
                  <label class="text-xs text-muted-foreground">H</label>
                  <ui-input
                    type="number"
                    min="0"
                    max="360"
                    [ngModel]="hue()"
                    (ngModelChange)="hue.set($event); updateColorFromHSL()"
                    class="h-8 text-xs"
                  />
                </div>
                <div>
                  <label class="text-xs text-muted-foreground">S</label>
                  <ui-input
                    type="number"
                    min="0"
                    max="100"
                    [ngModel]="saturation()"
                    (ngModelChange)="saturation.set($event); updateColorFromHSL()"
                    class="h-8 text-xs"
                  />
                </div>
                <div>
                  <label class="text-xs text-muted-foreground">L</label>
                  <ui-input
                    type="number"
                    min="0"
                    max="100"
                    [ngModel]="lightness()"
                    (ngModelChange)="lightness.set($event); updateColorFromHSL()"
                    class="h-8 text-xs"
                  />
                </div>
              </div>
            </ui-tabs-content>
          </ui-tabs>
        </div>
      </ui-popover-content>
    </ui-popover>
  `,
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
    saturation = signal(100);
    lightness = signal(50);

    colorArea = viewChild<ElementRef<HTMLDivElement>>('colorArea');

    private onChange: (value: string) => void = () => { };
    private onTouched: () => void = () => { };
    private formDisabled = signal(false);
    private isDragging = false;

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
        this.isDragging = true;
        this.updateFromAreaPosition(event);

        const onMouseMove = (e: MouseEvent) => {
            if (this.isDragging) {
                this.updateFromAreaPosition(e);
            }
        };

        const onMouseUp = () => {
            this.isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    private updateFromAreaPosition(event: MouseEvent) {
        const area = this.colorArea()?.nativeElement;
        if (!area) return;

        const rect = area.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));

        this.saturation.set(Math.round(x * 100));
        this.lightness.set(Math.round((1 - y) * 50));
        this.updateColorFromHSL();
    }

    onHueChange(event: Event) {
        const value = +(event.target as HTMLInputElement).value;
        this.hue.set(value);
        this.updateColorFromHSL();
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

    updateColorFromHSL() {
        const hex = this.hslToHex({ h: this.hue(), s: this.saturation(), l: this.lightness() });
        this.currentColor.set(hex);
        this.onTouched();
    }

    private setColor(hex: string) {
        this.currentColor.set(hex);
        const hsl = this.hexToHsl(hex);
        this.hue.set(hsl.h);
        this.saturation.set(hsl.s);
        this.lightness.set(hsl.l);
    }

    private hexToRgb(hex: string): RGB {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16),
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
