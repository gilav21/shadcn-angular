import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface KbdDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  pressPrefix: string;
  toSearch: string;
  toOpenCommandPalette: string;
}

export const KBD_DEMO_LOCALES: Record<string, KbdDemoLocale> = {
  en: {
    code: 'en',
    title: 'Kbd',
    description: 'Display keyboard shortcuts or keystrokes.',
    pressPrefix: 'Press',
    toSearch: 'to search',
    toOpenCommandPalette: 'to open command palette',
  },
  he: {
    code: 'he',
    rtl: true,
    title: 'מקלדת',
    description: 'הצג קיצורי מקלדת או הקשות מקשים.',
    pressPrefix: 'לחץ',
    toSearch: 'לחיפוש',
    toOpenCommandPalette: 'לפתיחת פלטת פקודות',
  },
  ar: {
    code: 'ar',
    rtl: true,
    title: 'لوحة المفاتيح',
    description: 'عرض اختصارات لوحة المفاتيح أو ضغطات المفاتيح.',
    pressPrefix: 'اضغط',
    toSearch: 'للبحث',
    toOpenCommandPalette: 'لفتح لوحة الأوامر',
  },
  de: {
    code: 'de',
    title: 'Kbd',
    description: 'Tastaturkürzel oder Tastendrücke anzeigen.',
    pressPrefix: 'Drücken',
    toSearch: 'zum Suchen',
    toOpenCommandPalette: 'zum Öffnen der Befehlspalette',
  },
  fr: {
    code: 'fr',
    title: 'Kbd',
    description: 'Afficher les raccourcis clavier ou les frappes de touches.',
    pressPrefix: 'Appuyez',
    toSearch: 'pour rechercher',
    toOpenCommandPalette: 'pour ouvrir la palette de commandes',
  },
  es: {
    code: 'es',
    title: 'Kbd',
    description: 'Mostrar atajos de teclado o pulsaciones de teclas.',
    pressPrefix: 'Presiona',
    toSearch: 'para buscar',
    toOpenCommandPalette: 'para abrir la paleta de comandos',
  },
  ja: {
    code: 'ja',
    title: 'キーボード',
    description: 'キーボードショートカットやキー入力を表示。',
    pressPrefix: '押す',
    toSearch: '検索する',
    toOpenCommandPalette: 'コマンドパレットを開く',
  },
  zh: {
    code: 'zh',
    title: '键盘',
    description: '显示键盘快捷键或按键操作。',
    pressPrefix: '按下',
    toSearch: '搜索',
    toOpenCommandPalette: '打开命令面板',
  },
  ru: {
    code: 'ru',
    title: 'Клавиатура',
    description: 'Отображение горячих клавиш или нажатий клавиш.',
    pressPrefix: 'Нажмите',
    toSearch: 'для поиска',
    toOpenCommandPalette: 'для открытия палитры команд',
  },
  pt: {
    code: 'pt',
    title: 'Kbd',
    description: 'Exibir atalhos de teclado ou teclas pressionadas.',
    pressPrefix: 'Pressione',
    toSearch: 'para pesquisar',
    toOpenCommandPalette: 'para abrir a paleta de comandos',
  },
};
