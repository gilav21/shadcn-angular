import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface EmojiPickerDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  triggerLabel: string;
  closeOnSelectLabel: string;
}

export const EMOJI_PICKER_DEMO_LOCALES: Record<string, EmojiPickerDemoLocale> = {
  en: {
    code: 'en',
    title: 'Emoji Picker',
    description: 'A customizable emoji picker with category navigation and search.',
    triggerLabel: 'Pick an Emoji',
    closeOnSelectLabel: 'Close on select',
  },
  he: {
    code: 'he', rtl: true,
    title: 'בורר אימוג\'י',
    description: 'בורר אימוג\'י מותאם אישית עם ניווט קטגוריות וחיפוש.',
    triggerLabel: 'בחר אימוג\'י',
    closeOnSelectLabel: 'סגור בבחירה',
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'منتقي الرموز التعبيرية',
    description: 'منتقي رموز تعبيرية قابل للتخصيص مع التنقل بين الفئات والبحث.',
    triggerLabel: 'اختر رمزًا تعبيريًا',
    closeOnSelectLabel: 'إغلاق عند الاختيار',
  },
  de: {
    code: 'de',
    title: 'Emoji-Auswahl',
    description: 'Eine anpassbare Emoji-Auswahl mit Kategorienavigation und Suche.',
    triggerLabel: 'Emoji auswählen',
    closeOnSelectLabel: 'Bei Auswahl schließen',
  },
  fr: {
    code: 'fr',
    title: 'Sélecteur d\'emoji',
    description: 'Un sélecteur d\'emoji personnalisable avec navigation par catégorie et recherche.',
    triggerLabel: 'Choisir un emoji',
    closeOnSelectLabel: 'Fermer à la sélection',
  },
  es: {
    code: 'es',
    title: 'Selector de emoji',
    description: 'Un selector de emoji personalizable con navegación por categorías y búsqueda.',
    triggerLabel: 'Elegir un emoji',
    closeOnSelectLabel: 'Cerrar al seleccionar',
  },
  ja: {
    code: 'ja',
    title: '絵文字ピッカー',
    description: 'カテゴリナビゲーションと検索機能を備えたカスタマイズ可能な絵文字ピッカーです。',
    triggerLabel: '絵文字を選ぶ',
    closeOnSelectLabel: '選択時に閉じる',
  },
  zh: {
    code: 'zh',
    title: '表情符号选择器',
    description: '带有类别导航和搜索功能的可自定义表情符号选择器。',
    triggerLabel: '选择表情符号',
    closeOnSelectLabel: '选择后关闭',
  },
  ru: {
    code: 'ru',
    title: 'Выбор эмодзи',
    description: 'Настраиваемый выбор эмодзи с навигацией по категориям и поиском.',
    triggerLabel: 'Выбрать эмодзи',
    closeOnSelectLabel: 'Закрыть при выборе',
  },
  pt: {
    code: 'pt',
    title: 'Seletor de emoji',
    description: 'Um seletor de emoji personalizável com navegação por categorias e pesquisa.',
    triggerLabel: 'Escolher um emoji',
    closeOnSelectLabel: 'Fechar ao selecionar',
  },
};
