import type { LocaleMeta } from '../../../../lib/i18n';

export interface NodeEditorPaletteLocale extends LocaleMeta {
  /** Placeholder in the search field. */
  search: string;
  /** Shown when nothing matches. */
  empty: string;
  /** Group heading for types with no category of their own. */
  uncategorised: string;
  /** Accessible name for the picker as a whole. */
  label: string;
  /** Prefix for the "accepts X" hint on a filtered result. */
  accepts: string;
}

export const NODE_EDITOR_PALETTE_LOCALES: Record<string, NodeEditorPaletteLocale> = {
  en: {
    code: 'en',
    search: 'Search nodes…',
    empty: 'No node type matches.',
    uncategorised: 'Other',
    label: 'Add a node',
    accepts: 'accepts',
  },
  he: {
    code: 'he',
    rtl: true,
    search: 'חיפוש צמתים…',
    empty: 'לא נמצא סוג צומת מתאים.',
    uncategorised: 'אחר',
    label: 'הוספת צומת',
    accepts: 'מקבל',
  },
  ar: {
    code: 'ar',
    rtl: true,
    search: 'البحث عن العقد…',
    empty: 'لا يوجد نوع عقدة مطابق.',
    uncategorised: 'أخرى',
    label: 'إضافة عقدة',
    accepts: 'يقبل',
  },
  de: {
    code: 'de',
    search: 'Knoten suchen…',
    empty: 'Kein passender Knotentyp.',
    uncategorised: 'Sonstige',
    label: 'Knoten hinzufügen',
    accepts: 'akzeptiert',
  },
  fr: {
    code: 'fr',
    search: 'Rechercher des nœuds…',
    empty: 'Aucun type de nœud correspondant.',
    uncategorised: 'Autres',
    label: 'Ajouter un nœud',
    accepts: 'accepte',
  },
  es: {
    code: 'es',
    search: 'Buscar nodos…',
    empty: 'Ningún tipo de nodo coincide.',
    uncategorised: 'Otros',
    label: 'Añadir un nodo',
    accepts: 'acepta',
  },
  ja: {
    code: 'ja',
    search: 'ノードを検索…',
    empty: '一致するノードタイプがありません。',
    uncategorised: 'その他',
    label: 'ノードを追加',
    accepts: '受け取る型',
  },
  zh: {
    code: 'zh',
    search: '搜索节点…',
    empty: '没有匹配的节点类型。',
    uncategorised: '其他',
    label: '添加节点',
    accepts: '接受',
  },
  ru: {
    code: 'ru',
    search: 'Поиск узлов…',
    empty: 'Подходящих типов узлов нет.',
    uncategorised: 'Прочее',
    label: 'Добавить узел',
    accepts: 'принимает',
  },
  pt: {
    code: 'pt',
    search: 'Procurar nós…',
    empty: 'Nenhum tipo de nó corresponde.',
    uncategorised: 'Outros',
    label: 'Adicionar um nó',
    accepts: 'aceita',
  },
};
