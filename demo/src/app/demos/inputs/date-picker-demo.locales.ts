import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface DatePickerDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  sections: {
    singleDate: string;
    dateTime: string;
    dateRange: string;
    rtlHebrew: string;
    clearable: string;
    insideOverflowCard: string;
  };
  captions: {
    clearable: string;
    insideOverflowCard: string;
  };
  actions: {
    clear: string;
  };
  labels: {
    value: string;
  };
  placeholders: {
    pickDate: string;
    pickDateTime: string;
    selectDateRange: string;
    hebrewDate: string;
  };
}

export const DATE_PICKER_DEMO_LOCALES: Record<string, DatePickerDemoLocale> = {
  en: {
    code: 'en',
    title: 'Date Picker',
    description: 'A date picker component with popover calendar.',
    sections: {
      singleDate: 'Single Date',
      dateTime: 'Date & Time',
      dateRange: 'Date Range',
      rtlHebrew: 'Date Picker RTL (Hebrew)',
      clearable: 'Clearable',
      insideOverflowCard: 'Inside an overflow-hidden card',
    },
    captions: {
      clearable: 'Try it: pick a day, then press Clear — writing null into [date] drops the selection.',
      insideOverflowCard: 'Try it: open the calendar — the card clips its own content, but the popup is promoted to the top layer and stays whole.',
    },
    actions: { clear: 'Clear' },
    labels: { value: 'Value:' },
    placeholders: {
      pickDate: 'Pick a date',
      pickDateTime: 'Pick date & time',
      selectDateRange: 'Select date range',
      hebrewDate: 'בחר תאריך',
    },
  },
  he: {
    code: 'he', rtl: true,
    title: 'בורר תאריכים',
    description: 'רכיב בורר תאריכים עם לוח שנה קופץ.',
    sections: {
      singleDate: 'תאריך יחיד',
      dateTime: 'תאריך ושעה',
      dateRange: 'טווח תאריכים',
      rtlHebrew: 'בורר תאריכים RTL (עברית)',
      clearable: 'ניתן לניקוי',
      insideOverflowCard: 'בתוך כרטיס עם overflow-hidden',
    },
    captions: {
      clearable: 'נסה: בחר יום ואז לחץ על "נקה" — כתיבת null אל [date] מבטלת את הבחירה.',
      insideOverflowCard: 'נסה: פתח את לוח השנה — הכרטיס חותך את התוכן שלו, אך החלון מקודם לשכבה העליונה ונשאר שלם.',
    },
    actions: { clear: 'נקה' },
    labels: { value: 'ערך:' },
    placeholders: {
      pickDate: 'בחר תאריך',
      pickDateTime: 'בחר תאריך ושעה',
      selectDateRange: 'בחר טווח תאריכים',
      hebrewDate: 'בחר תאריך',
    },
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'منتقي التاريخ',
    description: 'مكوّن منتقي تاريخ مع تقويم منبثق.',
    sections: {
      singleDate: 'تاريخ واحد',
      dateTime: 'التاريخ والوقت',
      dateRange: 'نطاق التواريخ',
      rtlHebrew: 'منتقي تاريخ RTL (عبري)',
      clearable: 'قابل للمسح',
      insideOverflowCard: 'داخل بطاقة بخاصية overflow-hidden',
    },
    captions: {
      clearable: 'جرّب: اختر يومًا ثم اضغط «مسح» — كتابة null في [date] تلغي الاختيار.',
      insideOverflowCard: 'جرّب: افتح التقويم — البطاقة تقتص محتواها، لكن النافذة تُرفع إلى الطبقة العليا وتظهر كاملة.',
    },
    actions: { clear: 'مسح' },
    labels: { value: 'القيمة:' },
    placeholders: {
      pickDate: 'اختر تاريخًا',
      pickDateTime: 'اختر تاريخًا ووقتًا',
      selectDateRange: 'اختر نطاق تواريخ',
      hebrewDate: 'בחר תאריך',
    },
  },
  de: {
    code: 'de',
    title: 'Datumsauswahl',
    description: 'Eine Datumsauswahl-Komponente mit Popup-Kalender.',
    sections: {
      singleDate: 'Einzelnes Datum',
      dateTime: 'Datum & Uhrzeit',
      dateRange: 'Datumsbereich',
      rtlHebrew: 'Datumsauswahl RTL (Hebräisch)',
      clearable: 'Löschbar',
      insideOverflowCard: 'In einer Karte mit overflow-hidden',
    },
    captions: {
      clearable: 'Ausprobieren: einen Tag wählen, dann „Löschen“ drücken — null in [date] verwirft die Auswahl.',
      insideOverflowCard: 'Ausprobieren: den Kalender öffnen — die Karte beschneidet ihren Inhalt, das Popup wird aber in den Top-Layer gehoben und bleibt vollständig.',
    },
    actions: { clear: 'Löschen' },
    labels: { value: 'Wert:' },
    placeholders: {
      pickDate: 'Datum auswählen',
      pickDateTime: 'Datum & Uhrzeit auswählen',
      selectDateRange: 'Datumsbereich auswählen',
      hebrewDate: 'בחר תאריך',
    },
  },
  fr: {
    code: 'fr',
    title: 'Sélecteur de date',
    description: 'Un composant de sélection de date avec calendrier popover.',
    sections: {
      singleDate: 'Date unique',
      dateTime: 'Date et heure',
      dateRange: 'Plage de dates',
      rtlHebrew: 'Sélecteur RTL (hébreu)',
      clearable: 'Effaçable',
      insideOverflowCard: 'Dans une carte en overflow-hidden',
    },
    captions: {
      clearable: 'Essayez : choisissez un jour, puis cliquez sur « Effacer » — écrire null dans [date] annule la sélection.',
      insideOverflowCard: 'Essayez : ouvrez le calendrier — la carte rogne son contenu, mais le popup est promu au top layer et reste entier.',
    },
    actions: { clear: 'Effacer' },
    labels: { value: 'Valeur :' },
    placeholders: {
      pickDate: 'Choisir une date',
      pickDateTime: 'Choisir date et heure',
      selectDateRange: 'Sélectionner une plage de dates',
      hebrewDate: 'בחר תאריך',
    },
  },
  es: {
    code: 'es',
    title: 'Selector de fecha',
    description: 'Un componente selector de fecha con calendario emergente.',
    sections: {
      singleDate: 'Fecha única',
      dateTime: 'Fecha y hora',
      dateRange: 'Rango de fechas',
      rtlHebrew: 'Selector RTL (hebreo)',
      clearable: 'Borrable',
      insideOverflowCard: 'Dentro de una tarjeta con overflow-hidden',
    },
    captions: {
      clearable: 'Pruébalo: elige un día y pulsa «Borrar» — escribir null en [date] descarta la selección.',
      insideOverflowCard: 'Pruébalo: abre el calendario — la tarjeta recorta su contenido, pero el popup se promueve a la capa superior y se ve completo.',
    },
    actions: { clear: 'Borrar' },
    labels: { value: 'Valor:' },
    placeholders: {
      pickDate: 'Elegir una fecha',
      pickDateTime: 'Elegir fecha y hora',
      selectDateRange: 'Seleccionar rango de fechas',
      hebrewDate: 'בחר תאריך',
    },
  },
  ja: {
    code: 'ja',
    title: '日付ピッカー',
    description: 'ポップオーバーカレンダー付きの日付選択コンポーネントです。',
    sections: {
      singleDate: '単一日付',
      dateTime: '日付と時刻',
      dateRange: '日付範囲',
      rtlHebrew: '日付ピッカー RTL（ヘブライ語）',
      clearable: 'クリア可能',
      insideOverflowCard: 'overflow-hidden のカード内',
    },
    captions: {
      clearable: 'お試しください: 日付を選んで「クリア」を押すと、[date] への null 書き込みで選択が解除されます。',
      insideOverflowCard: 'お試しください: カレンダーを開くと、カードは自身の内容を切り取りますが、ポップアップはトップレイヤーへ昇格し全体が表示されます。',
    },
    actions: { clear: 'クリア' },
    labels: { value: '値:' },
    placeholders: {
      pickDate: '日付を選択',
      pickDateTime: '日付と時刻を選択',
      selectDateRange: '日付範囲を選択',
      hebrewDate: 'בחר תאריך',
    },
  },
  zh: {
    code: 'zh',
    title: '日期选择器',
    description: '带弹出日历的日期选择组件。',
    sections: {
      singleDate: '单个日期',
      dateTime: '日期和时间',
      dateRange: '日期范围',
      rtlHebrew: '日期选择器 RTL（希伯来语）',
      clearable: '可清除',
      insideOverflowCard: '位于 overflow-hidden 卡片内',
    },
    captions: {
      clearable: '试一试：先选一天，再点击“清除”——向 [date] 写入 null 会取消选择。',
      insideOverflowCard: '试一试：打开日历——卡片会裁剪自身内容，但弹层被提升到顶层，仍完整显示。',
    },
    actions: { clear: '清除' },
    labels: { value: '值:' },
    placeholders: {
      pickDate: '选择日期',
      pickDateTime: '选择日期和时间',
      selectDateRange: '选择日期范围',
      hebrewDate: 'בחר תאריך',
    },
  },
  ru: {
    code: 'ru',
    title: 'Выбор даты',
    description: 'Компонент выбора даты с всплывающим календарём.',
    sections: {
      singleDate: 'Одна дата',
      dateTime: 'Дата и время',
      dateRange: 'Диапазон дат',
      rtlHebrew: 'Выбор даты RTL (иврит)',
      clearable: 'С очисткой',
      insideOverflowCard: 'Внутри карточки с overflow-hidden',
    },
    captions: {
      clearable: 'Попробуйте: выберите день, затем нажмите «Очистить» — запись null в [date] снимает выбор.',
      insideOverflowCard: 'Попробуйте: откройте календарь — карточка обрезает своё содержимое, но всплывающее окно поднимается в верхний слой и остаётся целым.',
    },
    actions: { clear: 'Очистить' },
    labels: { value: 'Значение:' },
    placeholders: {
      pickDate: 'Выберите дату',
      pickDateTime: 'Выберите дату и время',
      selectDateRange: 'Выберите диапазон дат',
      hebrewDate: 'בחר תאריך',
    },
  },
  pt: {
    code: 'pt',
    title: 'Seletor de data',
    description: 'Um componente seletor de data com calendário popover.',
    sections: {
      singleDate: 'Data única',
      dateTime: 'Data e hora',
      dateRange: 'Intervalo de datas',
      rtlHebrew: 'Seletor de data RTL (hebraico)',
      clearable: 'Limpável',
      insideOverflowCard: 'Dentro de um cartão com overflow-hidden',
    },
    captions: {
      clearable: 'Experimente: escolha um dia e clique em «Limpar» — escrever null em [date] descarta a seleção.',
      insideOverflowCard: 'Experimente: abra o calendário — o cartão recorta o próprio conteúdo, mas o popup é promovido à camada superior e aparece inteiro.',
    },
    actions: { clear: 'Limpar' },
    labels: { value: 'Valor:' },
    placeholders: {
      pickDate: 'Escolher uma data',
      pickDateTime: 'Escolher data e hora',
      selectDateRange: 'Selecionar intervalo de datas',
      hebrewDate: 'בחר תאריך',
    },
  },
};
