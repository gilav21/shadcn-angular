import type { LocaleMeta } from '../../../../lib/i18n';

/**
 * Localized strings for the rich-text AI-assist addon: the "✨ Ask AI"
 * selection chip, the task menu, the custom-prompt field, and the
 * generate/accept/discard/retry review controls. Pass a registry key
 * (`'en'`, `'he'`, …) or a full dictionary to `[uiRteAiLocale]`.
 *
 * Unlike the former built-in AI UI (which read `RichTextLocale.ai`), these
 * strings resolve from the addon's own `[uiRteAiLocale]` input (or the global
 * `UI_LOCALE_ID` token), not the editor's `[locale]` input.
 */
export interface RichTextAiLocale extends LocaleMeta {
    /** Label of the floating chip shown on a text selection. */
    trigger: string;
    /** `/ai` slash-command label. */
    slash: string;
    /** `/ai` slash-command description. */
    slashDescription: string;
    /** "Improve writing" task. */
    rewrite: string;
    /** "Fix spelling & grammar" task. */
    fixGrammar: string;
    /** "Make shorter" task. */
    shorten: string;
    /** "Make longer" task. */
    expand: string;
    /** "Summarize" task. */
    summarize: string;
    /** "Continue writing" task. */
    continueWriting: string;
    /** Placeholder for the free-form prompt input. */
    promptPlaceholder: string;
    /** Label of the run-custom-prompt button. */
    go: string;
    /** Shown while the provider streams output. */
    generating: string;
    /** Keep-the-result button. */
    accept: string;
    /** Drop-the-result button. */
    discard: string;
    /** Re-run-the-task button. */
    retry: string;
    /** Fallback message when the provider errors without one. */
    failed: string;
}

/** Built-in locales for the AI-assist addon. */
export const RICH_TEXT_AI_LOCALES: Record<string, RichTextAiLocale> = {
    en: {
        code: 'en',
        trigger: '✨ Ask AI',
        slash: 'Ask AI',
        slashDescription: 'Rewrite, summarize, or generate with AI',
        rewrite: 'Improve writing',
        fixGrammar: 'Fix spelling & grammar',
        shorten: 'Make shorter',
        expand: 'Make longer',
        summarize: 'Summarize',
        continueWriting: 'Continue writing',
        promptPlaceholder: 'Ask AI to…',
        go: 'Go',
        generating: 'Generating…',
        accept: 'Accept',
        discard: 'Discard',
        retry: 'Try again',
        failed: 'AI request failed',
    },
    he: {
        code: 'he',
        rtl: true,
        trigger: '✨ שאל AI',
        slash: 'שאל AI',
        slashDescription: 'שכתוב, סיכום או יצירה בעזרת AI',
        rewrite: 'שפר ניסוח',
        fixGrammar: 'תקן איות ודקדוק',
        shorten: 'קצר',
        expand: 'הרחב',
        summarize: 'סכם',
        continueWriting: 'המשך לכתוב',
        promptPlaceholder: '…בקש מ-AI',
        go: 'בצע',
        generating: '…מייצר',
        accept: 'אשר',
        discard: 'בטל',
        retry: 'נסה שוב',
        failed: 'בקשת ה-AI נכשלה',
    },
    ar: {
        code: 'ar',
        rtl: true,
        trigger: '✨ اسأل الذكاء الاصطناعي',
        slash: 'اسأل الذكاء الاصطناعي',
        slashDescription: 'إعادة الصياغة أو التلخيص أو التوليد بالذكاء الاصطناعي',
        rewrite: 'تحسين الصياغة',
        fixGrammar: 'تصحيح الإملاء والقواعد',
        shorten: 'اختصار',
        expand: 'إطالة',
        summarize: 'تلخيص',
        continueWriting: 'متابعة الكتابة',
        promptPlaceholder: '…اطلب من الذكاء الاصطناعي',
        go: 'تنفيذ',
        generating: '…جارٍ التوليد',
        accept: 'قبول',
        discard: 'تجاهل',
        retry: 'إعادة المحاولة',
        failed: 'فشل طلب الذكاء الاصطناعي',
    },
    de: {
        code: 'de',
        trigger: '✨ KI fragen',
        slash: 'KI fragen',
        slashDescription: 'Mit KI umschreiben, zusammenfassen oder generieren',
        rewrite: 'Text verbessern',
        fixGrammar: 'Rechtschreibung & Grammatik korrigieren',
        shorten: 'Kürzen',
        expand: 'Verlängern',
        summarize: 'Zusammenfassen',
        continueWriting: 'Weiterschreiben',
        promptPlaceholder: 'KI bitten,…',
        go: 'Los',
        generating: 'Wird generiert…',
        accept: 'Übernehmen',
        discard: 'Verwerfen',
        retry: 'Erneut versuchen',
        failed: 'KI-Anfrage fehlgeschlagen',
    },
    fr: {
        code: 'fr',
        trigger: '✨ Demander à l\'IA',
        slash: 'Demander à l\'IA',
        slashDescription: 'Réécrire, résumer ou générer avec l\'IA',
        rewrite: 'Améliorer le texte',
        fixGrammar: 'Corriger l\'orthographe et la grammaire',
        shorten: 'Raccourcir',
        expand: 'Rallonger',
        summarize: 'Résumer',
        continueWriting: 'Continuer à écrire',
        promptPlaceholder: 'Demander à l\'IA de…',
        go: 'OK',
        generating: 'Génération…',
        accept: 'Accepter',
        discard: 'Ignorer',
        retry: 'Réessayer',
        failed: 'Échec de la requête IA',
    },
    es: {
        code: 'es',
        trigger: '✨ Preguntar a la IA',
        slash: 'Preguntar a la IA',
        slashDescription: 'Reescribir, resumir o generar con IA',
        rewrite: 'Mejorar la redacción',
        fixGrammar: 'Corregir ortografía y gramática',
        shorten: 'Acortar',
        expand: 'Alargar',
        summarize: 'Resumir',
        continueWriting: 'Continuar escribiendo',
        promptPlaceholder: 'Pide a la IA que…',
        go: 'Ir',
        generating: 'Generando…',
        accept: 'Aceptar',
        discard: 'Descartar',
        retry: 'Reintentar',
        failed: 'La solicitud de IA falló',
    },
    ja: {
        code: 'ja',
        trigger: '✨ AIに依頼',
        slash: 'AIに依頼',
        slashDescription: 'AIで書き換え・要約・生成',
        rewrite: '文章を改善',
        fixGrammar: 'スペルと文法を修正',
        shorten: '短くする',
        expand: '長くする',
        summarize: '要約する',
        continueWriting: '続きを書く',
        promptPlaceholder: 'AIへの指示を入力…',
        go: '実行',
        generating: '生成中…',
        accept: '適用',
        discard: '破棄',
        retry: '再試行',
        failed: 'AIリクエストに失敗しました',
    },
    zh: {
        code: 'zh',
        trigger: '✨ 询问 AI',
        slash: '询问 AI',
        slashDescription: '使用 AI 改写、总结或生成',
        rewrite: '改进写作',
        fixGrammar: '修正拼写和语法',
        shorten: '缩短',
        expand: '扩展',
        summarize: '总结',
        continueWriting: '继续写作',
        promptPlaceholder: '让 AI…',
        go: '执行',
        generating: '生成中…',
        accept: '接受',
        discard: '放弃',
        retry: '重试',
        failed: 'AI 请求失败',
    },
    ru: {
        code: 'ru',
        trigger: '✨ Спросить ИИ',
        slash: 'Спросить ИИ',
        slashDescription: 'Переписать, обобщить или сгенерировать с помощью ИИ',
        rewrite: 'Улучшить текст',
        fixGrammar: 'Исправить орфографию и грамматику',
        shorten: 'Сократить',
        expand: 'Расширить',
        summarize: 'Кратко изложить',
        continueWriting: 'Продолжить писать',
        promptPlaceholder: 'Попросить ИИ…',
        go: 'Выполнить',
        generating: 'Генерация…',
        accept: 'Принять',
        discard: 'Отменить',
        retry: 'Повторить',
        failed: 'Сбой запроса к ИИ',
    },
    pt: {
        code: 'pt',
        trigger: '✨ Perguntar à IA',
        slash: 'Perguntar à IA',
        slashDescription: 'Reescrever, resumir ou gerar com IA',
        rewrite: 'Melhorar o texto',
        fixGrammar: 'Corrigir ortografia e gramática',
        shorten: 'Encurtar',
        expand: 'Alongar',
        summarize: 'Resumir',
        continueWriting: 'Continuar escrevendo',
        promptPlaceholder: 'Peça à IA para…',
        go: 'Ir',
        generating: 'Gerando…',
        accept: 'Aceitar',
        discard: 'Descartar',
        retry: 'Tentar novamente',
        failed: 'A solicitação de IA falhou',
    },
};
