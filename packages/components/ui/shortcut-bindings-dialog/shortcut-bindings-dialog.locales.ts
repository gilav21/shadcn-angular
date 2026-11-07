import type { LocaleMeta } from '../../lib/i18n';

/**
 * Locale dictionary for `<ui-shortcut-bindings-dialog>`.
 *
 * The two `rebind*` keys carry `{binding}` (and `{name}` for the
 * per-instance variant) placeholders that the component interpolates
 * with the binding's description (and the instance's display name).
 */
export interface ShortcutBindingsDialogLocale extends LocaleMeta {
    searchPlaceholder: string;
    conflict: string;
    /** `aria-label` on the "rebind all instances" capture button. Interpolates `{binding}`. */
    rebindAllInstances: string;
    /** `aria-label` on the per-instance rebind button. Interpolates `{name}` and `{binding}`. */
    rebindInstance: string;
    /** Dialog title. */
    title: string;
    /** Dialog description under the title. */
    description: string;
    /** Label of the save button shown with `allowSaveMapping`. */
    saveChanges: string;
    /** Prefix before an action id. */
    actionLabel: string;
    /** Per-group summary. Interpolates `{active}` and `{total}`. */
    activeActions: string;
    /** Per-action instance count. Interpolates `{count}`. */
    activeInstances: string;
    /** Shown on a rebind button while it is capturing. */
    pressKeys: string;
    /** Prefix before the shared shortcut on the "all instances" button. */
    allPrefix: string;
    /** Resets every instance of an action. */
    resetAll: string;
    /** Prefix before an instance default shortcut. */
    defaultPrefix: string;
    /** Resets one instance. */
    reset: string;
    /** Empty state for an action with no live instances. */
    noInstances: string;
    /** Empty state when the search matches nothing. */
    noMatches: string;
}

export const SHORTCUT_BINDINGS_DIALOG_LOCALES: Record<string, ShortcutBindingsDialogLocale> = {
    en: {
        code: 'en',
        searchPlaceholder: 'Search actions, categories, components, or keys...',
        conflict: 'Conflict',
        rebindAllInstances: 'Rebind all instances of {binding}',
        rebindInstance: 'Rebind instance {name} for {binding}',
        title: 'Keyboard Shortcuts',
        description: 'Browse available shortcuts and rebind actions for this app.',
        saveChanges: 'Save Changes',
        actionLabel: 'Action:',
        activeActions: 'Active actions: {active} / {total}',
        activeInstances: 'Active instances: {count}',
        pressKeys: 'Press keys...',
        allPrefix: 'All:',
        resetAll: 'Reset all',
        defaultPrefix: 'Default:',
        reset: 'Reset',
        noInstances: 'No active instances. Use the "All" control to define the shared shortcut for future instances.',
        noMatches: 'No shortcuts matched your search.',
    },
    he: {
        code: 'he', rtl: true,
        searchPlaceholder: '...חיפוש פעולות, קטגוריות, רכיבים או מקשים',
        conflict: 'התנגשות',
        rebindAllInstances: 'מיפוי מחדש של כל המופעים של {binding}',
        rebindInstance: 'מיפוי מחדש של מופע {name} עבור {binding}',
        title: 'קיצורי מקלדת',
        description: 'עיינו בקיצורים הזמינים ומפו מחדש פעולות עבור האפליקציה.',
        saveChanges: 'שמירת שינויים',
        actionLabel: 'פעולה:',
        activeActions: 'פעולות פעילות: {active} / {total}',
        activeInstances: 'מופעים פעילים: {count}',
        pressKeys: '...הקישו על מקשים',
        allPrefix: 'הכול:',
        resetAll: 'איפוס הכול',
        defaultPrefix: 'ברירת מחדל:',
        reset: 'איפוס',
        noInstances: 'אין מופעים פעילים. השתמשו בפקד "הכול" כדי להגדיר את הקיצור המשותף למופעים עתידיים.',
        noMatches: 'לא נמצאו קיצורים התואמים לחיפוש.',
    },
    ar: {
        code: 'ar', rtl: true,
        searchPlaceholder: '...بحث في الإجراءات أو الفئات أو المكونات أو المفاتيح',
        conflict: 'تعارض',
        rebindAllInstances: 'إعادة ربط جميع نُسخ {binding}',
        rebindInstance: 'إعادة ربط النسخة {name} لـ {binding}',
        title: 'اختصارات لوحة المفاتيح',
        description: 'استعرض الاختصارات المتاحة وأعد ربط الإجراءات لهذا التطبيق.',
        saveChanges: 'حفظ التغييرات',
        actionLabel: 'الإجراء:',
        activeActions: 'الإجراءات النشطة: {active} / {total}',
        activeInstances: 'النسخ النشطة: {count}',
        pressKeys: '...اضغط على المفاتيح',
        allPrefix: 'الكل:',
        resetAll: 'إعادة تعيين الكل',
        defaultPrefix: 'الافتراضي:',
        reset: 'إعادة تعيين',
        noInstances: 'لا توجد نسخ نشطة. استخدم عنصر التحكم "الكل" لتحديد الاختصار المشترك للنسخ المستقبلية.',
        noMatches: 'لا توجد اختصارات تطابق بحثك.',
    },
    de: {
        code: 'de',
        searchPlaceholder: 'Aktionen, Kategorien, Komponenten oder Tasten suchen...',
        conflict: 'Konflikt',
        rebindAllInstances: 'Alle Instanzen von {binding} neu zuweisen',
        rebindInstance: 'Instanz {name} für {binding} neu zuweisen',
        title: 'Tastenkürzel',
        description: 'Verfügbare Tastenkürzel durchsuchen und Aktionen für diese App neu zuweisen.',
        saveChanges: 'Änderungen speichern',
        actionLabel: 'Aktion:',
        activeActions: 'Aktive Aktionen: {active} / {total}',
        activeInstances: 'Aktive Instanzen: {count}',
        pressKeys: 'Tasten drücken...',
        allPrefix: 'Alle:',
        resetAll: 'Alle zurücksetzen',
        defaultPrefix: 'Standard:',
        reset: 'Zurücksetzen',
        noInstances: 'Keine aktiven Instanzen. Mit dem Steuerelement „Alle“ legen Sie das gemeinsame Tastenkürzel für künftige Instanzen fest.',
        noMatches: 'Keine Tastenkürzel entsprechen Ihrer Suche.',
    },
    fr: {
        code: 'fr',
        searchPlaceholder: 'Rechercher des actions, catégories, composants ou touches...',
        conflict: 'Conflit',
        rebindAllInstances: 'Réassocier toutes les instances de {binding}',
        rebindInstance: 'Réassocier l\'instance {name} pour {binding}',
        title: 'Raccourcis clavier',
        description: 'Parcourez les raccourcis disponibles et réassociez les actions de cette application.',
        saveChanges: 'Enregistrer les modifications',
        actionLabel: 'Action :',
        activeActions: 'Actions actives : {active} / {total}',
        activeInstances: 'Instances actives : {count}',
        pressKeys: 'Appuyez sur les touches...',
        allPrefix: 'Toutes :',
        resetAll: 'Tout réinitialiser',
        defaultPrefix: 'Par défaut :',
        reset: 'Réinitialiser',
        noInstances: 'Aucune instance active. Utilisez le contrôle « Toutes » pour définir le raccourci partagé des futures instances.',
        noMatches: 'Aucun raccourci ne correspond à votre recherche.',
    },
    es: {
        code: 'es',
        searchPlaceholder: 'Buscar acciones, categorías, componentes o teclas...',
        conflict: 'Conflicto',
        rebindAllInstances: 'Reasignar todas las instancias de {binding}',
        rebindInstance: 'Reasignar la instancia {name} para {binding}',
        title: 'Atajos de teclado',
        description: 'Explora los atajos disponibles y reasigna las acciones de esta aplicación.',
        saveChanges: 'Guardar cambios',
        actionLabel: 'Acción:',
        activeActions: 'Acciones activas: {active} / {total}',
        activeInstances: 'Instancias activas: {count}',
        pressKeys: 'Pulsa las teclas...',
        allPrefix: 'Todas:',
        resetAll: 'Restablecer todo',
        defaultPrefix: 'Predeterminado:',
        reset: 'Restablecer',
        noInstances: 'No hay instancias activas. Usa el control «Todas» para definir el atajo compartido de futuras instancias.',
        noMatches: 'Ningún atajo coincide con tu búsqueda.',
    },
    ja: {
        code: 'ja',
        searchPlaceholder: 'アクション、カテゴリ、コンポーネント、またはキーを検索...',
        conflict: '競合',
        rebindAllInstances: '{binding} のすべてのインスタンスを再割り当て',
        rebindInstance: '{binding} のインスタンス {name} を再割り当て',
        title: 'キーボードショートカット',
        description: '利用可能なショートカットを確認し、このアプリのアクションを再割り当てできます。',
        saveChanges: '変更を保存',
        actionLabel: 'アクション:',
        activeActions: '有効なアクション: {active} / {total}',
        activeInstances: '有効なインスタンス: {count}',
        pressKeys: 'キーを押してください...',
        allPrefix: 'すべて:',
        resetAll: 'すべてリセット',
        defaultPrefix: '既定:',
        reset: 'リセット',
        noInstances: '有効なインスタンスはありません。「すべて」コントロールで今後のインスタンス共通のショートカットを設定できます。',
        noMatches: '検索に一致するショートカットはありません。',
    },
    zh: {
        code: 'zh',
        searchPlaceholder: '搜索操作、类别、组件或按键...',
        conflict: '冲突',
        rebindAllInstances: '重新绑定 {binding} 的所有实例',
        rebindInstance: '为 {binding} 重新绑定实例 {name}',
        title: '键盘快捷键',
        description: '浏览可用快捷键，并为此应用重新绑定操作。',
        saveChanges: '保存更改',
        actionLabel: '操作：',
        activeActions: '活动操作：{active} / {total}',
        activeInstances: '活动实例：{count}',
        pressKeys: '请按键...',
        allPrefix: '全部：',
        resetAll: '全部重置',
        defaultPrefix: '默认：',
        reset: '重置',
        noInstances: '没有活动实例。使用“全部”控件为未来的实例定义共享快捷键。',
        noMatches: '没有与搜索匹配的快捷键。',
    },
    ru: {
        code: 'ru',
        searchPlaceholder: 'Поиск действий, категорий, компонентов или клавиш...',
        conflict: 'Конфликт',
        rebindAllInstances: 'Переназначить все экземпляры {binding}',
        rebindInstance: 'Переназначить экземпляр {name} для {binding}',
        title: 'Сочетания клавиш',
        description: 'Просматривайте доступные сочетания и переназначайте действия этого приложения.',
        saveChanges: 'Сохранить изменения',
        actionLabel: 'Действие:',
        activeActions: 'Активные действия: {active} / {total}',
        activeInstances: 'Активные экземпляры: {count}',
        pressKeys: 'Нажмите клавиши...',
        allPrefix: 'Все:',
        resetAll: 'Сбросить все',
        defaultPrefix: 'По умолчанию:',
        reset: 'Сбросить',
        noInstances: 'Нет активных экземпляров. Используйте элемент «Все», чтобы задать общее сочетание для будущих экземпляров.',
        noMatches: 'Нет сочетаний, подходящих под ваш запрос.',
    },
    pt: {
        code: 'pt',
        searchPlaceholder: 'Pesquisar ações, categorias, componentes ou teclas...',
        conflict: 'Conflito',
        rebindAllInstances: 'Reatribuir todas as instâncias de {binding}',
        rebindInstance: 'Reatribuir a instância {name} para {binding}',
        title: 'Atalhos de teclado',
        description: 'Veja os atalhos disponíveis e reatribua as ações deste aplicativo.',
        saveChanges: 'Salvar alterações',
        actionLabel: 'Ação:',
        activeActions: 'Ações ativas: {active} / {total}',
        activeInstances: 'Instâncias ativas: {count}',
        pressKeys: 'Pressione as teclas...',
        allPrefix: 'Todas:',
        resetAll: 'Redefinir tudo',
        defaultPrefix: 'Padrão:',
        reset: 'Redefinir',
        noInstances: 'Nenhuma instância ativa. Use o controle "Todas" para definir o atalho compartilhado das próximas instâncias.',
        noMatches: 'Nenhum atalho corresponde à sua pesquisa.',
    },
};
