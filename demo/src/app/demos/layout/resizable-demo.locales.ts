import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface ResizableDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  horizontalHeading: string;
  leftPanel: string;
  rightPanel: string;
  verticalHeading: string;
  topPanel: string;
  bottomPanel: string;
}

export const RESIZABLE_DEMO_LOCALES: Record<string, ResizableDemoLocale> = {
  en: { code: 'en', heading: 'Resizable', description: 'Resizable panel groups for creating adjustable layouts.', horizontalHeading: 'Horizontal', leftPanel: 'Left', rightPanel: 'Right', verticalHeading: 'Vertical (with live size updates)', topPanel: 'Top', bottomPanel: 'Bottom' },
  he: { code: 'he', rtl: true, heading: 'ניתן לשינוי גודל', description: 'קבוצות לוחות בגודל משתנה ליצירת פריסות מתכווננות.', horizontalHeading: 'אופקי', leftPanel: 'שמאל', rightPanel: 'ימין', verticalHeading: 'אנכי (עם עדכוני גודל בזמן אמת)', topPanel: 'עליון', bottomPanel: 'תחתון' },
  ar: { code: 'ar', rtl: true, heading: 'قابل لتغيير الحجم', description: 'مجموعات لوحات قابلة للتغيير لإنشاء تخطيطات قابلة للتعديل.', horizontalHeading: 'أفقي', leftPanel: 'يسار', rightPanel: 'يمين', verticalHeading: 'عمودي (مع تحديثات الحجم المباشرة)', topPanel: 'أعلى', bottomPanel: 'أسفل' },
  de: { code: 'de', heading: 'Größenänderbar', description: 'Größenänderbare Panelgruppen für anpassbare Layouts.', horizontalHeading: 'Horizontal', leftPanel: 'Links', rightPanel: 'Rechts', verticalHeading: 'Vertikal (mit Live-Größenaktualisierungen)', topPanel: 'Oben', bottomPanel: 'Unten' },
  fr: { code: 'fr', heading: 'Redimensionnable', description: 'Groupes de panneaux redimensionnables pour créer des mises en page ajustables.', horizontalHeading: 'Horizontal', leftPanel: 'Gauche', rightPanel: 'Droite', verticalHeading: 'Vertical (avec mises à jour de taille en direct)', topPanel: 'Haut', bottomPanel: 'Bas' },
  es: { code: 'es', heading: 'Redimensionable', description: 'Grupos de paneles redimensionables para crear diseños ajustables.', horizontalHeading: 'Horizontal', leftPanel: 'Izquierda', rightPanel: 'Derecha', verticalHeading: 'Vertical (con actualizaciones de tamaño en vivo)', topPanel: 'Arriba', bottomPanel: 'Abajo' },
  ja: { code: 'ja', heading: 'サイズ変更可能', description: '調整可能なレイアウトを作成するためのサイズ変更可能なパネルグループ。', horizontalHeading: '水平', leftPanel: '左', rightPanel: '右', verticalHeading: '垂直（ライブサイズ更新付き）', topPanel: '上', bottomPanel: '下' },
  zh: { code: 'zh', heading: '可调整大小', description: '可调整大小的面板组，用于创建自适应布局。', horizontalHeading: '水平', leftPanel: '左侧', rightPanel: '右侧', verticalHeading: '垂直（实时大小更新）', topPanel: '顶部', bottomPanel: '底部' },
  ru: { code: 'ru', heading: 'Изменяемый размер', description: 'Группы панелей с изменяемым размером для создания гибких макетов.', horizontalHeading: 'Горизонтальный', leftPanel: 'Слева', rightPanel: 'Справа', verticalHeading: 'Вертикальный (с обновлениями размера в реальном времени)', topPanel: 'Сверху', bottomPanel: 'Снизу' },
  pt: { code: 'pt', heading: 'Redimensionável', description: 'Grupos de painéis redimensionáveis para criar layouts ajustáveis.', horizontalHeading: 'Horizontal', leftPanel: 'Esquerda', rightPanel: 'Direita', verticalHeading: 'Vertical (com atualizações de tamanho ao vivo)', topPanel: 'Topo', bottomPanel: 'Base' },
};
