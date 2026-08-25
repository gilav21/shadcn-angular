import type { LocaleMeta } from '../../../../lib/i18n';

export interface NodeEditorGroupsLocale extends LocaleMeta {
  /** Accessible name of a frame — `{title}` and `{count}` members. */
  groupLabel: string;
  /** Accessible name of a freestanding note. */
  comment: string;
}

export const NODE_EDITOR_GROUPS_LOCALES: Record<string, NodeEditorGroupsLocale> = {
  en: {
    code: 'en',
    groupLabel: 'Group {title}, {count} nodes',
    comment: 'Comment',
  },
  he: {
    code: 'he',
    rtl: true,
    groupLabel: 'קבוצה {title}, {count} צמתים',
    comment: 'הערה',
  },
  ar: {
    code: 'ar',
    rtl: true,
    groupLabel: 'مجموعة {title}، {count} عقد',
    comment: 'تعليق',
  },
  de: {
    code: 'de',
    groupLabel: 'Gruppe {title}, {count} Knoten',
    comment: 'Kommentar',
  },
  fr: {
    code: 'fr',
    groupLabel: 'Groupe {title}, {count} nœuds',
    comment: 'Commentaire',
  },
  es: {
    code: 'es',
    groupLabel: 'Grupo {title}, {count} nodos',
    comment: 'Comentario',
  },
  ja: {
    code: 'ja',
    groupLabel: 'グループ {title}、{count} ノード',
    comment: 'コメント',
  },
  zh: {
    code: 'zh',
    groupLabel: '分组 {title}，{count} 个节点',
    comment: '注释',
  },
  ru: {
    code: 'ru',
    groupLabel: 'Группа {title}, узлов: {count}',
    comment: 'Комментарий',
  },
  pt: {
    code: 'pt',
    groupLabel: 'Grupo {title}, {count} nós',
    comment: 'Comentário',
  },
};
