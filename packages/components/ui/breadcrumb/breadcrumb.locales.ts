import type { LocaleMeta } from '../../lib/i18n';

/**
 * Locale dictionary for `<ui-breadcrumb>`.
 *
 * - `breadcrumb` is the `aria-label` on the outer `<nav>` element.
 * - `more` is the screen-reader text inside the ellipsis component
 *   (`<ui-breadcrumb-ellipsis>`), announced to indicate collapsed
 *   intermediate items.
 */
export interface BreadcrumbLocale extends LocaleMeta {
    breadcrumb: string;
    more: string;
}

export const BREADCRUMB_LOCALES: Record<string, BreadcrumbLocale> = {
    en: { code: 'en', breadcrumb: 'breadcrumb', more: 'More' },
    he: { code: 'he', rtl: true, breadcrumb: 'נתיב ניווט', more: 'עוד' },
    ar: { code: 'ar', rtl: true, breadcrumb: 'مسار التنقل', more: 'المزيد' },
    de: { code: 'de', breadcrumb: 'Navigationspfad', more: 'Mehr' },
    fr: { code: 'fr', breadcrumb: 'fil d\'Ariane', more: 'Plus' },
    es: { code: 'es', breadcrumb: 'ruta de navegación', more: 'Más' },
    ja: { code: 'ja', breadcrumb: 'パンくずリスト', more: 'もっと見る' },
    zh: { code: 'zh', breadcrumb: '面包屑导航', more: '更多' },
    ru: { code: 'ru', breadcrumb: 'хлебные крошки', more: 'Ещё' },
    pt: { code: 'pt', breadcrumb: 'caminho de navegação', more: 'Mais' },
};
