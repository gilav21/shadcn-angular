import type { LocaleMeta } from '../../../../lib/i18n';

/**
 * Localized strings for the rich-text links addon: the toolbar link button, its
 * insert/edit popover (text + URL fields, insert/update/remove/cancel actions),
 * and the `/link` slash command. Pass a registry key (`'en'`, `'he'`, …) or a
 * full dictionary to `[uiRteLinksLocale]`.
 *
 * Unlike the former built-in link toolbar item, these strings resolve from the
 * addon's own `[uiRteLinksLocale]` input (or the global `UI_LOCALE_ID`), not the
 * editor's `[locale]` input.
 */
export interface RichTextLinksLocale extends LocaleMeta {
    /** Toolbar button tooltip / popover heading. */
    tooltip: string;
    /** Link-text field label. */
    text: string;
    /** Link-text field placeholder. */
    textPlaceholder: string;
    /** URL field label. */
    url: string;
    /** URL field placeholder. */
    urlPlaceholder: string;
    /** Insert-mode confirm button. */
    insert: string;
    /** Edit-mode confirm button. */
    update: string;
    /** Edit-mode remove-link button. */
    remove: string;
    /** Dismiss button. */
    cancel: string;
    /** `/link` slash-command label. */
    commandLabel: string;
    /** `/link` slash-command description. */
    commandDescription: string;
}

/** Built-in locales for the links addon. */
export const RICH_TEXT_LINKS_LOCALES: Record<string, RichTextLinksLocale> = {
    en: { code: 'en', tooltip: 'Insert Link', text: 'Link Text', textPlaceholder: 'Display text', url: 'URL', urlPlaceholder: 'https://example.com', insert: 'Insert Link', update: 'Update', remove: 'Remove', cancel: 'Cancel', commandLabel: 'Link', commandDescription: 'Insert or edit a link' },
    he: { code: 'he', rtl: true, tooltip: 'הוספת קישור', text: 'טקסט הקישור', textPlaceholder: 'טקסט לתצוגה', url: 'כתובת URL', urlPlaceholder: 'https://example.com', insert: 'הוספת קישור', update: 'עדכון', remove: 'הסרה', cancel: 'ביטול', commandLabel: 'קישור', commandDescription: 'הוספה או עריכה של קישור' },
    ar: { code: 'ar', rtl: true, tooltip: 'إدراج رابط', text: 'نص الرابط', textPlaceholder: 'نص العرض', url: 'عنوان URL', urlPlaceholder: 'https://example.com', insert: 'إدراج رابط', update: 'تحديث', remove: 'إزالة', cancel: 'إلغاء', commandLabel: 'رابط', commandDescription: 'إدراج أو تعديل رابط' },
    de: { code: 'de', tooltip: 'Link einfügen', text: 'Linktext', textPlaceholder: 'Anzeigetext', url: 'URL', urlPlaceholder: 'https://example.com', insert: 'Link einfügen', update: 'Aktualisieren', remove: 'Entfernen', cancel: 'Abbrechen', commandLabel: 'Link', commandDescription: 'Link einfügen oder bearbeiten' },
    fr: { code: 'fr', tooltip: 'Insérer un lien', text: 'Texte du lien', textPlaceholder: 'Texte affiché', url: 'URL', urlPlaceholder: 'https://example.com', insert: 'Insérer le lien', update: 'Mettre à jour', remove: 'Supprimer', cancel: 'Annuler', commandLabel: 'Lien', commandDescription: 'Insérer ou modifier un lien' },
    es: { code: 'es', tooltip: 'Insertar enlace', text: 'Texto del enlace', textPlaceholder: 'Texto mostrado', url: 'URL', urlPlaceholder: 'https://example.com', insert: 'Insertar enlace', update: 'Actualizar', remove: 'Eliminar', cancel: 'Cancelar', commandLabel: 'Enlace', commandDescription: 'Insertar o editar un enlace' },
    ja: { code: 'ja', tooltip: 'リンクを挿入', text: 'リンクテキスト', textPlaceholder: '表示テキスト', url: 'URL', urlPlaceholder: 'https://example.com', insert: 'リンクを挿入', update: '更新', remove: '削除', cancel: 'キャンセル', commandLabel: 'リンク', commandDescription: 'リンクを挿入または編集' },
    zh: { code: 'zh', tooltip: '插入链接', text: '链接文字', textPlaceholder: '显示文字', url: 'URL', urlPlaceholder: 'https://example.com', insert: '插入链接', update: '更新', remove: '移除', cancel: '取消', commandLabel: '链接', commandDescription: '插入或编辑链接' },
    ru: { code: 'ru', tooltip: 'Вставить ссылку', text: 'Текст ссылки', textPlaceholder: 'Отображаемый текст', url: 'URL', urlPlaceholder: 'https://example.com', insert: 'Вставить ссылку', update: 'Обновить', remove: 'Удалить', cancel: 'Отмена', commandLabel: 'Ссылка', commandDescription: 'Вставить или изменить ссылку' },
    pt: { code: 'pt', tooltip: 'Inserir link', text: 'Texto do link', textPlaceholder: 'Texto exibido', url: 'URL', urlPlaceholder: 'https://example.com', insert: 'Inserir link', update: 'Atualizar', remove: 'Remover', cancel: 'Cancelar', commandLabel: 'Link', commandDescription: 'Inserir ou editar um link' },
};
