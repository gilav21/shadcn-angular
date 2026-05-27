import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface AspectRatioDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  label169: string;
}

export const ASPECT_RATIO_DEMO_LOCALES: Record<string, AspectRatioDemoLocale> = {
  en: { code: 'en', heading: 'Aspect Ratio', description: 'Display content within a desired ratio.', label169: '16:9 Aspect Ratio' },
  he: { code: 'he', rtl: true, heading: 'יחס גובה-רוחב', description: 'הצג תוכן ביחס גובה-רוחב הרצוי.', label169: 'יחס גובה-רוחב 16:9' },
  ar: { code: 'ar', rtl: true, heading: 'نسبة العرض إلى الارتفاع', description: 'عرض المحتوى بنسبة مرغوبة.', label169: 'نسبة 16:9' },
  de: { code: 'de', heading: 'Seitenverhältnis', description: 'Inhalt in einem gewünschten Verhältnis anzeigen.', label169: '16:9-Seitenverhältnis' },
  fr: { code: 'fr', heading: 'Rapport d\'aspect', description: 'Afficher le contenu dans un rapport souhaité.', label169: 'Rapport d\'aspect 16:9' },
  es: { code: 'es', heading: 'Relación de aspecto', description: 'Mostrar contenido en una relación deseada.', label169: 'Relación de aspecto 16:9' },
  ja: { code: 'ja', heading: 'アスペクト比', description: '目的のアスペクト比でコンテンツを表示します。', label169: '16:9 アスペクト比' },
  zh: { code: 'zh', heading: '宽高比', description: '以所需比例显示内容。', label169: '16:9 宽高比' },
  ru: { code: 'ru', heading: 'Соотношение сторон', description: 'Отображение контента в нужном соотношении.', label169: 'Соотношение сторон 16:9' },
  pt: { code: 'pt', heading: 'Proporção de aspecto', description: 'Exibir conteúdo em uma proporção desejada.', label169: 'Proporção 16:9' },
};
