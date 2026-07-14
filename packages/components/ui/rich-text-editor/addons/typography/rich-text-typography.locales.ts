import type { LocaleMeta } from '../../../../lib/i18n';

/**
 * Localized strings for the rich-text typography addon: the font-size and
 * font-family toolbar buttons and their popover panels. Pass a registry key
 * (`'en'`, `'he'`, …) or a full dictionary to `[uiRteTypographyLocale]`.
 *
 * Unlike the former built-in toolbar items, these strings resolve from the
 * addon's own `[uiRteTypographyLocale]` input (or the global `UI_LOCALE_ID`),
 * not the editor's `[locale]` input.
 */
export interface RichTextTypographyLocale extends LocaleMeta {
    /** Font-size button tooltip. */
    fontSize: string;
    /** Font-family button tooltip. */
    fontFamily: string;
    /** Font-size popover heading. */
    selectSize: string;
    /** Font-size autocomplete placeholder. */
    selectSizePlaceholder: string;
    /** Font-family popover heading. */
    selectFamily: string;
    /** Font-family autocomplete placeholder. */
    selectFamilyPlaceholder: string;
}

/** Built-in locales for the typography addon. */
export const RICH_TEXT_TYPOGRAPHY_LOCALES: Record<string, RichTextTypographyLocale> = {
    en: { code: 'en', fontSize: 'Font Size', fontFamily: 'Font Family', selectSize: 'Select Size', selectSizePlaceholder: 'Select size', selectFamily: 'Select Font', selectFamilyPlaceholder: 'Search fonts...' },
    he: { code: 'he', rtl: true, fontSize: 'גודל גופן', fontFamily: 'משפחת גופנים', selectSize: 'בחירת גודל', selectSizePlaceholder: 'בחירת גודל', selectFamily: 'בחירת גופן', selectFamilyPlaceholder: 'חיפוש גופנים...' },
    ar: { code: 'ar', rtl: true, fontSize: 'حجم الخط', fontFamily: 'نوع الخط', selectSize: 'اختيار الحجم', selectSizePlaceholder: 'اختيار الحجم', selectFamily: 'اختيار الخط', selectFamilyPlaceholder: 'البحث عن خطوط...' },
    de: { code: 'de', fontSize: 'Schriftgröße', fontFamily: 'Schriftart', selectSize: 'Größe wählen', selectSizePlaceholder: 'Größe wählen', selectFamily: 'Schriftart wählen', selectFamilyPlaceholder: 'Schriftarten suchen...' },
    fr: { code: 'fr', fontSize: 'Taille de police', fontFamily: 'Police de caractères', selectSize: 'Choisir la taille', selectSizePlaceholder: 'Choisir la taille', selectFamily: 'Choisir la police', selectFamilyPlaceholder: 'Rechercher des polices...' },
    es: { code: 'es', fontSize: 'Tamaño de fuente', fontFamily: 'Familia tipográfica', selectSize: 'Seleccionar tamaño', selectSizePlaceholder: 'Seleccionar tamaño', selectFamily: 'Seleccionar fuente', selectFamilyPlaceholder: 'Buscar fuentes...' },
    ja: { code: 'ja', fontSize: 'フォントサイズ', fontFamily: 'フォント', selectSize: 'サイズを選択', selectSizePlaceholder: 'サイズを選択', selectFamily: 'フォントを選択', selectFamilyPlaceholder: 'フォントを検索...' },
    zh: { code: 'zh', fontSize: '字号', fontFamily: '字体', selectSize: '选择大小', selectSizePlaceholder: '选择大小', selectFamily: '选择字体', selectFamilyPlaceholder: '搜索字体...' },
    ru: { code: 'ru', fontSize: 'Размер шрифта', fontFamily: 'Шрифт', selectSize: 'Выбрать размер', selectSizePlaceholder: 'Выберите размер', selectFamily: 'Выбрать шрифт', selectFamilyPlaceholder: 'Поиск шрифтов...' },
    pt: { code: 'pt', fontSize: 'Tamanho da fonte', fontFamily: 'Família tipográfica', selectSize: 'Selecionar tamanho', selectSizePlaceholder: 'Selecionar tamanho', selectFamily: 'Selecionar fonte', selectFamilyPlaceholder: 'Pesquisar fontes...' },
};
