import type { LocaleMeta } from '../../../../lib/i18n';

/** Localized strings for the rich-text emoji addon UI. */
export interface RichTextEmojiLocale extends LocaleMeta {
    /** Tooltip for the emoji toolbar button. */
    insertEmoji: string;
}

/**
 * Built-in locales for the emoji addon. Pass a key (`'en'`, `'he'`, …) or a
 * full {@link RichTextEmojiLocale} dictionary to `[uiRteEmojiLocale]`.
 */
export const RICH_TEXT_EMOJI_LOCALES: Record<string, RichTextEmojiLocale> = {
    en: { code: 'en', insertEmoji: 'Insert Emoji' },
    he: { code: 'he', rtl: true, insertEmoji: 'הוספת אמוג\'י' },
    ar: { code: 'ar', rtl: true, insertEmoji: 'إدراج رمز تعبيري' },
    de: { code: 'de', insertEmoji: 'Emoji einfügen' },
    fr: { code: 'fr', insertEmoji: 'Insérer un emoji' },
    es: { code: 'es', insertEmoji: 'Insertar emoji' },
    ja: { code: 'ja', insertEmoji: '絵文字を挿入' },
    zh: { code: 'zh', insertEmoji: '插入表情' },
    ru: { code: 'ru', insertEmoji: 'Вставить эмодзи' },
    pt: { code: 'pt', insertEmoji: 'Inserir emoji' },
};
