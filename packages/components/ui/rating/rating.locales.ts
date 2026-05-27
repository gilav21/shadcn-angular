import type { LocaleMeta } from '../../lib/i18n';

/**
 * Locale dictionary for `<ui-rating>`.
 *
 * - `rating` is the default `aria-label` on the rating group when the
 *   consumer doesn't pass an explicit `ariaLabel` input.
 * - `rateAriaLabel` is the per-star `aria-label`, interpolated with the
 *   star's 1-based position and the max. Default English template:
 *   `'Rate {n} out of {total}'`.
 */
export interface RatingLocale extends LocaleMeta {
    rating: string;
    rateAriaLabel: string;
}

export const RATING_LOCALES: Record<string, RatingLocale> = {
    en: { code: 'en', rating: 'Rating', rateAriaLabel: 'Rate {n} out of {total}' },
    he: { code: 'he', rtl: true, rating: 'דירוג', rateAriaLabel: 'דרג {n} מתוך {total}' },
    ar: { code: 'ar', rtl: true, rating: 'التقييم', rateAriaLabel: 'قيّم {n} من {total}' },
    de: { code: 'de', rating: 'Bewertung', rateAriaLabel: 'Bewerten mit {n} von {total}' },
    fr: { code: 'fr', rating: 'Évaluation', rateAriaLabel: 'Évaluer {n} sur {total}' },
    es: { code: 'es', rating: 'Calificación', rateAriaLabel: 'Calificar {n} de {total}' },
    ja: { code: 'ja', rating: '評価', rateAriaLabel: '{total} 段階中 {n} で評価' },
    zh: { code: 'zh', rating: '评分', rateAriaLabel: '{total} 中评 {n} 分' },
    ru: { code: 'ru', rating: 'Рейтинг', rateAriaLabel: 'Оценить {n} из {total}' },
    pt: { code: 'pt', rating: 'Avaliação', rateAriaLabel: 'Avaliar {n} de {total}' },
};
