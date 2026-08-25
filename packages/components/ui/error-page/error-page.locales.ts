import type { LocaleMeta } from '../../lib/i18n';

/** Default copy for one status code. */
export interface ErrorPageCopy {
    title: string;
    description: string;
}

/**
 * Locale dictionary for `<ui-error-page>`.
 *
 * - `codes` holds the default copy per status code. The key is deliberately
 *   `codes` rather than `code`, which `LocaleMeta` already uses for the BCP-47
 *   tag.
 * - `fallback` is used for any code not listed in `codes`, so an unrecognised
 *   or empty code renders sensible copy instead of blanks.
 * - `goBack` / `goHome` label the two default recovery actions.
 */
export interface ErrorPageLocale extends LocaleMeta {
    goBack: string;
    goHome: string;
    fallback: ErrorPageCopy;
    codes: Record<string, ErrorPageCopy>;
}

export const ERROR_PAGE_LOCALES: Record<string, ErrorPageLocale> = {
    en: {
        code: 'en',
        goBack: 'Go back',
        goHome: 'Go home',
        fallback: {
            title: 'Something went wrong',
            description: 'An unexpected error occurred. Please try again.',
        },
        codes: {
            '404': {
                title: 'Page not found',
                description: "The page you're looking for doesn't exist or has moved.",
            },
            '403': {
                title: 'Access denied',
                description: "You don't have permission to view this page.",
            },
            '500': {
                title: 'Server error',
                description: 'Something broke on our end. We have been notified.',
            },
        },
    },
    he: {
        code: 'he',
        rtl: true,
        goBack: 'חזרה',
        goHome: 'לדף הבית',
        fallback: {
            title: 'משהו השתבש',
            description: 'אירעה שגיאה בלתי צפויה. נסו שוב.',
        },
        codes: {
            '404': {
                title: 'הדף לא נמצא',
                description: 'הדף שחיפשתם אינו קיים או שהועבר.',
            },
            '403': {
                title: 'הגישה נחסמה',
                description: 'אין לכם הרשאה לצפות בדף הזה.',
            },
            '500': {
                title: 'שגיאת שרת',
                description: 'משהו נשבר אצלנו. קיבלנו על כך התראה.',
            },
        },
    },
    ar: {
        code: 'ar',
        rtl: true,
        goBack: 'رجوع',
        goHome: 'الصفحة الرئيسية',
        fallback: {
            title: 'حدث خطأ ما',
            description: 'وقع خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
        },
        codes: {
            '404': {
                title: 'الصفحة غير موجودة',
                description: 'الصفحة التي تبحث عنها غير موجودة أو تم نقلها.',
            },
            '403': {
                title: 'الوصول مرفوض',
                description: 'ليس لديك إذن لعرض هذه الصفحة.',
            },
            '500': {
                title: 'خطأ في الخادم',
                description: 'حدث عطل لدينا. وقد وصلنا إشعار به.',
            },
        },
    },
    de: {
        code: 'de',
        goBack: 'Zurück',
        goHome: 'Zur Startseite',
        fallback: {
            title: 'Etwas ist schiefgelaufen',
            description: 'Ein unerwarteter Fehler ist aufgetreten. Bitte erneut versuchen.',
        },
        codes: {
            '404': {
                title: 'Seite nicht gefunden',
                description: 'Die gesuchte Seite existiert nicht oder wurde verschoben.',
            },
            '403': {
                title: 'Zugriff verweigert',
                description: 'Sie haben keine Berechtigung für diese Seite.',
            },
            '500': {
                title: 'Serverfehler',
                description: 'Bei uns ist etwas kaputtgegangen. Wir wurden benachrichtigt.',
            },
        },
    },
    fr: {
        code: 'fr',
        goBack: 'Retour',
        goHome: 'Accueil',
        fallback: {
            title: 'Une erreur est survenue',
            description: 'Une erreur inattendue s’est produite. Veuillez réessayer.',
        },
        codes: {
            '404': {
                title: 'Page introuvable',
                description: 'La page que vous cherchez n’existe pas ou a été déplacée.',
            },
            '403': {
                title: 'Accès refusé',
                description: 'Vous n’avez pas l’autorisation de voir cette page.',
            },
            '500': {
                title: 'Erreur serveur',
                description: 'Quelque chose a cassé chez nous. Nous avons été prévenus.',
            },
        },
    },
    es: {
        code: 'es',
        goBack: 'Volver',
        goHome: 'Ir al inicio',
        fallback: {
            title: 'Algo salió mal',
            description: 'Se produjo un error inesperado. Inténtalo de nuevo.',
        },
        codes: {
            '404': {
                title: 'Página no encontrada',
                description: 'La página que buscas no existe o se ha movido.',
            },
            '403': {
                title: 'Acceso denegado',
                description: 'No tienes permiso para ver esta página.',
            },
            '500': {
                title: 'Error del servidor',
                description: 'Algo se rompió por nuestra parte. Ya nos han avisado.',
            },
        },
    },
    ja: {
        code: 'ja',
        goBack: '戻る',
        goHome: 'ホームへ',
        fallback: {
            title: '問題が発生しました',
            description: '予期しないエラーが発生しました。もう一度お試しください。',
        },
        codes: {
            '404': {
                title: 'ページが見つかりません',
                description: 'お探しのページは存在しないか、移動しました。',
            },
            '403': {
                title: 'アクセスが拒否されました',
                description: 'このページを表示する権限がありません。',
            },
            '500': {
                title: 'サーバーエラー',
                description: '当方で問題が発生しました。通知は届いています。',
            },
        },
    },
    zh: {
        code: 'zh',
        goBack: '返回',
        goHome: '回到首页',
        fallback: {
            title: '出了点问题',
            description: '发生了意外错误，请重试。',
        },
        codes: {
            '404': {
                title: '页面未找到',
                description: '您要找的页面不存在或已被移动。',
            },
            '403': {
                title: '访问被拒绝',
                description: '您没有查看此页面的权限。',
            },
            '500': {
                title: '服务器错误',
                description: '我们这边出了故障，已经收到通知。',
            },
        },
    },
    ru: {
        code: 'ru',
        goBack: 'Назад',
        goHome: 'На главную',
        fallback: {
            title: 'Что-то пошло не так',
            description: 'Произошла непредвиденная ошибка. Попробуйте ещё раз.',
        },
        codes: {
            '404': {
                title: 'Страница не найдена',
                description: 'Страница, которую вы ищете, не существует или была перемещена.',
            },
            '403': {
                title: 'Доступ запрещён',
                description: 'У вас нет прав на просмотр этой страницы.',
            },
            '500': {
                title: 'Ошибка сервера',
                description: 'У нас что-то сломалось. Мы уже получили уведомление.',
            },
        },
    },
    pt: {
        code: 'pt',
        goBack: 'Voltar',
        goHome: 'Ir para o início',
        fallback: {
            title: 'Algo deu errado',
            description: 'Ocorreu um erro inesperado. Tente novamente.',
        },
        codes: {
            '404': {
                title: 'Página não encontrada',
                description: 'A página que você procura não existe ou foi movida.',
            },
            '403': {
                title: 'Acesso negado',
                description: 'Você não tem permissão para ver esta página.',
            },
            '500': {
                title: 'Erro no servidor',
                description: 'Algo quebrou do nosso lado. Já fomos notificados.',
            },
        },
    },
};
