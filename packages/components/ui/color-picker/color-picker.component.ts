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
    inject,
    PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { cn } from '../../lib/utils';
import { onPointerDrag } from '../../lib/touch';
import {
    parseColor,
    formatHex,
    formatRgb,
    formatHsl,
    formatOklch,
    rgbToHsl,
    rgbToHsv,
    hsvToRgb,
    hslToRgb,
    rgbToOklch,
    contrastRatio,
    harmonyComplementary,
    harmonyAnalogous,
    harmonyTriadic,
    harmonyTetradic,
    type RGBA,
} from '../../lib/color';
import {
    extractDominantColors,
    type ExtractAlgorithm,
} from '../../lib/color-extract';
import { PopoverComponent, PopoverTriggerComponent, PopoverContentComponent } from '../popover';
import { InputComponent } from '../input';
import { TabsComponent, TabsListComponent, TabsTriggerComponent, TabsContentComponent } from '../tabs';
import { IconComponent } from '../icon';
import { EyedropperComponent } from '../eyedropper';
import {
    keyboardStep,
    paletteToHex,
    readRecents,
    unshiftUniqueColor,
    wcagBadge,
    writeRecents,
    type WcagBadge,
} from './color-picker.utils';

export type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'oklch';

interface HarmonyGroup {
    readonly label: string;
    readonly swatches: readonly string[];
}

const DEFAULT_RGBA: RGBA = { r: 0, g: 0, b: 0, a: 1 };

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
        IconComponent,
        EyedropperComponent,
    ],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => ColorPickerComponent),
            multi: true,
        },
    ],
    templateUrl: './color-picker.component.html',
    styleUrl: './color-picker.component.css',
    host: { class: 'inline-block' },
})
export class ColorPickerComponent implements ControlValueAccessor {
    readonly presets = input<string[]>([]);
    readonly disabled = input(false);
    readonly class = input('');
    readonly alpha = input(false);
    readonly recentColors = input<string[] | null>(null);
    readonly maxRecent = input(8);
    readonly storageKey = input<string | null>(null);
    readonly enableEyedropper = input(true);
    readonly fallbackTarget = input<HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | null>(null);
    readonly enableImagePick = input(false);
    readonly imageExtractAlgorithm = input<ExtractAlgorithm>('median-cut');
    readonly imageExtractCount = input(6);
    readonly showHarmonies = input(false);
    readonly showContrast = input(false);
    readonly contrastBackground = input<string>('#ffffff');
    readonly formats = input<readonly ColorFormat[]>(['hex', 'rgb', 'hsl']);

    readonly colorChange = output<string>();
    readonly recentColorsChange = output<string[]>();

    readonly open = signal(false);

    /** Canonical color state — preserved exactly across external set/get. */
    private readonly rgba = signal<RGBA>(DEFAULT_RGBA);

    /**
     * HSV view-state. Settable for the SV-area UI; written by the
     * component itself whenever the canonical color changes. The
     * `hue` signal preserves hue across grayscale states where HSV's
     * hue is undefined.
     */
    readonly hue = signal(0);
    readonly saturation = signal(0);
    readonly value = signal(0);
    readonly alphaValue = signal(1);

    private readonly internalRecents = signal<string[]>([]);
    readonly extractedPalette = signal<string[]>([]);
    readonly copiedFormat = signal<ColorFormat | null>(null);

    readonly hasTrigger = signal(false);

    readonly colorArea = viewChild<ElementRef<HTMLDivElement>>('colorArea');
    private readonly imageFile = viewChild<ElementRef<HTMLInputElement>>('imageFile');

    private readonly platformId = inject(PLATFORM_ID);
    private readonly isBrowser = isPlatformBrowser(this.platformId);

    private onChange: (value: string) => void = () => { };
    private onTouched: () => void = () => { };
    private readonly formDisabled = signal(false);
    private isDragging = false;
    private dragCleanup: (() => void) | null = null;
    private copyTimer: ReturnType<typeof setTimeout> | null = null;

    readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

    /** Current color as RGBA. */
    readonly currentRgba = this.rgba.asReadonly();
    /** Current color as hex (6-char by default; 8-char when alpha mode is on AND a < 1). */
    readonly currentColor = computed(() => formatHex(this.rgba(), this.alpha()));
    /** RGB triple (no alpha) for the RGB tab. */
    readonly rgb = computed(() => {
        const { r, g, b } = this.rgba();
        return { r, g, b };
    });
    readonly hsl = computed(() => rgbToHsl(this.rgb()));
    readonly oklch = computed(() => rgbToOklch(this.rgb()));

    readonly recents = computed<string[]>(() => this.recentColors() ?? this.internalRecents());

    readonly areaBackground = computed(() => {
        const h = this.hue();
        return `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h}, 100%, 50%))`;
    });

    readonly hueGradient =
        'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)';

    readonly alphaGradient = computed(() => {
        const { r, g, b } = this.rgb();
        return `linear-gradient(to right, rgba(${r},${g},${b},0), rgba(${r},${g},${b},1))`;
    });

    readonly formatValues = computed(() => ({
        hex: this.currentColor(),
        rgb: formatRgb(this.rgba()),
        hsl: formatHsl(this.rgba()),
        oklch: formatOklch(this.rgba()),
    }));

    readonly contrastRatioValue = computed(() => {
        const bg = parseColor(this.contrastBackground());
        if (!bg) return null;
        return contrastRatio(this.rgb(), bg);
    });

    readonly contrastRatioDisplay = computed(() => {
        const ratio = this.contrastRatioValue();
        return ratio === null ? '' : ratio.toFixed(2);
    });

    readonly contrastBadge = computed<WcagBadge | null>(() => {
        const ratio = this.contrastRatioValue();
        return ratio === null ? null : wcagBadge(ratio);
    });

    readonly harmonyGroups = computed<readonly HarmonyGroup[]>(() => {
        if (!this.showHarmonies()) return [];
        const c = this.rgba();
        const inAlpha = this.alpha();
        return [
            { label: 'Complementary', swatches: paletteToHex(harmonyComplementary(c), inAlpha) },
            { label: 'Analogous', swatches: paletteToHex(harmonyAnalogous(c), inAlpha) },
            { label: 'Triadic', swatches: paletteToHex(harmonyTriadic(c), inAlpha) },
            { label: 'Tetradic', swatches: paletteToHex(harmonyTetradic(c), inAlpha) },
        ];
    });

    readonly triggerClasses = computed(() =>
        cn(
            'flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            this.isDisabled() && 'cursor-not-allowed opacity-50',
            this.class(),
        ),
    );

    constructor() {
        effect(() => {
            const color = this.currentColor();
            this.onChange(color);
            this.colorChange.emit(color);
        });

        effect(() => {
            const key = this.storageKey();
            if (!key || !this.isBrowser) return;
            const loaded = readRecents(key, this.maxRecent());
            if (loaded.length > 0) this.internalRecents.set(loaded);
        });

        effect(() => {
            const key = this.storageKey();
            const recents = this.recents();
            if (key && this.isBrowser) writeRecents(key, recents);
        });
    }

    onAreaMouseDown(event: MouseEvent): void {
        if (this.isDisabled()) return;
        this.startAreaDrag(event.clientX, event.clientY);
    }

    onAreaTouchStart(event: TouchEvent): void {
        if (this.isDisabled() || event.touches.length === 0) return;
        event.preventDefault();
        this.startAreaDrag(event.touches[0].clientX, event.touches[0].clientY);
    }

    onAreaKeyDown(event: KeyboardEvent): void {
        if (this.isDisabled()) return;
        const step = keyboardStep(event);
        if (!step) return;
        event.preventDefault();
        const nextS = Math.max(0, Math.min(100, this.saturation() + step.dSaturation));
        const nextV = Math.max(0, Math.min(100, this.value() + step.dValue));
        this.saturation.set(nextS);
        this.value.set(nextV);
        this.commitHsv();
        this.onTouched();
    }

    private startAreaDrag(clientX: number, clientY: number): void {
        this.isDragging = true;
        this.updateFromAreaPosition(clientX, clientY);
        this.dragCleanup = onPointerDrag(
            (moveX, moveY) => {
                if (this.isDragging) this.updateFromAreaPosition(moveX, moveY);
            },
            () => {
                this.isDragging = false;
                this.dragCleanup = null;
            },
        );
    }

    private updateFromAreaPosition(clientX: number, clientY: number): void {
        const area = this.colorArea()?.nativeElement;
        if (!area) return;
        const rect = area.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        this.saturation.set(Math.round(x * 100));
        this.value.set(Math.round((1 - y) * 100));
        this.commitHsv();
    }

    onHueChange(event: Event): void {
        const v = +(event.target as HTMLInputElement).value;
        this.hue.set(v);
        this.commitHsv();
    }

    onAlphaChange(event: Event): void {
        const v = +(event.target as HTMLInputElement).value;
        this.setAlpha(v / 100);
    }

    /** Set the alpha channel (0..1) and sync the canonical color. */
    setAlpha(a: number): void {
        const clamped = Math.max(0, Math.min(1, a));
        this.alphaValue.set(clamped);
        this.rgba.update(prev => ({ ...prev, a: clamped }));
    }

    onHexInput(value: string): void {
        const parsed = parseColor(value);
        if (parsed) this.applyRgba(parsed);
    }

    onRgbChange(channel: 'r' | 'g' | 'b', value: number): void {
        const current = this.rgb();
        const next = { ...current, [channel]: Math.max(0, Math.min(255, value)) };
        this.applyRgba({ ...next, a: this.alphaValue() });
    }

    onHslChange(channel: 's' | 'l', input: number): void {
        const current = this.hsl();
        const next = { ...current, [channel]: Math.max(0, Math.min(100, input)) };
        const rgb = hslToRgb(next);
        this.applyRgba({ ...rgb, a: this.alphaValue() });
    }

    onHslHueChange(value: number): void {
        const next = { ...this.hsl(), h: Math.max(0, Math.min(360, value)) };
        const rgb = hslToRgb(next);
        this.applyRgba({ ...rgb, a: this.alphaValue() });
    }

    selectPreset(color: string): void {
        const parsed = parseColor(color);
        if (!parsed) return;
        this.applyRgba(parsed);
        this.pushRecent(this.currentColor());
        this.onTouched();
    }

    applyExtracted(hex: string): void {
        this.selectPreset(hex);
    }

    onEyedropperPick(hex: string): void {
        this.selectPreset(hex);
    }

    openImagePicker(): void {
        this.imageFile()?.nativeElement.click();
    }

    async onImageSelected(event: Event): Promise<void> {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        try {
            const palette = await extractDominantColors(file, {
                count: this.imageExtractCount(),
                algorithm: this.imageExtractAlgorithm(),
            });
            this.extractedPalette.set(paletteToHex(palette, this.alpha()));
        } catch {
            this.extractedPalette.set([]);
        } finally {
            target.value = '';
        }
    }

    clearExtractedPalette(): void {
        this.extractedPalette.set([]);
    }

    async copy(format: ColorFormat): Promise<void> {
        if (!this.isBrowser) return;
        const text = this.formatValues()[format];
        try {
            await globalThis.navigator?.clipboard?.writeText(text);
            this.copiedFormat.set(format);
            if (this.copyTimer) clearTimeout(this.copyTimer);
            this.copyTimer = setTimeout(() => this.copiedFormat.set(null), 1500);
        } catch {
            /* clipboard unavailable; silently no-op */
        }
    }

    /**
     * Public API: set the picker's color from any parseable RGBA.
     * Syncs HSV view-state without mutating the canonical hex
     * representation.
     */
    applyRgba(rgba: RGBA): void {
        this.rgba.set(rgba);
        const hsv = rgbToHsv(rgba);
        if (hsv.s > 0) this.hue.set(hsv.h);
        this.saturation.set(hsv.s);
        this.value.set(hsv.v);
        this.alphaValue.set(rgba.a);
    }

    private commitHsv(): void {
        const rgb = hsvToRgb({ h: this.hue(), s: this.saturation(), v: this.value() });
        this.rgba.set({ ...rgb, a: this.alphaValue() });
    }

    private pushRecent(color: string): void {
        const controlled = this.recentColors();
        if (controlled !== null) {
            this.recentColorsChange.emit(unshiftUniqueColor(controlled, color, this.maxRecent()));
            return;
        }
        this.internalRecents.update(prev => unshiftUniqueColor(prev, color, this.maxRecent()));
    }

    writeValue(value: string | null): void {
        if (!value) return;
        const parsed = parseColor(value);
        if (parsed) this.applyRgba(parsed);
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
