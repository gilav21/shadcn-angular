import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface FormDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  fields: {
    username: string;
    usernameDesc: string;
    usernamePlaceholder: string;
    email: string;
    emailPlaceholder: string;
  };
  errors: {
    usernameRequired: string;
    usernameMinLength: string;
    emailRequired: string;
    emailInvalid: string;
  };
  submitButton: string;
  toast: {
    successTitle: string;
  };
}

export const FORM_DEMO_LOCALES: Record<string, FormDemoLocale> = {
  en: {
    code: 'en',
    title: 'Form',
    description: 'Building forms with validation and helper text using the Field component.',
    fields: {
      username: 'Username',
      usernameDesc: 'This is your public display name.',
      usernamePlaceholder: 'shadcn',
      email: 'Email',
      emailPlaceholder: 'm@example.com',
    },
    errors: {
      usernameRequired: 'Username is required',
      usernameMinLength: 'Username must be at least 2 characters',
      emailRequired: 'Email is required',
      emailInvalid: 'Please enter a valid email',
    },
    submitButton: 'Submit',
    toast: { successTitle: 'Form Submitted' },
  },
  he: {
    code: 'he', rtl: true,
    title: 'טופס',
    description: 'בניית טפסים עם אימות וטקסט עזר באמצעות רכיב השדה.',
    fields: {
      username: 'שם משתמש',
      usernameDesc: 'זהו שם התצוגה הציבורי שלך.',
      usernamePlaceholder: 'דוד',
      email: 'דואר אלקטרוני',
      emailPlaceholder: 'david@example.com',
    },
    errors: {
      usernameRequired: 'שם המשתמש נדרש',
      usernameMinLength: 'שם המשתמש חייב להיות לפחות 2 תווים',
      emailRequired: 'הדואר האלקטרוני נדרש',
      emailInvalid: 'אנא הזן דואר אלקטרוני תקין',
    },
    submitButton: 'שלח',
    toast: { successTitle: 'הטופס נשלח' },
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'النموذج',
    description: 'بناء نماذج مع التحقق من الصحة والنص المساعد باستخدام مكوّن الحقل.',
    fields: {
      username: 'اسم المستخدم',
      usernameDesc: 'هذا هو اسم عرضك العام.',
      usernamePlaceholder: 'محمد',
      email: 'البريد الإلكتروني',
      emailPlaceholder: 'mohammed@example.com',
    },
    errors: {
      usernameRequired: 'اسم المستخدم مطلوب',
      usernameMinLength: 'يجب أن يتكون اسم المستخدم من حرفين على الأقل',
      emailRequired: 'البريد الإلكتروني مطلوب',
      emailInvalid: 'يرجى إدخال بريد إلكتروني صالح',
    },
    submitButton: 'إرسال',
    toast: { successTitle: 'تم إرسال النموذج' },
  },
  de: {
    code: 'de',
    title: 'Formular',
    description: 'Erstellen von Formularen mit Validierung und Hilfstext mithilfe der Feldkomponente.',
    fields: {
      username: 'Benutzername',
      usernameDesc: 'Dies ist Ihr öffentlicher Anzeigename.',
      usernamePlaceholder: 'Hans',
      email: 'E-Mail',
      emailPlaceholder: 'hans@beispiel.de',
    },
    errors: {
      usernameRequired: 'Benutzername ist erforderlich',
      usernameMinLength: 'Der Benutzername muss mindestens 2 Zeichen lang sein',
      emailRequired: 'E-Mail ist erforderlich',
      emailInvalid: 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
    },
    submitButton: 'Absenden',
    toast: { successTitle: 'Formular eingereicht' },
  },
  fr: {
    code: 'fr',
    title: 'Formulaire',
    description: 'Création de formulaires avec validation et texte d\'aide à l\'aide du composant Champ.',
    fields: {
      username: 'Nom d\'utilisateur',
      usernameDesc: 'C\'est votre nom d\'affichage public.',
      usernamePlaceholder: 'Hugo',
      email: 'E-mail',
      emailPlaceholder: 'hugo@exemple.fr',
    },
    errors: {
      usernameRequired: 'Le nom d\'utilisateur est requis',
      usernameMinLength: 'Le nom d\'utilisateur doit comporter au moins 2 caractères',
      emailRequired: 'L\'e-mail est requis',
      emailInvalid: 'Veuillez entrer un e-mail valide',
    },
    submitButton: 'Soumettre',
    toast: { successTitle: 'Formulaire soumis' },
  },
  es: {
    code: 'es',
    title: 'Formulario',
    description: 'Creación de formularios con validación y texto de ayuda usando el componente Campo.',
    fields: {
      username: 'Nombre de usuario',
      usernameDesc: 'Este es su nombre de visualización público.',
      usernamePlaceholder: 'Carlos',
      email: 'Correo electrónico',
      emailPlaceholder: 'carlos@ejemplo.es',
    },
    errors: {
      usernameRequired: 'El nombre de usuario es obligatorio',
      usernameMinLength: 'El nombre de usuario debe tener al menos 2 caracteres',
      emailRequired: 'El correo electrónico es obligatorio',
      emailInvalid: 'Por favor ingrese un correo electrónico válido',
    },
    submitButton: 'Enviar',
    toast: { successTitle: 'Formulario enviado' },
  },
  ja: {
    code: 'ja',
    title: 'フォーム',
    description: 'Fieldコンポーネントを使って、バリデーションとヘルパーテキストを備えたフォームを構築します。',
    fields: {
      username: 'ユーザー名',
      usernameDesc: 'これが公開表示名です。',
      usernamePlaceholder: '田中',
      email: 'メールアドレス',
      emailPlaceholder: 'tanaka@example.jp',
    },
    errors: {
      usernameRequired: 'ユーザー名は必須です',
      usernameMinLength: 'ユーザー名は2文字以上必要です',
      emailRequired: 'メールアドレスは必須です',
      emailInvalid: '有効なメールアドレスを入力してください',
    },
    submitButton: '送信',
    toast: { successTitle: 'フォームを送信しました' },
  },
  zh: {
    code: 'zh',
    title: '表单',
    description: '使用 Field 组件构建带有验证和帮助文本的表单。',
    fields: {
      username: '用户名',
      usernameDesc: '这是您的公开显示名称。',
      usernamePlaceholder: '李明',
      email: '电子邮件',
      emailPlaceholder: 'liming@example.com',
    },
    errors: {
      usernameRequired: '用户名为必填项',
      usernameMinLength: '用户名至少需要2个字符',
      emailRequired: '电子邮件为必填项',
      emailInvalid: '请输入有效的电子邮件',
    },
    submitButton: '提交',
    toast: { successTitle: '表单已提交' },
  },
  ru: {
    code: 'ru',
    title: 'Форма',
    description: 'Создание форм с проверкой и вспомогательным текстом с помощью компонента Поле.',
    fields: {
      username: 'Имя пользователя',
      usernameDesc: 'Это ваше публичное отображаемое имя.',
      usernamePlaceholder: 'Иван',
      email: 'Электронная почта',
      emailPlaceholder: 'ivan@example.ru',
    },
    errors: {
      usernameRequired: 'Имя пользователя обязательно',
      usernameMinLength: 'Имя пользователя должно содержать не менее 2 символов',
      emailRequired: 'Электронная почта обязательна',
      emailInvalid: 'Пожалуйста, введите корректный адрес электронной почты',
    },
    submitButton: 'Отправить',
    toast: { successTitle: 'Форма отправлена' },
  },
  pt: {
    code: 'pt',
    title: 'Formulário',
    description: 'Construção de formulários com validação e texto de ajuda usando o componente Campo.',
    fields: {
      username: 'Nome de usuário',
      usernameDesc: 'Este é seu nome de exibição público.',
      usernamePlaceholder: 'João',
      email: 'E-mail',
      emailPlaceholder: 'joao@exemplo.pt',
    },
    errors: {
      usernameRequired: 'O nome de usuário é obrigatório',
      usernameMinLength: 'O nome de usuário deve ter pelo menos 2 caracteres',
      emailRequired: 'O e-mail é obrigatório',
      emailInvalid: 'Por favor, insira um e-mail válido',
    },
    submitButton: 'Enviar',
    toast: { successTitle: 'Formulário enviado' },
  },
};
