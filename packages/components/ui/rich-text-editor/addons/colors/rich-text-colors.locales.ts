import type { LocaleMeta } from '../../../../lib/i18n';

/**
 * Localized strings for the rich-text colors addon: the text-color and
 * highlight-color toolbar buttons and their popover headings. Pass a registry
 * key (`'en'`, `'he'`, …) or a full dictionary to `[uiRteColorsLocale]`.
 *
 * Unlike the former built-in toolbar items, these strings resolve from the
 * addon's own `[uiRteColorsLocale]` input (or the global `UI_LOCALE_ID`), not
 * the editor's `[locale]` input.
 */
export interface RichTextColorsLocale extends LocaleMeta {
    /** Text-color button tooltip and popover heading. */
    textColor: string;
    /** Highlight-color button tooltip. */
    backgroundColor: string;
    /** Highlight-color popover heading. */
    highlightColor: string;
}

/** Built-in locales for the colors addon. */
export const RICH_TEXT_COLORS_LOCALES: Record<string, RichTextColorsLocale> = {
    en: { code: 'en', textColor: 'Text Color', backgroundColor: 'Background Color', highlightColor: 'Highlight Color' },
    he: { code: 'he', rtl: true, textColor: 'צבע טקסט', backgroundColor: 'צבע רקע', highlightColor: 'צבע הדגשה' },
    ar: { code: 'ar', rtl: true, textColor: 'لون النص', backgroundColor: 'لون الخلفية', highlightColor: 'لون التمييز' },
    de: { code: 'de', textColor: 'Textfarbe', backgroundColor: 'Hintergrundfarbe', highlightColor: 'Hervorhebungsfarbe' },
    fr: { code: 'fr', textColor: 'Couleur du texte', backgroundColor: 'Couleur de fond', highlightColor: 'Couleur de surlignage' },
    es: { code: 'es', textColor: 'Color de texto', backgroundColor: 'Color de fondo', highlightColor: 'Color de resaltado' },
    ja: { code: 'ja', textColor: '文字色', backgroundColor: '背景色', highlightColor: 'ハイライト色' },
    zh: { code: 'zh', textColor: '文字颜色', backgroundColor: '背景颜色', highlightColor: '高亮颜色' },
    ru: { code: 'ru', textColor: 'Цвет текста', backgroundColor: 'Цвет фона', highlightColor: 'Цвет выделения' },
    pt: { code: 'pt', textColor: 'Cor do texto', backgroundColor: 'Cor de fundo', highlightColor: 'Cor de destaque' },
};

/** Default text-color palette offered by the text-color picker. */
export const DEFAULT_COLOR_PALETTE: string[] = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#ffffff',
    '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff',
    '#9900ff', '#ff00ff', '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3',
    '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc', '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599',
];

/** Default highlight-color palette offered by the highlight-color picker. */
export const DEFAULT_HIGHLIGHT_PALETTE: string[] = [
    '#ffffff', '#fef3c7', '#fef9c3', '#d9f99d', '#bbf7d0', '#a7f3d0', '#99f6e4',
    '#a5f3fc', '#bae6fd', '#c7d2fe', '#ddd6fe', '#f5d0fe', '#fce7f3', '#fed7aa', '#fecaca',
    '#fde68a', '#fef08a', '#86efac', '#4ade80', '#6ee7b7', '#5eead4', '#67e8f9', '#7dd3fc',
    '#a5b4fc', '#c4b5fd', '#e879f9', '#f472b6', '#fb923c', '#f87171', '#facc15', '#a3e635',
];
