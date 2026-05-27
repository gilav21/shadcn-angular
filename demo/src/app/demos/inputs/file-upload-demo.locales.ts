import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface FileUploadDemoLocale extends LocaleMeta {
  title: string;
  description: string;
}

export const FILE_UPLOAD_DEMO_LOCALES: Record<string, FileUploadDemoLocale> = {
  en: {
    code: 'en',
    title: 'File Upload',
    description: 'A drag-and-drop zone with file list preview, progress bars, and remove actions.',
  },
  he: {
    code: 'he', rtl: true,
    title: 'העלאת קבצים',
    description: 'אזור גרור ושחרר עם תצוגה מקדימה של רשימת קבצים, סרגלי התקדמות ואפשרויות הסרה.',
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'رفع الملفات',
    description: 'منطقة سحب وإفلات مع معاينة قائمة الملفات وأشرطة التقدم وإجراءات الإزالة.',
  },
  de: {
    code: 'de',
    title: 'Datei-Upload',
    description: 'Eine Drag-and-Drop-Zone mit Dateilistenvorschau, Fortschrittsbalken und Entfernungsaktionen.',
  },
  fr: {
    code: 'fr',
    title: 'Téléchargement de fichiers',
    description: 'Une zone de glisser-déposer avec aperçu de la liste de fichiers, barres de progression et actions de suppression.',
  },
  es: {
    code: 'es',
    title: 'Carga de archivos',
    description: 'Una zona de arrastrar y soltar con vista previa de la lista de archivos, barras de progreso y acciones de eliminación.',
  },
  ja: {
    code: 'ja',
    title: 'ファイルアップロード',
    description: 'ファイルリストのプレビュー、プログレスバー、削除アクションを備えたドラッグ＆ドロップゾーンです。',
  },
  zh: {
    code: 'zh',
    title: '文件上传',
    description: '带有文件列表预览、进度条和删除操作的拖放区域。',
  },
  ru: {
    code: 'ru',
    title: 'Загрузка файлов',
    description: 'Зона перетаскивания с предварительным просмотром списка файлов, индикаторами прогресса и действиями удаления.',
  },
  pt: {
    code: 'pt',
    title: 'Upload de arquivos',
    description: 'Uma zona de arrastar e soltar com visualização da lista de arquivos, barras de progresso e ações de remoção.',
  },
};
