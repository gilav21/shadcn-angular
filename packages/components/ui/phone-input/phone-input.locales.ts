import type { LocaleMeta } from '../../lib/i18n';

/**
 * Locale dictionary for `<ui-phone-input>`. The component's country picker
 * exposes a search field and a no-results message that read more naturally
 * with country-specific wording than the generic CommonLocale equivalents,
 * so they live here.
 */
export interface PhoneInputLocale extends LocaleMeta {
    searchCountryPlaceholder: string;
    noCountryFound: string;
}

export const PHONE_INPUT_LOCALES: Record<string, PhoneInputLocale> = {
    en: { code: 'en', searchCountryPlaceholder: 'Search country...', noCountryFound: 'No countries found' },
    he: { code: 'he', rtl: true, searchCountryPlaceholder: '...חיפוש מדינה', noCountryFound: 'לא נמצאו מדינות' },
    ar: { code: 'ar', rtl: true, searchCountryPlaceholder: '...بحث عن دولة', noCountryFound: 'لم يتم العثور على دول' },
    de: { code: 'de', searchCountryPlaceholder: 'Land suchen...', noCountryFound: 'Keine Länder gefunden' },
    fr: { code: 'fr', searchCountryPlaceholder: 'Rechercher un pays...', noCountryFound: 'Aucun pays trouvé' },
    es: { code: 'es', searchCountryPlaceholder: 'Buscar país...', noCountryFound: 'No se encontraron países' },
    ja: { code: 'ja', searchCountryPlaceholder: '国を検索...', noCountryFound: '国が見つかりません' },
    zh: { code: 'zh', searchCountryPlaceholder: '搜索国家...', noCountryFound: '未找到国家' },
    ru: { code: 'ru', searchCountryPlaceholder: 'Поиск страны...', noCountryFound: 'Страны не найдены' },
    pt: { code: 'pt', searchCountryPlaceholder: 'Buscar país...', noCountryFound: 'Nenhum país encontrado' },
};
