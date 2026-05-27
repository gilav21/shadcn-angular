import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface ToggleGroupDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  singleLabel: string;
  multipleLabel: string;
}

export const TOGGLE_GROUP_DEMO_LOCALES: Record<string, ToggleGroupDemoLocale> = {
  en: {
    code: 'en',
    title: 'Toggle Group',
    description: 'A set of two-state buttons that can be toggled on or off.',
    singleLabel: 'Single selection:',
    multipleLabel: 'Multiple selection:',
  },
  he: {
    code: 'he', rtl: true,
    title: 'קבוצת לחצני מצב',
    description: 'סט כפתורים דו-מצביים שניתן להפעיל או לכבות.',
    singleLabel: 'בחירה יחידה:',
    multipleLabel: 'בחירה מרובה:',
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'مجموعة التبديل',
    description: 'مجموعة من الأزرار ذات حالتين يمكن تشغيلها أو إيقافها.',
    singleLabel: 'تحديد واحد:',
    multipleLabel: 'تحديد متعدد:',
  },
  de: {
    code: 'de',
    title: 'Umschaltergruppe',
    description: 'Eine Gruppe von Schaltflächen mit zwei Zuständen, die ein- oder ausgeschaltet werden können.',
    singleLabel: 'Einzelauswahl:',
    multipleLabel: 'Mehrfachauswahl:',
  },
  fr: {
    code: 'fr',
    title: 'Groupe de bascule',
    description: 'Un ensemble de boutons à deux états pouvant être activés ou désactivés.',
    singleLabel: 'Sélection unique :',
    multipleLabel: 'Sélection multiple :',
  },
  es: {
    code: 'es',
    title: 'Grupo de alternancia',
    description: 'Un conjunto de botones de dos estados que se pueden activar o desactivar.',
    singleLabel: 'Selección única:',
    multipleLabel: 'Selección múltiple:',
  },
  ja: {
    code: 'ja',
    title: 'トグルグループ',
    description: 'オン・オフを切り替えられる2状態ボタンのセットです。',
    singleLabel: '単一選択：',
    multipleLabel: '複数選択：',
  },
  zh: {
    code: 'zh',
    title: '切换组',
    description: '一组可以打开或关闭的双状态按钮。',
    singleLabel: '单选：',
    multipleLabel: '多选：',
  },
  ru: {
    code: 'ru',
    title: 'Группа переключателей',
    description: 'Набор кнопок с двумя состояниями, которые можно включать или выключать.',
    singleLabel: 'Одиночный выбор:',
    multipleLabel: 'Множественный выбор:',
  },
  pt: {
    code: 'pt',
    title: 'Grupo de alternância',
    description: 'Um conjunto de botões de dois estados que podem ser ligados ou desligados.',
    singleLabel: 'Seleção única:',
    multipleLabel: 'Seleção múltipla:',
  },
};
