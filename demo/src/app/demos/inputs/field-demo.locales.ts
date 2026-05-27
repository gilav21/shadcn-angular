import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface FieldDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  legend: string;
  legendDesc: string;
  fields: {
    fullName: string;
    fullNamePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    emailDesc: string;
    requiredField: string;
    requiredFieldPlaceholder: string;
    requiredFieldError: string;
    agreeTerms: string;
  };
}

export const FIELD_DEMO_LOCALES: Record<string, FieldDemoLocale> = {
  en: {
    code: 'en',
    title: 'Field',
    description: 'Form field wrapper with label, description, and error support.',
    legend: 'Contact Information',
    legendDesc: 'Enter your contact details.',
    fields: {
      fullName: 'Full Name',
      fullNamePlaceholder: 'John Doe',
      email: 'Email',
      emailPlaceholder: 'john@example.com',
      emailDesc: 'We\'ll never share your email.',
      requiredField: 'Required Field',
      requiredFieldPlaceholder: 'This field has an error',
      requiredFieldError: 'This field is required.',
      agreeTerms: 'I agree to the terms',
    },
  },
  he: {
    code: 'he', rtl: true,
    title: 'שדה',
    description: 'עטיפת שדה טופס עם תווית, תיאור ותמיכה בשגיאות.',
    legend: 'פרטי יצירת קשר',
    legendDesc: 'הזן את פרטי הקשר שלך.',
    fields: {
      fullName: 'שם מלא',
      fullNamePlaceholder: 'יעל כהן',
      email: 'דואר אלקטרוני',
      emailPlaceholder: 'yael@example.com',
      emailDesc: 'לעולם לא נשתף את הדואר האלקטרוני שלך.',
      requiredField: 'שדה חובה',
      requiredFieldPlaceholder: 'לשדה זה יש שגיאה',
      requiredFieldError: 'שדה זה נדרש.',
      agreeTerms: 'אני מסכים לתנאים',
    },
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'الحقل',
    description: 'غلاف حقل نموذج مع تسمية ووصف ودعم للأخطاء.',
    legend: 'معلومات الاتصال',
    legendDesc: 'أدخل تفاصيل الاتصال الخاصة بك.',
    fields: {
      fullName: 'الاسم الكامل',
      fullNamePlaceholder: 'فاطمة محمد',
      email: 'البريد الإلكتروني',
      emailPlaceholder: 'fatima@example.com',
      emailDesc: 'لن نشارك بريدك الإلكتروني أبدًا.',
      requiredField: 'حقل مطلوب',
      requiredFieldPlaceholder: 'هذا الحقل يحتوي على خطأ',
      requiredFieldError: 'هذا الحقل مطلوب.',
      agreeTerms: 'أوافق على الشروط',
    },
  },
  de: {
    code: 'de',
    title: 'Feld',
    description: 'Formularfeld-Wrapper mit Label, Beschreibung und Fehlerunterstützung.',
    legend: 'Kontaktinformationen',
    legendDesc: 'Geben Sie Ihre Kontaktdaten ein.',
    fields: {
      fullName: 'Vollständiger Name',
      fullNamePlaceholder: 'Hans Müller',
      email: 'E-Mail',
      emailPlaceholder: 'hans@beispiel.de',
      emailDesc: 'Wir werden Ihre E-Mail niemals teilen.',
      requiredField: 'Pflichtfeld',
      requiredFieldPlaceholder: 'Dieses Feld hat einen Fehler',
      requiredFieldError: 'Dieses Feld ist erforderlich.',
      agreeTerms: 'Ich stimme den Bedingungen zu',
    },
  },
  fr: {
    code: 'fr',
    title: 'Champ',
    description: 'Enveloppe de champ de formulaire avec étiquette, description et support d\'erreur.',
    legend: 'Informations de contact',
    legendDesc: 'Saisissez vos coordonnées.',
    fields: {
      fullName: 'Nom complet',
      fullNamePlaceholder: 'Aurélie Dupont',
      email: 'E-mail',
      emailPlaceholder: 'aurelie@exemple.fr',
      emailDesc: 'Nous ne partagerons jamais votre e-mail.',
      requiredField: 'Champ obligatoire',
      requiredFieldPlaceholder: 'Ce champ comporte une erreur',
      requiredFieldError: 'Ce champ est obligatoire.',
      agreeTerms: 'J\'accepte les conditions',
    },
  },
  es: {
    code: 'es',
    title: 'Campo',
    description: 'Contenedor de campo de formulario con etiqueta, descripción y soporte de errores.',
    legend: 'Información de contacto',
    legendDesc: 'Introduzca sus datos de contacto.',
    fields: {
      fullName: 'Nombre completo',
      fullNamePlaceholder: 'Carmen García',
      email: 'Correo electrónico',
      emailPlaceholder: 'carmen@ejemplo.es',
      emailDesc: 'Nunca compartiremos su correo electrónico.',
      requiredField: 'Campo obligatorio',
      requiredFieldPlaceholder: 'Este campo tiene un error',
      requiredFieldError: 'Este campo es obligatorio.',
      agreeTerms: 'Acepto los términos',
    },
  },
  ja: {
    code: 'ja',
    title: 'フィールド',
    description: 'ラベル、説明、エラーサポートを備えたフォームフィールドラッパーです。',
    legend: '連絡先情報',
    legendDesc: '連絡先の詳細を入力してください。',
    fields: {
      fullName: '氏名',
      fullNamePlaceholder: '山田 太郎',
      email: 'メールアドレス',
      emailPlaceholder: 'yamada@example.jp',
      emailDesc: 'メールアドレスを共有することはありません。',
      requiredField: '必須フィールド',
      requiredFieldPlaceholder: 'このフィールドにはエラーがあります',
      requiredFieldError: 'このフィールドは必須です。',
      agreeTerms: '利用規約に同意します',
    },
  },
  zh: {
    code: 'zh',
    title: '字段',
    description: '带有标签、描述和错误支持的表单字段包装器。',
    legend: '联系信息',
    legendDesc: '请输入您的联系方式。',
    fields: {
      fullName: '全名',
      fullNamePlaceholder: '王伟',
      email: '电子邮件',
      emailPlaceholder: 'wang@example.com',
      emailDesc: '我们不会分享您的电子邮件。',
      requiredField: '必填字段',
      requiredFieldPlaceholder: '此字段有错误',
      requiredFieldError: '此字段为必填项。',
      agreeTerms: '我同意条款',
    },
  },
  ru: {
    code: 'ru',
    title: 'Поле',
    description: 'Обёртка поля формы с меткой, описанием и поддержкой ошибок.',
    legend: 'Контактная информация',
    legendDesc: 'Введите контактные данные.',
    fields: {
      fullName: 'Полное имя',
      fullNamePlaceholder: 'Иван Иванов',
      email: 'Электронная почта',
      emailPlaceholder: 'ivan@example.ru',
      emailDesc: 'Мы никогда не будем делиться вашей почтой.',
      requiredField: 'Обязательное поле',
      requiredFieldPlaceholder: 'В этом поле есть ошибка',
      requiredFieldError: 'Это поле обязательно.',
      agreeTerms: 'Я соглашаюсь с условиями',
    },
  },
  pt: {
    code: 'pt',
    title: 'Campo',
    description: 'Invólucro de campo de formulário com rótulo, descrição e suporte a erros.',
    legend: 'Informações de contato',
    legendDesc: 'Insira seus dados de contato.',
    fields: {
      fullName: 'Nome completo',
      fullNamePlaceholder: 'João Silva',
      email: 'E-mail',
      emailPlaceholder: 'joao@exemplo.pt',
      emailDesc: 'Nunca compartilharemos seu e-mail.',
      requiredField: 'Campo obrigatório',
      requiredFieldPlaceholder: 'Este campo tem um erro',
      requiredFieldError: 'Este campo é obrigatório.',
      agreeTerms: 'Concordo com os termos',
    },
  },
};
