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
    },
};
