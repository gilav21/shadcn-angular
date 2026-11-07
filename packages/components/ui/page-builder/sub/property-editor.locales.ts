import type { LocaleMeta } from '../../../lib/i18n';

/**
 * Locale dictionary for `<ui-property-editor>`. Input names and labels come
 * from the host's `ComponentMeta`, so they are never translated here.
 *
 * `selectPlaceholder` carries `{label}`; translators may move it but must
 * keep it.
 */
export interface PropertyEditorLocale extends LocaleMeta {
    layout: string;
    gridConfig: string;
    columnsWidth: string;
    rowsHeight: string;
    settings: string;
    props: string;
    /** `title` on the per-input binding toggle. */
    toggleBinding: string;
    /** Binding toggle label while the input is bound. */
    bound: string;
    /** Binding toggle label while the input holds a literal. */
    static: string;
    bindingPlaceholder: string;
    /** Placeholder of a select input. Interpolates `{label}`. */
    selectPlaceholder: string;
    deleteComponent: string;
    noSelection: string;
    noSelectionHint: string;
}

export const PROPERTY_EDITOR_LOCALES: Record<string, PropertyEditorLocale> = {
    en: {
        code: 'en',
        layout: 'Layout',
        gridConfig: 'Grid Config',
        columnsWidth: 'Columns (Width)',
        rowsHeight: 'Rows (Height)',
        settings: 'Settings',
        props: 'Props',
        toggleBinding: 'Toggle Data Binding',
        bound: 'Bound',
        static: 'Static',
        bindingPlaceholder: 'e.g. user.name',
        selectPlaceholder: 'Select {label}',
        deleteComponent: 'Delete Component',
        noSelection: 'No Selection',
        noSelectionHint: 'Select an item on the board to edit its layout and properties.',
    },
    he: {
        code: 'he', rtl: true,
        layout: 'פריסה',
        gridConfig: 'הגדרות רשת',
        columnsWidth: 'עמודות (רוחב)',
        rowsHeight: 'שורות (גובה)',
        settings: 'הגדרות',
        props: 'מאפיינים',
        toggleBinding: 'הפעלה/כיבוי של קישור נתונים',
        bound: 'מקושר',
        static: 'קבוע',
        bindingPlaceholder: 'לדוגמה: user.name',
        selectPlaceholder: 'בחירת {label}',
        deleteComponent: 'מחיקת הרכיב',
        noSelection: 'לא נבחר דבר',
        noSelectionHint: 'בחרו פריט בלוח כדי לערוך את הפריסה והמאפיינים שלו.',
    },
    ar: {
        code: 'ar', rtl: true,
        layout: 'التخطيط',
        gridConfig: 'إعدادات الشبكة',
        columnsWidth: 'الأعمدة (العرض)',
        rowsHeight: 'الصفوف (الارتفاع)',
        settings: 'الإعدادات',
        props: 'الخصائص',
        toggleBinding: 'تبديل ربط البيانات',
        bound: 'مرتبط',
        static: 'ثابت',
        bindingPlaceholder: 'مثال: user.name',
        selectPlaceholder: 'اختر {label}',
        deleteComponent: 'حذف المكوّن',
        noSelection: 'لا يوجد تحديد',
        noSelectionHint: 'حدد عنصرًا على اللوحة لتحرير تخطيطه وخصائصه.',
    },
    de: {
        code: 'de',
        layout: 'Layout',
        gridConfig: 'Rasterkonfiguration',
        columnsWidth: 'Spalten (Breite)',
        rowsHeight: 'Zeilen (Höhe)',
        settings: 'Einstellungen',
        props: 'Eigenschaften',
        toggleBinding: 'Datenbindung umschalten',
        bound: 'Gebunden',
        static: 'Statisch',
        bindingPlaceholder: 'z. B. user.name',
        selectPlaceholder: '{label} auswählen',
        deleteComponent: 'Komponente löschen',
        noSelection: 'Keine Auswahl',
        noSelectionHint: 'Wählen Sie ein Element auf dem Board aus, um Layout und Eigenschaften zu bearbeiten.',
    },
    fr: {
        code: 'fr',
        layout: 'Mise en page',
        gridConfig: 'Config. de la grille',
        columnsWidth: 'Colonnes (largeur)',
        rowsHeight: 'Lignes (hauteur)',
        settings: 'Paramètres',
        props: 'Propriétés',
        toggleBinding: 'Activer/désactiver la liaison de données',
        bound: 'Liée',
        static: 'Statique',
        bindingPlaceholder: 'p. ex. user.name',
        selectPlaceholder: 'Sélectionner {label}',
        deleteComponent: 'Supprimer le composant',
        noSelection: 'Aucune sélection',
        noSelectionHint: 'Sélectionnez un élément du tableau pour modifier sa mise en page et ses propriétés.',
    },
    es: {
        code: 'es',
        layout: 'Diseño',
        gridConfig: 'Config. de cuadrícula',
        columnsWidth: 'Columnas (ancho)',
        rowsHeight: 'Filas (alto)',
        settings: 'Ajustes',
        props: 'Propiedades',
        toggleBinding: 'Activar o desactivar el enlace de datos',
        bound: 'Enlazado',
        static: 'Estático',
        bindingPlaceholder: 'p. ej. user.name',
        selectPlaceholder: 'Seleccionar {label}',
        deleteComponent: 'Eliminar componente',
        noSelection: 'Sin selección',
        noSelectionHint: 'Seleccione un elemento del tablero para editar su diseño y propiedades.',
    },
    ja: {
        code: 'ja',
        layout: 'レイアウト',
        gridConfig: 'グリッド設定',
        columnsWidth: '列 (幅)',
        rowsHeight: '行 (高さ)',
        settings: '設定',
        props: 'プロパティ',
        toggleBinding: 'データバインディングを切り替え',
        bound: 'バインド済み',
        static: '固定値',
        bindingPlaceholder: '例: user.name',
        selectPlaceholder: '{label}を選択',
        deleteComponent: 'コンポーネントを削除',
        noSelection: '選択なし',
        noSelectionHint: 'ボード上のアイテムを選択すると、レイアウトとプロパティを編集できます。',
    },
    zh: {
        code: 'zh',
        layout: '布局',
        gridConfig: '网格配置',
        columnsWidth: '列（宽度）',
        rowsHeight: '行（高度）',
        settings: '设置',
        props: '属性',
        toggleBinding: '切换数据绑定',
        bound: '已绑定',
        static: '静态',
        bindingPlaceholder: '例如：user.name',
        selectPlaceholder: '选择{label}',
        deleteComponent: '删除组件',
        noSelection: '未选择',
        noSelectionHint: '在画板上选择一个项目，即可编辑其布局和属性。',
    },
    ru: {
        code: 'ru',
        layout: 'Макет',
        gridConfig: 'Настройки сетки',
        columnsWidth: 'Столбцы (ширина)',
        rowsHeight: 'Строки (высота)',
        settings: 'Настройки',
        props: 'Свойства',
        toggleBinding: 'Переключить привязку данных',
        bound: 'Привязано',
        static: 'Статично',
        bindingPlaceholder: 'напр. user.name',
        selectPlaceholder: 'Выберите: {label}',
        deleteComponent: 'Удалить компонент',
        noSelection: 'Ничего не выбрано',
        noSelectionHint: 'Выберите элемент на доске, чтобы изменить его макет и свойства.',
    },
    pt: {
        code: 'pt',
        layout: 'Layout',
        gridConfig: 'Config. da grade',
        columnsWidth: 'Colunas (largura)',
        rowsHeight: 'Linhas (altura)',
        settings: 'Configurações',
        props: 'Propriedades',
        toggleBinding: 'Alternar a vinculação de dados',
        bound: 'Vinculado',
        static: 'Estático',
        bindingPlaceholder: 'ex.: user.name',
        selectPlaceholder: 'Selecionar {label}',
        deleteComponent: 'Excluir componente',
        noSelection: 'Nenhuma seleção',
        noSelectionHint: 'Selecione um item no quadro para editar seu layout e suas propriedades.',
    },
};
