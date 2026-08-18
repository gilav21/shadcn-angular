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
    untracked,
    inject,
    PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { cn } from '../../lib/utils';
import { createLocaleBindings, type LocaleInput } from '../../lib/i18n';
import { COLOR_PICKER_LOCALES, type ColorPickerLocale } from './color-picker.locales';
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
import { TooltipDirective } from '../tooltip';
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
    readonly hint: string;
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
        TooltipDirective,
        NgTemplateOutlet,
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
    /** Swatches shown in the preset row. Any CSS colour `parseColor` understands; unparseable entries are ignored on click. Picking one also pushes it into the recents. */
    readonly presets = input<string[]>([]);
    /** Render just the picker panel, without the built-in trigger + popover (for embedding inside another popover). */
    readonly inline = input(false);
    /** Disables every control. OR-ed with the form's own disabled state ({@link setDisabledState}), so a reactive form can disable the picker without this input. */
    readonly disabled = input(false);
    /** Extra classes merged onto the trigger button (not the popover panel). Ignored in {@link inline} mode, which renders no trigger. */
    readonly class = input('');
    /**
     * Shows the alpha slider and widens the emitted hex to 8 characters when
     * `a < 1`. A fully transparent colour keeps its alpha even with this off, so
     * a `transparent` preset never silently becomes opaque black.
     */
    readonly alpha = input(false);
    /**
     * Controlled recents. Leave `null` (default) and the picker keeps its own
     * list; pass an array and it becomes the single source of truth — the picker
     * stops mutating it and only emits {@link recentColorsChange}, so you must
     * store that back or the list never grows.
     */
    readonly recentColors = input<string[] | null>(null);
    /**
     * Show the recently-used row. Turn off where recents have nowhere to live —
     * a picker rebuilt on every open, with no `storageKey` — since the row would
     * then only ever echo the colour just picked while taking up space.
     */
    readonly showRecent = input(true);
    /** How many recents to keep. Applies to both the internal list and the array emitted through {@link recentColorsChange}, and caps what is read back from {@link storageKey}. */
    readonly maxRecent = input(8);
    /**
     * `localStorage` key under which recents survive a reload. Browser-only —
     * a no-op under SSR. Two pickers sharing a key share a list on load but do
     * not stay in sync afterwards, since each only writes its own.
     */
    readonly storageKey = input<string | null>(null);
    /** Offers the screen eyedropper. The native `EyedropperAPI` is Chromium-only; elsewhere the button falls back to sampling {@link fallbackTarget}, and is useless if that is null too. */
    readonly enableEyedropper = input(true);
    /** Element the eyedropper samples when the browser has no native `EyeDropper`. Must be same-origin, or reading its pixels taints the canvas and the pick fails. */
    readonly fallbackTarget = input<HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | null>(null);

    /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
    readonly locale = input<LocaleInput<ColorPickerLocale>>();
    private readonly i18n = createLocaleBindings(this.locale, COLOR_PICKER_LOCALES);
    protected readonly t = this.i18n.t;
    protected readonly dir = this.i18n.dir;
    /** Adds the "pick from image" control. The chosen file is decoded locally — nothing is uploaded — and its dominant colours land in the extracted-palette row, with the first one selected immediately. */
    readonly enableImagePick = input(false);
    /** Quantisation strategy used by {@link enableImagePick}. `'median-cut'` gives evenly spread colours; the alternatives trade fidelity for speed on large images. */
    readonly imageExtractAlgorithm = input<ExtractAlgorithm>('median-cut');
    /** How many colours to pull out of a picked image. Higher counts cost more CPU and start returning near-duplicates. */
    readonly imageExtractCount = input(6);
    /** Adds the harmony panel (readable / opposite / neighbours / trio / quartet) derived from the current colour. Off by default because it makes the popover noticeably taller. */
    readonly showHarmonies = input(false);
    /** Adds the WCAG contrast panel comparing the current colour against {@link contrastBackground}. */
    readonly showContrast = input(false);
    /** The colour the contrast panel compares against, i.e. slot B. Changing it while slot B is the active slot is overwritten by the next colour pick — see {@link setCompareSlot}. */
    readonly contrastBackground = input<string>('#ffffff');
    /** Which format tabs the panel offers. Order is respected; the first entry is the tab shown initially. Only affects the editors — the emitted value is always hex. */
    readonly formats = input<readonly ColorFormat[]>(['hex', 'rgb', 'hsl']);

    /**
     * The current colour as hex, emitted on every **user-driven** change of the
     * canonical colour. Programmatic writes stay silent: neither the initial
     * colour nor a value pushed in through {@link writeValue} is echoed back, so
     * binding this output into the same state the picker is written from does
     * not loop and does not mark a form control dirty.
     */
    readonly colorChange = output<string>();
    /** The next recents list, emitted only while {@link recentColors} is controlled (non-null). Uncontrolled pickers keep recents internally and stay silent here. */
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
    readonly copiedHarmony = signal<string | null>(null);
    private copiedHarmonyTimer: ReturnType<typeof setTimeout> | null = null;

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
    private suppressedColor: string | null = null;
    private hasEmittedInitialColor = false;

    readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

    /** Current color as RGBA. */
    readonly currentRgba = this.rgba.asReadonly();
    /** Current color as hex (6-char by default; 8-char when alpha mode is on AND a < 1). */
    /**
     * A fully transparent colour keeps its alpha channel even when the alpha
     * control is hidden: "transparent" means no colour at all, not an opacity
     * level. Without this, a `transparent` preset collapses to opaque black as
     * soon as a consumer turns alpha off — silently turning "clear this" into
     * "paint it black".
     */
    readonly currentColor = computed(() => {
        const rgba = this.rgba();
        return formatHex(rgba, this.alpha() || rgba.a === 0);
    });
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

    readonly compareA = signal<RGBA>(DEFAULT_RGBA);
    readonly compareB = signal<RGBA>({ r: 255, g: 255, b: 255, a: 1 });
    readonly compareActive = signal<'a' | 'b'>('a');

    readonly compareAHex = computed(() => formatHex(this.compareA(), this.alpha()));
    readonly compareBHex = computed(() => formatHex(this.compareB(), this.alpha()));

    readonly contrastRatioValue = computed(() => {
        const a = this.compareA();
        const b = this.compareB();
        return contrastRatio({ r: a.r, g: a.g, b: a.b }, { r: b.r, g: b.g, b: b.b });
    });

    /**
     * Chooses which side of the contrast pair the picker now edits, and loads
     * that slot's colour as the current colour. From then on every pick writes
     * into that slot — so selecting `'b'` lets the user tune the background,
     * overriding {@link contrastBackground} until the slot is switched back.
     */
    setCompareSlot(slot: 'a' | 'b'): void {
        if (this.compareActive() === slot) return;
        this.compareActive.set(slot);
        const next = slot === 'a' ? this.compareA() : this.compareB();
        this.applyRgba(next);
    }

    readonly contrastRatioDisplay = computed(() => this.contrastRatioValue().toFixed(2));

    readonly contrastBadge = computed<WcagBadge | null>(() => wcagBadge(this.contrastRatioValue()));

    readonly harmonyGroups = computed<readonly HarmonyGroup[]>(() => {
        if (!this.showHarmonies()) return [];
        const c = this.rgba();
        const inAlpha = this.alpha();
        return [
            {
                label: 'Readable',
                hint: 'Best color for TEXT on this background. Black or white, whichever has higher WCAG contrast. Use this for labels, body text, or icons that must stay legible.',
                swatches: this.readableSwatches(c),
            },
            {
                label: 'Opposite',
                hint: 'Opposite on the color wheel — vibrant visual pop. Use for accents that should grab the eye (buttons, badges, highlights). NOT a readable text color: complementary pairs often have similar brightness, so contrast for text can be poor. Use "Readable" above for text.',
                swatches: paletteToHex(harmonyComplementary(c), inAlpha),
            },
            {
                label: 'Neighbors',
                hint: 'Sit right next to this color on the wheel — calm and harmonious. Great for backgrounds, gradients, and sections that should feel related.',
                swatches: paletteToHex(harmonyAnalogous(c), inAlpha),
            },
            {
                label: 'Trio',
                hint: 'Three evenly-spaced colors — balanced and lively without clashing. Use one as the main color and the others as accents.',
                swatches: paletteToHex(harmonyTriadic(c), inAlpha),
            },
            {
                label: 'Quartet',
                hint: 'Two pairs of opposites — a rich, bold four-color palette. Pick one as the dominant color, the rest as supporting accents.',
                swatches: paletteToHex(harmonyTetradic(c), inAlpha),
            },
        ];
    });

    readonly triggerClasses = computed(() =>
        cn(
            'flex w-full items-center rounded-md border border-input bg-background text-sm ring-offset-background',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            this.isDisabled() && 'cursor-not-allowed opacity-50',
            this.class(),
        ),
    );

    constructor() {
        effect(() => {
            const color = this.currentColor();
            if (this.isProgrammatic(color)) return;
            this.onChange(color);
            this.colorChange.emit(color);
        });

        effect(() => {
            const parsed = parseColor(this.contrastBackground());
            if (parsed) this.compareB.set(parsed);
        });

        effect(() => {
            const next = this.rgba();
            untracked(() => {
                if (this.compareActive() === 'a') this.compareA.set(next);
                else this.compareB.set(next);
            });
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

    /**
     * Starts a saturation/value drag in the SV area from the pointer position.
     * Suppresses the default to stop the browser extending an existing text
     * selection while dragging — without that, a picker opened over an editor
     * grows the selection its caller then applies the colour to.
     * See {@link onAreaTouchStart} for the touch path.
     */
    onAreaMouseDown(event: MouseEvent): void {
        if (this.isDisabled()) return;
        // Prevent the browser from starting/extending a native text selection while the
        // user drags in the saturation area — otherwise dragging over a page that already
        // has a selection (e.g. an editor) grows it and the picker's caller applies to it.
        event.preventDefault();
        this.startAreaDrag(event.clientX, event.clientY);
    }

    /** Touch counterpart of {@link onAreaMouseDown}; tracks the first finger and cancels the default so the page does not scroll under the drag. */
    onAreaTouchStart(event: TouchEvent): void {
        if (this.isDisabled() || event.touches.length === 0) return;
        event.preventDefault();
        this.startAreaDrag(event.touches[0].clientX, event.touches[0].clientY);
    }

    /**
     * Keyboard access to the SV area: arrows nudge saturation/value by 1 (10 with
     * Shift), Home/End jump saturation to the extremes and PageUp/PageDown move
     * value by 10; everything stays clamped to 0..100. Marks the control touched.
     * Other keys pass through so the popover's own shortcuts (Escape, Tab) still work.
     */
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

    /** Handler for the hue slider's `input` event. Hue is held separately from the colour so it survives greys, where HSV hue is undefined and would otherwise reset to 0. */
    onHueChange(event: Event): void {
        const v = +(event.target as HTMLInputElement).value;
        this.hue.set(v);
        this.commitHsv();
    }

    /** Handler for the alpha slider's `input` event; the 0..100 slider value is rescaled to the 0..1 channel via {@link setAlpha}. */
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

    /** Applies text typed into the hex field. Anything `parseColor` rejects is ignored silently, leaving the previous colour — so partially typed values do not flash. Accepts any CSS colour, not just hex. */
    onHexInput(value: string): void {
        const parsed = parseColor(value);
        if (parsed) this.applyRgba(parsed);
    }

    /** Sets one RGB channel from the RGB tab, clamped to 0..255 and keeping the current alpha. Does not push to recents — only explicit swatch picks do. */
    onRgbChange(channel: 'r' | 'g' | 'b', value: number): void {
        const current = this.rgb();
        const next = { ...current, [channel]: Math.max(0, Math.min(255, value)) };
        this.applyRgba({ ...next, a: this.alphaValue() });
    }

    /** Sets HSL saturation or lightness, clamped to 0..100 and round-tripped through RGB. Hue is handled by {@link onHslHueChange} because it wraps at 360 instead. */
    onHslChange(channel: 's' | 'l', input: number): void {
        const current = this.hsl();
        const next = { ...current, [channel]: Math.max(0, Math.min(100, input)) };
        const rgb = hslToRgb(next);
        this.applyRgba({ ...rgb, a: this.alphaValue() });
    }

    /** Sets HSL hue, clamped to 0..360. At zero saturation the conversion back through RGB loses the hue, so the marker can appear not to move on greys. */
    onHslHueChange(value: number): void {
        const next = { ...this.hsl(), h: Math.max(0, Math.min(360, value)) };
        const rgb = hslToRgb(next);
        this.applyRgba({ ...rgb, a: this.alphaValue() });
    }

    /**
     * Applies a swatch and records it in the recents — the one entry point that
     * does, unlike the slider/field handlers. Ignores unparseable values. The
     * recorded string is the picker's own normalised hex, not the argument, so a
     * `rgb(…)` preset lands in recents as hex.
     */
    selectPreset(color: string): void {
        const parsed = parseColor(color);
        if (!parsed) return;
        this.applyRgba(parsed);
        this.pushRecent(this.currentColor());
        this.onTouched();
    }

    /** Selects a swatch from the image-extracted palette; behaves exactly like {@link selectPreset}, including the push to recents. The extracted row itself stays until {@link clearExtractedPalette}. */
    applyExtracted(hex: string): void {
        this.selectPreset(hex);
    }

    /** Applies a colour sampled by the eyedropper, recording it in recents like a preset pick. Cancelling the eyedropper never reaches here, so the previous colour stands. */
    onEyedropperPick(hex: string): void {
        this.selectPreset(hex);
    }

    /** Opens the OS file dialog for image extraction by clicking the hidden file input. Must be called from a user gesture or the browser blocks it. */
    openImagePicker(): void {
        this.imageFile()?.nativeElement.click();
    }

    /**
     * Extracts the dominant colours from the chosen file and selects the first
     * one straight away. Decoding is local — the file never leaves the browser.
     * On failure the palette is emptied and no error surfaces to the user. The
     * input is always reset afterwards so re-picking the same file re-triggers.
     */
    async onImageSelected(event: Event): Promise<void> {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        try {
            const palette = await extractDominantColors(file, {
                count: this.imageExtractCount(),
                algorithm: this.imageExtractAlgorithm(),
            });
            const hexPalette = paletteToHex(palette, this.alpha());
            this.extractedPalette.set(hexPalette);
            if (hexPalette.length > 0) {
                this.selectPreset(hexPalette[0]);
            }
        } catch {
            this.extractedPalette.set([]);
        } finally {
            target.value = '';
        }
    }

    /** Hides the image-extracted palette row. The colour already applied from it is kept, as is anything it added to recents. */
    clearExtractedPalette(): void {
        this.extractedPalette.set([]);
    }

    private readableSwatches(c: RGBA): readonly string[] {
        const rgb = { r: c.r, g: c.g, b: c.b };
        const vsBlack = contrastRatio(rgb, { r: 0, g: 0, b: 0 });
        const vsWhite = contrastRatio(rgb, { r: 255, g: 255, b: 255 });
        return vsBlack >= vsWhite ? ['#000000', '#ffffff'] : ['#ffffff', '#000000'];
    }

    /** Whether a harmony group already contains this exact hex, used to mark the current colour inside its own harmony row. String comparison — case and 6-vs-8-char form must match. */
    groupContains(group: HarmonyGroup, hex: string): boolean {
        return group.swatches.includes(hex);
    }

    /**
     * Copies a harmony swatch to the clipboard and flags it as copied for 1.5s.
     * Copying only — it does **not** select the colour. Silently does nothing
     * without clipboard permission or under SSR, so the "copied" flag is the
     * only success signal.
     */
    async copyHarmony(hex: string): Promise<void> {
        if (!this.isBrowser) return;
        try {
            await globalThis.navigator?.clipboard?.writeText(hex);
            this.copiedHarmony.set(hex);
            if (this.copiedHarmonyTimer) clearTimeout(this.copiedHarmonyTimer);
            this.copiedHarmonyTimer = setTimeout(() => this.copiedHarmony.set(null), 1500);
        } catch {
            /* clipboard unavailable; silently no-op */
        }
    }

    /**
     * Copies the current colour rendered in the given format (`hex`, `rgb`,
     * `hsl`, `oklch`) and flags that tab as copied for 1.5s. Works for any
     * format, including ones not listed in {@link formats}. No-op when the
     * clipboard is unavailable or under SSR.
     */
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

    /**
     * True while `color` is the result of a programmatic write rather than a
     * user pick — the initial colour, or the value {@link writeValue} just
     * applied. Consuming the marker here (rather than clearing a flag around the
     * write) is what makes it correct: the colour effect is asynchronous, so it
     * runs long after `writeValue` has returned.
     */
    private isProgrammatic(color: string): boolean {
        const isInitial = !this.hasEmittedInitialColor;
        this.hasEmittedInitialColor = true;
        const suppressed = this.suppressedColor;
        this.suppressedColor = null;
        return isInitial || suppressed === color;
    }

    private commitHsv(): void {
        const rgb = hsvToRgb({ h: this.hue(), s: this.saturation(), v: this.value() });
        this.rgba.set({ ...rgb, a: this.alphaValue() });
    }

    private pushRecent(color: string): void {
        if (!this.showRecent()) return;
        const controlled = this.recentColors();
        if (controlled !== null) {
            this.recentColorsChange.emit(unshiftUniqueColor(controlled, color, this.maxRecent()));
            return;
        }
        this.internalRecents.update(prev => unshiftUniqueColor(prev, color, this.maxRecent()));
    }

    /**
     * `ControlValueAccessor` hook — accepts any CSS colour string. `null`, an
     * empty string and unparseable values are ignored, so a form cannot reset
     * the picker back to a blank state, only to another colour.
     *
     * The applied value is **not** echoed: it is marked programmatic, so the
     * colour effect skips {@link colorChange} and the registered `onChange` for
     * it and the control is not marked dirty by a write.
     */
    writeValue(value: string | null): void {
        if (!value) return;
        const parsed = parseColor(value);
        if (!parsed) return;
        const previous = this.currentColor();
        this.applyRgba(parsed);
        const next = this.currentColor();
        if (next !== previous) this.suppressedColor = next;
    }

    /** `ControlValueAccessor` hook. The registered callback receives the same hex string as {@link colorChange}, and on the same terms — user picks only, never the initial colour or a {@link writeValue}. */
    registerOnChange(fn: (value: string) => void): void {
        this.onChange = fn;
    }

    /** `ControlValueAccessor` hook. Touched is raised on preset/eyedropper picks and SV-area keyboard input, not on slider or numeric-field edits. */
    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    /** `ControlValueAccessor` hook. Held separately from the {@link disabled} input and OR-ed with it, so `disabled` cannot be cleared by the form re-enabling the control. */
    setDisabledState(isDisabled: boolean): void {
        this.formDisabled.set(isDisabled);
    }
}
