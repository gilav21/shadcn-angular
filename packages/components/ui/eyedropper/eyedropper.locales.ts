import type { LocaleMeta } from '../../lib/i18n';

/** Locale dictionary for `<ui-eyedropper>`. */
export interface EyedropperLocale extends LocaleMeta {
    /** Default `aria-label` / button label when the EyeDropper API is available. */
    pickColor: string;
    /** Replacement label when the browser doesn't support the EyeDropper API. */
    notSupported: string;
}

export const EYEDROPPER_LOCALES: Record<string, EyedropperLocale> = {
    en: { code: 'en', pickColor: 'Pick color', notSupported: 'Eyedropper not supported in this browser' },
    he: { code: 'he', rtl: true, pickColor: 'בחר צבע', notSupported: 'טפטפת אינה נתמכת בדפדפן זה' },
    ar: { code: 'ar', rtl: true, pickColor: 'اختر لونًا', notSupported: 'القطارة غير مدعومة في هذا المتصفح' },
    de: { code: 'de', pickColor: 'Farbe wählen', notSupported: 'Pipette wird in diesem Browser nicht unterstützt' },
    fr: { code: 'fr', pickColor: 'Choisir une couleur', notSupported: 'Pipette non prise en charge par ce navigateur' },
    es: { code: 'es', pickColor: 'Elegir color', notSupported: 'Cuentagotas no compatible con este navegador' },
    ja: { code: 'ja', pickColor: '色を選択', notSupported: 'このブラウザではスポイトはサポートされていません' },
    zh: { code: 'zh', pickColor: '选择颜色', notSupported: '此浏览器不支持取色器' },
    ru: { code: 'ru', pickColor: 'Выбрать цвет', notSupported: 'Пипетка не поддерживается в этом браузере' },
    pt: { code: 'pt', pickColor: 'Escolher cor', notSupported: 'Conta-gotas não suportado neste navegador' },
};
