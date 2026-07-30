import type { LocaleMeta } from '../../../../lib/i18n';

/**
 * Localized strings for the rich-text file-import addon: the toolbar import
 * button and the busy/error overlay it shows while parsing a `.docx`, `.pdf` or
 * reading a picked image.
 * Pass a registry key (`'en'`, `'he'`, …) or a full dictionary to
 * `[uiRteFileImportLocale]`.
 *
 * Unlike the former built-in import toolbar item, these strings resolve from the
 * addon's own `[uiRteFileImportLocale]` input (or the global `UI_LOCALE_ID`),
 * not the editor's `[locale]` input.
 */
export interface RichTextFileImportLocale extends LocaleMeta {
    /** Toolbar button tooltip / hidden input label. */
    tooltip: string;
    /** Shown in the overlay while a file is being parsed. */
    importing: string;
    /** Shown when parsing fails or produces no content. */
    importFailed: string;
    /** Shown when the file is not a valid PDF, DOCX or supported image. */
    importInvalidFile: string;
}

/** Built-in locales for the file-import addon. */
export const RICH_TEXT_FILE_IMPORT_LOCALES: Record<string, RichTextFileImportLocale> = {
    en: {
        code: 'en',
        tooltip: 'Import File',
        importing: 'Importing file...',
        importFailed: 'Failed to import file. The file may be unsupported or corrupted.',
        importInvalidFile: 'The selected file is not a supported document or image.',
    },
    he: {
        code: 'he',
        rtl: true,
        tooltip: 'ייבוא קובץ',
        importing: '...מייבא קובץ',
        importFailed: 'ייבוא הקובץ נכשל. הקובץ עשוי להיות לא נתמך או פגום.',
        importInvalidFile: 'הקובץ שנבחר אינו מסמך או תמונה נתמכים.',
    },
    ar: {
        code: 'ar',
        rtl: true,
        tooltip: 'استيراد ملف',
        importing: '...جارٍ استيراد الملف',
        importFailed: 'فشل استيراد الملف. قد يكون الملف غير مدعوم أو تالفاً.',
        importInvalidFile: 'الملف المحدد ليس مستنداً أو صورة مدعومة.',
    },
    de: {
        code: 'de',
        tooltip: 'Datei importieren',
        importing: 'Datei wird importiert...',
        importFailed: 'Datei-Import fehlgeschlagen. Die Datei wird möglicherweise nicht unterstützt oder ist beschädigt.',
        importInvalidFile: 'Die ausgewählte Datei ist kein unterstütztes Dokument oder Bild.',
    },
    fr: {
        code: 'fr',
        tooltip: 'Importer un fichier',
        importing: 'Importation du fichier...',
        importFailed: 'Échec de l\'importation du fichier. Le fichier est peut-être non pris en charge ou corrompu.',
        importInvalidFile: 'Le fichier sélectionné n\'est pas un document ou une image pris en charge.',
    },
    es: {
        code: 'es',
        tooltip: 'Importar archivo',
        importing: 'Importando archivo...',
        importFailed: 'Error al importar archivo. El archivo puede no ser compatible o estar dañado.',
        importInvalidFile: 'El archivo seleccionado no es un documento o imagen compatible.',
    },
    ja: {
        code: 'ja',
        tooltip: 'ファイルをインポート',
        importing: 'ファイルをインポート中...',
        importFailed: 'ファイルのインポートに失敗しました。ファイルがサポートされていないか破損している可能性があります。',
        importInvalidFile: '選択されたファイルはサポートされている文書または画像ではありません。',
    },
    zh: {
        code: 'zh',
        tooltip: '导入文件',
        importing: '正在导入文件...',
        importFailed: '文件导入失败。文件可能不受支持或已损坏。',
        importInvalidFile: '所选文件不是受支持的文档或图片。',
    },
    ru: {
        code: 'ru',
        tooltip: 'Импорт файла',
        importing: 'Импорт файла...',
        importFailed: 'Не удалось импортировать файл. Файл может быть неподдерживаемым или повреждённым.',
        importInvalidFile: 'Выбранный файл не является поддерживаемым документом или изображением.',
    },
    pt: {
        code: 'pt',
        tooltip: 'Importar arquivo',
        importing: 'Importando arquivo...',
        importFailed: 'Falha ao importar arquivo. O arquivo pode não ser suportado ou estar corrompido.',
        importInvalidFile: 'O arquivo selecionado não é um documento ou imagem compatível.',
    },
};
