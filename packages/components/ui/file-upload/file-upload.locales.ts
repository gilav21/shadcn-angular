import type { LocaleMeta } from '../../lib/i18n';

/**
 * Locale dictionary for `<ui-file-upload>`. The `maxSize` and `fileTooLarge`
 * strings carry a `{size}` placeholder that the component interpolates with
 * the formatted byte total (e.g. `'10 MB'`).
 */
export interface FileUploadLocale extends LocaleMeta {
    dragDropHere: string;
    orClickToBrowse: string;
    maxSize: string;
    addMoreFiles: string;
    removeFile: string;
    uploadFiles: string;
    fileTypeNotAccepted: string;
    fileTooLarge: string;
    /**
     * Rejection message for files past the `maxFiles` cap; carries a `{count}`
     * placeholder for the cap. Optional so a hand-written dictionary predating
     * it still type-checks — the component falls back to English.
     */
    tooManyFiles?: string;
    /**
     * Copy for the inline crop step. All optional, so a hand-written dictionary
     * predating cropping still type-checks — the component falls back to
     * English for any key a locale omits.
     */
    cropTitle?: string;
    cropApply?: string;
    cropSkip?: string;
    cropCancel?: string;
    cropRegion?: string;
    cropResizeHandle?: string;
    cropFailed?: string;
}

export const FILE_UPLOAD_LOCALES: Record<string, FileUploadLocale> = {
    en: {
        code: 'en',
        dragDropHere: 'Drag & drop files here',
        orClickToBrowse: 'or click to browse',
        maxSize: 'Max size: {size}',
        addMoreFiles: 'Add more files',
        removeFile: 'Remove file',
        uploadFiles: 'Upload files',
        fileTypeNotAccepted: 'File type not accepted',
        fileTooLarge: 'File exceeds maximum size of {size}',
        tooManyFiles: 'Maximum of {count} files allowed',
        cropTitle: 'Crop image',
        cropApply: 'Apply',
        cropSkip: 'Skip',
        cropCancel: 'Cancel',
        cropRegion: 'Crop region',
        cropResizeHandle: 'Resize crop',
        cropFailed: 'Could not crop this image',
    },
    he: {
        code: 'he',
        rtl: true,
        dragDropHere: 'גרור ושחרר קבצים כאן',
        orClickToBrowse: 'או לחץ לעיון',
        maxSize: 'גודל מרבי: {size}',
        addMoreFiles: 'הוסף קבצים נוספים',
        removeFile: 'הסר קובץ',
        uploadFiles: 'העלה קבצים',
        fileTypeNotAccepted: 'סוג הקובץ אינו מתקבל',
        fileTooLarge: 'הקובץ חורג מהגודל המרבי של {size}',
        tooManyFiles: 'ניתן להעלות עד {count} קבצים',
        cropTitle: 'חיתוך תמונה',
        cropApply: 'החל',
        cropSkip: 'דלג',
        cropCancel: 'ביטול',
        cropRegion: 'אזור חיתוך',
        cropResizeHandle: 'שינוי גודל החיתוך',
        cropFailed: 'לא ניתן לחתוך את התמונה',
    },
    ar: {
        code: 'ar',
        rtl: true,
        dragDropHere: 'اسحب الملفات وأفلتها هنا',
        orClickToBrowse: 'أو انقر للتصفح',
        maxSize: 'الحجم الأقصى: {size}',
        addMoreFiles: 'إضافة المزيد من الملفات',
        removeFile: 'إزالة الملف',
        uploadFiles: 'تحميل الملفات',
        fileTypeNotAccepted: 'نوع الملف غير مقبول',
        fileTooLarge: 'الملف يتجاوز الحجم الأقصى البالغ {size}',
        tooManyFiles: 'الحد الأقصى {count} ملفات',
        cropTitle: 'اقتصاص الصورة',
        cropApply: 'تطبيق',
        cropSkip: 'تخطٍّ',
        cropCancel: 'إلغاء',
        cropRegion: 'منطقة الاقتصاص',
        cropResizeHandle: 'تغيير حجم الاقتصاص',
        cropFailed: 'تعذّر اقتصاص هذه الصورة',
    },
    de: {
        code: 'de',
        dragDropHere: 'Dateien hierher ziehen und ablegen',
        orClickToBrowse: 'oder klicken zum Durchsuchen',
        maxSize: 'Maximale Größe: {size}',
        addMoreFiles: 'Weitere Dateien hinzufügen',
        removeFile: 'Datei entfernen',
        uploadFiles: 'Dateien hochladen',
        fileTypeNotAccepted: 'Dateityp nicht akzeptiert',
        fileTooLarge: 'Datei überschreitet die maximale Größe von {size}',
        tooManyFiles: 'Maximal {count} Dateien erlaubt',
        cropTitle: 'Bild zuschneiden',
        cropApply: 'Übernehmen',
        cropSkip: 'Überspringen',
        cropCancel: 'Abbrechen',
        cropRegion: 'Zuschneidebereich',
        cropResizeHandle: 'Zuschnitt anpassen',
        cropFailed: 'Bild konnte nicht zugeschnitten werden',
    },
    fr: {
        code: 'fr',
        dragDropHere: 'Glissez et déposez les fichiers ici',
        orClickToBrowse: 'ou cliquez pour parcourir',
        maxSize: 'Taille maximale : {size}',
        addMoreFiles: 'Ajouter plus de fichiers',
        removeFile: 'Supprimer le fichier',
        uploadFiles: 'Téléverser des fichiers',
        fileTypeNotAccepted: 'Type de fichier non accepté',
        fileTooLarge: 'Le fichier dépasse la taille maximale de {size}',
        tooManyFiles: 'Maximum de {count} fichiers autorisés',
        cropTitle: 'Recadrer l’image',
        cropApply: 'Appliquer',
        cropSkip: 'Ignorer',
        cropCancel: 'Annuler',
        cropRegion: 'Zone de recadrage',
        cropResizeHandle: 'Redimensionner le recadrage',
        cropFailed: 'Impossible de recadrer cette image',
    },
    es: {
        code: 'es',
        dragDropHere: 'Arrastra y suelta los archivos aquí',
        orClickToBrowse: 'o haz clic para examinar',
        maxSize: 'Tamaño máximo: {size}',
        addMoreFiles: 'Añadir más archivos',
        removeFile: 'Eliminar archivo',
        uploadFiles: 'Subir archivos',
        fileTypeNotAccepted: 'Tipo de archivo no aceptado',
        fileTooLarge: 'El archivo supera el tamaño máximo de {size}',
        tooManyFiles: 'Máximo de {count} archivos permitidos',
        cropTitle: 'Recortar imagen',
        cropApply: 'Aplicar',
        cropSkip: 'Omitir',
        cropCancel: 'Cancelar',
        cropRegion: 'Área de recorte',
        cropResizeHandle: 'Redimensionar recorte',
        cropFailed: 'No se pudo recortar esta imagen',
    },
    ja: {
        code: 'ja',
        dragDropHere: 'ここにファイルをドラッグ＆ドロップ',
        orClickToBrowse: 'またはクリックして参照',
        maxSize: '最大サイズ: {size}',
        addMoreFiles: 'さらにファイルを追加',
        removeFile: 'ファイルを削除',
        uploadFiles: 'ファイルをアップロード',
        fileTypeNotAccepted: 'ファイル形式は受け付けられません',
        fileTooLarge: 'ファイルは最大サイズ {size} を超えています',
        tooManyFiles: 'ファイルは最大 {count} 件までです',
        cropTitle: '画像を切り抜く',
        cropApply: '適用',
        cropSkip: 'スキップ',
        cropCancel: 'キャンセル',
        cropRegion: '切り抜き範囲',
        cropResizeHandle: '切り抜きサイズ変更',
        cropFailed: 'この画像を切り抜けませんでした',
    },
    zh: {
        code: 'zh',
        dragDropHere: '将文件拖放到此处',
        orClickToBrowse: '或点击浏览',
        maxSize: '最大大小: {size}',
        addMoreFiles: '添加更多文件',
        removeFile: '删除文件',
        uploadFiles: '上传文件',
        fileTypeNotAccepted: '不接受的文件类型',
        fileTooLarge: '文件超过最大大小 {size}',
        tooManyFiles: '最多允许 {count} 个文件',
        cropTitle: '裁剪图片',
        cropApply: '应用',
        cropSkip: '跳过',
        cropCancel: '取消',
        cropRegion: '裁剪区域',
        cropResizeHandle: '调整裁剪大小',
        cropFailed: '无法裁剪此图片',
    },
    ru: {
        code: 'ru',
        dragDropHere: 'Перетащите файлы сюда',
        orClickToBrowse: 'или нажмите для выбора',
        maxSize: 'Максимальный размер: {size}',
        addMoreFiles: 'Добавить ещё файлы',
        removeFile: 'Удалить файл',
        uploadFiles: 'Загрузить файлы',
        fileTypeNotAccepted: 'Тип файла не принимается',
        fileTooLarge: 'Файл превышает максимальный размер {size}',
        tooManyFiles: 'Максимум {count} файлов',
        cropTitle: 'Обрезать изображение',
        cropApply: 'Применить',
        cropSkip: 'Пропустить',
        cropCancel: 'Отмена',
        cropRegion: 'Область обрезки',
        cropResizeHandle: 'Изменить размер обрезки',
        cropFailed: 'Не удалось обрезать изображение',
    },
    pt: {
        code: 'pt',
        dragDropHere: 'Arraste e solte arquivos aqui',
        orClickToBrowse: 'ou clique para procurar',
        maxSize: 'Tamanho máximo: {size}',
        addMoreFiles: 'Adicionar mais arquivos',
        removeFile: 'Remover arquivo',
        uploadFiles: 'Enviar arquivos',
        fileTypeNotAccepted: 'Tipo de arquivo não aceito',
        fileTooLarge: 'O arquivo excede o tamanho máximo de {size}',
        tooManyFiles: 'Máximo de {count} arquivos permitidos',
        cropTitle: 'Recortar imagem',
        cropApply: 'Aplicar',
        cropSkip: 'Ignorar',
        cropCancel: 'Cancelar',
        cropRegion: 'Área de recorte',
        cropResizeHandle: 'Redimensionar recorte',
        cropFailed: 'Não foi possível recortar esta imagem',
    },
};
