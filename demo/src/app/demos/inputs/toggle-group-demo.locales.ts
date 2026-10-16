import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface ToggleGroupDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  singleLabel: string;
  multipleLabel: string;
  formHeading: string;
  formDescription: string;
  formValueLabel: string;
}

export const TOGGLE_GROUP_DEMO_LOCALES: Record<string, ToggleGroupDemoLocale> = {
  en: {
    code: 'en',
    title: 'Toggle Group',
    description: 'A set of two-state buttons that can be toggled on or off.',
    singleLabel: 'Single selection:',
    multipleLabel: 'Multiple selection:',
    formHeading: 'Reactive forms',
    formDescription: 'Bind formControlName: the form value renders, each change reaches the form once, and disable() disables the control.',
    formValueLabel: 'Form value',
  },
  he: {
    code: 'he', rtl: true,
    title: 'קבוצת לחצני מצב',
    description: 'סט כפתורים דו-מצביים שניתן להפעיל או לכבות.',
    singleLabel: 'בחירה יחידה:',
    multipleLabel: 'בחירה מרובה:',
    formHeading: 'טפסים ריאקטיביים',
    formDescription: 'קשרו formControlName: ערך הטופס מוצג, כל שינוי מגיע לטופס פעם אחת, ו-disable() משבית את הרכיב.',
    formValueLabel: 'ערך הטופס',
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'مجموعة التبديل',
    description: 'مجموعة من الأزرار ذات حالتين يمكن تشغيلها أو إيقافها.',
    singleLabel: 'تحديد واحد:',
    multipleLabel: 'تحديد متعدد:',
    formHeading: 'النماذج التفاعلية',
    formDescription: 'اربط formControlName: تظهر قيمة النموذج، ويصل كل تغيير إلى النموذج مرة واحدة، و disable() يعطّل العنصر.',
    formValueLabel: 'قيمة النموذج',
  },
  de: {
    code: 'de',
    title: 'Umschaltergruppe',
    description: 'Eine Gruppe von Schaltflächen mit zwei Zuständen, die ein- oder ausgeschaltet werden können.',
    singleLabel: 'Einzelauswahl:',
    multipleLabel: 'Mehrfachauswahl:',
    formHeading: 'Reaktive Formulare',
    formDescription: 'formControlName binden: Der Formularwert wird angezeigt, jede Änderung erreicht das Formular genau einmal, und disable() deaktiviert das Steuerelement.',
    formValueLabel: 'Formularwert',
  },
  fr: {
    code: 'fr',
    title: 'Groupe de bascule',
    description: 'Un ensemble de boutons à deux états pouvant être activés ou désactivés.',
    singleLabel: 'Sélection unique :',
    multipleLabel: 'Sélection multiple :',
    formHeading: 'Formulaires réactifs',
    formDescription: 'Liez formControlName : la valeur du formulaire s’affiche, chaque changement atteint le formulaire une seule fois, et disable() désactive le composant.',
    formValueLabel: 'Valeur du formulaire',
  },
  es: {
    code: 'es',
    title: 'Grupo de alternancia',
    description: 'Un conjunto de botones de dos estados que se pueden activar o desactivar.',
    singleLabel: 'Selección única:',
    multipleLabel: 'Selección múltiple:',
    formHeading: 'Formularios reactivos',
    formDescription: 'Vincula formControlName: el valor del formulario se muestra, cada cambio llega al formulario una vez y disable() desactiva el componente.',
    formValueLabel: 'Valor del formulario',
  },
  ja: {
    code: 'ja',
    title: 'トグルグループ',
    description: 'オン・オフを切り替えられる2状態ボタンのセットです。',
    singleLabel: '単一選択：',
    multipleLabel: '複数選択：',
    formHeading: 'リアクティブフォーム',
    formDescription: 'formControlName をバインド：フォームの値が表示され、各変更は一度だけフォームに届き、disable() でコンポーネントが無効になります。',
    formValueLabel: 'フォームの値',
  },
  zh: {
    code: 'zh',
    title: '切换组',
    description: '一组可以打开或关闭的双状态按钮。',
    singleLabel: '单选：',
    multipleLabel: '多选：',
    formHeading: '响应式表单',
    formDescription: '绑定 formControlName：显示表单值，每次更改只传给表单一次，disable() 会禁用组件。',
    formValueLabel: '表单值',
  },
  ru: {
    code: 'ru',
    title: 'Группа переключателей',
    description: 'Набор кнопок с двумя состояниями, которые можно включать или выключать.',
    singleLabel: 'Одиночный выбор:',
    multipleLabel: 'Множественный выбор:',
    formHeading: 'Реактивные формы',
    formDescription: 'Привяжите formControlName: значение формы отображается, каждое изменение попадает в форму один раз, а disable() отключает компонент.',
    formValueLabel: 'Значение формы',
  },
  pt: {
    code: 'pt',
    title: 'Grupo de alternância',
    description: 'Um conjunto de botões de dois estados que podem ser ligados ou desligados.',
    singleLabel: 'Seleção única:',
    multipleLabel: 'Seleção múltipla:',
    formHeading: 'Formulários reativos',
    formDescription: 'Vincule formControlName: o valor do formulário é exibido, cada alteração chega ao formulário uma vez e disable() desativa o componente.',
    formValueLabel: 'Valor do formulário',
  },
};
