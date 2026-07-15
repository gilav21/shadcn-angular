import {
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
import { RichTextTypographyButtonComponent } from './rich-text-typography-button.component';
import {
    RICH_TEXT_TYPOGRAPHY_BUTTON_CONTEXT,
    type RichTextTypographyButtonContext,
    type RichTextTypographyKind,
} from './rich-text-typography.context';
import {
    RICH_TEXT_TYPOGRAPHY_LOCALES,
    type RichTextTypographyLocale,
} from './rich-text-typography.locales';

const SIZE_SLOT_ID = 'typography.size';
const FAMILY_SLOT_ID = 'typography.family';

/**
 * The default set of web-safe font families offered by the font-family dropdown.
 * Pass a custom array via `[uiRteTypographyFamilies]` to replace or extend this
 * list (see {@link FontFamilyStrategy}).
 */
export const DEFAULT_FONT_FAMILIES: string[] = [
    'Arial',
    'Helvetica',
    'Verdana',
    'Tahoma',
    'Trebuchet MS',
    'Times New Roman',
    'Georgia',
    'Garamond',
    'Courier New',
    'Lucida Console',
    'Comic Sans MS',
    'Impact',
];

/**
 * Controls whether custom font families replace or extend the built-in defaults.
 *
 * - `'append'`  — Custom fonts are added after {@link DEFAULT_FONT_FAMILIES}.
 * - `'replace'` — Only the custom fonts are shown; defaults are discarded.
 */
export type FontFamilyStrategy = 'append' | 'replace';

/** Font sizes (px) offered by the font-size dropdown: 8px…72px in 2px steps. */
const FONT_SIZE_STEPS = Array.from({ length: 33 }, (_, i) => 8 + i * 2);

/**
 * Opt-in typography addon for `<ui-rich-text-editor>`. Attaches via DI to the
 * `RichTextEditorAddonHost` the base provides and contributes two toolbar
 * buttons — font size (`typography.size`) and font family (`typography.family`)
 * — each a popover with an inline `ui-autocomplete`. The base editor ships no
 * font-size/font-family toolbar code and no `autocomplete` dependency.
 *
 * Both apply through the host's `applyInlineStyle` seam (inline `font-size` /
 * `font-family` styles the sanitizer preserves, plus mention-chip styling), so
 * existing content keeps rendering with the base alone. Each autocomplete is
 * seeded from the current selection when its popover opens.
 *
 * Strings resolve from `[uiRteTypographyLocale]` (a registry key or a full
 * dictionary) or the app-wide `UI_LOCALE_ID` token — NOT the editor's own
 * `[locale]` input.
 *
 * ```html
 * <ui-rich-text-editor uiRteTypography />
 * ```
 */
@Directive({
    selector: 'ui-rich-text-editor[uiRteTypography], ui-rich-text-editor[uiRteFull]',
    standalone: true,
})
export class RichTextTypographyDirective {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly injector = inject(Injector);

    /** Locale for the addon UI: a registry key (`'en'`/`'he'`/…) or a full dictionary. */
    readonly uiRteTypographyLocale = input<LocaleInput<RichTextTypographyLocale>>();
    /** Enable the typography addon (the bare `uiRteTypography` attribute). Flip to `false` to remove both buttons live. */
    readonly uiRteTypography = input(true, { transform: coerceEnabled });
    /** Base sort order of the typography buttons among addon toolbar slots; the family button follows the size button. */
    readonly uiRteTypographyOrder = input(310);
    /** Custom font families for the font-family dropdown (see {@link FontFamilyStrategy}). */
    readonly uiRteTypographyFamilies = input<string[]>([]);
    /** Whether custom {@link uiRteTypographyFamilies} replace or extend the defaults. */
    readonly uiRteTypographyFamiliesStrategy = input<FontFamilyStrategy>('append');

    /** Emits the applied font size (numeric px string, e.g. `'24'`). */
    readonly fontSizeSelect = output<string>();
    /** Emits the applied font family. */
    readonly fontFamilySelect = output<string>();

    private readonly i18n = createLocaleBindings(this.uiRteTypographyLocale, RICH_TEXT_TYPOGRAPHY_LOCALES);

    /** Font-size options suffixed with `px`. */
    private readonly sizeOptions = signal(FONT_SIZE_STEPS.map((size) => `${size}px`));

    /** Resolved font-family options: defaults, replaced or appended per strategy. */
    private readonly familyOptions = computed<string[]>(() => {
        const custom = this.uiRteTypographyFamilies();
        if (custom.length === 0) {
            return DEFAULT_FONT_FAMILIES;
        }
        if (this.uiRteTypographyFamiliesStrategy() === 'replace') {
            return custom;
        }
        return [...DEFAULT_FONT_FAMILIES, ...custom];
    });

    private readonly seededSize = signal('');
    private readonly seededFamily = signal('');

    constructor() {
        this.registerSlot({
            kind: 'size',
            id: SIZE_SLOT_ID,
            tooltip: computed(() => this.i18n.t().fontSize),
            heading: computed(() => this.i18n.t().selectSize),
            placeholder: computed(() => this.i18n.t().selectSizePlaceholder),
            options: this.sizeOptions,
            filter: false,
            seededValue: this.seededSize,
            order: () => this.uiRteTypographyOrder(),
        });
        this.registerSlot({
            kind: 'family',
            id: FAMILY_SLOT_ID,
            tooltip: computed(() => this.i18n.t().fontFamily),
            heading: computed(() => this.i18n.t().selectFamily),
            placeholder: computed(() => this.i18n.t().selectFamilyPlaceholder),
            options: this.familyOptions,
            filter: true,
            seededValue: this.seededFamily,
            order: () => this.uiRteTypographyOrder() + 1,
        });
    }

    private registerSlot(config: {
        kind: RichTextTypographyKind;
        id: string;
        tooltip: Signal<string>;
        heading: Signal<string>;
        placeholder: Signal<string>;
        options: Signal<string[]>;
        filter: boolean;
        seededValue: Signal<string>;
        order: () => number;
    }): void {
        const { kind, id, tooltip, heading, placeholder, options, filter, seededValue, order } = config;
        const context: RichTextTypographyButtonContext = {
            kind,
            tooltip,
            heading,
            placeholder,
            options,
            filter,
            seededValue,
            onOpen: () => this.seed(kind),
            onSelect: (value) => this.apply(kind, value),
        };
        const slotInjector = Injector.create({
            providers: [{ provide: RICH_TEXT_TYPOGRAPHY_BUTTON_CONTEXT, useValue: context }],
            parent: this.injector,
        });
        effect((onCleanup) => {
            if (!this.uiRteTypography()) return;
            onCleanup(this.host.toolbarSlots.register({
                id,
                order: order(),
                component: RichTextTypographyButtonComponent,
                injector: slotInjector,
            }));
        });
    }

    private seed(kind: RichTextTypographyKind): void {
        const style = this.host.selectionInlineStyle();
        if (kind === 'size') {
            this.seededSize.set(style.fontSize ? `${style.fontSize}px` : '');
        } else {
            this.seededFamily.set(style.fontFamily);
        }
    }

    private apply(kind: RichTextTypographyKind, value: string): void {
        if (kind === 'size') {
            const numeric = value.replaceAll(/\D/g, '');
            if (!numeric || Number.isNaN(Number(numeric))) {
                return;
            }
            this.host.applyInlineStyle({ fontSize: numeric });
            this.fontSizeSelect.emit(numeric);
        } else {
            if (!value) {
                return;
            }
            this.host.applyInlineStyle({ fontFamily: value });
            this.fontFamilySelect.emit(value);
        }
    }
}

/** Coerce the bare `uiRteTypography` attribute (empty string) to `true`. */
function coerceEnabled(value: boolean | string | undefined): boolean {
    return value === '' || value === true || value === undefined;
}
