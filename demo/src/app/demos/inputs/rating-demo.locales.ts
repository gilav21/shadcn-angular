import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface RatingDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  sections: {
    sizes: string;
  };
  captions: {
    sizes: string;
  };
  labels: {
    defaultStars: string;
    halfPrecisionStars: string;
    readonly: string;
    largeSize: string;
    sizeSm: string;
    sizeMd: string;
    sizeLg: string;
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
      sizeSm: 'sm',
      sizeMd: 'md',
      sizeLg: 'lg',
    },
    sections: { sizes: 'Sizes' },
    captions: { sizes: 'Try it: all three share one value — only the [size] input changes, scaling the star glyphs.' },
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
      sizeSm: 'sm',
      sizeMd: 'md',
      sizeLg: 'lg',
    },
    sections: { sizes: 'גדלים' },
    captions: { sizes: 'נסה: לשלושתם אותו ערך — רק הקלט [size] משתנה ומשנה את גודל הכוכבים.' },
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
      sizeSm: 'sm',
      sizeMd: 'md',
      sizeLg: 'lg',
    },
    sections: { sizes: 'الأحجام' },
    captions: { sizes: 'جرّب: الثلاثة تشترك في القيمة نفسها — يتغيّر الإدخال [size] فقط فيتغيّر حجم النجوم.' },
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
      sizeSm: 'sm',
      sizeMd: 'md',
      sizeLg: 'lg',
    },
    sections: { sizes: 'Größen' },
    captions: { sizes: 'Ausprobieren: alle drei teilen einen Wert — nur der [size]-Input ändert sich und skaliert die Sterne.' },
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
      sizeSm: 'sm',
      sizeMd: 'md',
      sizeLg: 'lg',
    },
    sections: { sizes: 'Tailles' },
    captions: { sizes: 'Essayez : les trois partagent une valeur — seul l\'input [size] change et met les étoiles à l\'échelle.' },
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
      sizeSm: 'sm',
      sizeMd: 'md',
      sizeLg: 'lg',
    },
    sections: { sizes: 'Tamaños' },
    captions: { sizes: 'Pruébalo: los tres comparten un valor — solo cambia el input [size], que escala las estrellas.' },
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
      sizeSm: 'sm',
      sizeMd: 'md',
      sizeLg: 'lg',
    },
    sections: { sizes: 'サイズ' },
    captions: { sizes: 'お試しください: 3つは同じ値を共有し、変わるのは [size] 入力だけで星の大きさが変化します。' },
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
      sizeSm: 'sm',
      sizeMd: 'md',
      sizeLg: 'lg',
    },
    sections: { sizes: '尺寸' },
    captions: { sizes: '试一试：三者共用同一个值——只有 [size] 输入不同，星形随之缩放。' },
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
      sizeSm: 'sm',
      sizeMd: 'md',
      sizeLg: 'lg',
    },
    sections: { sizes: 'Размеры' },
    captions: { sizes: 'Попробуйте: у всех трёх одно значение — меняется только вход [size], масштабирующий звёзды.' },
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
      sizeSm: 'sm',
      sizeMd: 'md',
      sizeLg: 'lg',
    },
    sections: { sizes: 'Tamanhos' },
    captions: { sizes: 'Experimente: os três partilham um valor — só o input [size] muda, escalando as estrelas.' },
  },
};
