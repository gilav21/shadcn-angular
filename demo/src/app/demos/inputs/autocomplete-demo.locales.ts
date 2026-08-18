import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface AutocompleteDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  sections: {
    singleSelection: string;
    multipleSelection: string;
    disabled: string;
    clippedOverlay: string;
  };
  placeholders: {
    single: string;
    multiple: string;
    disabled: string;
  };
  selected: string;
  clippedCaption: string;
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
      clippedOverlay: 'Inside a Clipped Card',
    },
    placeholders: {
      single: 'Select framework...',
      multiple: 'Select frameworks...',
      disabled: 'Disabled...',
    },
    selected: 'Selected:',
    clippedCaption: 'Try it: open the list inside this overflow-hidden card — the popup renders in the browser top layer, so it is never clipped.',
  },
  he: {
    code: 'he', rtl: true,
    title: 'השלמה אוטומטית',
    description: 'רכיב בחירה עם חיפוש, תומך בבחירה יחידה ומרובה.',
    sections: {
      singleSelection: 'בחירה יחידה',
      multipleSelection: 'בחירה מרובה',
      disabled: 'מושבת',
      clippedOverlay: 'בתוך כרטיס חתוך',
    },
    placeholders: {
      single: 'בחר מסגרת...',
      multiple: 'בחר מסגרות...',
      disabled: 'מושבת...',
    },
    selected: 'נבחר:',
    clippedCaption: 'נסו: פתחו את הרשימה בתוך הכרטיס עם overflow-hidden — החלונית מוצגת בשכבה העליונה של הדפדפן ולכן אינה נחתכת.',
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'الإكمال التلقائي',
    description: 'مكوّن اختيار قابل للبحث يدعم وضعَي الاختيار الفردي والمتعدد.',
    sections: {
      singleSelection: 'اختيار فردي',
      multipleSelection: 'اختيار متعدد',
      disabled: 'معطّل',
      clippedOverlay: 'داخل بطاقة مقصوصة',
    },
    placeholders: {
      single: 'اختر إطار عمل...',
      multiple: 'اختر أُطر عمل...',
      disabled: 'معطّل...',
    },
    selected: 'المحدد:',
    clippedCaption: 'جرّب: افتح القائمة داخل هذه البطاقة ذات overflow-hidden — تُعرض النافذة المنبثقة في الطبقة العليا للمتصفح فلا تُقتطع أبدًا.',
  },
  de: {
    code: 'de',
    title: 'Autovervollständigung',
    description: 'Eine durchsuchbare Auswahlkomponente mit Einzel- und Mehrfachauswahl.',
    sections: {
      singleSelection: 'Einzelauswahl',
      multipleSelection: 'Mehrfachauswahl',
      disabled: 'Deaktiviert',
      clippedOverlay: 'In einer beschnittenen Karte',
    },
    placeholders: {
      single: 'Framework auswählen...',
      multiple: 'Frameworks auswählen...',
      disabled: 'Deaktiviert...',
    },
    selected: 'Ausgewählt:',
    clippedCaption: 'Zum Ausprobieren: Liste in dieser Karte mit overflow-hidden öffnen — das Popup wird in der obersten Browser-Ebene gerendert und daher nie abgeschnitten.',
  },
  fr: {
    code: 'fr',
    title: 'Saisie automatique',
    description: 'Un composant de sélection avec recherche, prenant en charge les modes simple et multiple.',
    sections: {
      singleSelection: 'Sélection simple',
      multipleSelection: 'Sélection multiple',
      disabled: 'Désactivé',
      clippedOverlay: 'Dans une carte rognée',
    },
    placeholders: {
      single: 'Sélectionner un framework...',
      multiple: 'Sélectionner des frameworks...',
      disabled: 'Désactivé...',
    },
    selected: 'Sélectionné :',
    clippedCaption: 'À essayer : ouvrez la liste dans cette carte en overflow-hidden — la fenêtre s’affiche dans la couche supérieure du navigateur et n’est jamais rognée.',
  },
  es: {
    code: 'es',
    title: 'Autocompletar',
    description: 'Un componente de selección con búsqueda que admite modos de selección simple y múltiple.',
    sections: {
      singleSelection: 'Selección simple',
      multipleSelection: 'Selección múltiple',
      disabled: 'Desactivado',
      clippedOverlay: 'Dentro de una tarjeta recortada',
    },
    placeholders: {
      single: 'Seleccionar framework...',
      multiple: 'Seleccionar frameworks...',
      disabled: 'Desactivado...',
    },
    selected: 'Seleccionado:',
    clippedCaption: 'Pruébalo: abre la lista dentro de esta tarjeta con overflow-hidden; el desplegable se dibuja en la capa superior del navegador, así que nunca se recorta.',
  },
  ja: {
    code: 'ja',
    title: 'オートコンプリート',
    description: '単一・複数選択をサポートする検索可能なセレクトコンポーネントです。',
    sections: {
      singleSelection: '単一選択',
      multipleSelection: '複数選択',
      disabled: '無効',
      clippedOverlay: '切り取られたカードの中',
    },
    placeholders: {
      single: 'フレームワークを選択...',
      multiple: 'フレームワークを選択...',
      disabled: '無効...',
    },
    selected: '選択中:',
    clippedCaption: 'お試し: overflow-hidden のカード内で一覧を開いてください。ポップアップはブラウザーの最前面レイヤーに描画されるため、切り取られません。',
  },
  zh: {
    code: 'zh',
    title: '自动补全',
    description: '支持单选和多选模式的可搜索选择组件。',
    sections: {
      singleSelection: '单选',
      multipleSelection: '多选',
      disabled: '禁用',
      clippedOverlay: '在被裁剪的卡片内',
    },
    placeholders: {
      single: '选择框架...',
      multiple: '选择框架...',
      disabled: '禁用...',
    },
    selected: '已选择:',
    clippedCaption: '试试看：在这个 overflow-hidden 卡片内打开列表——弹出层渲染在浏览器顶层，不会被裁剪。',
  },
  ru: {
    code: 'ru',
    title: 'Автодополнение',
    description: 'Компонент выбора с поиском, поддерживающий одиночный и множественный выбор.',
    sections: {
      singleSelection: 'Одиночный выбор',
      multipleSelection: 'Множественный выбор',
      disabled: 'Отключено',
      clippedOverlay: 'Внутри обрезанной карточки',
    },
    placeholders: {
      single: 'Выберите фреймворк...',
      multiple: 'Выберите фреймворки...',
      disabled: 'Отключено...',
    },
    selected: 'Выбрано:',
    clippedCaption: 'Попробуйте: откройте список внутри карточки с overflow-hidden — всплывающее окно отрисовывается в верхнем слое браузера и не обрезается.',
  },
  pt: {
    code: 'pt',
    title: 'Preenchimento automático',
    description: 'Um componente de seleção pesquisável com modos de seleção simples e múltipla.',
    sections: {
      singleSelection: 'Seleção simples',
      multipleSelection: 'Seleção múltipla',
      disabled: 'Desativado',
      clippedOverlay: 'Dentro de um cartão recortado',
    },
    placeholders: {
      single: 'Selecionar framework...',
      multiple: 'Selecionar frameworks...',
      disabled: 'Desativado...',
    },
    selected: 'Selecionado:',
    clippedCaption: 'Experimente: abra a lista dentro deste cartão com overflow-hidden — o pop-up é renderizado na camada superior do navegador e nunca é cortado.',
  },
};
