import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface InputOtpDemoLocale extends LocaleMeta {
    heading: string;
    description: string;
    formHeading: string;
    formDescription: string;
    formValueLabel: string;
}

export const INPUT_OTP_DEMO_LOCALES: Record<string, InputOtpDemoLocale> = {
    en: {
        code: 'en',
        heading: 'Input OTP',
        description: 'One-time password input fields.',
        formHeading: 'Reactive forms',
        formDescription: 'Bind formControlName: the form value renders, each change reaches the form once, and disable() disables the control.',
        formValueLabel: 'Form value',
    },
    he: {
        code: 'he',
        rtl: true,
        heading: 'קלט סיסמה חד-פעמית',
        description: 'שדות קלט לסיסמה חד-פעמית.',
        formHeading: 'טפסים ריאקטיביים',
        formDescription: 'קשרו formControlName: ערך הטופס מוצג, כל שינוי מגיע לטופס פעם אחת, ו-disable() משבית את הרכיב.',
        formValueLabel: 'ערך הטופס',
    },
    ar: {
        code: 'ar',
        rtl: true,
        heading: 'إدخال كلمة المرور لمرة واحدة',
        description: 'حقول إدخال كلمة المرور لمرة واحدة.',
        formHeading: 'النماذج التفاعلية',
        formDescription: 'اربط formControlName: تظهر قيمة النموذج، ويصل كل تغيير إلى النموذج مرة واحدة، و disable() يعطّل العنصر.',
        formValueLabel: 'قيمة النموذج',
    },
    de: {
        code: 'de',
        heading: 'Einmalpasswort-Eingabe',
        description: 'Eingabefelder für Einmalpasswörter.',
        formHeading: 'Reaktive Formulare',
        formDescription: 'formControlName binden: Der Formularwert wird angezeigt, jede Änderung erreicht das Formular genau einmal, und disable() deaktiviert das Steuerelement.',
        formValueLabel: 'Formularwert',
    },
    fr: {
        code: 'fr',
        heading: 'Saisie OTP',
        description: 'Champs de saisie pour mot de passe à usage unique.',
        formHeading: 'Formulaires réactifs',
        formDescription: 'Liez formControlName : la valeur du formulaire s’affiche, chaque changement atteint le formulaire une seule fois, et disable() désactive le composant.',
        formValueLabel: 'Valeur du formulaire',
    },
    es: {
        code: 'es',
        heading: 'Entrada OTP',
        description: 'Campos de entrada para contraseña de un solo uso.',
        formHeading: 'Formularios reactivos',
        formDescription: 'Vincula formControlName: el valor del formulario se muestra, cada cambio llega al formulario una vez y disable() desactiva el componente.',
        formValueLabel: 'Valor del formulario',
    },
    ja: {
        code: 'ja',
        heading: 'ワンタイムパスワード入力',
        description: 'ワンタイムパスワードの入力フィールド。',
        formHeading: 'リアクティブフォーム',
        formDescription: 'formControlName をバインド：フォームの値が表示され、各変更は一度だけフォームに届き、disable() でコンポーネントが無効になります。',
        formValueLabel: 'フォームの値',
    },
    zh: {
        code: 'zh',
        heading: '一次性密码输入',
        description: '一次性密码输入字段。',
        formHeading: '响应式表单',
        formDescription: '绑定 formControlName：显示表单值，每次更改只传给表单一次，disable() 会禁用组件。',
        formValueLabel: '表单值',
    },
    ru: {
        code: 'ru',
        heading: 'Ввод одноразового пароля',
        description: 'Поля для ввода одноразового пароля.',
        formHeading: 'Реактивные формы',
        formDescription: 'Привяжите formControlName: значение формы отображается, каждое изменение попадает в форму один раз, а disable() отключает компонент.',
        formValueLabel: 'Значение формы',
    },
    pt: {
        code: 'pt',
        heading: 'Entrada de senha única',
        description: 'Campos de entrada para senha de uso único.',
        formHeading: 'Formulários reativos',
        formDescription: 'Vincule formControlName: o valor do formulário é exibido, cada alteração chega ao formulário uma vez e disable() desativa o componente.',
        formValueLabel: 'Valor do formulário',
    },
};
