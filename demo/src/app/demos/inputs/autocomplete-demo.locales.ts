import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface AutocompleteDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  sections: {
    singleSelection: string;
    multipleSelection: string;
    disabled: string;
  };
  placeholders: {
    single: string;
    multiple: string;
    disabled: string;
  };
  selected: string;
}

export const AUTOCOMPLETE_DEMO_LOCALES: Record<string, AutocompleteDemoLocale> = {
  en: {
    code: 'en',
    title: 'Autocomplete',
    description: 'A searchable select component with single and multiple selection modes.',
    sections: {
      singleSelection: 'Single Selection',
      multipleSelection: 'Multiple Selection',
      disabled: 'Disabled',
    },
    placeholders: {
      single: 'Select framework...',
      multiple: 'Select frameworks...',
      disabled: 'Disabled...',
    },
    selected: 'Selected:',
  },
  he: {
    code: 'he', rtl: true,
    title: 'השלמה אוטומטית',
    description: 'רכיב בחירה עם חיפוש, תומך בבחירה יחידה ומרובה.',
    sections: {
      singleSelection: 'בחירה יחידה',
      multipleSelection: 'בחירה מרובה',
      disabled: 'מושבת',
    },
    placeholders: {
      single: 'בחר מסגרת...',
      multiple: 'בחר מסגרות...',
      disabled: 'מושבת...',
    },
    selected: 'נבחר:',
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'الإكمال التلقائي',
    description: 'مكوّن اختيار قابل للبحث يدعم وضعَي الاختيار الفردي والمتعدد.',
    sections: {
      singleSelection: 'اختيار فردي',
      multipleSelection: 'اختيار متعدد',
      disabled: 'معطّل',
    },
    placeholders: {
      single: 'اختر إطار عمل...',
      multiple: 'اختر أُطر عمل...',
      disabled: 'معطّل...',
    },
    selected: 'المحدد:',
  },
  de: {
    code: 'de',
    title: 'Autovervollständigung',
    description: 'Eine durchsuchbare Auswahlkomponente mit Einzel- und Mehrfachauswahl.',
    sections: {
      singleSelection: 'Einzelauswahl',
      multipleSelection: 'Mehrfachauswahl',
      disabled: 'Deaktiviert',
    },
    placeholders: {
      single: 'Framework auswählen...',
      multiple: 'Frameworks auswählen...',
      disabled: 'Deaktiviert...',
    },
    selected: 'Ausgewählt:',
  },
  fr: {
    code: 'fr',
    title: 'Saisie automatique',
    description: 'Un composant de sélection avec recherche, prenant en charge les modes simple et multiple.',
    sections: {
      singleSelection: 'Sélection simple',
      multipleSelection: 'Sélection multiple',
      disabled: 'Désactivé',
    },
    placeholders: {
      single: 'Sélectionner un framework...',
      multiple: 'Sélectionner des frameworks...',
      disabled: 'Désactivé...',
    },
    selected: 'Sélectionné :',
  },
  es: {
    code: 'es',
    title: 'Autocompletar',
    description: 'Un componente de selección con búsqueda que admite modos de selección simple y múltiple.',
    sections: {
      singleSelection: 'Selección simple',
      multipleSelection: 'Selección múltiple',
      disabled: 'Desactivado',
    },
    placeholders: {
      single: 'Seleccionar framework...',
      multiple: 'Seleccionar frameworks...',
      disabled: 'Desactivado...',
    },
    selected: 'Seleccionado:',
  },
  ja: {
    code: 'ja',
    title: 'オートコンプリート',
    description: '単一・複数選択をサポートする検索可能なセレクトコンポーネントです。',
    sections: {
      singleSelection: '単一選択',
      multipleSelection: '複数選択',
      disabled: '無効',
    },
    placeholders: {
      single: 'フレームワークを選択...',
      multiple: 'フレームワークを選択...',
      disabled: '無効...',
    },
    selected: '選択中:',
  },
  zh: {
    code: 'zh',
    title: '自动补全',
    description: '支持单选和多选模式的可搜索选择组件。',
    sections: {
      singleSelection: '单选',
      multipleSelection: '多选',
      disabled: '禁用',
    },
    placeholders: {
      single: '选择框架...',
      multiple: '选择框架...',
      disabled: '禁用...',
    },
    selected: '已选择:',
  },
  ru: {
    code: 'ru',
    title: 'Автодополнение',
    description: 'Компонент выбора с поиском, поддерживающий одиночный и множественный выбор.',
    sections: {
      singleSelection: 'Одиночный выбор',
      multipleSelection: 'Множественный выбор',
      disabled: 'Отключено',
    },
    placeholders: {
      single: 'Выберите фреймворк...',
      multiple: 'Выберите фреймворки...',
      disabled: 'Отключено...',
    },
    selected: 'Выбрано:',
  },
  pt: {
    code: 'pt',
    title: 'Preenchimento automático',
    description: 'Um componente de seleção pesquisável com modos de seleção simples e múltipla.',
    sections: {
      singleSelection: 'Seleção simples',
      multipleSelection: 'Seleção múltipla',
      disabled: 'Desativado',
    },
    placeholders: {
      single: 'Selecionar framework...',
      multiple: 'Selecionar frameworks...',
      disabled: 'Desativado...',
    },
    selected: 'Selecionado:',
  },
};
