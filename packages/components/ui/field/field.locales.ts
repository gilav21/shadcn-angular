import type { LocaleMeta } from '../../lib/i18n/i18n.types';

/**
 * Default validation error messages rendered by `ui-field-auto-errors`.
 *
 * Each value is a plain string template; `{placeholder}` tokens are resolved
 * against Angular's validation error object via `interpolate()` — e.g.
 * `Validators.minLength` produces `{ requiredLength, actualLength }`, so
 * `'Minimum {requiredLength} characters'` interpolates the limit.
 *
 * This file is installed into your project — edit messages or add locales
 * directly. Per-instance overrides go through the `messages` input on
 * `ui-field-auto-errors`.
 */
export interface FieldErrorsLocale extends LocaleMeta {
    required: string;
    minlength: string;
    maxlength: string;
    min: string;
    max: string;
    email: string;
    pattern: string;
    minWords: string;
}

export const FIELD_ERROR_LOCALES: Record<string, FieldErrorsLocale> = {
    en: {
        code: 'en',
        required: 'This field is required',
        minlength: 'Minimum {requiredLength} characters',
        maxlength: 'Maximum {requiredLength} characters',
        min: 'Must be at least {min}',
        max: 'Must be at most {max}',
        email: 'Enter a valid email address',
        pattern: 'Invalid format',
        minWords: 'Minimum {requiredWords} words',
    },
    he: {
        code: 'he',
        rtl: true,
        required: 'שדה חובה',
        minlength: 'מינימום {requiredLength} תווים',
        maxlength: 'מקסימום {requiredLength} תווים',
        min: 'הערך חייב להיות לפחות {min}',
        max: 'הערך חייב להיות לכל היותר {max}',
        email: 'יש להזין כתובת אימייל תקינה',
        pattern: 'פורמט לא תקין',
        minWords: 'מינימום {requiredWords} מילים',
    },
    ar: {
        code: 'ar',
        rtl: true,
        required: 'هذا الحقل مطلوب',
        minlength: 'الحد الأدنى {requiredLength} حرفًا',
        maxlength: 'الحد الأقصى {requiredLength} حرفًا',
        min: 'يجب ألا يقل عن {min}',
        max: 'يجب ألا يزيد عن {max}',
        email: 'أدخل بريدًا إلكترونيًا صالحًا',
        pattern: 'تنسيق غير صالح',
        minWords: 'الحد الأدنى {requiredWords} كلمات',
    },
    de: {
        code: 'de',
        required: 'Dieses Feld ist erforderlich',
        minlength: 'Mindestens {requiredLength} Zeichen',
        maxlength: 'Höchstens {requiredLength} Zeichen',
        min: 'Muss mindestens {min} sein',
        max: 'Darf höchstens {max} sein',
        email: 'Geben Sie eine gültige E-Mail-Adresse ein',
        pattern: 'Ungültiges Format',
        minWords: 'Mindestens {requiredWords} Wörter',
    },
    fr: {
        code: 'fr',
        required: 'Ce champ est obligatoire',
        minlength: 'Minimum {requiredLength} caractères',
        maxlength: 'Maximum {requiredLength} caractères',
        min: 'Doit être au moins {min}',
        max: 'Doit être au plus {max}',
        email: 'Saisissez une adresse e-mail valide',
        pattern: 'Format invalide',
        minWords: 'Minimum {requiredWords} mots',
    },
    es: {
        code: 'es',
        required: 'Este campo es obligatorio',
        minlength: 'Mínimo {requiredLength} caracteres',
        maxlength: 'Máximo {requiredLength} caracteres',
        min: 'Debe ser al menos {min}',
        max: 'Debe ser como máximo {max}',
        email: 'Introduce un correo electrónico válido',
        pattern: 'Formato no válido',
        minWords: 'Mínimo {requiredWords} palabras',
    },
    ja: {
        code: 'ja',
        required: 'この項目は必須です',
        minlength: '{requiredLength}文字以上で入力してください',
        maxlength: '{requiredLength}文字以下で入力してください',
        min: '{min}以上で入力してください',
        max: '{max}以下で入力してください',
        email: '有効なメールアドレスを入力してください',
        pattern: '形式が正しくありません',
        minWords: '{requiredWords}語以上で入力してください',
    },
    zh: {
        code: 'zh',
        required: '此字段为必填项',
        minlength: '至少需要 {requiredLength} 个字符',
        maxlength: '最多 {requiredLength} 个字符',
        min: '不能小于 {min}',
        max: '不能大于 {max}',
        email: '请输入有效的电子邮件地址',
        pattern: '格式无效',
        minWords: '至少需要 {requiredWords} 个词',
    },
    ru: {
        code: 'ru',
        required: 'Это поле обязательно',
        minlength: 'Минимум {requiredLength} символов',
        maxlength: 'Максимум {requiredLength} символов',
        min: 'Должно быть не менее {min}',
        max: 'Должно быть не более {max}',
        email: 'Введите корректный адрес электронной почты',
        pattern: 'Неверный формат',
        minWords: 'Минимум {requiredWords} слов',
    },
    pt: {
        code: 'pt',
        required: 'Este campo é obrigatório',
        minlength: 'Mínimo de {requiredLength} caracteres',
        maxlength: 'Máximo de {requiredLength} caracteres',
        min: 'Deve ser no mínimo {min}',
        max: 'Deve ser no máximo {max}',
        email: 'Insira um endereço de e-mail válido',
        pattern: 'Formato inválido',
        minWords: 'Mínimo de {requiredWords} palavras',
    },
};
