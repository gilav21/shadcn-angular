import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface SkeletonDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
}

export const SKELETON_DEMO_LOCALES: Record<string, SkeletonDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Skeleton',
    description: 'Loading placeholder animations.',
  },
  he: {
    code: 'he',
    rtl: true,
    heading: 'שלד',
    description: 'אנימציות של מציין מיקום לטעינה.',
  },
  ar: {
    code: 'ar',
    rtl: true,
    heading: 'هيكل',
    description: 'رسوم متحركة لعنصر نائب التحميل.',
  },
  de: {
    code: 'de',
    heading: 'Skelett',
    description: 'Lade-Platzhalter-Animationen.',
  },
  fr: {
    code: 'fr',
    heading: 'Squelette',
    description: 'Animations de chargement en attente.',
  },
  es: {
    code: 'es',
    heading: 'Esqueleto',
    description: 'Animaciones de marcador de posición de carga.',
  },
  ja: {
    code: 'ja',
    heading: 'スケルトン',
    description: 'ローディングプレースホルダーアニメーション。',
  },
  zh: {
    code: 'zh',
    heading: '骨架屏',
    description: '加载占位符动画。',
  },
  ru: {
    code: 'ru',
    heading: 'Скелетон',
    description: 'Анимации загрузочных заполнителей.',
  },
  pt: {
    code: 'pt',
    heading: 'Esqueleto',
    description: 'Animações de espaço reservado de carregamento.',
  },
};
