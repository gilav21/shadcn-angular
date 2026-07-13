import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface ShortcutBindingsDialogDemoLocale extends LocaleMeta {
  heading: string;
  description: string;

  basicHeading: string;
  basicDesc: string;
  openButton: string;
  kbdHintPrefix: string;
  kbdHintKey: string;
  kbdHintSuffix: string;
  platformLabel: string;
  platformDesc: string;

  catalogHeading: string;
  catalogDesc: string;
  colAction: string;
  colCategory: string;
  colComponent: string;
  colDefault: string;
  colEffective: string;
  colInstances: string;

  tryHeading: string;
  tryDesc: string;
  surfaceHint: string;
  lastActionLabel: string;
  noActionYet: string;

  mappingHeading: string;
  mappingDesc: string;
  openMappingButton: string;
  loadSampleButton: string;
  resetButton: string;
  savedLabel: string;
  notSavedLabel: string;

  localeHeading: string;
  localeDesc: string;
  openLocalizedButton: string;
  customSearchPlaceholder: string;
  customConflict: string;
  customRebindAll: string;
  customRebindInstance: string;

  catEditor: string;
  catData: string;
  catApp: string;

  actBold: string;
  actItalic: string;
  actSave: string;
  actSearch: string;
  actExport: string;
  actShortcuts: string;
  actPing: string;
}

export const SHORTCUT_BINDINGS_DIALOG_DEMO_LOCALES: Record<string, ShortcutBindingsDialogDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Shortcut Bindings Dialog',
    description: 'A ready-made settings surface for every keyboard shortcut registered with ShortcutBindingService. Users can search actions, rebind a key for all instances of a component or for a single instance, spot conflicts, and export or import their mapping.',

    basicHeading: 'Open the manager',
    basicDesc: 'Bind [(open)] to a signal and toggle it from a button — or from a shortcut you register yourself.',
    openButton: 'Manage shortcuts',
    kbdHintPrefix: 'You can also press',
    kbdHintKey: 'Shift + ?',
    kbdHintSuffix: 'anywhere on this page. The button does exactly the same thing, so touch users are never locked out.',
    platformLabel: 'Platform-aware keys',
    platformDesc: 'Register "Mod+K" once — the service resolves it to Cmd on macOS and Ctrl everywhere else. On this device it renders as:',

    catalogHeading: 'What the dialog shows',
    catalogDesc: 'This demo registers three component groups, each with its own category. The dialog groups them by component, lists every instance, and highlights conflicting keys.',
    colAction: 'Action',
    colCategory: 'Category',
    colComponent: 'Component',
    colDefault: 'Default',
    colEffective: 'Effective',
    colInstances: 'Instances',

    tryHeading: 'See a rebind take effect',
    tryDesc: 'Rebind an editor action in the dialog, then trigger it here — the surface below dispatches shortcuts scoped to the first editor instance.',
    surfaceHint: 'Click here to focus, then press an editor shortcut (Mod+B, Mod+I, Mod+S).',
    lastActionLabel: 'Last action:',
    noActionYet: 'Nothing triggered yet.',

    mappingHeading: 'Export and import a mapping',
    mappingDesc: 'With [allowSaveMapping] the dialog shows a save button that emits the current overrides through (mappingSave). Feed a schema back in through [mappingSchema] to restore it.',
    openMappingButton: 'Open with save enabled',
    loadSampleButton: 'Load sample mapping',
    resetButton: 'Reset all overrides',
    savedLabel: 'Last exported mapping:',
    notSavedLabel: 'No mapping exported yet — open the dialog, rebind something, and press Save.',

    localeHeading: 'Custom wording',
    localeDesc: 'Pass a dictionary to [locale] to override the dialog\'s own strings (search placeholder, conflict badge, rebind aria-labels) without touching the component source.',
    openLocalizedButton: 'Open with custom wording',
    customSearchPlaceholder: 'Filter this workspace\'s shortcuts...',
    customConflict: 'Clash',
    customRebindAll: 'Change the key for every {binding}',
    customRebindInstance: 'Change the key of {name} for {binding}',

    catEditor: 'Editor',
    catData: 'Data',
    catApp: 'Application',

    actBold: 'Bold selection',
    actItalic: 'Italicize selection',
    actSave: 'Save document',
    actSearch: 'Search table rows',
    actExport: 'Export table to CSV',
    actShortcuts: 'Open shortcut manager',
    actPing: 'Log a demo event',
  },

  he: {
    code: 'he', rtl: true,
    heading: 'דיאלוג קיצורי מקלדת',
    description: 'מסך הגדרות מוכן לכל קיצור מקלדת שנרשם ב-ShortcutBindingService. משתמשים יכולים לחפש פעולות, למפות מחדש מקש לכל המופעים של רכיב או למופע יחיד, לזהות התנגשויות ולייצא או לייבא את המיפוי.',

    basicHeading: 'פתיחת המנהל',
    basicDesc: 'קשרו [(open)] לסיגנל והחליפו את מצבו מכפתור — או מקיצור שאתם רושמים בעצמכם.',
    openButton: 'ניהול קיצורים',
    kbdHintPrefix: 'אפשר גם ללחוץ',
    kbdHintKey: 'Shift + ?',
    kbdHintSuffix: 'בכל מקום בדף. הכפתור עושה בדיוק את אותו הדבר, כך שמשתמשי מגע לעולם אינם נחסמים.',
    platformLabel: 'מקשים מותאמי פלטפורמה',
    platformDesc: 'רשמו "Mod+K" פעם אחת — השירות מתרגם אותו ל-Cmd ב-macOS ול-Ctrl בכל מקום אחר. במכשיר הזה הוא מוצג כך:',

    catalogHeading: 'מה הדיאלוג מציג',
    catalogDesc: 'הדמו רושם שלוש קבוצות רכיבים, לכל אחת קטגוריה משלה. הדיאלוג מקבץ אותן לפי רכיב, מציג כל מופע ומדגיש מקשים מתנגשים.',
    colAction: 'פעולה',
    colCategory: 'קטגוריה',
    colComponent: 'רכיב',
    colDefault: 'ברירת מחדל',
    colEffective: 'בפועל',
    colInstances: 'מופעים',

    tryHeading: 'לראות מיפוי מחדש בפעולה',
    tryDesc: 'מפו מחדש פעולת עורך בדיאלוג ואז הפעילו אותה כאן — המשטח שלמטה שולח קיצורים בהיקף המופע הראשון של העורך.',
    surfaceHint: 'לחצו כאן למיקוד, ואז הקישו קיצור של העורך (Mod+B, Mod+I, Mod+S).',
    lastActionLabel: 'הפעולה האחרונה:',
    noActionYet: 'עדיין לא הופעלה פעולה.',

    mappingHeading: 'ייצוא וייבוא מיפוי',
    mappingDesc: 'עם [allowSaveMapping] הדיאלוג מציג כפתור שמירה שמשדר את ההגדרות הנוכחיות דרך (mappingSave). החזירו סכימה דרך [mappingSchema] כדי לשחזר אותה.',
    openMappingButton: 'פתיחה עם שמירה מופעלת',
    loadSampleButton: 'טעינת מיפוי לדוגמה',
    resetButton: 'איפוס כל ההגדרות',
    savedLabel: 'המיפוי האחרון שיוצא:',
    notSavedLabel: 'עדיין לא יוצא מיפוי — פתחו את הדיאלוג, מפו משהו מחדש ולחצו שמירה.',

    localeHeading: 'ניסוח מותאם אישית',
    localeDesc: 'העבירו מילון ל-[locale] כדי לדרוס את מחרוזות הדיאלוג (מציין החיפוש, תג ההתנגשות ותוויות הנגישות) בלי לגעת בקוד הרכיב.',
    openLocalizedButton: 'פתיחה עם ניסוח מותאם',
    customSearchPlaceholder: '...סינון הקיצורים של סביבת העבודה',
    customConflict: 'התנגשות מקשים',
    customRebindAll: 'שינוי המקש עבור כל {binding}',
    customRebindInstance: 'שינוי המקש של {name} עבור {binding}',

    catEditor: 'עורך',
    catData: 'נתונים',
    catApp: 'אפליקציה',

    actBold: 'הדגשת הבחירה',
    actItalic: 'הטיית הבחירה',
    actSave: 'שמירת המסמך',
    actSearch: 'חיפוש בשורות הטבלה',
    actExport: 'ייצוא הטבלה ל-CSV',
    actShortcuts: 'פתיחת מנהל הקיצורים',
    actPing: 'רישום אירוע לדוגמה',
  },

  ar: {
    code: 'ar', rtl: true,
    heading: 'مربع حوار اختصارات لوحة المفاتيح',
    description: 'واجهة إعدادات جاهزة لكل اختصار مسجَّل في ShortcutBindingService. يمكن للمستخدمين البحث عن الإجراءات، وإعادة ربط مفتاح لجميع نُسخ مكوّن أو لنسخة واحدة، واكتشاف التعارضات، وتصدير أو استيراد التعيينات.',

    basicHeading: 'فتح المدير',
    basicDesc: 'اربط [(open)] بإشارة وبدّلها من زر — أو من اختصار تسجّله بنفسك.',
    openButton: 'إدارة الاختصارات',
    kbdHintPrefix: 'يمكنك أيضاً الضغط على',
    kbdHintKey: 'Shift + ?',
    kbdHintSuffix: 'في أي مكان بالصفحة. الزر يقوم بالأمر نفسه تماماً، لذا لا يُستبعد مستخدمو اللمس أبداً.',
    platformLabel: 'مفاتيح مدركة للنظام',
    platformDesc: 'سجّل "Mod+K" مرة واحدة — تحوّلها الخدمة إلى Cmd على macOS وإلى Ctrl في غيرها. على هذا الجهاز تظهر هكذا:',

    catalogHeading: 'ما يعرضه مربع الحوار',
    catalogDesc: 'يسجّل هذا العرض ثلاث مجموعات مكوّنات، لكل منها فئة. يجمعها مربع الحوار حسب المكوّن، ويسرد كل نسخة، ويبرز المفاتيح المتعارضة.',
    colAction: 'الإجراء',
    colCategory: 'الفئة',
    colComponent: 'المكوّن',
    colDefault: 'الافتراضي',
    colEffective: 'الفعلي',
    colInstances: 'النُسخ',

    tryHeading: 'شاهد إعادة الربط وهي تعمل',
    tryDesc: 'أعد ربط إجراء في المحرر داخل مربع الحوار ثم شغّله هنا — يرسل السطح أدناه الاختصارات ضمن نطاق نسخة المحرر الأولى.',
    surfaceHint: 'انقر هنا للتركيز، ثم اضغط اختصار محرر (Mod+B أو Mod+I أو Mod+S).',
    lastActionLabel: 'آخر إجراء:',
    noActionYet: 'لم يُشغَّل أي إجراء بعد.',

    mappingHeading: 'تصدير التعيينات واستيرادها',
    mappingDesc: 'مع [allowSaveMapping] يعرض مربع الحوار زر حفظ يُصدر التعديلات الحالية عبر (mappingSave). أعِد تمرير المخطط عبر [mappingSchema] لاستعادته.',
    openMappingButton: 'فتح مع تفعيل الحفظ',
    loadSampleButton: 'تحميل تعيين نموذجي',
    resetButton: 'إعادة تعيين كل التعديلات',
    savedLabel: 'آخر تعيين مُصدَّر:',
    notSavedLabel: 'لم يُصدَّر أي تعيين بعد — افتح مربع الحوار وأعد ربط شيء ثم اضغط حفظ.',

    localeHeading: 'صياغة مخصّصة',
    localeDesc: 'مرّر قاموساً إلى [locale] لتجاوز نصوص مربع الحوار (نص البحث، شارة التعارض، تسميات الوصول) دون تعديل مصدر المكوّن.',
    openLocalizedButton: 'فتح بصياغة مخصّصة',
    customSearchPlaceholder: '...تصفية اختصارات مساحة العمل',
    customConflict: 'تضارب',
    customRebindAll: 'تغيير المفتاح لكل {binding}',
    customRebindInstance: 'تغيير مفتاح {name} لـ {binding}',

    catEditor: 'المحرر',
    catData: 'البيانات',
    catApp: 'التطبيق',

    actBold: 'تغميق التحديد',
    actItalic: 'إمالة التحديد',
    actSave: 'حفظ المستند',
    actSearch: 'البحث في صفوف الجدول',
    actExport: 'تصدير الجدول إلى CSV',
    actShortcuts: 'فتح مدير الاختصارات',
    actPing: 'تسجيل حدث تجريبي',
  },

  de: {
    code: 'de',
    heading: 'Tastenkürzel-Dialog',
    description: 'Eine fertige Einstellungsoberfläche für jedes im ShortcutBindingService registrierte Tastenkürzel. Nutzer können Aktionen suchen, eine Taste für alle Instanzen einer Komponente oder für eine einzelne Instanz neu zuweisen, Konflikte erkennen und ihre Zuordnung exportieren oder importieren.',

    basicHeading: 'Den Manager öffnen',
    basicDesc: 'Binden Sie [(open)] an ein Signal und schalten Sie es per Schaltfläche um — oder per selbst registriertem Kürzel.',
    openButton: 'Kürzel verwalten',
    kbdHintPrefix: 'Sie können auch',
    kbdHintKey: 'Shift + ?',
    kbdHintSuffix: 'irgendwo auf dieser Seite drücken. Die Schaltfläche macht genau dasselbe, damit Touch-Nutzer nie ausgesperrt werden.',
    platformLabel: 'Plattformabhängige Tasten',
    platformDesc: 'Registrieren Sie "Mod+K" einmal — der Service löst es unter macOS zu Cmd und sonst zu Ctrl auf. Auf diesem Gerät erscheint es als:',

    catalogHeading: 'Was der Dialog zeigt',
    catalogDesc: 'Diese Demo registriert drei Komponentengruppen mit jeweils eigener Kategorie. Der Dialog gruppiert sie nach Komponente, listet jede Instanz auf und hebt kollidierende Tasten hervor.',
    colAction: 'Aktion',
    colCategory: 'Kategorie',
    colComponent: 'Komponente',
    colDefault: 'Standard',
    colEffective: 'Aktiv',
    colInstances: 'Instanzen',

    tryHeading: 'Eine Neuzuweisung in Aktion',
    tryDesc: 'Weisen Sie eine Editor-Aktion im Dialog neu zu und lösen Sie sie hier aus — die Fläche unten sendet Kürzel im Kontext der ersten Editor-Instanz.',
    surfaceHint: 'Hier klicken, um zu fokussieren, dann ein Editor-Kürzel drücken (Mod+B, Mod+I, Mod+S).',
    lastActionLabel: 'Letzte Aktion:',
    noActionYet: 'Noch nichts ausgelöst.',

    mappingHeading: 'Zuordnung exportieren und importieren',
    mappingDesc: 'Mit [allowSaveMapping] zeigt der Dialog eine Speichern-Schaltfläche, die die aktuellen Überschreibungen über (mappingSave) ausgibt. Über [mappingSchema] spielen Sie ein Schema wieder ein.',
    openMappingButton: 'Mit Speichern öffnen',
    loadSampleButton: 'Beispielzuordnung laden',
    resetButton: 'Alle Überschreibungen zurücksetzen',
    savedLabel: 'Zuletzt exportierte Zuordnung:',
    notSavedLabel: 'Noch keine Zuordnung exportiert — Dialog öffnen, etwas neu zuweisen und Speichern drücken.',

    localeHeading: 'Eigene Formulierungen',
    localeDesc: 'Übergeben Sie ein Wörterbuch an [locale], um die Texte des Dialogs (Suchfeld, Konflikt-Badge, ARIA-Labels) zu überschreiben, ohne den Komponentencode anzufassen.',
    openLocalizedButton: 'Mit eigenen Texten öffnen',
    customSearchPlaceholder: 'Kürzel dieses Arbeitsbereichs filtern...',
    customConflict: 'Kollision',
    customRebindAll: 'Taste für jedes {binding} ändern',
    customRebindInstance: 'Taste von {name} für {binding} ändern',

    catEditor: 'Editor',
    catData: 'Daten',
    catApp: 'Anwendung',

    actBold: 'Auswahl fett',
    actItalic: 'Auswahl kursiv',
    actSave: 'Dokument speichern',
    actSearch: 'Tabellenzeilen durchsuchen',
    actExport: 'Tabelle als CSV exportieren',
    actShortcuts: 'Kürzel-Manager öffnen',
    actPing: 'Demo-Ereignis protokollieren',
  },

  fr: {
    code: 'fr',
    heading: 'Boîte de dialogue des raccourcis',
    description: 'Une interface de réglages prête à l\'emploi pour chaque raccourci enregistré dans ShortcutBindingService. Les utilisateurs peuvent rechercher des actions, réassocier une touche pour toutes les instances d\'un composant ou pour une seule, repérer les conflits et exporter ou importer leur configuration.',

    basicHeading: 'Ouvrir le gestionnaire',
    basicDesc: 'Liez [(open)] à un signal et basculez-le depuis un bouton — ou depuis un raccourci que vous enregistrez vous-même.',
    openButton: 'Gérer les raccourcis',
    kbdHintPrefix: 'Vous pouvez aussi appuyer sur',
    kbdHintKey: 'Shift + ?',
    kbdHintSuffix: 'n\'importe où sur cette page. Le bouton fait exactement la même chose : les utilisateurs tactiles ne sont jamais bloqués.',
    platformLabel: 'Touches adaptées à la plateforme',
    platformDesc: 'Enregistrez « Mod+K » une seule fois — le service le résout en Cmd sur macOS et en Ctrl ailleurs. Sur cet appareil il s\'affiche ainsi :',

    catalogHeading: 'Ce que la boîte de dialogue affiche',
    catalogDesc: 'Cette démo enregistre trois groupes de composants, chacun avec sa catégorie. La boîte de dialogue les regroupe par composant, liste chaque instance et met en évidence les touches en conflit.',
    colAction: 'Action',
    colCategory: 'Catégorie',
    colComponent: 'Composant',
    colDefault: 'Par défaut',
    colEffective: 'Effectif',
    colInstances: 'Instances',

    tryHeading: 'Voir une réassociation prendre effet',
    tryDesc: 'Réassociez une action d\'éditeur dans la boîte de dialogue, puis déclenchez-la ici — la surface ci-dessous envoie les raccourcis dans le contexte de la première instance d\'éditeur.',
    surfaceHint: 'Cliquez ici pour donner le focus, puis appuyez sur un raccourci d\'éditeur (Mod+B, Mod+I, Mod+S).',
    lastActionLabel: 'Dernière action :',
    noActionYet: 'Rien n\'a encore été déclenché.',

    mappingHeading: 'Exporter et importer une configuration',
    mappingDesc: 'Avec [allowSaveMapping], la boîte de dialogue affiche un bouton d\'enregistrement qui émet les remplacements courants via (mappingSave). Réinjectez un schéma via [mappingSchema] pour le restaurer.',
    openMappingButton: 'Ouvrir avec l\'enregistrement activé',
    loadSampleButton: 'Charger un exemple',
    resetButton: 'Réinitialiser tous les remplacements',
    savedLabel: 'Dernière configuration exportée :',
    notSavedLabel: 'Aucune configuration exportée — ouvrez la boîte de dialogue, réassociez une touche et enregistrez.',

    localeHeading: 'Formulation personnalisée',
    localeDesc: 'Passez un dictionnaire à [locale] pour remplacer les textes de la boîte de dialogue (champ de recherche, badge de conflit, libellés ARIA) sans toucher au code du composant.',
    openLocalizedButton: 'Ouvrir avec des textes personnalisés',
    customSearchPlaceholder: 'Filtrer les raccourcis de cet espace de travail...',
    customConflict: 'Collision',
    customRebindAll: 'Changer la touche de chaque {binding}',
    customRebindInstance: 'Changer la touche de {name} pour {binding}',

    catEditor: 'Éditeur',
    catData: 'Données',
    catApp: 'Application',

    actBold: 'Mettre la sélection en gras',
    actItalic: 'Mettre la sélection en italique',
    actSave: 'Enregistrer le document',
    actSearch: 'Rechercher dans les lignes du tableau',
    actExport: 'Exporter le tableau en CSV',
    actShortcuts: 'Ouvrir le gestionnaire de raccourcis',
    actPing: 'Journaliser un événement de démo',
  },

  es: {
    code: 'es',
    heading: 'Diálogo de atajos de teclado',
    description: 'Una pantalla de ajustes lista para usar con todos los atajos registrados en ShortcutBindingService. Los usuarios pueden buscar acciones, reasignar una tecla para todas las instancias de un componente o para una sola, detectar conflictos y exportar o importar su configuración.',

    basicHeading: 'Abrir el gestor',
    basicDesc: 'Vincule [(open)] a una señal y altérnela desde un botón — o desde un atajo que registre usted mismo.',
    openButton: 'Gestionar atajos',
    kbdHintPrefix: 'También puede pulsar',
    kbdHintKey: 'Shift + ?',
    kbdHintSuffix: 'en cualquier parte de esta página. El botón hace exactamente lo mismo, así que los usuarios táctiles nunca quedan excluidos.',
    platformLabel: 'Teclas según la plataforma',
    platformDesc: 'Registre "Mod+K" una vez: el servicio lo resuelve como Cmd en macOS y como Ctrl en el resto. En este dispositivo se muestra así:',

    catalogHeading: 'Qué muestra el diálogo',
    catalogDesc: 'Esta demo registra tres grupos de componentes, cada uno con su categoría. El diálogo los agrupa por componente, lista cada instancia y resalta las teclas en conflicto.',
    colAction: 'Acción',
    colCategory: 'Categoría',
    colComponent: 'Componente',
    colDefault: 'Predeterminado',
    colEffective: 'Efectivo',
    colInstances: 'Instancias',

    tryHeading: 'Ver una reasignación en acción',
    tryDesc: 'Reasigne una acción del editor en el diálogo y actívela aquí: la superficie de abajo despacha atajos en el ámbito de la primera instancia del editor.',
    surfaceHint: 'Haga clic aquí para enfocar y pulse un atajo del editor (Mod+B, Mod+I, Mod+S).',
    lastActionLabel: 'Última acción:',
    noActionYet: 'Todavía no se ha activado nada.',

    mappingHeading: 'Exportar e importar una configuración',
    mappingDesc: 'Con [allowSaveMapping] el diálogo muestra un botón de guardado que emite las sobrescrituras actuales mediante (mappingSave). Devuelva un esquema por [mappingSchema] para restaurarlo.',
    openMappingButton: 'Abrir con guardado activado',
    loadSampleButton: 'Cargar configuración de ejemplo',
    resetButton: 'Restablecer todas las sobrescrituras',
    savedLabel: 'Última configuración exportada:',
    notSavedLabel: 'Aún no se ha exportado nada: abra el diálogo, reasigne algo y pulse Guardar.',

    localeHeading: 'Textos personalizados',
    localeDesc: 'Pase un diccionario a [locale] para sustituir los textos del diálogo (marcador de búsqueda, insignia de conflicto, etiquetas ARIA) sin tocar el código del componente.',
    openLocalizedButton: 'Abrir con textos personalizados',
    customSearchPlaceholder: 'Filtrar los atajos de este espacio de trabajo...',
    customConflict: 'Choque',
    customRebindAll: 'Cambiar la tecla de cada {binding}',
    customRebindInstance: 'Cambiar la tecla de {name} para {binding}',

    catEditor: 'Editor',
    catData: 'Datos',
    catApp: 'Aplicación',

    actBold: 'Poner la selección en negrita',
    actItalic: 'Poner la selección en cursiva',
    actSave: 'Guardar el documento',
    actSearch: 'Buscar filas de la tabla',
    actExport: 'Exportar la tabla a CSV',
    actShortcuts: 'Abrir el gestor de atajos',
    actPing: 'Registrar un evento de demostración',
  },

  ja: {
    code: 'ja',
    heading: 'ショートカット設定ダイアログ',
    description: 'ShortcutBindingService に登録されたすべてのキーボードショートカットを管理する設定画面です。アクションの検索、コンポーネントの全インスタンスまたは単一インスタンスへのキー再割り当て、競合の確認、マッピングのエクスポート／インポートが行えます。',

    basicHeading: 'マネージャーを開く',
    basicDesc: '[(open)] をシグナルにバインドし、ボタン（または自分で登録したショートカット）から切り替えます。',
    openButton: 'ショートカットを管理',
    kbdHintPrefix: '次のキーでも開けます:',
    kbdHintKey: 'Shift + ?',
    kbdHintSuffix: 'ページ内のどこでも有効です。ボタンでもまったく同じ操作ができるため、タッチ操作のユーザーが締め出されることはありません。',
    platformLabel: 'プラットフォーム対応キー',
    platformDesc: '「Mod+K」を一度登録すれば、macOS では Cmd、その他では Ctrl として解決されます。この端末での表示:',

    catalogHeading: 'ダイアログに表示される内容',
    catalogDesc: 'このデモは 3 つのコンポーネントグループを、それぞれ独自のカテゴリで登録します。ダイアログはコンポーネントごとにグループ化し、各インスタンスを一覧表示し、競合するキーを強調します。',
    colAction: 'アクション',
    colCategory: 'カテゴリ',
    colComponent: 'コンポーネント',
    colDefault: '既定',
    colEffective: '現在',
    colInstances: 'インスタンス',

    tryHeading: '再割り当ての効果を確認',
    tryDesc: 'ダイアログでエディターのアクションを再割り当てし、ここで実行してください。下の領域は最初のエディターインスタンスのスコープでショートカットをディスパッチします。',
    surfaceHint: 'ここをクリックしてフォーカスし、エディターのショートカット（Mod+B、Mod+I、Mod+S）を押してください。',
    lastActionLabel: '最後のアクション:',
    noActionYet: 'まだ何も実行されていません。',

    mappingHeading: 'マッピングのエクスポートとインポート',
    mappingDesc: '[allowSaveMapping] を有効にすると保存ボタンが表示され、現在の上書き設定が (mappingSave) から出力されます。[mappingSchema] にスキーマを渡すと復元できます。',
    openMappingButton: '保存を有効にして開く',
    loadSampleButton: 'サンプルマッピングを読み込む',
    resetButton: 'すべての上書きをリセット',
    savedLabel: '最後にエクスポートしたマッピング:',
    notSavedLabel: 'まだエクスポートされていません。ダイアログを開き、再割り当てして保存を押してください。',

    localeHeading: '文言のカスタマイズ',
    localeDesc: '[locale] に辞書を渡すと、コンポーネントのソースを変更せずにダイアログの文言（検索プレースホルダー、競合バッジ、ARIA ラベル）を上書きできます。',
    openLocalizedButton: 'カスタム文言で開く',
    customSearchPlaceholder: 'このワークスペースのショートカットを絞り込む...',
    customConflict: '重複',
    customRebindAll: 'すべての {binding} のキーを変更',
    customRebindInstance: '{binding} のインスタンス {name} のキーを変更',

    catEditor: 'エディター',
    catData: 'データ',
    catApp: 'アプリケーション',

    actBold: '選択範囲を太字にする',
    actItalic: '選択範囲を斜体にする',
    actSave: 'ドキュメントを保存',
    actSearch: 'テーブルの行を検索',
    actExport: 'テーブルを CSV にエクスポート',
    actShortcuts: 'ショートカット管理を開く',
    actPing: 'デモイベントを記録',
  },

  zh: {
    code: 'zh',
    heading: '快捷键绑定对话框',
    description: '为 ShortcutBindingService 中注册的所有快捷键提供的现成设置界面。用户可以搜索操作，为组件的所有实例或单个实例重新绑定按键，发现冲突，并导出或导入自己的映射。',

    basicHeading: '打开管理器',
    basicDesc: '将 [(open)] 绑定到信号，并通过按钮（或你自己注册的快捷键）切换它。',
    openButton: '管理快捷键',
    kbdHintPrefix: '你也可以按',
    kbdHintKey: 'Shift + ?',
    kbdHintSuffix: '在本页任意位置生效。按钮的作用完全相同，因此触摸设备用户不会被排除在外。',
    platformLabel: '平台感知按键',
    platformDesc: '只需注册一次 “Mod+K” — 服务会在 macOS 上解析为 Cmd，在其他系统上解析为 Ctrl。在本设备上显示为：',

    catalogHeading: '对话框显示的内容',
    catalogDesc: '本示例注册了三个组件分组，每组都有各自的类别。对话框按组件分组，列出每个实例，并高亮冲突的按键。',
    colAction: '操作',
    colCategory: '类别',
    colComponent: '组件',
    colDefault: '默认',
    colEffective: '生效',
    colInstances: '实例',

    tryHeading: '查看重新绑定的效果',
    tryDesc: '在对话框中重新绑定一个编辑器操作，然后在这里触发它 — 下方区域会在第一个编辑器实例的作用域内派发快捷键。',
    surfaceHint: '点击此处获取焦点，然后按下编辑器快捷键（Mod+B、Mod+I、Mod+S）。',
    lastActionLabel: '最近的操作：',
    noActionYet: '尚未触发任何操作。',

    mappingHeading: '导出与导入映射',
    mappingDesc: '设置 [allowSaveMapping] 后，对话框会显示保存按钮，通过 (mappingSave) 发出当前的覆盖配置。通过 [mappingSchema] 回传架构即可恢复。',
    openMappingButton: '启用保存并打开',
    loadSampleButton: '加载示例映射',
    resetButton: '重置所有覆盖',
    savedLabel: '最近导出的映射：',
    notSavedLabel: '尚未导出映射 — 打开对话框，重新绑定后点击保存。',

    localeHeading: '自定义文案',
    localeDesc: '向 [locale] 传入字典即可覆盖对话框自身的文案（搜索占位符、冲突徽章、无障碍标签），无需修改组件源码。',
    openLocalizedButton: '使用自定义文案打开',
    customSearchPlaceholder: '筛选此工作区的快捷键...',
    customConflict: '按键冲突',
    customRebindAll: '更改每个 {binding} 的按键',
    customRebindInstance: '更改 {binding} 中实例 {name} 的按键',

    catEditor: '编辑器',
    catData: '数据',
    catApp: '应用',

    actBold: '将所选内容加粗',
    actItalic: '将所选内容设为斜体',
    actSave: '保存文档',
    actSearch: '搜索表格行',
    actExport: '将表格导出为 CSV',
    actShortcuts: '打开快捷键管理器',
    actPing: '记录一个示例事件',
  },

  ru: {
    code: 'ru',
    heading: 'Диалог назначения горячих клавиш',
    description: 'Готовый экран настроек для всех сочетаний клавиш, зарегистрированных в ShortcutBindingService. Пользователи могут искать действия, переназначать клавишу для всех экземпляров компонента или для одного, находить конфликты и экспортировать либо импортировать свою схему.',

    basicHeading: 'Открыть менеджер',
    basicDesc: 'Свяжите [(open)] с сигналом и переключайте его кнопкой — или сочетанием клавиш, которое вы зарегистрируете сами.',
    openButton: 'Управление сочетаниями',
    kbdHintPrefix: 'Можно также нажать',
    kbdHintKey: 'Shift + ?',
    kbdHintSuffix: 'в любом месте страницы. Кнопка делает то же самое, поэтому пользователи сенсорных экранов ничего не теряют.',
    platformLabel: 'Клавиши с учётом платформы',
    platformDesc: 'Зарегистрируйте «Mod+K» один раз — сервис превратит его в Cmd на macOS и в Ctrl на остальных системах. На этом устройстве отображается так:',

    catalogHeading: 'Что показывает диалог',
    catalogDesc: 'Это демо регистрирует три группы компонентов, у каждой своя категория. Диалог группирует их по компоненту, перечисляет каждый экземпляр и подсвечивает конфликтующие клавиши.',
    colAction: 'Действие',
    colCategory: 'Категория',
    colComponent: 'Компонент',
    colDefault: 'По умолчанию',
    colEffective: 'Действующее',
    colInstances: 'Экземпляры',

    tryHeading: 'Посмотрите, как работает переназначение',
    tryDesc: 'Переназначьте действие редактора в диалоге, затем вызовите его здесь — область ниже отправляет сочетания в контексте первого экземпляра редактора.',
    surfaceHint: 'Нажмите здесь для фокуса, затем нажмите сочетание редактора (Mod+B, Mod+I, Mod+S).',
    lastActionLabel: 'Последнее действие:',
    noActionYet: 'Пока ничего не вызвано.',

    mappingHeading: 'Экспорт и импорт схемы',
    mappingDesc: 'С [allowSaveMapping] диалог показывает кнопку сохранения, которая отдаёт текущие переопределения через (mappingSave). Передайте схему обратно через [mappingSchema], чтобы восстановить её.',
    openMappingButton: 'Открыть с сохранением',
    loadSampleButton: 'Загрузить пример схемы',
    resetButton: 'Сбросить все переопределения',
    savedLabel: 'Последняя экспортированная схема:',
    notSavedLabel: 'Схема ещё не экспортирована — откройте диалог, переназначьте клавишу и нажмите «Сохранить».',

    localeHeading: 'Собственные формулировки',
    localeDesc: 'Передайте словарь в [locale], чтобы переопределить тексты диалога (подсказку поиска, значок конфликта, ARIA-подписи), не трогая исходный код компонента.',
    openLocalizedButton: 'Открыть со своими текстами',
    customSearchPlaceholder: 'Фильтровать сочетания этого рабочего пространства...',
    customConflict: 'Столкновение',
    customRebindAll: 'Изменить клавишу для всех {binding}',
    customRebindInstance: 'Изменить клавишу {name} для {binding}',

    catEditor: 'Редактор',
    catData: 'Данные',
    catApp: 'Приложение',

    actBold: 'Сделать выделение жирным',
    actItalic: 'Сделать выделение курсивом',
    actSave: 'Сохранить документ',
    actSearch: 'Поиск по строкам таблицы',
    actExport: 'Экспортировать таблицу в CSV',
    actShortcuts: 'Открыть менеджер сочетаний',
    actPing: 'Записать демо-событие',
  },

  pt: {
    code: 'pt',
    heading: 'Diálogo de atalhos de teclado',
    description: 'Uma tela de configurações pronta para todos os atalhos registrados no ShortcutBindingService. Os usuários podem pesquisar ações, reatribuir uma tecla para todas as instâncias de um componente ou para apenas uma, identificar conflitos e exportar ou importar o seu mapeamento.',

    basicHeading: 'Abrir o gerenciador',
    basicDesc: 'Vincule [(open)] a um sinal e alterne-o por um botão — ou por um atalho que você mesmo registrar.',
    openButton: 'Gerenciar atalhos',
    kbdHintPrefix: 'Você também pode pressionar',
    kbdHintKey: 'Shift + ?',
    kbdHintSuffix: 'em qualquer lugar desta página. O botão faz exatamente o mesmo, então usuários de toque nunca ficam de fora.',
    platformLabel: 'Teclas conforme a plataforma',
    platformDesc: 'Registre "Mod+K" uma vez — o serviço o resolve como Cmd no macOS e como Ctrl nos demais sistemas. Neste dispositivo aparece como:',

    catalogHeading: 'O que o diálogo mostra',
    catalogDesc: 'Esta demonstração registra três grupos de componentes, cada um com a sua categoria. O diálogo os agrupa por componente, lista cada instância e destaca as teclas em conflito.',
    colAction: 'Ação',
    colCategory: 'Categoria',
    colComponent: 'Componente',
    colDefault: 'Padrão',
    colEffective: 'Em vigor',
    colInstances: 'Instâncias',

    tryHeading: 'Veja uma reatribuição funcionando',
    tryDesc: 'Reatribua uma ação do editor no diálogo e acione-a aqui — a área abaixo despacha atalhos no escopo da primeira instância do editor.',
    surfaceHint: 'Clique aqui para focar e pressione um atalho do editor (Mod+B, Mod+I, Mod+S).',
    lastActionLabel: 'Última ação:',
    noActionYet: 'Nada foi acionado ainda.',

    mappingHeading: 'Exportar e importar um mapeamento',
    mappingDesc: 'Com [allowSaveMapping] o diálogo exibe um botão de salvar que emite as substituições atuais por (mappingSave). Reenvie um esquema por [mappingSchema] para restaurá-lo.',
    openMappingButton: 'Abrir com salvamento ativado',
    loadSampleButton: 'Carregar mapeamento de exemplo',
    resetButton: 'Redefinir todas as substituições',
    savedLabel: 'Último mapeamento exportado:',
    notSavedLabel: 'Nenhum mapeamento exportado ainda — abra o diálogo, reatribua algo e pressione Salvar.',

    localeHeading: 'Textos personalizados',
    localeDesc: 'Passe um dicionário para [locale] a fim de substituir os textos do diálogo (campo de busca, selo de conflito, rótulos ARIA) sem alterar o código do componente.',
    openLocalizedButton: 'Abrir com textos personalizados',
    customSearchPlaceholder: 'Filtrar os atalhos deste espaço de trabalho...',
    customConflict: 'Colisão',
    customRebindAll: 'Alterar a tecla de cada {binding}',
    customRebindInstance: 'Alterar a tecla de {name} para {binding}',

    catEditor: 'Editor',
    catData: 'Dados',
    catApp: 'Aplicação',

    actBold: 'Deixar a seleção em negrito',
    actItalic: 'Deixar a seleção em itálico',
    actSave: 'Salvar o documento',
    actSearch: 'Pesquisar linhas da tabela',
    actExport: 'Exportar a tabela para CSV',
    actShortcuts: 'Abrir o gerenciador de atalhos',
    actPing: 'Registrar um evento de demonstração',
  },
};
