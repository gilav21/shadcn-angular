import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface TabsDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  tabAccount: string;
  tabPassword: string;
  tabSettings: string;
  accountCardTitle: string;
  accountCardDesc: string;
  accountInputPlaceholder: string;
  passwordCardTitle: string;
  passwordCardDesc: string;
  passwordInputPlaceholder: string;
  settingsCardTitle: string;
  settingsCardDesc: string;
  simpleHeading: string;
  simpleDesc: string;
  simpleTabOverview: string;
  simpleTabFeatures: string;
  simpleTabPricing: string;
  simpleOverviewContent: string;
  simpleFeaturesContent: string;
  simplePricingContent: string;
  complexHeading: string;
  complexDesc: string;
  helperCardTitle: string;
  helperCardDesc: string;
  helperUsernameLabel: string;
  helperEmailLabel: string;
  helperSaveBtn: string;
}

export const TABS_DEMO_LOCALES: Record<string, TabsDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Tabs', description: 'Tab navigation component.',
    tabAccount: 'Account', tabPassword: 'Password', tabSettings: 'Settings',
    accountCardTitle: 'Account', accountCardDesc: 'Make changes to your account here.',
    accountInputPlaceholder: 'Your name',
    passwordCardTitle: 'Password', passwordCardDesc: 'Change your password here.',
    passwordInputPlaceholder: 'New password',
    settingsCardTitle: 'Settings', settingsCardDesc: 'Configure your preferences.',
    simpleHeading: 'Simple Mode (Data-driven)', simpleDesc: 'Using tabs input array instead of content projection.',
    simpleTabOverview: 'Overview', simpleTabFeatures: 'Features', simpleTabPricing: 'Pricing',
    simpleOverviewContent: 'This is the overview tab content.',
    simpleFeaturesContent: 'These are the features of the product.',
    simplePricingContent: 'Check out our pricing plans.',
    complexHeading: 'Complex Mode (Components)', complexDesc: 'Rendering components and passing context data in tabs.',
    helperCardTitle: 'Account Settings', helperCardDesc: 'Manage your account settings and preferences.',
    helperUsernameLabel: 'Username', helperEmailLabel: 'Email', helperSaveBtn: 'Save Changes',
  },
  he: {
    code: 'he', rtl: true,
    heading: 'לשוניות', description: 'רכיב ניווט בלשוניות.',
    tabAccount: 'חשבון', tabPassword: 'סיסמה', tabSettings: 'הגדרות',
    accountCardTitle: 'חשבון', accountCardDesc: 'בצע שינויים בחשבונך כאן.',
    accountInputPlaceholder: 'שמך',
    passwordCardTitle: 'סיסמה', passwordCardDesc: 'שנה את סיסמתך כאן.',
    passwordInputPlaceholder: 'סיסמה חדשה',
    settingsCardTitle: 'הגדרות', settingsCardDesc: 'הגדר את ההעדפות שלך.',
    simpleHeading: 'מצב פשוט (מונע נתונים)', simpleDesc: 'שימוש במערך הקלט tabs במקום הטלת תוכן.',
    simpleTabOverview: 'סקירה', simpleTabFeatures: 'תכונות', simpleTabPricing: 'תמחור',
    simpleOverviewContent: 'זהו תוכן לשונית הסקירה.',
    simpleFeaturesContent: 'אלו הן תכונות המוצר.',
    simplePricingContent: 'בדוק את תוכניות התמחור שלנו.',
    complexHeading: 'מצב מורכב (רכיבים)', complexDesc: 'עיבוד רכיבים והעברת נתוני הקשר בלשוניות.',
    helperCardTitle: 'הגדרות חשבון', helperCardDesc: 'נהל את הגדרות החשבון וההעדפות שלך.',
    helperUsernameLabel: 'שם משתמש', helperEmailLabel: 'אימייל', helperSaveBtn: 'שמור שינויים',
  },
  ar: {
    code: 'ar', rtl: true,
    heading: 'علامات التبويب', description: 'مكوّن التنقل بعلامات التبويب.',
    tabAccount: 'الحساب', tabPassword: 'كلمة المرور', tabSettings: 'الإعدادات',
    accountCardTitle: 'الحساب', accountCardDesc: 'أجرِ تغييرات على حسابك هنا.',
    accountInputPlaceholder: 'اسمك',
    passwordCardTitle: 'كلمة المرور', passwordCardDesc: 'غيّر كلمة مرورك هنا.',
    passwordInputPlaceholder: 'كلمة مرور جديدة',
    settingsCardTitle: 'الإعدادات', settingsCardDesc: 'اضبط تفضيلاتك.',
    simpleHeading: 'الوضع البسيط (مدفوع بالبيانات)', simpleDesc: 'استخدام مصفوفة الإدخال tabs بدلاً من إسقاط المحتوى.',
    simpleTabOverview: 'نظرة عامة', simpleTabFeatures: 'الميزات', simpleTabPricing: 'التسعير',
    simpleOverviewContent: 'هذا هو محتوى علامة التبويب العامة.',
    simpleFeaturesContent: 'هذه هي ميزات المنتج.',
    simplePricingContent: 'اطلع على خطط التسعير لدينا.',
    complexHeading: 'الوضع المعقد (مكونات)', complexDesc: 'عرض المكونات وتمرير بيانات السياق في علامات التبويب.',
    helperCardTitle: 'إعدادات الحساب', helperCardDesc: 'إدارة إعدادات حسابك وتفضيلاتك.',
    helperUsernameLabel: 'اسم المستخدم', helperEmailLabel: 'البريد الإلكتروني', helperSaveBtn: 'حفظ التغييرات',
  },
  de: {
    code: 'de',
    heading: 'Tabs', description: 'Tab-Navigationskomponente.',
    tabAccount: 'Konto', tabPassword: 'Passwort', tabSettings: 'Einstellungen',
    accountCardTitle: 'Konto', accountCardDesc: 'Nehmen Sie hier Änderungen an Ihrem Konto vor.',
    accountInputPlaceholder: 'Ihr Name',
    passwordCardTitle: 'Passwort', passwordCardDesc: 'Ändern Sie hier Ihr Passwort.',
    passwordInputPlaceholder: 'Neues Passwort',
    settingsCardTitle: 'Einstellungen', settingsCardDesc: 'Konfigurieren Sie Ihre Präferenzen.',
    simpleHeading: 'Einfacher Modus (Datengesteuert)', simpleDesc: 'Verwendung des tabs-Eingabe-Arrays statt Content Projection.',
    simpleTabOverview: 'Übersicht', simpleTabFeatures: 'Funktionen', simpleTabPricing: 'Preise',
    simpleOverviewContent: 'Dies ist der Inhalt des Übersichts-Tabs.',
    simpleFeaturesContent: 'Dies sind die Funktionen des Produkts.',
    simplePricingContent: 'Schauen Sie sich unsere Preispläne an.',
    complexHeading: 'Komplexer Modus (Komponenten)', complexDesc: 'Rendern von Komponenten mit Kontextdaten in Tabs.',
    helperCardTitle: 'Kontoeinstellungen', helperCardDesc: 'Verwalten Sie Ihre Kontoeinstellungen und Präferenzen.',
    helperUsernameLabel: 'Benutzername', helperEmailLabel: 'E-Mail', helperSaveBtn: 'Änderungen speichern',
  },
  fr: {
    code: 'fr',
    heading: 'Onglets', description: 'Composant de navigation par onglets.',
    tabAccount: 'Compte', tabPassword: 'Mot de passe', tabSettings: 'Paramètres',
    accountCardTitle: 'Compte', accountCardDesc: 'Apportez des modifications à votre compte ici.',
    accountInputPlaceholder: 'Votre nom',
    passwordCardTitle: 'Mot de passe', passwordCardDesc: 'Changez votre mot de passe ici.',
    passwordInputPlaceholder: 'Nouveau mot de passe',
    settingsCardTitle: 'Paramètres', settingsCardDesc: 'Configurez vos préférences.',
    simpleHeading: 'Mode simple (piloté par les données)', simpleDesc: 'Utilisation du tableau d\'entrée tabs.',
    simpleTabOverview: 'Aperçu', simpleTabFeatures: 'Fonctionnalités', simpleTabPricing: 'Tarification',
    simpleOverviewContent: 'Voici le contenu de l\'onglet aperçu.',
    simpleFeaturesContent: 'Ce sont les fonctionnalités du produit.',
    simplePricingContent: 'Découvrez nos plans tarifaires.',
    complexHeading: 'Mode complexe (Composants)', complexDesc: 'Rendu de composants avec contexte dans les onglets.',
    helperCardTitle: 'Paramètres du compte', helperCardDesc: 'Gérez les paramètres et préférences de votre compte.',
    helperUsernameLabel: 'Nom d\'utilisateur', helperEmailLabel: 'E-mail', helperSaveBtn: 'Enregistrer les modifications',
  },
  es: {
    code: 'es',
    heading: 'Pestañas', description: 'Componente de navegación por pestañas.',
    tabAccount: 'Cuenta', tabPassword: 'Contraseña', tabSettings: 'Ajustes',
    accountCardTitle: 'Cuenta', accountCardDesc: 'Realiza cambios en tu cuenta aquí.',
    accountInputPlaceholder: 'Tu nombre',
    passwordCardTitle: 'Contraseña', passwordCardDesc: 'Cambia tu contraseña aquí.',
    passwordInputPlaceholder: 'Nueva contraseña',
    settingsCardTitle: 'Ajustes', settingsCardDesc: 'Configura tus preferencias.',
    simpleHeading: 'Modo simple (basado en datos)', simpleDesc: 'Usando el array de entrada tabs.',
    simpleTabOverview: 'Resumen', simpleTabFeatures: 'Características', simpleTabPricing: 'Precios',
    simpleOverviewContent: 'Este es el contenido de la pestaña de resumen.',
    simpleFeaturesContent: 'Estas son las características del producto.',
    simplePricingContent: 'Consulta nuestros planes de precios.',
    complexHeading: 'Modo complejo (Componentes)', complexDesc: 'Renderizado de componentes con datos de contexto.',
    helperCardTitle: 'Configuración de cuenta', helperCardDesc: 'Gestiona la configuración y preferencias de tu cuenta.',
    helperUsernameLabel: 'Nombre de usuario', helperEmailLabel: 'Correo electrónico', helperSaveBtn: 'Guardar cambios',
  },
  ja: {
    code: 'ja',
    heading: 'タブ', description: 'タブナビゲーションコンポーネント。',
    tabAccount: 'アカウント', tabPassword: 'パスワード', tabSettings: '設定',
    accountCardTitle: 'アカウント', accountCardDesc: 'ここでアカウントを変更します。',
    accountInputPlaceholder: 'お名前',
    passwordCardTitle: 'パスワード', passwordCardDesc: 'ここでパスワードを変更します。',
    passwordInputPlaceholder: '新しいパスワード',
    settingsCardTitle: '設定', settingsCardDesc: '設定を構成します。',
    simpleHeading: 'シンプルモード（データ駆動）', simpleDesc: 'コンテンツ投影の代わりにタブ入力配列を使用。',
    simpleTabOverview: '概要', simpleTabFeatures: '機能', simpleTabPricing: '料金',
    simpleOverviewContent: 'これは概要タブのコンテンツです。',
    simpleFeaturesContent: 'これは製品の機能です。',
    simplePricingContent: '料金プランをご確認ください。',
    complexHeading: '複雑モード（コンポーネント）', complexDesc: 'タブ内のコンテキストデータとともにコンポーネントをレンダリング。',
    helperCardTitle: 'アカウント設定', helperCardDesc: 'アカウントの設定と設定を管理します。',
    helperUsernameLabel: 'ユーザー名', helperEmailLabel: 'メールアドレス', helperSaveBtn: '変更を保存',
  },
  zh: {
    code: 'zh',
    heading: '选项卡', description: '选项卡导航组件。',
    tabAccount: '账户', tabPassword: '密码', tabSettings: '设置',
    accountCardTitle: '账户', accountCardDesc: '在此处更改您的账户。',
    accountInputPlaceholder: '您的姓名',
    passwordCardTitle: '密码', passwordCardDesc: '在此处更改您的密码。',
    passwordInputPlaceholder: '新密码',
    settingsCardTitle: '设置', settingsCardDesc: '配置您的偏好设置。',
    simpleHeading: '简单模式（数据驱动）', simpleDesc: '使用选项卡输入数组代替内容投影。',
    simpleTabOverview: '概览', simpleTabFeatures: '功能', simpleTabPricing: '定价',
    simpleOverviewContent: '这是概览选项卡的内容。',
    simpleFeaturesContent: '这些是产品的功能。',
    simplePricingContent: '查看我们的定价方案。',
    complexHeading: '复杂模式（组件）', complexDesc: '在选项卡中渲染组件并传递上下文数据。',
    helperCardTitle: '账户设置', helperCardDesc: '管理您的账户设置和偏好。',
    helperUsernameLabel: '用户名', helperEmailLabel: '电子邮件', helperSaveBtn: '保存更改',
  },
  ru: {
    code: 'ru',
    heading: 'Вкладки', description: 'Компонент навигации по вкладкам.',
    tabAccount: 'Аккаунт', tabPassword: 'Пароль', tabSettings: 'Настройки',
    accountCardTitle: 'Аккаунт', accountCardDesc: 'Внесите изменения в свой аккаунт здесь.',
    accountInputPlaceholder: 'Ваше имя',
    passwordCardTitle: 'Пароль', passwordCardDesc: 'Измените пароль здесь.',
    passwordInputPlaceholder: 'Новый пароль',
    settingsCardTitle: 'Настройки', settingsCardDesc: 'Настройте свои предпочтения.',
    simpleHeading: 'Простой режим (управляемый данными)', simpleDesc: 'Использование входного массива tabs вместо проекции контента.',
    simpleTabOverview: 'Обзор', simpleTabFeatures: 'Функции', simpleTabPricing: 'Цены',
    simpleOverviewContent: 'Это содержимое вкладки обзора.',
    simpleFeaturesContent: 'Это функции продукта.',
    simplePricingContent: 'Ознакомьтесь с нашими тарифными планами.',
    complexHeading: 'Сложный режим (компоненты)', complexDesc: 'Рендеринг компонентов с данными контекста во вкладках.',
    helperCardTitle: 'Настройки аккаунта', helperCardDesc: 'Управляйте настройками и предпочтениями аккаунта.',
    helperUsernameLabel: 'Имя пользователя', helperEmailLabel: 'Эл. почта', helperSaveBtn: 'Сохранить изменения',
  },
  pt: {
    code: 'pt',
    heading: 'Abas', description: 'Componente de navegação por abas.',
    tabAccount: 'Conta', tabPassword: 'Senha', tabSettings: 'Configurações',
    accountCardTitle: 'Conta', accountCardDesc: 'Faça alterações na sua conta aqui.',
    accountInputPlaceholder: 'Seu nome',
    passwordCardTitle: 'Senha', passwordCardDesc: 'Altere sua senha aqui.',
    passwordInputPlaceholder: 'Nova senha',
    settingsCardTitle: 'Configurações', settingsCardDesc: 'Configure suas preferências.',
    simpleHeading: 'Modo simples (baseado em dados)', simpleDesc: 'Usando o array de entrada de abas.',
    simpleTabOverview: 'Visão geral', simpleTabFeatures: 'Funcionalidades', simpleTabPricing: 'Preços',
    simpleOverviewContent: 'Este é o conteúdo da aba de visão geral.',
    simpleFeaturesContent: 'Estas são as funcionalidades do produto.',
    simplePricingContent: 'Confira nossos planos de preços.',
    complexHeading: 'Modo complexo (Componentes)', complexDesc: 'Renderização de componentes com dados de contexto nas abas.',
    helperCardTitle: 'Configurações de conta', helperCardDesc: 'Gerencie as configurações e preferências da sua conta.',
    helperUsernameLabel: 'Nome de usuário', helperEmailLabel: 'E-mail', helperSaveBtn: 'Salvar alterações',
  },
};
