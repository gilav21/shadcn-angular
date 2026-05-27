import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface ImageExtractDemoLocale extends LocaleMeta {
    heading: string;
    description: string;
    algorithmLabel: string;
    countLabel: string;
    paletteLabel: string;
    emptyPrompt: string;
    imgAlt: string;
}

export const IMAGE_EXTRACT_DEMO_LOCALES: Record<string, ImageExtractDemoLocale> = {
    en: {
        code: 'en',
        heading: 'Image color extraction',
        description: 'Drop in any image source and get a dominant-color palette back.',
        algorithmLabel: 'Algorithm',
        countLabel: 'Count',
        paletteLabel: 'Palette',
        emptyPrompt: 'Pick an image to extract its dominant colors.',
        imgAlt: 'Selected image',
    },
    he: {
        code: 'he',
        rtl: true,
        heading: 'חילוץ צבעים מתמונה',
        description: 'שחררו כל מקור תמונה וקבלו חזרה פלטת צבעים דומיננטיים.',
        algorithmLabel: 'אלגוריתם',
        countLabel: 'כמות',
        paletteLabel: 'פלטה',
        emptyPrompt: 'בחרו תמונה לחילוץ הצבעים הדומיננטיים שלה.',
        imgAlt: 'תמונה שנבחרה',
    },
    ar: {
        code: 'ar',
        rtl: true,
        heading: 'استخراج ألوان الصورة',
        description: 'أسقط أي مصدر صورة واحصل على لوحة الألوان السائدة.',
        algorithmLabel: 'الخوارزمية',
        countLabel: 'العدد',
        paletteLabel: 'اللوحة',
        emptyPrompt: 'اختر صورة لاستخراج ألوانها السائدة.',
        imgAlt: 'الصورة المختارة',
    },
    de: {
        code: 'de',
        heading: 'Bildfarbenextraktion',
        description: 'Geben Sie eine Bildquelle an und erhalten Sie eine dominante Farbpalette zurück.',
        algorithmLabel: 'Algorithmus',
        countLabel: 'Anzahl',
        paletteLabel: 'Palette',
        emptyPrompt: 'Wählen Sie ein Bild aus, um die dominanten Farben zu extrahieren.',
        imgAlt: 'Ausgewähltes Bild',
    },
    fr: {
        code: 'fr',
        heading: 'Extraction de couleurs d\'image',
        description: 'Fournissez une source d\'image et obtenez une palette de couleurs dominantes.',
        algorithmLabel: 'Algorithme',
        countLabel: 'Nombre',
        paletteLabel: 'Palette',
        emptyPrompt: 'Choisissez une image pour extraire ses couleurs dominantes.',
        imgAlt: 'Image sélectionnée',
    },
    es: {
        code: 'es',
        heading: 'Extracción de colores de imagen',
        description: 'Introduce cualquier fuente de imagen y obtén una paleta de colores dominantes.',
        algorithmLabel: 'Algoritmo',
        countLabel: 'Cantidad',
        paletteLabel: 'Paleta',
        emptyPrompt: 'Elige una imagen para extraer sus colores dominantes.',
        imgAlt: 'Imagen seleccionada',
    },
    ja: {
        code: 'ja',
        heading: '画像カラー抽出',
        description: '画像ソースを指定して主要な色のパレットを取得します。',
        algorithmLabel: 'アルゴリズム',
        countLabel: '数量',
        paletteLabel: 'パレット',
        emptyPrompt: '画像を選択して主要な色を抽出してください。',
        imgAlt: '選択した画像',
    },
    zh: {
        code: 'zh',
        heading: '图像颜色提取',
        description: '输入任意图像来源，获取主色调调色板。',
        algorithmLabel: '算法',
        countLabel: '数量',
        paletteLabel: '调色板',
        emptyPrompt: '选择图像以提取其主色调。',
        imgAlt: '所选图像',
    },
    ru: {
        code: 'ru',
        heading: 'Извлечение цветов из изображения',
        description: 'Укажите источник изображения и получите палитру доминирующих цветов.',
        algorithmLabel: 'Алгоритм',
        countLabel: 'Количество',
        paletteLabel: 'Палитра',
        emptyPrompt: 'Выберите изображение для извлечения доминирующих цветов.',
        imgAlt: 'Выбранное изображение',
    },
    pt: {
        code: 'pt',
        heading: 'Extração de cores de imagem',
        description: 'Forneça qualquer fonte de imagem e obtenha uma paleta de cores dominantes.',
        algorithmLabel: 'Algoritmo',
        countLabel: 'Quantidade',
        paletteLabel: 'Paleta',
        emptyPrompt: 'Escolha uma imagem para extrair suas cores dominantes.',
        imgAlt: 'Imagem selecionada',
    },
};
