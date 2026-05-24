import type { LocaleMeta } from './i18n.types';

/**
 * Cross-cutting UI strings shared by many components (Close buttons, Cancel
 * defaults, Search placeholders, etc.).
 *
 * Components are free to extend their own locale interface with additional
 * keys; this file just guarantees a common vocabulary for the smallest
 * label set. Most component-level locale files re-export the keys they need
 * rather than depending on `CommonLocale` directly — that keeps each
 * component's locale shape self-contained.
 */
export interface CommonLocale extends LocaleMeta {
    close: string;
    cancel: string;
    confirm: string;
    continue: string;
    save: string;
    delete: string;
    edit: string;
    search: string;
    searchPlaceholder: string;
    noResults: string;
    previous: string;
    next: string;
    loading: string;
}

export const COMMON_LOCALES: Record<string, CommonLocale> = {
    en: {
        code: 'en',
        close: 'Close',
        cancel: 'Cancel',
        confirm: 'Confirm',
        continue: 'Continue',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        search: 'Search',
        searchPlaceholder: 'Search...',
        noResults: 'No results found.',
        previous: 'Previous',
        next: 'Next',
        loading: 'Loading...',
    },
    he: {
        code: 'he',
        rtl: true,
        close: 'סגור',
        cancel: 'ביטול',
        confirm: 'אישור',
        continue: 'המשך',
        save: 'שמור',
        delete: 'מחק',
        edit: 'ערוך',
        search: 'חיפוש',
        searchPlaceholder: '...חיפוש',
        noResults: 'לא נמצאו תוצאות.',
        previous: 'הקודם',
        next: 'הבא',
        loading: '...טוען',
    },
    ar: {
        code: 'ar',
        rtl: true,
        close: 'إغلاق',
        cancel: 'إلغاء',
        confirm: 'تأكيد',
        continue: 'متابعة',
        save: 'حفظ',
        delete: 'حذف',
        edit: 'تحرير',
        search: 'بحث',
        searchPlaceholder: '...بحث',
        noResults: 'لم يتم العثور على نتائج.',
        previous: 'السابق',
        next: 'التالي',
        loading: '...جاري التحميل',
    },
    de: {
        code: 'de',
        close: 'Schließen',
        cancel: 'Abbrechen',
        confirm: 'Bestätigen',
        continue: 'Weiter',
        save: 'Speichern',
        delete: 'Löschen',
        edit: 'Bearbeiten',
        search: 'Suche',
        searchPlaceholder: 'Suchen...',
        noResults: 'Keine Ergebnisse gefunden.',
        previous: 'Zurück',
        next: 'Weiter',
        loading: 'Wird geladen...',
    },
    fr: {
        code: 'fr',
        close: 'Fermer',
        cancel: 'Annuler',
        confirm: 'Confirmer',
        continue: 'Continuer',
        save: 'Enregistrer',
        delete: 'Supprimer',
        edit: 'Modifier',
        search: 'Rechercher',
        searchPlaceholder: 'Rechercher...',
        noResults: 'Aucun résultat trouvé.',
        previous: 'Précédent',
        next: 'Suivant',
        loading: 'Chargement...',
    },
    es: {
        code: 'es',
        close: 'Cerrar',
        cancel: 'Cancelar',
        confirm: 'Confirmar',
        continue: 'Continuar',
        save: 'Guardar',
        delete: 'Eliminar',
        edit: 'Editar',
        search: 'Buscar',
        searchPlaceholder: 'Buscar...',
        noResults: 'No se encontraron resultados.',
        previous: 'Anterior',
        next: 'Siguiente',
        loading: 'Cargando...',
    },
    ja: {
        code: 'ja',
        close: '閉じる',
        cancel: 'キャンセル',
        confirm: '確認',
        continue: '続行',
        save: '保存',
        delete: '削除',
        edit: '編集',
        search: '検索',
        searchPlaceholder: '検索...',
        noResults: '結果が見つかりません。',
        previous: '前へ',
        next: '次へ',
        loading: '読み込み中...',
    },
    zh: {
        code: 'zh',
        close: '关闭',
        cancel: '取消',
        confirm: '确认',
        continue: '继续',
        save: '保存',
        delete: '删除',
        edit: '编辑',
        search: '搜索',
        searchPlaceholder: '搜索...',
        noResults: '未找到结果。',
        previous: '上一页',
        next: '下一页',
        loading: '加载中...',
    },
    ru: {
        code: 'ru',
        close: 'Закрыть',
        cancel: 'Отмена',
        confirm: 'Подтвердить',
        continue: 'Продолжить',
        save: 'Сохранить',
        delete: 'Удалить',
        edit: 'Редактировать',
        search: 'Поиск',
        searchPlaceholder: 'Поиск...',
        noResults: 'Результаты не найдены.',
        previous: 'Назад',
        next: 'Далее',
        loading: 'Загрузка...',
    },
    pt: {
        code: 'pt',
        close: 'Fechar',
        cancel: 'Cancelar',
        confirm: 'Confirmar',
        continue: 'Continuar',
        save: 'Salvar',
        delete: 'Excluir',
        edit: 'Editar',
        search: 'Pesquisar',
        searchPlaceholder: 'Pesquisar...',
        noResults: 'Nenhum resultado encontrado.',
        previous: 'Anterior',
        next: 'Próximo',
        loading: 'Carregando...',
    },
};
