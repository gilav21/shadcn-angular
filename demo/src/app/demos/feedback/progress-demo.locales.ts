import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface ProgressDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
}

export const PROGRESS_DEMO_LOCALES: Record<string, ProgressDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Progress',
    description: 'Progress bar indicators.',
  },
  he: {
    code: 'he',
    rtl: true,
    heading: 'התקדמות',
    description: 'מחוונים של סרגל התקדמות.',
  },
  ar: {
    code: 'ar',
    rtl: true,
    heading: 'التقدم',
    description: 'مؤشرات شريط التقدم.',
  },
  de: {
    code: 'de',
    heading: 'Fortschritt',
    description: 'Fortschrittsbalken-Indikatoren.',
  },
  fr: {
    code: 'fr',
    heading: 'Progression',
    description: 'Indicateurs de barre de progression.',
  },
  es: {
    code: 'es',
    heading: 'Progreso',
    description: 'Indicadores de barra de progreso.',
  },
  ja: {
    code: 'ja',
    heading: 'プログレス',
    description: 'プログレスバーインジケーター。',
  },
  zh: {
    code: 'zh',
    heading: '进度',
    description: '进度条指示器。',
  },
  ru: {
    code: 'ru',
    heading: 'Прогресс',
    description: 'Индикаторы прогресс-бара.',
  },
  pt: {
    code: 'pt',
    heading: 'Progresso',
    description: 'Indicadores de barra de progresso.',
  },
};
