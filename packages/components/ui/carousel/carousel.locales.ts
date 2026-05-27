import type { LocaleMeta } from '../../lib/i18n';

/**
 * Locale dictionary for `<ui-carousel>` and its previous/next sub-components.
 * Strings are explicitly "Previous slide" / "Next slide" (vs generic
 * "Previous"/"Next") so screen-readers announce the context, not a bare
 * direction.
 */
export interface CarouselLocale extends LocaleMeta {
    previousSlide: string;
    nextSlide: string;
}

export const CAROUSEL_LOCALES: Record<string, CarouselLocale> = {
    en: { code: 'en', previousSlide: 'Previous slide', nextSlide: 'Next slide' },
    he: { code: 'he', rtl: true, previousSlide: 'השקופית הקודמת', nextSlide: 'השקופית הבאה' },
    ar: { code: 'ar', rtl: true, previousSlide: 'الشريحة السابقة', nextSlide: 'الشريحة التالية' },
    de: { code: 'de', previousSlide: 'Vorherige Folie', nextSlide: 'Nächste Folie' },
    fr: { code: 'fr', previousSlide: 'Diapositive précédente', nextSlide: 'Diapositive suivante' },
    es: { code: 'es', previousSlide: 'Diapositiva anterior', nextSlide: 'Diapositiva siguiente' },
    ja: { code: 'ja', previousSlide: '前のスライド', nextSlide: '次のスライド' },
    zh: { code: 'zh', previousSlide: '上一张幻灯片', nextSlide: '下一张幻灯片' },
    ru: { code: 'ru', previousSlide: 'Предыдущий слайд', nextSlide: 'Следующий слайд' },
    pt: { code: 'pt', previousSlide: 'Slide anterior', nextSlide: 'Próximo slide' },
};
