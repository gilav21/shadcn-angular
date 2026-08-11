import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface FileUploadDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  maxFilesHeading: string;
  maxFilesCaption: string;
  refusedHeading: string;
  noRefused: string;
}

export const FILE_UPLOAD_DEMO_LOCALES: Record<string, FileUploadDemoLocale> = {
  en: {
    code: 'en',
    title: 'File Upload',
    description: 'A drag-and-drop zone with file list preview, progress bars, and remove actions.',
    maxFilesHeading: 'Two-File Cap with (fileError)',
    maxFilesCaption: 'Try it: drop three or more files at once — everything past the two-file cap is refused, with the reason listed below.',
    refusedHeading: 'Refused files',
    noRefused: 'No file has been refused yet.',
  },
  he: {
    code: 'he', rtl: true,
    title: 'העלאת קבצים',
    description: 'אזור גרור ושחרר עם תצוגה מקדימה של רשימת קבצים, סרגלי התקדמות ואפשרויות הסרה.',
    maxFilesHeading: 'מגבלת שני קבצים עם (fileError)',
    maxFilesCaption: 'נסו: גררו שלושה קבצים או יותר בבת אחת — כל מה שמעבר למגבלת שני הקבצים נדחה, והסיבה מוצגת למטה.',
    refusedHeading: 'קבצים שנדחו',
    noRefused: 'עדיין לא נדחה אף קובץ.',
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'رفع الملفات',
    description: 'منطقة سحب وإفلات مع معاينة قائمة الملفات وأشرطة التقدم وإجراءات الإزالة.',
    maxFilesHeading: 'حد ملفين مع (fileError)',
    maxFilesCaption: 'جرّب: أفلت ثلاثة ملفات أو أكثر دفعة واحدة — يُرفض كل ما يتجاوز حد الملفين، ويظهر السبب أدناه.',
    refusedHeading: 'الملفات المرفوضة',
    noRefused: 'لم يُرفض أي ملف بعد.',
  },
  de: {
    code: 'de',
    title: 'Datei-Upload',
    description: 'Eine Drag-and-Drop-Zone mit Dateilistenvorschau, Fortschrittsbalken und Entfernungsaktionen.',
    maxFilesHeading: 'Limit von zwei Dateien mit (fileError)',
    maxFilesCaption: 'Zum Ausprobieren: drei oder mehr Dateien auf einmal ablegen — alles über dem Limit von zwei Dateien wird abgelehnt, mit Begründung darunter.',
    refusedHeading: 'Abgelehnte Dateien',
    noRefused: 'Bisher wurde keine Datei abgelehnt.',
  },
  fr: {
    code: 'fr',
    title: 'Téléchargement de fichiers',
    description: 'Une zone de glisser-déposer avec aperçu de la liste de fichiers, barres de progression et actions de suppression.',
    maxFilesHeading: 'Limite de deux fichiers avec (fileError)',
    maxFilesCaption: 'À essayer : déposez trois fichiers ou plus d’un coup — tout ce qui dépasse la limite de deux fichiers est refusé, avec le motif ci-dessous.',
    refusedHeading: 'Fichiers refusés',
    noRefused: 'Aucun fichier n’a encore été refusé.',
  },
  es: {
    code: 'es',
    title: 'Carga de archivos',
    description: 'Una zona de arrastrar y soltar con vista previa de la lista de archivos, barras de progreso y acciones de eliminación.',
    maxFilesHeading: 'Límite de dos archivos con (fileError)',
    maxFilesCaption: 'Pruébalo: suelta tres o más archivos a la vez; todo lo que supere el límite de dos archivos se rechaza y el motivo aparece abajo.',
    refusedHeading: 'Archivos rechazados',
    noRefused: 'Todavía no se ha rechazado ningún archivo.',
  },
  ja: {
    code: 'ja',
    title: 'ファイルアップロード',
    description: 'ファイルリストのプレビュー、プログレスバー、削除アクションを備えたドラッグ＆ドロップゾーンです。',
    maxFilesHeading: '2 ファイル上限と (fileError)',
    maxFilesCaption: 'お試し: 3 つ以上のファイルを一度にドロップしてください。2 ファイルの上限を超えた分は拒否され、理由が下に表示されます。',
    refusedHeading: '拒否されたファイル',
    noRefused: 'まだ拒否されたファイルはありません。',
  },
  zh: {
    code: 'zh',
    title: '文件上传',
    description: '带有文件列表预览、进度条和删除操作的拖放区域。',
    maxFilesHeading: '两个文件的上限与 (fileError)',
    maxFilesCaption: '试试看：一次拖入三个或更多文件——超过两个文件上限的部分会被拒绝，并在下方列出原因。',
    refusedHeading: '被拒绝的文件',
    noRefused: '尚未拒绝任何文件。',
  },
  ru: {
    code: 'ru',
    title: 'Загрузка файлов',
    description: 'Зона перетаскивания с предварительным просмотром списка файлов, индикаторами прогресса и действиями удаления.',
    maxFilesHeading: 'Лимит в два файла и (fileError)',
    maxFilesCaption: 'Попробуйте: перетащите сразу три файла или больше — всё сверх лимита в два файла будет отклонено, причина появится ниже.',
    refusedHeading: 'Отклонённые файлы',
    noRefused: 'Пока ни один файл не отклонён.',
  },
  pt: {
    code: 'pt',
    title: 'Upload de arquivos',
    description: 'Uma zona de arrastar e soltar com visualização da lista de arquivos, barras de progresso e ações de remoção.',
    maxFilesHeading: 'Limite de dois arquivos com (fileError)',
    maxFilesCaption: 'Experimente: solte três ou mais arquivos de uma vez — tudo além do limite de dois arquivos é recusado, com o motivo listado abaixo.',
    refusedHeading: 'Arquivos recusados',
    noRefused: 'Nenhum arquivo foi recusado ainda.',
  },
};
