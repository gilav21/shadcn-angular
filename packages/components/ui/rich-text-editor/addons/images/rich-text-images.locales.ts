/**
 * Locale strings for the rich-text-editor images addon. Standalone from the
 * base editor's `RICH_TEXT_LOCALES` so the addon ships only what it needs.
 */
export interface RichTextImagesLocale {
    readonly code: string;
    readonly rtl?: boolean;
    readonly tooltip: string;
    readonly url: string;
    readonly urlPlaceholder: string;
    readonly altText: string;
    readonly altTextPlaceholder: string;
    readonly insert: string;
    readonly uploading: string;
    readonly uploadFailed: string;
    readonly uploadRetry: string;
    readonly uploadRemove: string;
    readonly uploadNotImage: string;
    readonly inline: string;
    readonly floatLeft: string;
    readonly center: string;
    readonly floatRight: string;
    readonly deleteImage: string;
}

export const RICH_TEXT_IMAGES_LOCALES: Record<string, RichTextImagesLocale> = {
    en: { code: 'en', tooltip: 'Insert Image', url: 'Image URL', urlPlaceholder: 'https://example.com/image.jpg', altText: 'Alt Text', altTextPlaceholder: 'Description of image', insert: 'Insert Image', uploading: 'Uploading image...', uploadFailed: 'Upload failed', uploadRetry: 'Retry', uploadRemove: 'Remove', uploadNotImage: 'The image could not be uploaded because its content is not a valid image.', inline: 'Inline with text', floatLeft: 'Float left', center: 'Center', floatRight: 'Float right', deleteImage: 'Delete image' },
    he: { code: 'he', rtl: true, tooltip: 'הוספת תמונה', url: 'כתובת תמונה', urlPlaceholder: 'https://example.com/image.jpg', altText: 'טקסט חלופי', altTextPlaceholder: 'תיאור התמונה', insert: 'הוספת תמונה', uploading: 'העלאת תמונה...', uploadFailed: 'ההעלאה נכשלה', uploadRetry: 'נסה שוב', uploadRemove: 'הסר', uploadNotImage: 'לא ניתן להעלות את התמונה מכיוון שהתוכן אינו תמונה תקינה.', inline: 'בתוך הטקסט', floatLeft: 'הצמדה לשמאל', center: 'מירכוז', floatRight: 'הצמדה לימין', deleteImage: 'מחיקת תמונה' },
    ar: { code: 'ar', rtl: true, tooltip: 'إدراج صورة', url: 'عنوان الصورة', urlPlaceholder: 'https://example.com/image.jpg', altText: 'نص بديل', altTextPlaceholder: 'وصف الصورة', insert: 'إدراج صورة', uploading: 'جارٍ رفع الصورة...', uploadFailed: 'فشل الرفع', uploadRetry: 'إعادة المحاولة', uploadRemove: 'إزالة', uploadNotImage: 'تعذر رفع الصورة لأن محتواها ليس صورة صالحة.', inline: 'داخل النص', floatLeft: 'تعويم لليسار', center: 'توسيط', floatRight: 'تعويم لليمين', deleteImage: 'حذف الصورة' },
    de: { code: 'de', tooltip: 'Bild einfügen', url: 'Bild-URL', urlPlaceholder: 'https://example.com/image.jpg', altText: 'Alternativtext', altTextPlaceholder: 'Bildbeschreibung', insert: 'Bild einfügen', uploading: 'Bild wird hochgeladen...', uploadFailed: 'Upload fehlgeschlagen', uploadRetry: 'Erneut versuchen', uploadRemove: 'Entfernen', uploadNotImage: 'Das Bild konnte nicht hochgeladen werden, da der Inhalt kein gültiges Bild ist.', inline: 'Im Text', floatLeft: 'Links umfließen', center: 'Zentriert', floatRight: 'Rechts umfließen', deleteImage: 'Bild löschen' },
    fr: { code: 'fr', tooltip: 'Insérer une image', url: 'URL de l\'image', urlPlaceholder: 'https://example.com/image.jpg', altText: 'Texte alternatif', altTextPlaceholder: 'Description de l\'image', insert: 'Insérer l\'image', uploading: 'Téléchargement de l\'image...', uploadFailed: 'Échec du téléversement', uploadRetry: 'Réessayer', uploadRemove: 'Supprimer', uploadNotImage: 'L\'image n\'a pas pu être téléchargée car son contenu n\'est pas une image valide.', inline: 'Dans le texte', floatLeft: 'Flottant à gauche', center: 'Centrée', floatRight: 'Flottant à droite', deleteImage: 'Supprimer l\'image' },
    es: { code: 'es', tooltip: 'Insertar imagen', url: 'URL de imagen', urlPlaceholder: 'https://example.com/image.jpg', altText: 'Texto alternativo', altTextPlaceholder: 'Descripción de la imagen', insert: 'Insertar imagen', uploading: 'Subiendo imagen...', uploadFailed: 'Error al subir', uploadRetry: 'Reintentar', uploadRemove: 'Eliminar', uploadNotImage: 'No se pudo subir la imagen porque su contenido no es una imagen válida.', inline: 'En línea con el texto', floatLeft: 'Flotar a la izquierda', center: 'Centrar', floatRight: 'Flotar a la derecha', deleteImage: 'Eliminar imagen' },
    ja: { code: 'ja', tooltip: '画像を挿入', url: '画像URL', urlPlaceholder: 'https://example.com/image.jpg', altText: '代替テキスト', altTextPlaceholder: '画像の説明', insert: '画像を挿入', uploading: '画像をアップロード中...', uploadFailed: 'アップロード失敗', uploadRetry: '再試行', uploadRemove: '削除', uploadNotImage: 'コンテンツが有効な画像ではないため、画像をアップロードできませんでした。', inline: 'テキストと同列', floatLeft: '左に回り込み', center: '中央', floatRight: '右に回り込み', deleteImage: '画像を削除' },
    zh: { code: 'zh', tooltip: '插入图片', url: '图片 URL', urlPlaceholder: 'https://example.com/image.jpg', altText: '替代文字', altTextPlaceholder: '图片描述', insert: '插入图片', uploading: '正在上传图片...', uploadFailed: '上传失败', uploadRetry: '重试', uploadRemove: '移除', uploadNotImage: '由于内容不是有效图片，无法上传该图片。', inline: '与文字内联', floatLeft: '左浮动', center: '居中', floatRight: '右浮动', deleteImage: '删除图片' },
    ru: { code: 'ru', tooltip: 'Вставить изображение', url: 'URL изображения', urlPlaceholder: 'https://example.com/image.jpg', altText: 'Альтернативный текст', altTextPlaceholder: 'Описание изображения', insert: 'Вставить изображение', uploading: 'Загрузка изображения...', uploadFailed: 'Ошибка загрузки', uploadRetry: 'Повторить', uploadRemove: 'Удалить', uploadNotImage: 'Изображение не удалось загрузить, так как его содержимое не является допустимым изображением.', inline: 'В тексте', floatLeft: 'Обтекание слева', center: 'По центру', floatRight: 'Обтекание справа', deleteImage: 'Удалить изображение' },
    pt: { code: 'pt', tooltip: 'Inserir imagem', url: 'URL da imagem', urlPlaceholder: 'https://example.com/image.jpg', altText: 'Texto alternativo', altTextPlaceholder: 'Descrição da imagem', insert: 'Inserir imagem', uploading: 'Enviando imagem...', uploadFailed: 'Falha no envio', uploadRetry: 'Tentar novamente', uploadRemove: 'Remover', uploadNotImage: 'A imagem não pôde ser enviada porque seu conteúdo não é uma imagem válida.', inline: 'Em linha com o texto', floatLeft: 'Flutuar à esquerda', center: 'Centralizar', floatRight: 'Flutuar à direita', deleteImage: 'Excluir imagem' },
};
