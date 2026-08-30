import type { LocaleMeta } from '../../../../lib/i18n';

export interface NodeEditorSubgraphLocale extends LocaleMeta {
  /** Accessible name of the breadcrumb navigation. */
  breadcrumbLabel: string;
  /** Accessible name of a crumb — `{name}` is the level's label. */
  goTo: string;
  /** Label of the control that descends into a subgraph node. */
  open: string;
  /** Label of the control that goes back up one level. */
  back: string;
}

export const NODE_EDITOR_SUBGRAPH_LOCALES: Record<string, NodeEditorSubgraphLocale> = {
  en: {
    code: 'en',
    breadcrumbLabel: 'Graph path',
    goTo: 'Go to {name}',
    open: 'Open subgraph',
    back: 'Back',
  },
  he: {
    code: 'he',
    rtl: true,
    breadcrumbLabel: 'נתיב הגרף',
    goTo: 'מעבר אל {name}',
    open: 'פתיחת תת-גרף',
    back: 'חזרה',
  },
  ar: {
    code: 'ar',
    rtl: true,
    breadcrumbLabel: 'مسار الرسم البياني',
    goTo: 'الانتقال إلى {name}',
    open: 'فتح الرسم الفرعي',
    back: 'رجوع',
  },
  de: {
    code: 'de',
    breadcrumbLabel: 'Graphpfad',
    goTo: 'Zu {name} wechseln',
    open: 'Untergraph öffnen',
    back: 'Zurück',
  },
  fr: {
    code: 'fr',
    breadcrumbLabel: 'Chemin du graphe',
    goTo: 'Aller à {name}',
    open: 'Ouvrir le sous-graphe',
    back: 'Retour',
  },
  es: {
    code: 'es',
    breadcrumbLabel: 'Ruta del grafo',
    goTo: 'Ir a {name}',
    open: 'Abrir subgrafo',
    back: 'Atrás',
  },
  ja: {
    code: 'ja',
    breadcrumbLabel: 'グラフの階層',
    goTo: '{name} へ移動',
    open: 'サブグラフを開く',
    back: '戻る',
  },
  zh: {
    code: 'zh',
    breadcrumbLabel: '图层级',
    goTo: '前往 {name}',
    open: '打开子图',
    back: '返回',
  },
  ru: {
    code: 'ru',
    breadcrumbLabel: 'Путь в графе',
    goTo: 'Перейти к {name}',
    open: 'Открыть подграф',
    back: 'Назад',
  },
  pt: {
    code: 'pt',
    breadcrumbLabel: 'Caminho do grafo',
    goTo: 'Ir para {name}',
    open: 'Abrir subgrafo',
    back: 'Voltar',
  },
};
