import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface PageBuilderDemoLocale extends LocaleMeta {
  panelLabel: string;
  panelSavedAt: string;
  panelViewMode: string;
  panelHide: string;
  panelShow: string;
  panelClickSave: string;
}

export const PAGE_BUILDER_DEMO_LOCALES: Record<string, PageBuilderDemoLocale> = {
  en: {
    code: 'en',
    panelLabel: 'Saved Layout (from (save) output)',
    panelSavedAt: 'saved',
    panelViewMode: 'view mode:',
    panelHide: 'Hide',
    panelShow: 'Show',
    panelClickSave: 'Click "Save" in the toolbar to capture the layout JSON here.',
  },
  he: {
    code: 'he', rtl: true,
    panelLabel: 'פריסה שמורה (מפלט (save))',
    panelSavedAt: 'נשמר',
    panelViewMode: 'מצב תצוגה:',
    panelHide: 'הסתר',
    panelShow: 'הצג',
    panelClickSave: 'לחץ "שמור" בסרגל הכלים ללכידת JSON הפריסה כאן.',
  },
  ar: {
    code: 'ar', rtl: true,
    panelLabel: 'التخطيط المحفوظ (من مخرجات (save))',
    panelSavedAt: 'تم الحفظ',
    panelViewMode: 'وضع العرض:',
    panelHide: 'إخفاء',
    panelShow: 'إظهار',
    panelClickSave: 'انقر "حفظ" في شريط الأدوات لالتقاط JSON التخطيط هنا.',
  },
  de: {
    code: 'de',
    panelLabel: 'Gespeichertes Layout (aus (save)-Ausgabe)',
    panelSavedAt: 'gespeichert',
    panelViewMode: 'Ansichtsmodus:',
    panelHide: 'Ausblenden',
    panelShow: 'Einblenden',
    panelClickSave: 'Klicken Sie auf "Speichern" in der Symbolleiste, um das Layout-JSON hier zu erfassen.',
  },
  fr: {
    code: 'fr',
    panelLabel: 'Mise en page sauvegardée (sortie (save))',
    panelSavedAt: 'sauvegardé',
    panelViewMode: 'mode d\'affichage :',
    panelHide: 'Masquer',
    panelShow: 'Afficher',
    panelClickSave: 'Cliquez sur "Enregistrer" dans la barre d\'outils pour capturer le JSON de mise en page ici.',
  },
  es: {
    code: 'es',
    panelLabel: 'Diseño guardado (salida (save))',
    panelSavedAt: 'guardado',
    panelViewMode: 'modo de vista:',
    panelHide: 'Ocultar',
    panelShow: 'Mostrar',
    panelClickSave: 'Haga clic en "Guardar" en la barra de herramientas para capturar el JSON del diseño aquí.',
  },
  ja: {
    code: 'ja',
    panelLabel: '保存済みレイアウト（(save)出力から）',
    panelSavedAt: '保存済み',
    panelViewMode: '表示モード:',
    panelHide: '非表示',
    panelShow: '表示',
    panelClickSave: 'ツールバーの「保存」をクリックして、ここにレイアウトJSONをキャプチャします。',
  },
  zh: {
    code: 'zh',
    panelLabel: '已保存布局（来自(save)输出）',
    panelSavedAt: '已保存',
    panelViewMode: '视图模式：',
    panelHide: '隐藏',
    panelShow: '显示',
    panelClickSave: '点击工具栏中的"保存"以在此处捕获布局JSON。',
  },
  ru: {
    code: 'ru',
    panelLabel: 'Сохранённый макет (из вывода (save))',
    panelSavedAt: 'сохранено',
    panelViewMode: 'режим просмотра:',
    panelHide: 'Скрыть',
    panelShow: 'Показать',
    panelClickSave: 'Нажмите «Сохранить» на панели инструментов, чтобы зафиксировать JSON макета здесь.',
  },
  pt: {
    code: 'pt',
    panelLabel: 'Layout salvo (saída (save))',
    panelSavedAt: 'salvo',
    panelViewMode: 'modo de visualização:',
    panelHide: 'Ocultar',
    panelShow: 'Mostrar',
    panelClickSave: 'Clique em "Salvar" na barra de ferramentas para capturar o JSON do layout aqui.',
  },
};
