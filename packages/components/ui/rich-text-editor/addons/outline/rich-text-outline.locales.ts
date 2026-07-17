import type { LocaleMeta } from '../../../../lib/i18n';

/**
 * Localized strings for the rich-text document-outline addon: the toolbar
 * button tooltip, the `/outline` slash command, and the docked panel's title,
 * empty state, and close-button label. Pass a registry key (`'en'`, `'he'`, …)
 * or a full dictionary to `[uiRteOutlineLocale]`.
 *
 * Unlike the former built-in outline UI (which read `RichTextLocale.outline` +
 * `RichTextLocale.slashCommands`), these strings resolve from the addon's own
 * `[uiRteOutlineLocale]` input (or the global `UI_LOCALE_ID` token), not the
 * editor's `[locale]` input.
 */
export interface RichTextOutlineLocale extends LocaleMeta {
    /** Tooltip of the outline toolbar button. */
    toolbar: string;
    /** `/outline` slash-command label. */
    slash: string;
    /** `/outline` slash-command description. */
    slashDescription: string;
    /** Heading shown at the top of the docked panel. */
    title: string;
    /** Message shown when the document has no headings. */
    empty: string;
    /** `aria-label` of the panel's close button. */
    ariaClose: string;
}

/** Built-in locales for the document-outline addon. */
export const RICH_TEXT_OUTLINE_LOCALES: Record<string, RichTextOutlineLocale> = {
    en: {
        code: 'en',
        toolbar: 'Document Outline',
        slash: 'Outline',
        slashDescription: 'Open the document outline',
        title: 'Document Outline',
        empty: 'No headings yet',
        ariaClose: 'Close document outline',
    },
    he: {
        code: 'he',
        rtl: true,
        toolbar: 'מתאר מסמך',
        slash: 'תוכן עניינים',
        slashDescription: 'פתיחת תוכן העניינים של המסמך',
        title: 'מתאר מסמך',
        empty: 'אין כותרות עדיין',
        ariaClose: 'סגירת מתאר המסמך',
    },
    ar: {
        code: 'ar',
        rtl: true,
        toolbar: 'مخطط المستند',
        slash: 'المخطط التفصيلي',
        slashDescription: 'فتح المخطط التفصيلي للمستند',
        title: 'مخطط المستند',
        empty: 'لا توجد عناوين بعد',
        ariaClose: 'إغلاق مخطط المستند',
    },
    de: {
        code: 'de',
        toolbar: 'Dokumentgliederung',
        slash: 'Gliederung',
        slashDescription: 'Dokumentgliederung öffnen',
        title: 'Dokumentgliederung',
        empty: 'Noch keine Überschriften',
        ariaClose: 'Dokumentgliederung schließen',
    },
    fr: {
        code: 'fr',
        toolbar: 'Plan du document',
        slash: 'Plan',
        slashDescription: 'Ouvrir le plan du document',
        title: 'Plan du document',
        empty: 'Aucun titre pour le moment',
        ariaClose: 'Fermer le plan du document',
    },
    es: {
        code: 'es',
        toolbar: 'Esquema del documento',
        slash: 'Esquema',
        slashDescription: 'Abrir el esquema del documento',
        title: 'Esquema del documento',
        empty: 'Aún no hay encabezados',
        ariaClose: 'Cerrar el esquema del documento',
    },
    ja: {
        code: 'ja',
        toolbar: 'ドキュメントアウトライン',
        slash: 'アウトライン',
        slashDescription: 'ドキュメントのアウトラインを開く',
        title: 'ドキュメントアウトライン',
        empty: '見出しがまだありません',
        ariaClose: 'ドキュメントアウトラインを閉じる',
    },
    zh: {
        code: 'zh',
        toolbar: '文档大纲',
        slash: '大纲',
        slashDescription: '打开文档大纲',
        title: '文档大纲',
        empty: '暂无标题',
        ariaClose: '关闭文档大纲',
    },
    ru: {
        code: 'ru',
        toolbar: 'Структура документа',
        slash: 'Структура',
        slashDescription: 'Открыть структуру документа',
        title: 'Структура документа',
        empty: 'Заголовков пока нет',
        ariaClose: 'Закрыть структуру документа',
    },
    pt: {
        code: 'pt',
        toolbar: 'Estrutura do documento',
        slash: 'Estrutura de tópicos',
        slashDescription: 'Abrir a estrutura de tópicos do documento',
        title: 'Estrutura do documento',
        empty: 'Nenhum título ainda',
        ariaClose: 'Fechar estrutura do documento',
    },
};
