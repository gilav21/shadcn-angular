import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface StepperDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  step1Title: string;
  step1Desc: string;
  step1Content: string;
  continueBtn: string;
  step2Title: string;
  step2Desc: string;
  step2Content: string;
  backBtn: string;
  step3Title: string;
  step3Desc: string;
  step3Content: string;
  heading2: string;
  description2: string;
  step1b: string;
  step1bDesc: string;
  step1bContent: string;
  step2b: string;
  step2bDesc: string;
  step2bContent: string;
  step3b: string;
  step3bDesc: string;
  step3bContent: string;
  simpleHeading: string;
  simpleDesc: string;
  simpleStep1Title: string;
  simpleStep1Desc: string;
  simpleStep2Title: string;
  simpleStep2Desc: string;
  simpleStep3Title: string;
  simpleStep3Desc: string;
}

export const STEPPER_DEMO_LOCALES: Record<string, StepperDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Stepper', description: 'A progress indicator for multi-step forms.',
    step1Title: 'Account', step1Desc: 'Create your account', step1Content: 'Enter your account information...',
    continueBtn: 'Continue',
    step2Title: 'Profile', step2Desc: 'Set up your profile', step2Content: 'Configure your profile settings...',
    backBtn: 'Back',
    step3Title: 'Complete', step3Desc: 'Finish setup', step3Content: 'All done! Your account is ready.',
    heading2: 'Stepper', description2: 'A stepper component to display progress through a sequence of steps.',
    step1b: 'Step 1', step1bDesc: 'Enter details', step1bContent: 'Completed step content',
    step2b: 'Step 2', step2bDesc: 'Review', step2bContent: 'Active step content',
    step3b: 'Step 3', step3bDesc: 'Confirm', step3bContent: 'Inactive step content',
    simpleHeading: 'Simple Mode (Data-driven)', simpleDesc: 'Using the steps input array.',
    simpleStep1Title: 'Personal Info', simpleStep1Desc: 'Name and email',
    simpleStep2Title: 'Account', simpleStep2Desc: 'Setup password',
    simpleStep3Title: 'Review', simpleStep3Desc: 'Check details',
  },
  he: {
    code: 'he', rtl: true,
    heading: 'מדרג שלבים', description: 'מחוון התקדמות לטפסים רב-שלביים.',
    step1Title: 'חשבון', step1Desc: 'צור את חשבונך', step1Content: 'הזן את פרטי החשבון שלך...',
    continueBtn: 'המשך',
    step2Title: 'פרופיל', step2Desc: 'הגדר את הפרופיל שלך', step2Content: 'הגדר את הגדרות הפרופיל שלך...',
    backBtn: 'חזרה',
    step3Title: 'סיום', step3Desc: 'השלם את ההגדרה', step3Content: 'הכל מוכן! החשבון שלך מוכן.',
    heading2: 'מדרג שלבים', description2: 'רכיב מדרג להצגת התקדמות דרך סדרת שלבים.',
    step1b: 'שלב 1', step1bDesc: 'הזן פרטים', step1bContent: 'תוכן שלב שהושלם',
    step2b: 'שלב 2', step2bDesc: 'סקירה', step2bContent: 'תוכן שלב פעיל',
    step3b: 'שלב 3', step3bDesc: 'אישור', step3bContent: 'תוכן שלב לא פעיל',
    simpleHeading: 'מצב פשוט (מונע נתונים)', simpleDesc: 'שימוש במערך הקלט steps.',
    simpleStep1Title: 'פרטים אישיים', simpleStep1Desc: 'שם ואימייל',
    simpleStep2Title: 'חשבון', simpleStep2Desc: 'הגדרת סיסמה',
    simpleStep3Title: 'סקירה', simpleStep3Desc: 'בדוק פרטים',
  },
  ar: {
    code: 'ar', rtl: true,
    heading: 'متدرج الخطوات', description: 'مؤشر تقدم لنماذج متعددة الخطوات.',
    step1Title: 'الحساب', step1Desc: 'إنشاء حسابك', step1Content: 'أدخل معلومات حسابك...',
    continueBtn: 'متابعة',
    step2Title: 'الملف الشخصي', step2Desc: 'إعداد ملفك الشخصي', step2Content: 'قم بتكوين إعدادات ملفك الشخصي...',
    backBtn: 'رجوع',
    step3Title: 'اكتمال', step3Desc: 'إنهاء الإعداد', step3Content: 'تم! حسابك جاهز.',
    heading2: 'متدرج الخطوات', description2: 'مكوّن متدرج لعرض التقدم عبر سلسلة من الخطوات.',
    step1b: 'الخطوة 1', step1bDesc: 'إدخال التفاصيل', step1bContent: 'محتوى الخطوة المكتملة',
    step2b: 'الخطوة 2', step2bDesc: 'مراجعة', step2bContent: 'محتوى الخطوة النشطة',
    step3b: 'الخطوة 3', step3bDesc: 'تأكيد', step3bContent: 'محتوى الخطوة الخاملة',
    simpleHeading: 'الوضع البسيط (مدفوع بالبيانات)', simpleDesc: 'استخدام مصفوفة الإدخال steps.',
    simpleStep1Title: 'المعلومات الشخصية', simpleStep1Desc: 'الاسم والبريد الإلكتروني',
    simpleStep2Title: 'الحساب', simpleStep2Desc: 'إعداد كلمة المرور',
    simpleStep3Title: 'مراجعة', simpleStep3Desc: 'فحص التفاصيل',
  },
  de: {
    code: 'de',
    heading: 'Schrittanzeige', description: 'Ein Fortschrittsindikator für mehrstufige Formulare.',
    step1Title: 'Konto', step1Desc: 'Konto erstellen', step1Content: 'Kontoinformationen eingeben...',
    continueBtn: 'Weiter',
    step2Title: 'Profil', step2Desc: 'Profil einrichten', step2Content: 'Profileinstellungen konfigurieren...',
    backBtn: 'Zurück',
    step3Title: 'Fertig', step3Desc: 'Setup abschließen', step3Content: 'Alles erledigt! Ihr Konto ist bereit.',
    heading2: 'Schrittanzeige', description2: 'Eine Schrittanzeige zur Darstellung des Fortschritts.',
    step1b: 'Schritt 1', step1bDesc: 'Details eingeben', step1bContent: 'Inhalt des abgeschlossenen Schritts',
    step2b: 'Schritt 2', step2bDesc: 'Überprüfen', step2bContent: 'Inhalt des aktiven Schritts',
    step3b: 'Schritt 3', step3bDesc: 'Bestätigen', step3bContent: 'Inhalt des inaktiven Schritts',
    simpleHeading: 'Einfacher Modus (Datengesteuert)', simpleDesc: 'Verwendung des steps-Eingabe-Arrays.',
    simpleStep1Title: 'Persönliche Daten', simpleStep1Desc: 'Name und E-Mail',
    simpleStep2Title: 'Konto', simpleStep2Desc: 'Passwort einrichten',
    simpleStep3Title: 'Überprüfung', simpleStep3Desc: 'Details prüfen',
  },
  fr: {
    code: 'fr',
    heading: 'Indicateur d\'étapes', description: 'Un indicateur de progression pour les formulaires à plusieurs étapes.',
    step1Title: 'Compte', step1Desc: 'Créez votre compte', step1Content: 'Saisissez vos informations de compte...',
    continueBtn: 'Continuer',
    step2Title: 'Profil', step2Desc: 'Configurez votre profil', step2Content: 'Configurez les paramètres de votre profil...',
    backBtn: 'Retour',
    step3Title: 'Terminé', step3Desc: 'Finaliser la configuration', step3Content: 'Tout est prêt ! Votre compte est configuré.',
    heading2: 'Indicateur d\'étapes', description2: 'Un composant pour afficher la progression à travers des étapes.',
    step1b: 'Étape 1', step1bDesc: 'Saisir les détails', step1bContent: 'Contenu de l\'étape complétée',
    step2b: 'Étape 2', step2bDesc: 'Révision', step2bContent: 'Contenu de l\'étape active',
    step3b: 'Étape 3', step3bDesc: 'Confirmation', step3bContent: 'Contenu de l\'étape inactive',
    simpleHeading: 'Mode simple (piloté par les données)', simpleDesc: 'Utilisation du tableau d\'entrée steps.',
    simpleStep1Title: 'Informations personnelles', simpleStep1Desc: 'Nom et e-mail',
    simpleStep2Title: 'Compte', simpleStep2Desc: 'Configurer le mot de passe',
    simpleStep3Title: 'Révision', simpleStep3Desc: 'Vérifier les détails',
  },
  es: {
    code: 'es',
    heading: 'Indicador de pasos', description: 'Un indicador de progreso para formularios de varios pasos.',
    step1Title: 'Cuenta', step1Desc: 'Crea tu cuenta', step1Content: 'Ingresa la información de tu cuenta...',
    continueBtn: 'Continuar',
    step2Title: 'Perfil', step2Desc: 'Configura tu perfil', step2Content: 'Configura los ajustes de tu perfil...',
    backBtn: 'Atrás',
    step3Title: 'Completado', step3Desc: 'Finalizar configuración', step3Content: '¡Todo listo! Tu cuenta está lista.',
    heading2: 'Indicador de pasos', description2: 'Un componente para mostrar el progreso a través de pasos.',
    step1b: 'Paso 1', step1bDesc: 'Ingresar detalles', step1bContent: 'Contenido del paso completado',
    step2b: 'Paso 2', step2bDesc: 'Revisión', step2bContent: 'Contenido del paso activo',
    step3b: 'Paso 3', step3bDesc: 'Confirmación', step3bContent: 'Contenido del paso inactivo',
    simpleHeading: 'Modo simple (basado en datos)', simpleDesc: 'Usando el array de entrada steps.',
    simpleStep1Title: 'Información personal', simpleStep1Desc: 'Nombre y correo',
    simpleStep2Title: 'Cuenta', simpleStep2Desc: 'Configurar contraseña',
    simpleStep3Title: 'Revisión', simpleStep3Desc: 'Verificar detalles',
  },
  ja: {
    code: 'ja',
    heading: 'ステッパー', description: 'マルチステップフォームの進行状況インジケーター。',
    step1Title: 'アカウント', step1Desc: 'アカウントを作成', step1Content: 'アカウント情報を入力してください...',
    continueBtn: '続ける',
    step2Title: 'プロフィール', step2Desc: 'プロフィールを設定', step2Content: 'プロフィール設定を構成してください...',
    backBtn: '戻る',
    step3Title: '完了', step3Desc: 'セットアップを終了', step3Content: '完了！アカウントの準備ができました。',
    heading2: 'ステッパー', description2: 'ステップの進捗を表示するコンポーネント。',
    step1b: 'ステップ 1', step1bDesc: '詳細を入力', step1bContent: '完了したステップのコンテンツ',
    step2b: 'ステップ 2', step2bDesc: '確認', step2bContent: 'アクティブなステップのコンテンツ',
    step3b: 'ステップ 3', step3bDesc: '確認', step3bContent: '非アクティブなステップのコンテンツ',
    simpleHeading: 'シンプルモード（データ駆動）', simpleDesc: 'stepsの入力配列を使用。',
    simpleStep1Title: '個人情報', simpleStep1Desc: '名前とメール',
    simpleStep2Title: 'アカウント', simpleStep2Desc: 'パスワードの設定',
    simpleStep3Title: '確認', simpleStep3Desc: '詳細を確認',
  },
  zh: {
    code: 'zh',
    heading: '步骤指示器', description: '用于多步骤表单的进度指示器。',
    step1Title: '账户', step1Desc: '创建账户', step1Content: '输入账户信息...',
    continueBtn: '继续',
    step2Title: '个人资料', step2Desc: '设置个人资料', step2Content: '配置您的个人资料设置...',
    backBtn: '返回',
    step3Title: '完成', step3Desc: '完成设置', step3Content: '全部完成！您的账户已就绪。',
    heading2: '步骤指示器', description2: '显示步骤进度的组件。',
    step1b: '第 1 步', step1bDesc: '输入详情', step1bContent: '已完成步骤内容',
    step2b: '第 2 步', step2bDesc: '审阅', step2bContent: '活动步骤内容',
    step3b: '第 3 步', step3bDesc: '确认', step3bContent: '非活动步骤内容',
    simpleHeading: '简单模式（数据驱动）', simpleDesc: '使用 steps 输入数组。',
    simpleStep1Title: '个人信息', simpleStep1Desc: '姓名和邮箱',
    simpleStep2Title: '账户', simpleStep2Desc: '设置密码',
    simpleStep3Title: '审阅', simpleStep3Desc: '核实详情',
  },
  ru: {
    code: 'ru',
    heading: 'Индикатор шагов', description: 'Индикатор прогресса для многошаговых форм.',
    step1Title: 'Аккаунт', step1Desc: 'Создать аккаунт', step1Content: 'Введите данные аккаунта...',
    continueBtn: 'Продолжить',
    step2Title: 'Профиль', step2Desc: 'Настройте профиль', step2Content: 'Настройте параметры профиля...',
    backBtn: 'Назад',
    step3Title: 'Готово', step3Desc: 'Завершить настройку', step3Content: 'Всё готово! Ваш аккаунт создан.',
    heading2: 'Индикатор шагов', description2: 'Компонент для отображения прогресса через последовательность шагов.',
    step1b: 'Шаг 1', step1bDesc: 'Ввод данных', step1bContent: 'Содержимое завершённого шага',
    step2b: 'Шаг 2', step2bDesc: 'Проверка', step2bContent: 'Содержимое активного шага',
    step3b: 'Шаг 3', step3bDesc: 'Подтверждение', step3bContent: 'Содержимое неактивного шага',
    simpleHeading: 'Простой режим (управляемый данными)', simpleDesc: 'Использование входного массива steps.',
    simpleStep1Title: 'Личные данные', simpleStep1Desc: 'Имя и электронная почта',
    simpleStep2Title: 'Аккаунт', simpleStep2Desc: 'Настройка пароля',
    simpleStep3Title: 'Проверка', simpleStep3Desc: 'Проверить данные',
  },
  pt: {
    code: 'pt',
    heading: 'Indicador de etapas', description: 'Um indicador de progresso para formulários de várias etapas.',
    step1Title: 'Conta', step1Desc: 'Crie sua conta', step1Content: 'Insira as informações da sua conta...',
    continueBtn: 'Continuar',
    step2Title: 'Perfil', step2Desc: 'Configure seu perfil', step2Content: 'Configure as preferências do seu perfil...',
    backBtn: 'Voltar',
    step3Title: 'Concluído', step3Desc: 'Finalizar configuração', step3Content: 'Tudo pronto! Sua conta está configurada.',
    heading2: 'Indicador de etapas', description2: 'Um componente para exibir o progresso através de etapas.',
    step1b: 'Etapa 1', step1bDesc: 'Inserir detalhes', step1bContent: 'Conteúdo da etapa concluída',
    step2b: 'Etapa 2', step2bDesc: 'Revisão', step2bContent: 'Conteúdo da etapa ativa',
    step3b: 'Etapa 3', step3bDesc: 'Confirmação', step3bContent: 'Conteúdo da etapa inativa',
    simpleHeading: 'Modo simples (baseado em dados)', simpleDesc: 'Usando o array de entrada steps.',
    simpleStep1Title: 'Informações pessoais', simpleStep1Desc: 'Nome e e-mail',
    simpleStep2Title: 'Conta', simpleStep2Desc: 'Configurar senha',
    simpleStep3Title: 'Revisão', simpleStep3Desc: 'Verificar detalhes',
  },
};
