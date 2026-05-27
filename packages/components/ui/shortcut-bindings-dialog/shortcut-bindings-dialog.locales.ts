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
}

export const SHORTCUT_BINDINGS_DIALOG_LOCALES: Record<string, ShortcutBindingsDialogLocale> = {
    en: {
        code: 'en',
        searchPlaceholder: 'Search actions, categories, components, or keys...',
        conflict: 'Conflict',
        rebindAllInstances: 'Rebind all instances of {binding}',
        rebindInstance: 'Rebind instance {name} for {binding}',
    },
    he: {
        code: 'he', rtl: true,
        searchPlaceholder: '...חיפוש פעולות, קטגוריות, רכיבים או מקשים',
        conflict: 'התנגשות',
        rebindAllInstances: 'מיפוי מחדש של כל המופעים של {binding}',
        rebindInstance: 'מיפוי מחדש של מופע {name} עבור {binding}',
    },
    ar: {
        code: 'ar', rtl: true,
        searchPlaceholder: '...بحث في الإجراءات أو الفئات أو المكونات أو المفاتيح',
        conflict: 'تعارض',
        rebindAllInstances: 'إعادة ربط جميع نُسخ {binding}',
        rebindInstance: 'إعادة ربط النسخة {name} لـ {binding}',
    },
    de: {
        code: 'de',
        searchPlaceholder: 'Aktionen, Kategorien, Komponenten oder Tasten suchen...',
        conflict: 'Konflikt',
        rebindAllInstances: 'Alle Instanzen von {binding} neu zuweisen',
        rebindInstance: 'Instanz {name} für {binding} neu zuweisen',
    },
    fr: {
        code: 'fr',
        searchPlaceholder: 'Rechercher des actions, catégories, composants ou touches...',
        conflict: 'Conflit',
        rebindAllInstances: 'Réassocier toutes les instances de {binding}',
        rebindInstance: 'Réassocier l\'instance {name} pour {binding}',
    },
    es: {
        code: 'es',
        searchPlaceholder: 'Buscar acciones, categorías, componentes o teclas...',
        conflict: 'Conflicto',
        rebindAllInstances: 'Reasignar todas las instancias de {binding}',
        rebindInstance: 'Reasignar la instancia {name} para {binding}',
    },
    ja: {
        code: 'ja',
        searchPlaceholder: 'アクション、カテゴリ、コンポーネント、またはキーを検索...',
        conflict: '競合',
        rebindAllInstances: '{binding} のすべてのインスタンスを再割り当て',
        rebindInstance: '{binding} のインスタンス {name} を再割り当て',
    },
    zh: {
        code: 'zh',
        searchPlaceholder: '搜索操作、类别、组件或按键...',
        conflict: '冲突',
        rebindAllInstances: '重新绑定 {binding} 的所有实例',
        rebindInstance: '为 {binding} 重新绑定实例 {name}',
    },
    ru: {
        code: 'ru',
        searchPlaceholder: 'Поиск действий, категорий, компонентов или клавиш...',
        conflict: 'Конфликт',
        rebindAllInstances: 'Переназначить все экземпляры {binding}',
        rebindInstance: 'Переназначить экземпляр {name} для {binding}',
    },
    pt: {
        code: 'pt',
        searchPlaceholder: 'Pesquisar ações, categorias, componentes ou teclas...',
        conflict: 'Conflito',
        rebindAllInstances: 'Reatribuir todas as instâncias de {binding}',
        rebindInstance: 'Reatribuir a instância {name} para {binding}',
    },
};
