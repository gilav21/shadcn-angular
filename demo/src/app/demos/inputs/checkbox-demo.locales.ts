import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface CheckboxDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  acceptTerms: string;
  subscribeNewsletter: string;
  disabledCheckbox: string;
  simpleModeHeading: string;
  simpleModeDescription: string;
}

export const CHECKBOX_DEMO_LOCALES: Record<string, CheckboxDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Checkbox',
    description: 'Checkbox component for boolean selection.',
    acceptTerms: 'Accept terms and conditions',
    subscribeNewsletter: 'Subscribe to newsletter',
    disabledCheckbox: 'Disabled checkbox',
    simpleModeHeading: 'Simple Mode (With Label Input)',
    simpleModeDescription: 'Using the label input instead of a separate <ui-label> element.',
  },
  he: {
    code: 'he',
    rtl: true,
    heading: 'תיבת סימון',
    description: 'רכיב תיבת סימון לבחירה בוליאנית.',
    acceptTerms: 'אני מסכים לתנאי השימוש',
    subscribeNewsletter: 'הירשם לניוזלטר',
    disabledCheckbox: 'תיבת סימון מושבתת',
    simpleModeHeading: 'מצב פשוט (עם קלט תווית)',
    simpleModeDescription: 'שימוש בקלט התווית במקום רכיב <ui-label> נפרד.',
  },
  ar: {
    code: 'ar',
    rtl: true,
    heading: 'خانة اختيار',
    description: 'مكوّن خانة الاختيار للتحديد المنطقي.',
    acceptTerms: 'أوافق على الشروط والأحكام',
    subscribeNewsletter: 'الاشتراك في النشرة الإخبارية',
    disabledCheckbox: 'خانة اختيار معطّلة',
    simpleModeHeading: 'الوضع البسيط (مع إدخال التسمية)',
    simpleModeDescription: 'استخدام إدخال التسمية بدلاً من عنصر <ui-label> المنفصل.',
  },
  de: {
    code: 'de',
    heading: 'Kontrollkästchen',
    description: 'Kontrollkästchen-Komponente für boolesche Auswahl.',
    acceptTerms: 'Nutzungsbedingungen akzeptieren',
    subscribeNewsletter: 'Newsletter abonnieren',
    disabledCheckbox: 'Deaktiviertes Kontrollkästchen',
    simpleModeHeading: 'Einfacher Modus (mit Label-Eingabe)',
    simpleModeDescription: 'Das Label-Input anstelle eines separaten <ui-label>-Elements verwenden.',
  },
  fr: {
    code: 'fr',
    heading: 'Case à cocher',
    description: 'Composant de case à cocher pour la sélection booléenne.',
    acceptTerms: "Accepter les conditions d'utilisation",
    subscribeNewsletter: "S'abonner à la newsletter",
    disabledCheckbox: 'Case à cocher désactivée',
    simpleModeHeading: 'Mode simple (avec entrée de libellé)',
    simpleModeDescription: "Utiliser l'entrée de libellé à la place d'un élément <ui-label> séparé.",
  },
  es: {
    code: 'es',
    heading: 'Casilla de verificación',
    description: 'Componente de casilla de verificación para selección booleana.',
    acceptTerms: 'Aceptar los términos y condiciones',
    subscribeNewsletter: 'Suscribirse al boletín',
    disabledCheckbox: 'Casilla de verificación deshabilitada',
    simpleModeHeading: 'Modo simple (con entrada de etiqueta)',
    simpleModeDescription: 'Usar la entrada de etiqueta en lugar de un elemento <ui-label> separado.',
  },
  ja: {
    code: 'ja',
    heading: 'チェックボックス',
    description: 'ブール選択用のチェックボックスコンポーネント。',
    acceptTerms: '利用規約に同意する',
    subscribeNewsletter: 'ニュースレターを購読する',
    disabledCheckbox: '無効なチェックボックス',
    simpleModeHeading: 'シンプルモード（ラベル入力使用）',
    simpleModeDescription: '別の <ui-label> 要素の代わりにラベル入力を使用します。',
  },
  zh: {
    code: 'zh',
    heading: '复选框',
    description: '用于布尔选择的复选框组件。',
    acceptTerms: '接受条款和条件',
    subscribeNewsletter: '订阅新闻通讯',
    disabledCheckbox: '禁用的复选框',
    simpleModeHeading: '简单模式（使用标签输入）',
    simpleModeDescription: '使用标签输入代替单独的 <ui-label> 元素。',
  },
  ru: {
    code: 'ru',
    heading: 'Флажок',
    description: 'Компонент флажка для логического выбора.',
    acceptTerms: 'Принять условия использования',
    subscribeNewsletter: 'Подписаться на рассылку',
    disabledCheckbox: 'Отключённый флажок',
    simpleModeHeading: 'Простой режим (с вводом метки)',
    simpleModeDescription: 'Использовать ввод метки вместо отдельного элемента <ui-label>.',
  },
  pt: {
    code: 'pt',
    heading: 'Caixa de seleção',
    description: 'Componente de caixa de seleção para seleção booleana.',
    acceptTerms: 'Aceitar os termos e condições',
    subscribeNewsletter: 'Subscrever a newsletter',
    disabledCheckbox: 'Caixa de seleção desativada',
    simpleModeHeading: 'Modo simples (com entrada de rótulo)',
    simpleModeDescription: 'Usar a entrada de rótulo em vez de um elemento <ui-label> separado.',
  },
};
