import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface BadgeDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  labelDefault: string;
  labelSecondary: string;
  labelOutline: string;
  labelDestructive: string;
}

export const BADGE_DEMO_LOCALES: Record<string, BadgeDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Badge',
    description: 'Badge component with variants.',
    labelDefault: 'Default',
    labelSecondary: 'Secondary',
    labelOutline: 'Outline',
    labelDestructive: 'Destructive',
  },
  he: {
    code: 'he',
    rtl: true,
    heading: 'תג',
    description: 'רכיב תג עם וריאנטים.',
    labelDefault: 'ברירת מחדל',
    labelSecondary: 'משני',
    labelOutline: 'מתאר',
    labelDestructive: 'הרסני',
  },
  ar: {
    code: 'ar',
    rtl: true,
    heading: 'شارة',
    description: 'مكون شارة مع متغيرات.',
    labelDefault: 'افتراضي',
    labelSecondary: 'ثانوي',
    labelOutline: 'مخطط',
    labelDestructive: 'مدمر',
  },
  de: {
    code: 'de',
    heading: 'Badge',
    description: 'Badge-Komponente mit Varianten.',
    labelDefault: 'Standard',
    labelSecondary: 'Sekundär',
    labelOutline: 'Umriss',
    labelDestructive: 'Destruktiv',
  },
  fr: {
    code: 'fr',
    heading: 'Badge',
    description: 'Composant badge avec variantes.',
    labelDefault: 'Par défaut',
    labelSecondary: 'Secondaire',
    labelOutline: 'Contour',
    labelDestructive: 'Destructif',
  },
  es: {
    code: 'es',
    heading: 'Insignia',
    description: 'Componente de insignia con variantes.',
    labelDefault: 'Predeterminado',
    labelSecondary: 'Secundario',
    labelOutline: 'Contorno',
    labelDestructive: 'Destructivo',
  },
  ja: {
    code: 'ja',
    heading: 'バッジ',
    description: 'バリアント付きのバッジコンポーネント。',
    labelDefault: 'デフォルト',
    labelSecondary: 'セカンダリ',
    labelOutline: 'アウトライン',
    labelDestructive: '破壊的',
  },
  zh: {
    code: 'zh',
    heading: '徽章',
    description: '带变体的徽章组件。',
    labelDefault: '默认',
    labelSecondary: '次要',
    labelOutline: '轮廓',
    labelDestructive: '危险',
  },
  ru: {
    code: 'ru',
    heading: 'Значок',
    description: 'Компонент значка с вариантами.',
    labelDefault: 'По умолчанию',
    labelSecondary: 'Вторичный',
    labelOutline: 'Контур',
    labelDestructive: 'Деструктивный',
  },
  pt: {
    code: 'pt',
    heading: 'Emblema',
    description: 'Componente emblema com variantes.',
    labelDefault: 'Padrão',
    labelSecondary: 'Secundário',
    labelOutline: 'Contorno',
    labelDestructive: 'Destrutivo',
  },
};
