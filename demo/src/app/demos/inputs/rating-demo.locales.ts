import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface RatingDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  labels: {
    defaultStars: string;
    halfPrecisionStars: string;
    readonly: string;
    largeSize: string;
  };
}

export const RATING_DEMO_LOCALES: Record<string, RatingDemoLocale> = {
  en: {
    code: 'en',
    title: 'Rating',
    description: 'An interactive star rating input.',
    labels: {
      defaultStars: 'Default ({{value}} stars)',
      halfPrecisionStars: 'Half Precision ({{value}} stars)',
      readonly: 'Readonly',
      largeSize: 'Large Size (10 stars)',
    },
  },
  he: {
    code: 'he', rtl: true,
    title: 'דירוג',
    description: 'שדה קלט כוכבים אינטראקטיבי.',
    labels: {
      defaultStars: 'ברירת מחדל ({{value}} כוכבים)',
      halfPrecisionStars: 'חצי דיוק ({{value}} כוכבים)',
      readonly: 'לקריאה בלבד',
      largeSize: 'גודל גדול (10 כוכבים)',
    },
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'التقييم',
    description: 'حقل إدخال تقييم النجوم التفاعلي.',
    labels: {
      defaultStars: 'الافتراضي ({{value}} نجوم)',
      halfPrecisionStars: 'نصف دقيق ({{value}} نجوم)',
      readonly: 'للقراءة فقط',
      largeSize: 'حجم كبير (10 نجوم)',
    },
  },
  de: {
    code: 'de',
    title: 'Bewertung',
    description: 'Eine interaktive Sternbewertungseingabe.',
    labels: {
      defaultStars: 'Standard ({{value}} Sterne)',
      halfPrecisionStars: 'Halbgenau ({{value}} Sterne)',
      readonly: 'Schreibgeschützt',
      largeSize: 'Groß (10 Sterne)',
    },
  },
  fr: {
    code: 'fr',
    title: 'Notation',
    description: 'Un champ de saisie de notation par étoiles interactif.',
    labels: {
      defaultStars: 'Par défaut ({{value}} étoiles)',
      halfPrecisionStars: 'Demi-précision ({{value}} étoiles)',
      readonly: 'Lecture seule',
      largeSize: 'Grande taille (10 étoiles)',
    },
  },
  es: {
    code: 'es',
    title: 'Valoración',
    description: 'Un campo de entrada de valoración por estrellas interactivo.',
    labels: {
      defaultStars: 'Predeterminado ({{value}} estrellas)',
      halfPrecisionStars: 'Media precisión ({{value}} estrellas)',
      readonly: 'Solo lectura',
      largeSize: 'Tamaño grande (10 estrellas)',
    },
  },
  ja: {
    code: 'ja',
    title: 'レーティング',
    description: 'インタラクティブな星評価入力フィールドです。',
    labels: {
      defaultStars: 'デフォルト（{{value}} 星）',
      halfPrecisionStars: '半精度（{{value}} 星）',
      readonly: '読み取り専用',
      largeSize: '大サイズ（10 星）',
    },
  },
  zh: {
    code: 'zh',
    title: '评分',
    description: '交互式星级评分输入框。',
    labels: {
      defaultStars: '默认（{{value}} 颗星）',
      halfPrecisionStars: '半精度（{{value}} 颗星）',
      readonly: '只读',
      largeSize: '大尺寸（10 颗星）',
    },
  },
  ru: {
    code: 'ru',
    title: 'Рейтинг',
    description: 'Интерактивное поле ввода звёздного рейтинга.',
    labels: {
      defaultStars: 'По умолчанию ({{value}} звёзд)',
      halfPrecisionStars: 'Полузвёздная точность ({{value}} звёзд)',
      readonly: 'Только чтение',
      largeSize: 'Большой размер (10 звёзд)',
    },
  },
  pt: {
    code: 'pt',
    title: 'Avaliação',
    description: 'Um campo de entrada de avaliação por estrelas interativo.',
    labels: {
      defaultStars: 'Padrão ({{value}} estrelas)',
      halfPrecisionStars: 'Meia precisão ({{value}} estrelas)',
      readonly: 'Somente leitura',
      largeSize: 'Tamanho grande (10 estrelas)',
    },
  },
};
