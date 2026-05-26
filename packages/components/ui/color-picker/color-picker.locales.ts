import type { LocaleMeta } from '../../lib/i18n';

/**
 * Locale dictionary for `<ui-color-picker>`. Covers the various
 * aria-labels (saturation/hue/alpha/RGB/HSL channels), the "Recent"
 * and "Extracted palette" section labels, and the copy-format buttons.
 */
export interface ColorPickerLocale extends LocaleMeta {
    pickColorFromImage: string;
    saturationValue: string;
    hue: string;
    alpha: string;
    recent: string;
    recentColors: string;
    extractedPalette: string;
    editColorA: string;
    editColorB: string;
    copyHex: string;
    copyRgb: string;
    copyHsl: string;
    copyOklch: string;
    red: string;
    green: string;
    blue: string;
    saturation: string;
    lightness: string;
}

export const COLOR_PICKER_LOCALES: Record<string, ColorPickerLocale> = {
    en: {
        code: 'en',
        pickColorFromImage: 'Pick color from image',
        saturationValue: 'Saturation and value',
        hue: 'Hue', alpha: 'Alpha',
        recent: 'Recent', recentColors: 'Recent colors', extractedPalette: 'Extracted palette',
        editColorA: 'Edit color A', editColorB: 'Edit color B',
        copyHex: 'Copy hex', copyRgb: 'Copy rgb', copyHsl: 'Copy hsl', copyOklch: 'Copy oklch',
        red: 'Red', green: 'Green', blue: 'Blue',
        saturation: 'Saturation', lightness: 'Lightness',
    },
    he: {
        code: 'he', rtl: true,
        pickColorFromImage: 'בחר צבע מתמונה',
        saturationValue: 'רוויה וערך',
        hue: 'גוון', alpha: 'אלפא',
        recent: 'אחרונים', recentColors: 'צבעים אחרונים', extractedPalette: 'פלטה שחולצה',
        editColorA: 'ערוך צבע A', editColorB: 'ערוך צבע B',
        copyHex: 'העתק hex', copyRgb: 'העתק rgb', copyHsl: 'העתק hsl', copyOklch: 'העתק oklch',
        red: 'אדום', green: 'ירוק', blue: 'כחול',
        saturation: 'רוויה', lightness: 'בהירות',
    },
    ar: {
        code: 'ar', rtl: true,
        pickColorFromImage: 'اختر اللون من الصورة',
        saturationValue: 'التشبع والقيمة',
        hue: 'تدرج اللون', alpha: 'الشفافية',
        recent: 'الأخيرة', recentColors: 'الألوان الأخيرة', extractedPalette: 'اللوحة المستخرجة',
        editColorA: 'تعديل اللون A', editColorB: 'تعديل اللون B',
        copyHex: 'نسخ hex', copyRgb: 'نسخ rgb', copyHsl: 'نسخ hsl', copyOklch: 'نسخ oklch',
        red: 'أحمر', green: 'أخضر', blue: 'أزرق',
        saturation: 'التشبع', lightness: 'السطوع',
    },
    de: {
        code: 'de',
        pickColorFromImage: 'Farbe aus Bild wählen',
        saturationValue: 'Sättigung und Wert',
        hue: 'Farbton', alpha: 'Alpha',
        recent: 'Zuletzt', recentColors: 'Letzte Farben', extractedPalette: 'Extrahierte Palette',
        editColorA: 'Farbe A bearbeiten', editColorB: 'Farbe B bearbeiten',
        copyHex: 'Hex kopieren', copyRgb: 'RGB kopieren', copyHsl: 'HSL kopieren', copyOklch: 'Oklch kopieren',
        red: 'Rot', green: 'Grün', blue: 'Blau',
        saturation: 'Sättigung', lightness: 'Helligkeit',
    },
    fr: {
        code: 'fr',
        pickColorFromImage: 'Sélectionner la couleur dans l\'image',
        saturationValue: 'Saturation et valeur',
        hue: 'Teinte', alpha: 'Alpha',
        recent: 'Récents', recentColors: 'Couleurs récentes', extractedPalette: 'Palette extraite',
        editColorA: 'Modifier la couleur A', editColorB: 'Modifier la couleur B',
        copyHex: 'Copier hex', copyRgb: 'Copier rgb', copyHsl: 'Copier hsl', copyOklch: 'Copier oklch',
        red: 'Rouge', green: 'Vert', blue: 'Bleu',
        saturation: 'Saturation', lightness: 'Luminosité',
    },
    es: {
        code: 'es',
        pickColorFromImage: 'Elegir color de la imagen',
        saturationValue: 'Saturación y valor',
        hue: 'Tono', alpha: 'Alfa',
        recent: 'Recientes', recentColors: 'Colores recientes', extractedPalette: 'Paleta extraída',
        editColorA: 'Editar color A', editColorB: 'Editar color B',
        copyHex: 'Copiar hex', copyRgb: 'Copiar rgb', copyHsl: 'Copiar hsl', copyOklch: 'Copiar oklch',
        red: 'Rojo', green: 'Verde', blue: 'Azul',
        saturation: 'Saturación', lightness: 'Luminosidad',
    },
    ja: {
        code: 'ja',
        pickColorFromImage: '画像から色を選択',
        saturationValue: '彩度と明度',
        hue: '色相', alpha: 'アルファ',
        recent: '最近', recentColors: '最近の色', extractedPalette: '抽出されたパレット',
        editColorA: '色 A を編集', editColorB: '色 B を編集',
        copyHex: 'HEX をコピー', copyRgb: 'RGB をコピー', copyHsl: 'HSL をコピー', copyOklch: 'OKLCH をコピー',
        red: '赤', green: '緑', blue: '青',
        saturation: '彩度', lightness: '明度',
    },
    zh: {
        code: 'zh',
        pickColorFromImage: '从图像中选取颜色',
        saturationValue: '饱和度和明度',
        hue: '色相', alpha: '透明度',
        recent: '最近', recentColors: '最近的颜色', extractedPalette: '提取的调色板',
        editColorA: '编辑颜色 A', editColorB: '编辑颜色 B',
        copyHex: '复制 hex', copyRgb: '复制 rgb', copyHsl: '复制 hsl', copyOklch: '复制 oklch',
        red: '红', green: '绿', blue: '蓝',
        saturation: '饱和度', lightness: '亮度',
    },
    ru: {
        code: 'ru',
        pickColorFromImage: 'Выбрать цвет из изображения',
        saturationValue: 'Насыщенность и значение',
        hue: 'Оттенок', alpha: 'Альфа',
        recent: 'Недавние', recentColors: 'Недавние цвета', extractedPalette: 'Извлечённая палитра',
        editColorA: 'Изменить цвет A', editColorB: 'Изменить цвет B',
        copyHex: 'Копировать hex', copyRgb: 'Копировать rgb', copyHsl: 'Копировать hsl', copyOklch: 'Копировать oklch',
        red: 'Красный', green: 'Зелёный', blue: 'Синий',
        saturation: 'Насыщенность', lightness: 'Светлота',
    },
    pt: {
        code: 'pt',
        pickColorFromImage: 'Escolher cor da imagem',
        saturationValue: 'Saturação e valor',
        hue: 'Matiz', alpha: 'Alfa',
        recent: 'Recentes', recentColors: 'Cores recentes', extractedPalette: 'Paleta extraída',
        editColorA: 'Editar cor A', editColorB: 'Editar cor B',
        copyHex: 'Copiar hex', copyRgb: 'Copiar rgb', copyHsl: 'Copiar hsl', copyOklch: 'Copiar oklch',
        red: 'Vermelho', green: 'Verde', blue: 'Azul',
        saturation: 'Saturação', lightness: 'Luminosidade',
    },
};
