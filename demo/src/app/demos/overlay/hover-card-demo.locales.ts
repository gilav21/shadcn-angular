// demo/src/app/demos/overlay/hover-card-demo.locales.ts
import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface HoverCardDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  handle: string;
  tagline: string;
  joinedLabel: string;
  joinedDate: string;
}

export const HOVER_CARD_DEMO_LOCALES: Record<string, HoverCardDemoLocale> = {
  en: {
    code: 'en',
    title: 'Hover Card',
    description: 'A card that appears when hovering over an element.',
    handle: '@angular',
    tagline: 'The modern web developer\'s platform.',
    joinedLabel: 'Joined',
    joinedDate: 'December 2016',
  },
  he: {
    code: 'he', rtl: true,
    title: 'כרטיס ריחוף',
    description: 'כרטיס שמופיע בעת ריחוף מעל אלמנט.',
    handle: '@angular',
    tagline: 'הפלטפורמה של מפתח האינטרנט המודרני.',
    joinedLabel: 'הצטרף',
    joinedDate: 'דצמבר 2016',
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'بطاقة التمرير',
    description: 'بطاقة تظهر عند تمرير المؤشر فوق عنصر.',
    handle: '@angular',
    tagline: 'منصة مطور الويب الحديث.',
    joinedLabel: 'انضم في',
    joinedDate: 'ديسمبر 2016',
  },
  de: {
    code: 'de',
    title: 'Hover-Karte',
    description: 'Eine Karte, die beim Überfahren mit der Maus erscheint.',
    handle: '@angular',
    tagline: 'Die Plattform für moderne Webentwickler.',
    joinedLabel: 'Beigetreten',
    joinedDate: 'Dezember 2016',
  },
  fr: {
    code: 'fr',
    title: 'Carte de survol',
    description: 'Une carte qui apparaît au survol d\'un élément.',
    handle: '@angular',
    tagline: 'La plateforme des développeurs web modernes.',
    joinedLabel: 'Rejoint en',
    joinedDate: 'décembre 2016',
  },
  es: {
    code: 'es',
    title: 'Tarjeta flotante',
    description: 'Una tarjeta que aparece al pasar el cursor sobre un elemento.',
    handle: '@angular',
    tagline: 'La plataforma del desarrollador web moderno.',
    joinedLabel: 'Se unió en',
    joinedDate: 'diciembre de 2016',
  },
  ja: {
    code: 'ja',
    title: 'ホバーカード',
    description: '要素にホバーしたときに表示されるカードです。',
    handle: '@angular',
    tagline: '現代のウェブ開発者のためのプラットフォーム。',
    joinedLabel: '参加日',
    joinedDate: '2016年12月',
  },
  zh: {
    code: 'zh',
    title: '悬浮卡片',
    description: '鼠标悬停时显示的卡片。',
    handle: '@angular',
    tagline: '现代 Web 开发者的平台。',
    joinedLabel: '加入于',
    joinedDate: '2016年12月',
  },
  ru: {
    code: 'ru',
    title: 'Карточка при наведении',
    description: 'Карточка, появляющаяся при наведении на элемент.',
    handle: '@angular',
    tagline: 'Платформа современного веб-разработчика.',
    joinedLabel: 'Вступил',
    joinedDate: 'декабрь 2016',
  },
  pt: {
    code: 'pt',
    title: 'Cartão de hover',
    description: 'Um cartão que aparece ao passar o mouse sobre um elemento.',
    handle: '@angular',
    tagline: 'A plataforma do desenvolvedor web moderno.',
    joinedLabel: 'Ingressou em',
    joinedDate: 'dezembro de 2016',
  },
};
