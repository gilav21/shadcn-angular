import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface ScrollAreaDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  tagsLabel: string;
}

export const SCROLL_AREA_DEMO_LOCALES: Record<string, ScrollAreaDemoLocale> = {
  en: { code: 'en', heading: 'Scroll Area', description: 'A custom scrollable area with styled scrollbars.', tagsLabel: 'Tags' },
  he: { code: 'he', rtl: true, heading: 'אזור גלילה', description: 'אזור גלילה מותאם עם פסי גלילה מעוצבים.', tagsLabel: 'תגיות' },
  ar: { code: 'ar', rtl: true, heading: 'منطقة التمرير', description: 'منطقة تمرير مخصصة مع أشرطة تمرير منسقة.', tagsLabel: 'الوسوم' },
  de: { code: 'de', heading: 'Scrollbereich', description: 'Ein benutzerdefinierter scrollbarer Bereich mit gestalteten Bildlaufleisten.', tagsLabel: 'Tags' },
  fr: { code: 'fr', heading: 'Zone de défilement', description: 'Une zone de défilement personnalisée avec des barres de défilement stylisées.', tagsLabel: 'Étiquettes' },
  es: { code: 'es', heading: 'Área de desplazamiento', description: 'Un área de desplazamiento personalizada con barras de desplazamiento estilizadas.', tagsLabel: 'Etiquetas' },
  ja: { code: 'ja', heading: 'スクロール領域', description: 'スタイリッシュなスクロールバーを持つカスタムスクロール可能領域。', tagsLabel: 'タグ' },
  zh: { code: 'zh', heading: '滚动区域', description: '带有样式化滚动条的自定义可滚动区域。', tagsLabel: '标签' },
  ru: { code: 'ru', heading: 'Область прокрутки', description: 'Настраиваемая прокручиваемая область со стилизованными полосами прокрутки.', tagsLabel: 'Теги' },
  pt: { code: 'pt', heading: 'Área de rolagem', description: 'Uma área de rolagem personalizada com barras de rolagem estilizadas.', tagsLabel: 'Etiquetas' },
};
