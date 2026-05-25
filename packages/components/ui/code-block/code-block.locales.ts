import type { LocaleMeta } from '../../lib/i18n';

/**
 * Locale dictionary for `<ui-code-block>`.
 *
 * - `copy` / `copied` drive the copy-to-clipboard button's `aria-label`
 *   (default and post-click state).
 * - `expandScope` / `collapseScope` label the foldable region toggles
 *   in code blocks that opt into `collapseScope=true`.
 */
export interface CodeBlockLocale extends LocaleMeta {
    copy: string;
    copied: string;
    expandScope: string;
    collapseScope: string;
}

export const CODE_BLOCK_LOCALES: Record<string, CodeBlockLocale> = {
    en: { code: 'en', copy: 'Copy', copied: 'Copied', expandScope: 'Expand scope', collapseScope: 'Collapse scope' },
    he: { code: 'he', rtl: true, copy: 'העתק', copied: 'הועתק', expandScope: 'הרחב טווח', collapseScope: 'כווץ טווח' },
    ar: { code: 'ar', rtl: true, copy: 'نسخ', copied: 'تم النسخ', expandScope: 'توسيع النطاق', collapseScope: 'طي النطاق' },
    de: { code: 'de', copy: 'Kopieren', copied: 'Kopiert', expandScope: 'Bereich erweitern', collapseScope: 'Bereich einklappen' },
    fr: { code: 'fr', copy: 'Copier', copied: 'Copié', expandScope: 'Développer la portée', collapseScope: 'Réduire la portée' },
    es: { code: 'es', copy: 'Copiar', copied: 'Copiado', expandScope: 'Expandir ámbito', collapseScope: 'Contraer ámbito' },
    ja: { code: 'ja', copy: 'コピー', copied: 'コピーしました', expandScope: 'スコープを展開', collapseScope: 'スコープを折りたたむ' },
    zh: { code: 'zh', copy: '复制', copied: '已复制', expandScope: '展开范围', collapseScope: '折叠范围' },
    ru: { code: 'ru', copy: 'Копировать', copied: 'Скопировано', expandScope: 'Развернуть область', collapseScope: 'Свернуть область' },
    pt: { code: 'pt', copy: 'Copiar', copied: 'Copiado', expandScope: 'Expandir escopo', collapseScope: 'Recolher escopo' },
};
