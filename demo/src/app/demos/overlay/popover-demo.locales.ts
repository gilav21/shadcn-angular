// demo/src/app/demos/overlay/popover-demo.locales.ts
import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface PopoverDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  openLabel: string;
  dimensionsHeading: string;
  dimensionsDescription: string;
  widthLabel: string;
  maxWidthLabel: string;
  closeLabel: string;
}

export const POPOVER_DEMO_LOCALES: Record<string, PopoverDemoLocale> = {
  en: {
    code: 'en',
    title: 'Popover',
    description: 'Floating content that appears when a trigger is clicked.',
    openLabel: 'Open Popover',
    dimensionsHeading: 'Dimensions',
    dimensionsDescription: 'Set the dimensions for the layer.',
    widthLabel: 'Width',
    maxWidthLabel: 'Max. width',
    closeLabel: 'Close',
  },
  he: {
    code: 'he', rtl: true,
    title: 'חלון צף',
    description: 'תוכן צף שמופיע בעת לחיצה על טריגר.',
    openLabel: 'פתח חלון צף',
    dimensionsHeading: 'מידות',
    dimensionsDescription: 'הגדר את המידות של השכבה.',
    widthLabel: 'רוחב',
    maxWidthLabel: 'רוחב מקסימלי',
    closeLabel: 'סגור',
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'النافذة المنبثقة',
    description: 'محتوى عائم يظهر عند النقر على المشغّل.',
    openLabel: 'فتح النافذة المنبثقة',
    dimensionsHeading: 'الأبعاد',
    dimensionsDescription: 'تعيين أبعاد الطبقة.',
    widthLabel: 'العرض',
    maxWidthLabel: 'الحد الأقصى للعرض',
    closeLabel: 'إغلاق',
  },
  de: {
    code: 'de',
    title: 'Popover',
    description: 'Schwebendes Element, das bei einem Klick auf einen Auslöser erscheint.',
    openLabel: 'Popover öffnen',
    dimensionsHeading: 'Abmessungen',
    dimensionsDescription: 'Legen Sie die Abmessungen für die Ebene fest.',
    widthLabel: 'Breite',
    maxWidthLabel: 'Max. Breite',
    closeLabel: 'Schließen',
  },
  fr: {
    code: 'fr',
    title: 'Popover',
    description: 'Contenu flottant qui apparaît lorsqu\'un déclencheur est cliqué.',
    openLabel: 'Ouvrir le popover',
    dimensionsHeading: 'Dimensions',
    dimensionsDescription: 'Définissez les dimensions du calque.',
    widthLabel: 'Largeur',
    maxWidthLabel: 'Largeur max.',
    closeLabel: 'Fermer',
  },
  es: {
    code: 'es',
    title: 'Popover',
    description: 'Contenido flotante que aparece cuando se hace clic en un disparador.',
    openLabel: 'Abrir popover',
    dimensionsHeading: 'Dimensiones',
    dimensionsDescription: 'Establece las dimensiones de la capa.',
    widthLabel: 'Ancho',
    maxWidthLabel: 'Ancho máx.',
    closeLabel: 'Cerrar',
  },
  ja: {
    code: 'ja',
    title: 'ポップオーバー',
    description: 'トリガーをクリックしたときに表示されるフローティングコンテンツです。',
    openLabel: 'ポップオーバーを開く',
    dimensionsHeading: '寸法',
    dimensionsDescription: 'レイヤーの寸法を設定します。',
    widthLabel: '幅',
    maxWidthLabel: '最大幅',
    closeLabel: '閉じる',
  },
  zh: {
    code: 'zh',
    title: '弹出框',
    description: '点击触发器时出现的浮动内容。',
    openLabel: '打开弹出框',
    dimensionsHeading: '尺寸',
    dimensionsDescription: '设置图层的尺寸。',
    widthLabel: '宽度',
    maxWidthLabel: '最大宽度',
    closeLabel: '关闭',
  },
  ru: {
    code: 'ru',
    title: 'Поповер',
    description: 'Плавающий контент, появляющийся при нажатии на триггер.',
    openLabel: 'Открыть поповер',
    dimensionsHeading: 'Размеры',
    dimensionsDescription: 'Задайте размеры слоя.',
    widthLabel: 'Ширина',
    maxWidthLabel: 'Макс. ширина',
    closeLabel: 'Закрыть',
  },
  pt: {
    code: 'pt',
    title: 'Popover',
    description: 'Conteúdo flutuante que aparece quando um gatilho é clicado.',
    openLabel: 'Abrir popover',
    dimensionsHeading: 'Dimensões',
    dimensionsDescription: 'Defina as dimensões para a camada.',
    widthLabel: 'Largura',
    maxWidthLabel: 'Largura máx.',
    closeLabel: 'Fechar',
  },
};
