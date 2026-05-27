import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface SeparatorDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  libraryName: string;
  libraryDescription: string;
  navBlog: string;
  navDocs: string;
  navSource: string;
}

export const SEPARATOR_DEMO_LOCALES: Record<string, SeparatorDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Separator',
    description: 'Visually or semantically separates content.',
    libraryName: 'Radix Primitives',
    libraryDescription: 'An open-source UI component library.',
    navBlog: 'Blog',
    navDocs: 'Docs',
    navSource: 'Source',
  },
  he: {
    code: 'he',
    rtl: true,
    heading: 'מפריד',
    description: 'מפריד תוכן בצורה ויזואלית או סמנטית.',
    libraryName: 'Radix Primitives',
    libraryDescription: 'ספריית רכיבי UI בקוד פתוח.',
    navBlog: 'בלוג',
    navDocs: 'תיעוד',
    navSource: 'קוד מקור',
  },
  ar: {
    code: 'ar',
    rtl: true,
    heading: 'فاصل',
    description: 'يفصل المحتوى بصريًا أو دلاليًا.',
    libraryName: 'Radix Primitives',
    libraryDescription: 'مكتبة مكوّنات واجهة مستخدم مفتوحة المصدر.',
    navBlog: 'مدونة',
    navDocs: 'توثيق',
    navSource: 'المصدر',
  },
  de: {
    code: 'de',
    heading: 'Trennlinie',
    description: 'Trennt Inhalte visuell oder semantisch.',
    libraryName: 'Radix Primitives',
    libraryDescription: 'Eine Open-Source-UI-Komponentenbibliothek.',
    navBlog: 'Blog',
    navDocs: 'Dokumentation',
    navSource: 'Quellcode',
  },
  fr: {
    code: 'fr',
    heading: 'Séparateur',
    description: 'Sépare visuellement ou sémantiquement le contenu.',
    libraryName: 'Radix Primitives',
    libraryDescription: 'Une bibliothèque de composants UI open source.',
    navBlog: 'Blog',
    navDocs: 'Documentation',
    navSource: 'Source',
  },
  es: {
    code: 'es',
    heading: 'Separador',
    description: 'Separa el contenido visual o semánticamente.',
    libraryName: 'Radix Primitives',
    libraryDescription: 'Una biblioteca de componentes UI de código abierto.',
    navBlog: 'Blog',
    navDocs: 'Documentación',
    navSource: 'Fuente',
  },
  ja: {
    code: 'ja',
    heading: 'セパレーター',
    description: 'コンテンツを視覚的または意味的に分割します。',
    libraryName: 'Radix Primitives',
    libraryDescription: 'オープンソースの UI コンポーネントライブラリ。',
    navBlog: 'ブログ',
    navDocs: 'ドキュメント',
    navSource: 'ソース',
  },
  zh: {
    code: 'zh',
    heading: '分隔线',
    description: '以视觉或语义方式分隔内容。',
    libraryName: 'Radix Primitives',
    libraryDescription: '一个开源 UI 组件库。',
    navBlog: '博客',
    navDocs: '文档',
    navSource: '源码',
  },
  ru: {
    code: 'ru',
    heading: 'Разделитель',
    description: 'Визуально или семантически разделяет контент.',
    libraryName: 'Radix Primitives',
    libraryDescription: 'Открытая библиотека UI-компонентов.',
    navBlog: 'Блог',
    navDocs: 'Документация',
    navSource: 'Исходный код',
  },
  pt: {
    code: 'pt',
    heading: 'Separador',
    description: 'Separa conteúdo visual ou semanticamente.',
    libraryName: 'Radix Primitives',
    libraryDescription: 'Uma biblioteca de componentes UI de código aberto.',
    navBlog: 'Blog',
    navDocs: 'Documentação',
    navSource: 'Fonte',
  },
};
