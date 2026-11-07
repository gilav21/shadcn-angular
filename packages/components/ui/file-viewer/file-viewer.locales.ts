import type { LocaleMeta } from '../../lib/i18n';

/**
 * Locale dictionary for `<ui-file-viewer>`. The viewer's own words only:
 * file names, document content and the `HTTP <status>` transport error are
 * data and stay as received.
 */
export interface FileViewerLocale extends LocaleMeta {
    /** `aria-label` on the previous-page button (PDF / PPTX). */
    previousPage: string;
    /** `aria-label` on the next-page button (PDF / PPTX). */
    nextPage: string;
    /** `aria-label` on the zoom-out button. */
    zoomOut: string;
    /** `aria-label` on the zoom-in button. */
    zoomIn: string;
    /** `title` on the toolbar download link. */
    download: string;
    /** Text of the download link in the error and unsupported states. */
    downloadFile: string;
    /** Shown for a file type with no preview. */
    previewUnavailable: string;
    /** Banner above a spreadsheet cut at its row limit. */
    xlsxTruncated: string;
    imageLoadFailed: string;
    videoLoadFailed: string;
    audioLoadFailed: string;
    /** Fallback content inside `<video>` for browsers without support. */
    videoUnsupported: string;
    /** Fallback content inside `<audio>` for browsers without support. */
    audioUnsupported: string;
    /** Error message when loading throws without a message of its own. */
    loadFailed: string;
    /** Error message when processing throws without a message of its own. */
    processFailed: string;
    invalidSvg: string;
    /** Title-bar name when neither `filename` nor a `File` supplies one. */
    defaultFilename: string;
}

export const FILE_VIEWER_LOCALES: Record<string, FileViewerLocale> = {
    en: {
        code: 'en',
        previousPage: 'Previous page',
        nextPage: 'Next page',
        zoomOut: 'Zoom out',
        zoomIn: 'Zoom in',
        download: 'Download',
        downloadFile: 'Download file',
        previewUnavailable: 'Preview not available for this file type.',
        xlsxTruncated: 'Showing first 10,000 rows. Download the file to see all data.',
        imageLoadFailed: 'Failed to load image',
        videoLoadFailed: 'Failed to load video. The format may not be supported by your browser.',
        audioLoadFailed: 'Failed to load audio. The format may not be supported by your browser.',
        videoUnsupported: 'Your browser does not support the video element.',
        audioUnsupported: 'Your browser does not support the audio element.',
        loadFailed: 'Failed to load file',
        processFailed: 'Failed to process file',
        invalidSvg: 'Invalid or unsafe SVG file',
        defaultFilename: 'File',
    },
    he: {
        code: 'he', rtl: true,
        previousPage: 'העמוד הקודם',
        nextPage: 'העמוד הבא',
        zoomOut: 'הקטנה',
        zoomIn: 'הגדלה',
        download: 'הורדה',
        downloadFile: 'הורדת הקובץ',
        previewUnavailable: 'אין תצוגה מקדימה לסוג קובץ זה.',
        xlsxTruncated: 'מוצגות 10,000 השורות הראשונות. הורידו את הקובץ כדי לראות את כל הנתונים.',
        imageLoadFailed: 'טעינת התמונה נכשלה',
        videoLoadFailed: 'טעינת הסרטון נכשלה. ייתכן שהדפדפן אינו תומך בפורמט.',
        audioLoadFailed: 'טעינת האודיו נכשלה. ייתכן שהדפדפן אינו תומך בפורמט.',
        videoUnsupported: 'הדפדפן שלכם אינו תומך ברכיב הווידאו.',
        audioUnsupported: 'הדפדפן שלכם אינו תומך ברכיב האודיו.',
        loadFailed: 'טעינת הקובץ נכשלה',
        processFailed: 'עיבוד הקובץ נכשל',
        invalidSvg: 'קובץ SVG לא תקין או לא בטוח',
        defaultFilename: 'קובץ',
    },
    ar: {
        code: 'ar', rtl: true,
        previousPage: 'الصفحة السابقة',
        nextPage: 'الصفحة التالية',
        zoomOut: 'تصغير',
        zoomIn: 'تكبير',
        download: 'تنزيل',
        downloadFile: 'تنزيل الملف',
        previewUnavailable: 'المعاينة غير متاحة لهذا النوع من الملفات.',
        xlsxTruncated: 'يتم عرض أول 10,000 صف. نزّل الملف لرؤية جميع البيانات.',
        imageLoadFailed: 'تعذر تحميل الصورة',
        videoLoadFailed: 'تعذر تحميل الفيديو. قد لا يدعم متصفحك هذا التنسيق.',
        audioLoadFailed: 'تعذر تحميل الصوت. قد لا يدعم متصفحك هذا التنسيق.',
        videoUnsupported: 'متصفحك لا يدعم عنصر الفيديو.',
        audioUnsupported: 'متصفحك لا يدعم عنصر الصوت.',
        loadFailed: 'تعذر تحميل الملف',
        processFailed: 'تعذرت معالجة الملف',
        invalidSvg: 'ملف SVG غير صالح أو غير آمن',
        defaultFilename: 'ملف',
    },
    de: {
        code: 'de',
        previousPage: 'Vorherige Seite',
        nextPage: 'Nächste Seite',
        zoomOut: 'Verkleinern',
        zoomIn: 'Vergrößern',
        download: 'Herunterladen',
        downloadFile: 'Datei herunterladen',
        previewUnavailable: 'Für diesen Dateityp ist keine Vorschau verfügbar.',
        xlsxTruncated: 'Die ersten 10.000 Zeilen werden angezeigt. Laden Sie die Datei herunter, um alle Daten zu sehen.',
        imageLoadFailed: 'Bild konnte nicht geladen werden',
        videoLoadFailed: 'Video konnte nicht geladen werden. Das Format wird von Ihrem Browser möglicherweise nicht unterstützt.',
        audioLoadFailed: 'Audio konnte nicht geladen werden. Das Format wird von Ihrem Browser möglicherweise nicht unterstützt.',
        videoUnsupported: 'Ihr Browser unterstützt das Video-Element nicht.',
        audioUnsupported: 'Ihr Browser unterstützt das Audio-Element nicht.',
        loadFailed: 'Datei konnte nicht geladen werden',
        processFailed: 'Datei konnte nicht verarbeitet werden',
        invalidSvg: 'Ungültige oder unsichere SVG-Datei',
        defaultFilename: 'Datei',
    },
    fr: {
        code: 'fr',
        previousPage: 'Page précédente',
        nextPage: 'Page suivante',
        zoomOut: 'Zoom arrière',
        zoomIn: 'Zoom avant',
        download: 'Télécharger',
        downloadFile: 'Télécharger le fichier',
        previewUnavailable: 'Aperçu indisponible pour ce type de fichier.',
        xlsxTruncated: 'Affichage des 10 000 premières lignes. Téléchargez le fichier pour voir toutes les données.',
        imageLoadFailed: 'Échec du chargement de l\'image',
        videoLoadFailed: 'Échec du chargement de la vidéo. Le format n\'est peut-être pas pris en charge par votre navigateur.',
        audioLoadFailed: 'Échec du chargement de l\'audio. Le format n\'est peut-être pas pris en charge par votre navigateur.',
        videoUnsupported: 'Votre navigateur ne prend pas en charge l\'élément vidéo.',
        audioUnsupported: 'Votre navigateur ne prend pas en charge l\'élément audio.',
        loadFailed: 'Échec du chargement du fichier',
        processFailed: 'Échec du traitement du fichier',
        invalidSvg: 'Fichier SVG invalide ou non sécurisé',
        defaultFilename: 'Fichier',
    },
    es: {
        code: 'es',
        previousPage: 'Página anterior',
        nextPage: 'Página siguiente',
        zoomOut: 'Alejar',
        zoomIn: 'Acercar',
        download: 'Descargar',
        downloadFile: 'Descargar archivo',
        previewUnavailable: 'La vista previa no está disponible para este tipo de archivo.',
        xlsxTruncated: 'Se muestran las primeras 10 000 filas. Descargue el archivo para ver todos los datos.',
        imageLoadFailed: 'No se pudo cargar la imagen',
        videoLoadFailed: 'No se pudo cargar el vídeo. Es posible que su navegador no admita el formato.',
        audioLoadFailed: 'No se pudo cargar el audio. Es posible que su navegador no admita el formato.',
        videoUnsupported: 'Su navegador no admite el elemento de vídeo.',
        audioUnsupported: 'Su navegador no admite el elemento de audio.',
        loadFailed: 'No se pudo cargar el archivo',
        processFailed: 'No se pudo procesar el archivo',
        invalidSvg: 'Archivo SVG no válido o no seguro',
        defaultFilename: 'Archivo',
    },
    ja: {
        code: 'ja',
        previousPage: '前のページ',
        nextPage: '次のページ',
        zoomOut: '縮小',
        zoomIn: '拡大',
        download: 'ダウンロード',
        downloadFile: 'ファイルをダウンロード',
        previewUnavailable: 'このファイル形式はプレビューできません。',
        xlsxTruncated: '最初の10,000行を表示しています。すべてのデータを見るにはファイルをダウンロードしてください。',
        imageLoadFailed: '画像を読み込めませんでした',
        videoLoadFailed: '動画を読み込めませんでした。お使いのブラウザがこの形式に対応していない可能性があります。',
        audioLoadFailed: '音声を読み込めませんでした。お使いのブラウザがこの形式に対応していない可能性があります。',
        videoUnsupported: 'お使いのブラウザは動画要素に対応していません。',
        audioUnsupported: 'お使いのブラウザは音声要素に対応していません。',
        loadFailed: 'ファイルを読み込めませんでした',
        processFailed: 'ファイルを処理できませんでした',
        invalidSvg: '無効または安全でない SVG ファイルです',
        defaultFilename: 'ファイル',
    },
    zh: {
        code: 'zh',
        previousPage: '上一页',
        nextPage: '下一页',
        zoomOut: '缩小',
        zoomIn: '放大',
        download: '下载',
        downloadFile: '下载文件',
        previewUnavailable: '此文件类型无法预览。',
        xlsxTruncated: '仅显示前 10,000 行。请下载文件以查看全部数据。',
        imageLoadFailed: '图片加载失败',
        videoLoadFailed: '视频加载失败。您的浏览器可能不支持该格式。',
        audioLoadFailed: '音频加载失败。您的浏览器可能不支持该格式。',
        videoUnsupported: '您的浏览器不支持视频元素。',
        audioUnsupported: '您的浏览器不支持音频元素。',
        loadFailed: '文件加载失败',
        processFailed: '文件处理失败',
        invalidSvg: 'SVG 文件无效或不安全',
        defaultFilename: '文件',
    },
    ru: {
        code: 'ru',
        previousPage: 'Предыдущая страница',
        nextPage: 'Следующая страница',
        zoomOut: 'Уменьшить',
        zoomIn: 'Увеличить',
        download: 'Скачать',
        downloadFile: 'Скачать файл',
        previewUnavailable: 'Предпросмотр для этого типа файлов недоступен.',
        xlsxTruncated: 'Показаны первые 10 000 строк. Скачайте файл, чтобы увидеть все данные.',
        imageLoadFailed: 'Не удалось загрузить изображение',
        videoLoadFailed: 'Не удалось загрузить видео. Возможно, ваш браузер не поддерживает этот формат.',
        audioLoadFailed: 'Не удалось загрузить аудио. Возможно, ваш браузер не поддерживает этот формат.',
        videoUnsupported: 'Ваш браузер не поддерживает элемент video.',
        audioUnsupported: 'Ваш браузер не поддерживает элемент audio.',
        loadFailed: 'Не удалось загрузить файл',
        processFailed: 'Не удалось обработать файл',
        invalidSvg: 'Недопустимый или небезопасный файл SVG',
        defaultFilename: 'Файл',
    },
    pt: {
        code: 'pt',
        previousPage: 'Página anterior',
        nextPage: 'Próxima página',
        zoomOut: 'Reduzir',
        zoomIn: 'Ampliar',
        download: 'Baixar',
        downloadFile: 'Baixar arquivo',
        previewUnavailable: 'A visualização não está disponível para este tipo de arquivo.',
        xlsxTruncated: 'Exibindo as primeiras 10.000 linhas. Baixe o arquivo para ver todos os dados.',
        imageLoadFailed: 'Falha ao carregar a imagem',
        videoLoadFailed: 'Falha ao carregar o vídeo. O formato pode não ser compatível com o seu navegador.',
        audioLoadFailed: 'Falha ao carregar o áudio. O formato pode não ser compatível com o seu navegador.',
        videoUnsupported: 'Seu navegador não é compatível com o elemento de vídeo.',
        audioUnsupported: 'Seu navegador não é compatível com o elemento de áudio.',
        loadFailed: 'Falha ao carregar o arquivo',
        processFailed: 'Falha ao processar o arquivo',
        invalidSvg: 'Arquivo SVG inválido ou inseguro',
        defaultFilename: 'Arquivo',
    },
};
