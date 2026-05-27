import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface NumberTickerDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  subscribersHeading: string;
  subscribersLabel: string;
  revenueHeading: string;
  revenueLabel: string;
}

export const NUMBER_TICKER_DEMO_LOCALES: Record<string, NumberTickerDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Number Ticker',
    description: 'Animate numbers with ease.',
    subscribersHeading: 'Subscribers (Live)',
    subscribersLabel: 'Active Subscribers',
    revenueHeading: 'Revenue',
    revenueLabel: 'Total Revenue',
  },
  he: {
    code: 'he',
    rtl: true,
    heading: 'מונה מספרים',
    description: 'הנפישו מספרים בקלות.',
    subscribersHeading: 'מנויים (חי)',
    subscribersLabel: 'מנויים פעילים',
    revenueHeading: 'הכנסות',
    revenueLabel: 'סך ההכנסות',
  },
  ar: {
    code: 'ar',
    rtl: true,
    heading: 'عداد الأرقام',
    description: 'تحريك الأرقام بسهولة.',
    subscribersHeading: 'المشتركون (مباشر)',
    subscribersLabel: 'المشتركون النشطون',
    revenueHeading: 'الإيرادات',
    revenueLabel: 'إجمالي الإيرادات',
  },
  de: {
    code: 'de',
    heading: 'Nummern-Ticker',
    description: 'Animieren Sie Zahlen mit Leichtigkeit.',
    subscribersHeading: 'Abonnenten (Live)',
    subscribersLabel: 'Aktive Abonnenten',
    revenueHeading: 'Umsatz',
    revenueLabel: 'Gesamtumsatz',
  },
  fr: {
    code: 'fr',
    heading: 'Compteur numérique',
    description: 'Animez les chiffres facilement.',
    subscribersHeading: 'Abonnés (En direct)',
    subscribersLabel: 'Abonnés actifs',
    revenueHeading: 'Revenus',
    revenueLabel: 'Revenus totaux',
  },
  es: {
    code: 'es',
    heading: 'Contador numérico',
    description: 'Anima números con facilidad.',
    subscribersHeading: 'Suscriptores (En vivo)',
    subscribersLabel: 'Suscriptores activos',
    revenueHeading: 'Ingresos',
    revenueLabel: 'Ingresos totales',
  },
  ja: {
    code: 'ja',
    heading: 'ナンバーティッカー',
    description: '数字を簡単にアニメーションします。',
    subscribersHeading: 'サブスクライバー（ライブ）',
    subscribersLabel: 'アクティブサブスクライバー',
    revenueHeading: '収益',
    revenueLabel: '総収益',
  },
  zh: {
    code: 'zh',
    heading: '数字计数器',
    description: '轻松为数字添加动画效果。',
    subscribersHeading: '订阅者（实时）',
    subscribersLabel: '活跃订阅者',
    revenueHeading: '收入',
    revenueLabel: '总收入',
  },
  ru: {
    code: 'ru',
    heading: 'Счётчик чисел',
    description: 'Анимируйте числа с лёгкостью.',
    subscribersHeading: 'Подписчики (Живая)',
    subscribersLabel: 'Активные подписчики',
    revenueHeading: 'Выручка',
    revenueLabel: 'Общая выручка',
  },
  pt: {
    code: 'pt',
    heading: 'Contador numérico',
    description: 'Anime números com facilidade.',
    subscribersHeading: 'Assinantes (Ao vivo)',
    subscribersLabel: 'Assinantes ativos',
    revenueHeading: 'Receita',
    revenueLabel: 'Receita total',
  },
};
