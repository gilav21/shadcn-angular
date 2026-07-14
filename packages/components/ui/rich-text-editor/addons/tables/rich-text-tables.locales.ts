import type { LocaleMeta } from '../../../../lib/i18n';

/**
 * Localized strings for the rich-text tables addon: the toolbar table button
 * and its grid-picker popover. Pass a registry key (`'en'`, `'he'`, …) or a
 * full dictionary to `[uiRteTablesLocale]`.
 *
 * Unlike the former built-in table toolbar item, these strings resolve from the
 * addon's own `[uiRteTablesLocale]` input (or the global `UI_LOCALE_ID`), not
 * the editor's `[locale]` input. The base keeps the separate table-EDITING
 * strings (add/delete row/column, merge cells, borders…) since editing an
 * existing table stays in the base.
 */
export interface RichTextTablesLocale extends LocaleMeta {
    /** Toolbar button tooltip. */
    tooltip: string;
    /** Grid-picker hint shown before a size is hovered. */
    insertTable: string;
}

/** Built-in locales for the tables addon. */
export const RICH_TEXT_TABLES_LOCALES: Record<string, RichTextTablesLocale> = {
    en: { code: 'en', tooltip: 'Insert Table', insertTable: 'Insert Table' },
    he: { code: 'he', rtl: true, tooltip: 'הוספת טבלה', insertTable: 'הוספת טבלה' },
    ar: { code: 'ar', rtl: true, tooltip: 'إدراج جدول', insertTable: 'إدراج جدول' },
    de: { code: 'de', tooltip: 'Tabelle einfügen', insertTable: 'Tabelle einfügen' },
    fr: { code: 'fr', tooltip: 'Insérer un tableau', insertTable: 'Insérer un tableau' },
    es: { code: 'es', tooltip: 'Insertar tabla', insertTable: 'Insertar tabla' },
    ja: { code: 'ja', tooltip: 'テーブルを挿入', insertTable: 'テーブルを挿入' },
    zh: { code: 'zh', tooltip: '插入表格', insertTable: '插入表格' },
    ru: { code: 'ru', tooltip: 'Вставить таблицу', insertTable: 'Вставить таблицу' },
    pt: { code: 'pt', tooltip: 'Inserir tabela', insertTable: 'Inserir tabela' },
};
