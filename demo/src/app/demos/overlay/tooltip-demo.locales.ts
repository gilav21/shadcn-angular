// demo/src/app/demos/overlay/tooltip-demo.locales.ts
import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface TooltipDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  topTooltip: string;
  topButtonLabel: string;
  bottomTooltip: string;
  bottomButtonLabel: string;
  componentTooltip: string;
  componentButtonLabel: string;
}

export const TOOLTIP_DEMO_LOCALES: Record<string, TooltipDemoLocale> = {
  en: {
    code: 'en',
    title: 'Tooltip',
    description: 'Hover hints for elements.',
    topTooltip: 'This is a tooltip!',
    topButtonLabel: 'Hover me (Directive)',
    bottomTooltip: 'Bottom tooltip',
    bottomButtonLabel: 'Hover me (Bottom)',
    componentTooltip: 'Add to library',
    componentButtonLabel: 'Hover me (Component)',
  },
  he: {
    code: 'he', rtl: true,
    title: 'טיפ כלי',
    description: 'רמזים בריחוף עבור אלמנטים.',
    topTooltip: 'זה טיפ כלי!',
    topButtonLabel: 'רחף מעלי (הנחיה)',
    bottomTooltip: 'טיפ כלי תחתון',
    bottomButtonLabel: 'רחף מעלי (תחתון)',
    componentTooltip: 'הוסף לספרייה',
    componentButtonLabel: 'רחף מעלי (קומפוננטה)',
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'تلميح الأداة',
    description: 'تلميحات عند التمرير فوق العناصر.',
    topTooltip: 'هذا تلميح أداة!',
    topButtonLabel: 'مرر فوقي (التوجيه)',
    bottomTooltip: 'تلميح أداة سفلي',
    bottomButtonLabel: 'مرر فوقي (سفلي)',
    componentTooltip: 'إضافة إلى المكتبة',
    componentButtonLabel: 'مرر فوقي (المكوّن)',
  },
  de: {
    code: 'de',
    title: 'Tooltip',
    description: 'Hover-Hinweise für Elemente.',
    topTooltip: 'Dies ist ein Tooltip!',
    topButtonLabel: 'Hover hier (Direktive)',
    bottomTooltip: 'Unterer Tooltip',
    bottomButtonLabel: 'Hover hier (Unten)',
    componentTooltip: 'Zur Bibliothek hinzufügen',
    componentButtonLabel: 'Hover hier (Komponente)',
  },
  fr: {
    code: 'fr',
    title: 'Infobulle',
    description: 'Indications au survol pour les éléments.',
    topTooltip: 'C\'est une infobulle !',
    topButtonLabel: 'Survolez-moi (Directive)',
    bottomTooltip: 'Infobulle inférieure',
    bottomButtonLabel: 'Survolez-moi (Inférieure)',
    componentTooltip: 'Ajouter à la bibliothèque',
    componentButtonLabel: 'Survolez-moi (Composant)',
  },
  es: {
    code: 'es',
    title: 'Información emergente',
    description: 'Pistas al pasar el cursor sobre elementos.',
    topTooltip: '¡Esto es una información emergente!',
    topButtonLabel: 'Pasa el cursor (Directiva)',
    bottomTooltip: 'Información emergente inferior',
    bottomButtonLabel: 'Pasa el cursor (Inferior)',
    componentTooltip: 'Agregar a la biblioteca',
    componentButtonLabel: 'Pasa el cursor (Componente)',
  },
  ja: {
    code: 'ja',
    title: 'ツールチップ',
    description: '要素のホバーヒントです。',
    topTooltip: 'これはツールチップです！',
    topButtonLabel: 'ホバーしてね（ディレクティブ）',
    bottomTooltip: '下部ツールチップ',
    bottomButtonLabel: 'ホバーしてね（下部）',
    componentTooltip: 'ライブラリに追加',
    componentButtonLabel: 'ホバーしてね（コンポーネント）',
  },
  zh: {
    code: 'zh',
    title: '工具提示',
    description: '元素的悬停提示。',
    topTooltip: '这是一个工具提示！',
    topButtonLabel: '悬停我（指令）',
    bottomTooltip: '底部工具提示',
    bottomButtonLabel: '悬停我（底部）',
    componentTooltip: '添加到库',
    componentButtonLabel: '悬停我（组件）',
  },
  ru: {
    code: 'ru',
    title: 'Подсказка',
    description: 'Всплывающие подсказки для элементов.',
    topTooltip: 'Это подсказка!',
    topButtonLabel: 'Наведите (Директива)',
    bottomTooltip: 'Нижняя подсказка',
    bottomButtonLabel: 'Наведите (Снизу)',
    componentTooltip: 'Добавить в библиотеку',
    componentButtonLabel: 'Наведите (Компонент)',
  },
  pt: {
    code: 'pt',
    title: 'Dica de ferramenta',
    description: 'Dicas de foco para elementos.',
    topTooltip: 'Isto é uma dica de ferramenta!',
    topButtonLabel: 'Passe o mouse (Diretiva)',
    bottomTooltip: 'Dica de ferramenta inferior',
    bottomButtonLabel: 'Passe o mouse (Inferior)',
    componentTooltip: 'Adicionar à biblioteca',
    componentButtonLabel: 'Passe o mouse (Componente)',
  },
};
