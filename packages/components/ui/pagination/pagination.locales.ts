import type { LocaleMeta } from '../../lib/i18n';

/**
 * Locale dictionary for `<ui-pagination>` and its sub-components (previous,
 * next, ellipsis).
 *
 * The default English strings exactly match the previously-hardcoded values
 * so consumers who don't wire a locale see no behavior change.
 */
export interface PaginationLocale extends LocaleMeta {
    /** Text for the "Previous page" button. */
    previous: string;
    /** Text for the "Next page" button. */
    next: string;
    /** `sr-only` text inside the ellipsis indicator. */
    morePages: string;
    /** `aria-label` value for the root `<nav>`. */
    pagination: string;
}

export const PAGINATION_LOCALES: Record<string, PaginationLocale> = {
    en: {
        code: 'en',
        previous: 'Previous',
        next: 'Next',
        morePages: 'More pages',
        pagination: 'pagination',
    },
    he: {
        code: 'he',
        rtl: true,
        previous: 'הקודם',
        next: 'הבא',
        morePages: 'עוד עמודים',
        pagination: 'עימוד',
    },
    ar: {
        code: 'ar',
        rtl: true,
        previous: 'السابق',
        next: 'التالي',
        morePages: 'المزيد من الصفحات',
        pagination: 'ترقيم الصفحات',
    },
    de: {
        code: 'de',
        previous: 'Zurück',
        next: 'Weiter',
        morePages: 'Mehr Seiten',
        pagination: 'Seitennummerierung',
    },
    fr: {
        code: 'fr',
        previous: 'Précédent',
        next: 'Suivant',
        morePages: 'Plus de pages',
        pagination: 'pagination',
    },
    es: {
        code: 'es',
        previous: 'Anterior',
        next: 'Siguiente',
        morePages: 'Más páginas',
        pagination: 'paginación',
    },
    ja: {
        code: 'ja',
        previous: '前へ',
        next: '次へ',
        morePages: 'その他のページ',
        pagination: 'ページネーション',
    },
    zh: {
        code: 'zh',
        previous: '上一页',
        next: '下一页',
        morePages: '更多页',
        pagination: '分页',
    },
    ru: {
        code: 'ru',
        previous: 'Назад',
        next: 'Далее',
        morePages: 'Больше страниц',
        pagination: 'Пагинация',
    },
    pt: {
        code: 'pt',
        previous: 'Anterior',
        next: 'Próximo',
        morePages: 'Mais páginas',
        pagination: 'Paginação',
    },
};
