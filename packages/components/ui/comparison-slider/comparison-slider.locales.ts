import type { LocaleMeta } from '../../lib/i18n';

/** Locale dictionary for `<ui-comparison-slider>`. */
export interface ComparisonSliderLocale extends LocaleMeta {
    /** `aria-label` on the slider handle. */
    comparisonSlider: string;
}

export const COMPARISON_SLIDER_LOCALES: Record<string, ComparisonSliderLocale> = {
    en: { code: 'en', comparisonSlider: 'Comparison slider' },
    he: { code: 'he', rtl: true, comparisonSlider: 'מחוון השוואה' },
    ar: { code: 'ar', rtl: true, comparisonSlider: 'شريط المقارنة' },
    de: { code: 'de', comparisonSlider: 'Vergleichsregler' },
    fr: { code: 'fr', comparisonSlider: 'Curseur de comparaison' },
    es: { code: 'es', comparisonSlider: 'Control deslizante de comparación' },
    ja: { code: 'ja', comparisonSlider: '比較スライダー' },
    zh: { code: 'zh', comparisonSlider: '对比滑块' },
    ru: { code: 'ru', comparisonSlider: 'Ползунок сравнения' },
    pt: { code: 'pt', comparisonSlider: 'Controle deslizante de comparação' },
};
