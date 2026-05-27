import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface DatePickerDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  sections: {
    singleDate: string;
    dateTime: string;
    dateRange: string;
    rtlHebrew: string;
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
    placeholders: {
      pickDate: 'Escolher uma data',
      pickDateTime: 'Escolher data e hora',
      selectDateRange: 'Selecionar intervalo de datas',
      hebrewDate: 'בחר תאריך',
    },
  },
};
