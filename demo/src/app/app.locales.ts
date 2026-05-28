// demo/src/app/app.locales.ts
import type { LocaleMeta } from '../../../packages/components/lib/i18n';

export interface AppLocale extends LocaleMeta {
  categories: {
    Inputs: string;
    Layout: string;
    Navigation: string;
    Overlay: string;
    'Data Display': string;
    Feedback: string;
    Charts: string;
    Animations: string;
    Patterns: string;
    Blocks: string;
  };
  srOnly: {
    language: string;
    keyboardShortcuts: string;
    search: string;
  };
  modePlaceholder: string;
  languageMenuHeader: string;
}

export const APP_LOCALES: Record<string, AppLocale> = {
  en: {
    code: 'en',
    categories: { Inputs: 'Inputs', Layout: 'Layout', Navigation: 'Navigation', Overlay: 'Overlay', 'Data Display': 'Data Display', Feedback: 'Feedback', Charts: 'Charts', Animations: 'Animations', Patterns: 'Patterns', Blocks: 'Blocks' },
    srOnly: { language: 'Language', keyboardShortcuts: 'Keyboard Shortcuts', search: 'Search' },
    modePlaceholder: 'Mode',
    languageMenuHeader: 'Language',
  },
  he: {
    code: 'he', rtl: true,
    categories: { Inputs: 'קלט', Layout: 'פריסה', Navigation: 'ניווט', Overlay: 'שכבת על', 'Data Display': 'תצוגת נתונים', Feedback: 'משוב', Charts: 'תרשימים', Animations: 'אנימציות', Patterns: 'תבניות', Blocks: 'בלוקים' },
    srOnly: { language: 'שפה', keyboardShortcuts: 'קיצורי מקלדת', search: 'חיפוש' },
    modePlaceholder: 'מצב',
    languageMenuHeader: 'שפה',
  },
  ar: {
    code: 'ar', rtl: true,
    categories: { Inputs: 'الإدخال', Layout: 'التخطيط', Navigation: 'التنقل', Overlay: 'طبقة فوقية', 'Data Display': 'عرض البيانات', Feedback: 'الملاحظات', Charts: 'المخططات', Animations: 'الرسوم المتحركة', Patterns: 'الأنماط', Blocks: 'الكتل' },
    srOnly: { language: 'اللغة', keyboardShortcuts: 'اختصارات لوحة المفاتيح', search: 'بحث' },
    modePlaceholder: 'الوضع',
    languageMenuHeader: 'اللغة',
  },
  de: {
    code: 'de',
    categories: { Inputs: 'Eingaben', Layout: 'Layout', Navigation: 'Navigation', Overlay: 'Overlay', 'Data Display': 'Datenanzeige', Feedback: 'Feedback', Charts: 'Diagramme', Animations: 'Animationen', Patterns: 'Muster', Blocks: 'Blöcke' },
    srOnly: { language: 'Sprache', keyboardShortcuts: 'Tastenkürzel', search: 'Suche' },
    modePlaceholder: 'Modus',
    languageMenuHeader: 'Sprache',
  },
  fr: {
    code: 'fr',
    categories: { Inputs: 'Saisie', Layout: 'Mise en page', Navigation: 'Navigation', Overlay: 'Superposition', 'Data Display': 'Affichage des données', Feedback: 'Retour', Charts: 'Graphiques', Animations: 'Animations', Patterns: 'Modèles', Blocks: 'Blocs' },
    srOnly: { language: 'Langue', keyboardShortcuts: 'Raccourcis clavier', search: 'Recherche' },
    modePlaceholder: 'Mode',
    languageMenuHeader: 'Langue',
  },
  es: {
    code: 'es',
    categories: { Inputs: 'Entradas', Layout: 'Diseño', Navigation: 'Navegación', Overlay: 'Superposición', 'Data Display': 'Visualización de datos', Feedback: 'Comentarios', Charts: 'Gráficos', Animations: 'Animaciones', Patterns: 'Patrones', Blocks: 'Bloques' },
    srOnly: { language: 'Idioma', keyboardShortcuts: 'Atajos de teclado', search: 'Buscar' },
    modePlaceholder: 'Modo',
    languageMenuHeader: 'Idioma',
  },
  ja: {
    code: 'ja',
    categories: { Inputs: '入力', Layout: 'レイアウト', Navigation: 'ナビゲーション', Overlay: 'オーバーレイ', 'Data Display': 'データ表示', Feedback: 'フィードバック', Charts: 'チャート', Animations: 'アニメーション', Patterns: 'パターン', Blocks: 'ブロック' },
    srOnly: { language: '言語', keyboardShortcuts: 'キーボードショートカット', search: '検索' },
    modePlaceholder: 'モード',
    languageMenuHeader: '言語',
  },
  zh: {
    code: 'zh',
    categories: { Inputs: '输入', Layout: '布局', Navigation: '导航', Overlay: '浮层', 'Data Display': '数据展示', Feedback: '反馈', Charts: '图表', Animations: '动画', Patterns: '模式', Blocks: '区块' },
    srOnly: { language: '语言', keyboardShortcuts: '键盘快捷键', search: '搜索' },
    modePlaceholder: '模式',
    languageMenuHeader: '语言',
  },
  ru: {
    code: 'ru',
    categories: { Inputs: 'Ввод', Layout: 'Макет', Navigation: 'Навигация', Overlay: 'Накладка', 'Data Display': 'Отображение данных', Feedback: 'Обратная связь', Charts: 'Диаграммы', Animations: 'Анимации', Patterns: 'Шаблоны', Blocks: 'Блоки' },
    srOnly: { language: 'Язык', keyboardShortcuts: 'Сочетания клавиш', search: 'Поиск' },
    modePlaceholder: 'Режим',
    languageMenuHeader: 'Язык',
  },
  pt: {
    code: 'pt',
    categories: { Inputs: 'Entradas', Layout: 'Layout', Navigation: 'Navegação', Overlay: 'Sobreposição', 'Data Display': 'Exibição de dados', Feedback: 'Feedback', Charts: 'Gráficos', Animations: 'Animações', Patterns: 'Padrões', Blocks: 'Blocos' },
    srOnly: { language: 'Idioma', keyboardShortcuts: 'Atalhos de teclado', search: 'Pesquisar' },
    modePlaceholder: 'Modo',
    languageMenuHeader: 'Idioma',
  },
};
