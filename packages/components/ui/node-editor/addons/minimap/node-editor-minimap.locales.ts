import type { LocaleMeta } from '../../../../lib/i18n';

export interface NodeEditorMinimapLocale extends LocaleMeta {
  /** Accessible name of the control that opens a folded map. */
  expand: string;
  /** Accessible name of the control that folds it away. */
  collapse: string;
}

export const NODE_EDITOR_MINIMAP_LOCALES: Record<string, NodeEditorMinimapLocale> = {
  en: { code: 'en', expand: 'Show graph overview', collapse: 'Hide overview' },
  he: { code: 'he', rtl: true, expand: 'הצגת מפת הגרף', collapse: 'הסתרת המפה' },
  ar: { code: 'ar', rtl: true, expand: 'إظهار نظرة عامة', collapse: 'إخفاء النظرة العامة' },
  de: { code: 'de', expand: 'Übersicht anzeigen', collapse: 'Übersicht ausblenden' },
  fr: { code: 'fr', expand: 'Afficher l’aperçu', collapse: 'Masquer l’aperçu' },
  es: { code: 'es', expand: 'Mostrar vista general', collapse: 'Ocultar vista general' },
  ja: { code: 'ja', expand: '全体図を表示', collapse: '全体図を隠す' },
  zh: { code: 'zh', expand: '显示缩略图', collapse: '隐藏缩略图' },
  ru: { code: 'ru', expand: 'Показать обзор', collapse: 'Скрыть обзор' },
  pt: { code: 'pt', expand: 'Mostrar visão geral', collapse: 'Ocultar visão geral' },
};
