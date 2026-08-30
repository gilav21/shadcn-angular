import type { LocaleMeta } from '../../../../lib/i18n';

export interface NodeEditorProblemsLocale extends LocaleMeta {
  /** Heading for the panel. */
  heading: string;
  /** Shown when the graph has nothing wrong with it. */
  empty: string;
  /** Screen-reader label for an error row. */
  error: string;
  /** Screen-reader label for a warning row. */
  warning: string;
  /** Accessible name for the button that reveals the offending node. */
  reveal: string;
  /** `{count}` problems — used in the summary and the live announcement. */
  count: string;
}

export const NODE_EDITOR_PROBLEMS_LOCALES: Record<string, NodeEditorProblemsLocale> = {
  en: {
    code: 'en',
    heading: 'Problems',
    empty: 'No problems. The graph is valid.',
    error: 'Error',
    warning: 'Warning',
    reveal: 'Show this node',
    count: '{count} problems',
  },
  he: {
    code: 'he',
    rtl: true,
    heading: 'בעיות',
    empty: 'אין בעיות. הגרף תקין.',
    error: 'שגיאה',
    warning: 'אזהרה',
    reveal: 'הצגת הצומת',
    count: '{count} בעיות',
  },
  ar: {
    code: 'ar',
    rtl: true,
    heading: 'المشاكل',
    empty: 'لا توجد مشاكل. الرسم البياني صالح.',
    error: 'خطأ',
    warning: 'تحذير',
    reveal: 'إظهار هذه العقدة',
    count: '{count} مشاكل',
  },
  de: {
    code: 'de',
    heading: 'Probleme',
    empty: 'Keine Probleme. Der Graph ist gültig.',
    error: 'Fehler',
    warning: 'Warnung',
    reveal: 'Diesen Knoten anzeigen',
    count: '{count} Probleme',
  },
  fr: {
    code: 'fr',
    heading: 'Problèmes',
    empty: 'Aucun problème. Le graphe est valide.',
    error: 'Erreur',
    warning: 'Avertissement',
    reveal: 'Afficher ce nœud',
    count: '{count} problèmes',
  },
  es: {
    code: 'es',
    heading: 'Problemas',
    empty: 'Sin problemas. El grafo es válido.',
    error: 'Error',
    warning: 'Advertencia',
    reveal: 'Mostrar este nodo',
    count: '{count} problemas',
  },
  ja: {
    code: 'ja',
    heading: '問題',
    empty: '問題はありません。グラフは有効です。',
    error: 'エラー',
    warning: '警告',
    reveal: 'このノードを表示',
    count: '{count} 件の問題',
  },
  zh: {
    code: 'zh',
    heading: '问题',
    empty: '没有问题。图是有效的。',
    error: '错误',
    warning: '警告',
    reveal: '显示该节点',
    count: '{count} 个问题',
  },
  ru: {
    code: 'ru',
    heading: 'Проблемы',
    empty: 'Проблем нет. Граф корректен.',
    error: 'Ошибка',
    warning: 'Предупреждение',
    reveal: 'Показать этот узел',
    count: 'Проблем: {count}',
  },
  pt: {
    code: 'pt',
    heading: 'Problemas',
    empty: 'Sem problemas. O grafo é válido.',
    error: 'Erro',
    warning: 'Aviso',
    reveal: 'Mostrar este nó',
    count: '{count} problemas',
  },
};
