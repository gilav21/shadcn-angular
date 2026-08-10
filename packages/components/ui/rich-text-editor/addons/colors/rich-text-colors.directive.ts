import {
    DestroyRef,
    Directive,
    Injector,
    computed,
    effect,
    inject,
    input,
    output,
    signal,
    type Signal,
} from '@angular/core';
import { RichTextEditorAddonHost } from '../..';
import { createLocaleBindings, type LocaleInput } from '../../../../lib/i18n';
import { parseColor, formatHex } from '../../../../lib/color';
import { RichTextColorsButtonComponent } from './rich-text-colors-button.component';
import {
    RICH_TEXT_COLOR_BUTTON_CONTEXT,
    type RichTextColorButtonContext,
    type RichTextColorKind,
} from './rich-text-colors.context';
import {
    RICH_TEXT_COLORS_LOCALES,
    DEFAULT_COLOR_PALETTE,
    DEFAULT_HIGHLIGHT_PALETTE,
    type RichTextColorsLocale,
} from './rich-text-colors.locales';

const FOREGROUND_SLOT_ID = 'colors.foreground';
const BACKGROUND_SLOT_ID = 'colors.background';

/** Payload emitted after a colour is applied to the selection. */
export interface RichTextColorChange {
    readonly type: 'fontColor' | 'backgroundColor';
    readonly color: string;
}

/**
 * Opt-in colours addon for `<ui-rich-text-editor>`. Attaches via DI to the
 * `RichTextEditorAddonHost` the base provides and contributes two toolbar
 * buttons — text colour (`colors.foreground`) and highlight colour
 * (`colors.background`) — each a popover with an inline `ui-color-picker`. The
 * base editor ships no colour code and no `color-picker` dependency.
 *
 * Colours apply through the host's `applyInlineStyle` seam (inline
 * `color`/`background-color` styles the sanitizer preserves, plus mention-chip
 * styling), so existing coloured content keeps rendering with the base alone.
 * The picker is seeded from the current selection when a popover opens and left
 * untouched while open; the `ui-color-picker` re-emits its programmatically-set
 * value through `colorChange`, so that echo (a value equal to the reflected
 * selection colour) is ignored rather than re-applied.
 *
 * Strings resolve from `[uiRteColorsLocale]` (a registry key or a full
 * dictionary) or the app-wide `UI_LOCALE_ID` token — NOT the editor's own
 * `[locale]` input.
 *
 * ```html
 * <ui-rich-text-editor uiRteColors />
 * ```
 */
@Directive({
    selector: 'ui-rich-text-editor[uiRteColors], ui-rich-text-editor[uiRteFull]',
    standalone: true,
})
export class RichTextColorsDirective {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly injector = inject(Injector);
    private readonly destroyRef = inject(DestroyRef);

    /** Locale for the addon UI: a registry key (`'en'`/`'he'`/…) or a full dictionary. */
    readonly uiRteColorsLocale = input<LocaleInput<RichTextColorsLocale>>();
    /** Enable the colours addon (the bare `uiRteColors` attribute). Flip to `false` to remove both buttons live. */
    readonly uiRteColors = input(true, { transform: coerceEnabled });
    /** Base sort order of the colour buttons among addon toolbar slots; the highlight button follows the text button. */
    readonly uiRteColorsOrder = input(300);
    /** Preset swatches for the text-colour picker. */
    readonly uiRteColorsPalette = input<string[]>(DEFAULT_COLOR_PALETTE);
    /** Preset swatches for the highlight-colour picker. */
    readonly uiRteColorsHighlightPalette = input<string[]>(DEFAULT_HIGHLIGHT_PALETTE);
    /**
     * Offer an opacity slider on the highlight picker. Off by default: a
     * semi-transparent highlight rarely reads well over body text, and the
     * palette already carries a `transparent` swatch for clearing one.
     */
    readonly uiRteColorsAlpha = input(false, { transform: coerceBoolean });
    /**
     * Show the picker's recently-used row. Off by default: the picker is rebuilt
     * each time a popover opens and has no storage, so the row would only ever
     * echo the colour just picked — while growing the popover enough to push it
     * off screen on a short viewport.
     */
    readonly uiRteColorsRecent = input(false, { transform: coerceBoolean });

    /** Emits after a colour is applied to the selection. */
    readonly colorChange = output<RichTextColorChange>();

    private readonly i18n = createLocaleBindings(this.uiRteColorsLocale, RICH_TEXT_COLORS_LOCALES);

    /** Hex-normalized text colour reflected from the current selection. */
    private readonly currentForeground = computed(() =>
        this.toHex(this.host.selectionInlineStyle().color));
    /** Hex-normalized highlight colour reflected from the current selection ('' when transparent). */
    private readonly currentBackground = computed(() => {
        const raw = this.host.selectionInlineStyle().backgroundColor;
        return this.isTransparent(raw) ? '' : this.toHex(raw);
    });

    private readonly seededForeground = signal('');
    private readonly seededBackground = signal('');
    /** The colour picked since each popover opened, re-applied when it closes. */
    private readonly pickedWhileOpen = new Map<RichTextColorKind, string>();

    constructor() {
        this.registerSlot({
            kind: 'foreground',
            id: FOREGROUND_SLOT_ID,
            tooltip: computed(() => this.i18n.t().textColor),
            heading: computed(() => this.i18n.t().textColor),
            presets: this.uiRteColorsPalette,
            alpha: computed(() => false),
            showRecent: this.uiRteColorsRecent,
            seededColor: this.seededForeground,
            activeColor: this.currentForeground,
            order: () => this.uiRteColorsOrder(),
        });
        this.registerSlot({
            kind: 'background',
            id: BACKGROUND_SLOT_ID,
            tooltip: computed(() => this.i18n.t().backgroundColor),
            heading: computed(() => this.i18n.t().highlightColor),
            presets: this.uiRteColorsHighlightPalette,
            alpha: this.uiRteColorsAlpha,
            showRecent: this.uiRteColorsRecent,
            seededColor: this.seededBackground,
            activeColor: this.currentBackground,
            order: () => this.uiRteColorsOrder() + 1,
        });
    }

    private registerSlot(config: {
        kind: RichTextColorKind;
        id: string;
        tooltip: Signal<string>;
        heading: Signal<string>;
        presets: Signal<string[]>;
        alpha: Signal<boolean>;
        showRecent: Signal<boolean>;
        seededColor: Signal<string>;
        activeColor: Signal<string>;
        order: () => number;
    }): void {
        const { kind, id, tooltip, heading, presets, alpha, showRecent, seededColor, activeColor, order } = config;
        const context: RichTextColorButtonContext = {
            kind,
            tooltip,
            heading,
            presets,
            alpha,
            showRecent,
            seededColor,
            activeColor,
            onOpen: () => this.open(kind),
            onClose: () => this.close(kind),
            onSelect: (color) => this.applyColor(kind, color),
        };
        const slotInjector = Injector.create({
            providers: [{ provide: RICH_TEXT_COLOR_BUTTON_CONTEXT, useValue: context }],
            parent: this.injector,
        });
        effect((onCleanup) => {
            if (!this.uiRteColors()) return;
            onCleanup(this.host.toolbarSlots.register({
                id,
                order: order(),
                component: RichTextColorsButtonComponent,
                injector: slotInjector,
            }));
        });
    }

    private open(kind: RichTextColorKind): void {
        this.pickedWhileOpen.delete(kind);
        this.seed(kind);
    }

    /**
     * Put the caret back where it was, then re-apply the colour picked while the
     * popover was open.
     *
     * A colour chosen at a collapsed caret exists only as the browser's *pending
     * typing style*, and the click that dismisses the popover destroys it: the
     * caret lands somewhere else, the pending style is dropped, and restoring
     * the caret cannot bring it back. Without this, the colour survived only if
     * the user typed before dismissing — the reported bug. Re-applying at the
     * restored caret re-establishes it, so the next character is coloured and
     * the toolbar keeps showing it.
     *
     * A colour picked over a selection is already in the DOM, so it is left
     * alone: re-applying would add a second, identical history entry.
     */
    private close(kind: RichTextColorKind): void {
        const color = this.pickedWhileOpen.get(kind);
        this.pickedWhileOpen.delete(kind);
        /**
         * Deferred because the dismissing click is still being processed: the
         * caret it places lands only after this handler returns. Restoring and
         * re-applying now would run against a selection that is still outside
         * the editor, where `selection()` reports no range at all.
         */
        const timer = setTimeout(() => {
            this.host.restoreSelection();
            if (color === undefined || this.host.selection().range?.collapsed !== true) return;
            this.applyStyle(kind, color);
        });
        this.destroyRef.onDestroy(() => clearTimeout(timer));
    }

    private seed(kind: RichTextColorKind): void {
        if (kind === 'foreground') {
            this.seededForeground.set(this.currentForeground());
        } else {
            this.seededBackground.set(this.currentBackground());
        }
    }

    private applyColor(kind: RichTextColorKind, color: string): void {
        if (this.isEcho(kind, color)) {
            return;
        }
        this.applyStyle(kind, color);
        this.pickedWhileOpen.set(kind, color);
        this.colorChange.emit({
            type: kind === 'foreground' ? 'fontColor' : 'backgroundColor',
            color,
        });
    }

    /** Push a colour through the host seam, without re-announcing it. */
    private applyStyle(kind: RichTextColorKind, color: string): void {
        if (kind === 'foreground') {
            this.host.applyInlineStyle({ color });
        } else {
            this.host.applyInlineStyle({ backgroundColor: color });
        }
    }

    /**
     * True when a picked colour merely echoes the value the picker was seeded
     * with to reflect the current selection. The `ui-color-picker` re-emits its
     * programmatically-set value through `colorChange`; applying it would run a
     * colour command on a mere caret move, so the echo is ignored. A genuine
     * pick of a different colour still differs and applies normally.
     *
     * When there is no reflected colour (`current === ''`, only reachable for a
     * transparent highlight background) there is nothing to echo, so any value is
     * treated as a genuine pick. This never mis-fires in practice: the picker is
     * seeded with `''`, which matches its own empty state, so re-seeding on open
     * produces no `colorChange` — and the button forwards colour changes only
     * while its popover is open. This mirrors the former base `isReflectedColorEcho`.
     */
    private isEcho(kind: RichTextColorKind, color: string): boolean {
        const current = kind === 'foreground' ? this.currentForeground() : this.currentBackground();
        return current !== '' && this.toHex(color) === this.toHex(current);
    }

    private toHex(value: string): string {
        const rgba = parseColor(value);
        return rgba ? formatHex(rgba) : value;
    }

    private isTransparent(value: string): boolean {
        const rgba = parseColor(value);
        return !rgba || rgba.a === 0;
    }
}

/** Coerce the bare `uiRteColors` attribute (empty string) to `true`. */
function coerceEnabled(value: boolean | string | undefined): boolean {
    return value === '' || value === true || value === undefined;
}

/** Coerce an opt-in attribute: bare (empty string) or `true` enables it. */
function coerceBoolean(value: boolean | string | undefined): boolean {
    return value === '' || value === true;
}
