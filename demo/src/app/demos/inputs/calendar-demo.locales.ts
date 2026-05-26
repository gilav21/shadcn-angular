// demo/src/app/demos/inputs/calendar-demo.locales.ts
import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface CalendarDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  modes: {
    single: string;
    range: string;
    multi: string;
    withSelectors: string;
    dateTime: string;
    dateTimeRange: string;
    rangeWithTimeRange: string;
    startMonString: string;
  };
  showcase: {
    defaultEnglish: string;
    hebrewRtl: string;
    japanese: string;
  };
}

export const CALENDAR_DEMO_LOCALES: Record<string, CalendarDemoLocale> = {
  en: { code: 'en',
    title: 'Calendar',
    description: 'A date picker calendar component supporting single, range, and multi-selection modes.',
    modes: {
      single: 'Single Mode', range: 'Range Mode', multi: 'Multi Mode',
      withSelectors: 'With Selectors', dateTime: 'Date & Time',
      dateTimeRange: 'Date & Time Range', rangeWithTimeRange: 'Range with Time Range',
      startMonString: 'Start Mon (String)',
    },
    showcase: { defaultEnglish: 'Default (English)', hebrewRtl: 'Hebrew (RTL)', japanese: 'Japanese' },
  },
  he: { code: 'he', rtl: true,
    title: 'לוח שנה',
    description: 'רכיב לוח שנה לבחירת תאריך, תומך במצבי בחירה יחידה, טווח ובחירה מרובה.',
    modes: {
      single: 'מצב יחיד', range: 'מצב טווח', multi: 'מצב מרובה',
      withSelectors: 'עם בוררים', dateTime: 'תאריך ושעה',
      dateTimeRange: 'טווח תאריך ושעה', rangeWithTimeRange: 'טווח עם טווח שעות',
      startMonString: 'התחלה ביום שני (מחרוזת)',
    },
    showcase: { defaultEnglish: 'ברירת מחדל (אנגלית)', hebrewRtl: 'עברית (RTL)', japanese: 'יפנית' },
  },
  ar: { code: 'ar', rtl: true,
    title: 'التقويم',
    description: 'مكوّن تقويم لاختيار التاريخ يدعم وضع الاختيار الفردي والنطاق والاختيار المتعدد.',
    modes: {
      single: 'الوضع الفردي', range: 'وضع النطاق', multi: 'الوضع المتعدد',
      withSelectors: 'مع المحدِّدات', dateTime: 'التاريخ والوقت',
      dateTimeRange: 'نطاق التاريخ والوقت', rangeWithTimeRange: 'نطاق مع نطاق وقت',
      startMonString: 'البداية الإثنين (نص)',
    },
    showcase: { defaultEnglish: 'الافتراضي (الإنجليزية)', hebrewRtl: 'العبرية (RTL)', japanese: 'اليابانية' },
  },
  de: { code: 'de',
    title: 'Kalender',
    description: 'Eine Datumsauswahl-Komponente, die Einzel-, Bereichs- und Mehrfachauswahl unterstützt.',
    modes: {
      single: 'Einzelmodus', range: 'Bereichsmodus', multi: 'Mehrfachmodus',
      withSelectors: 'Mit Auswahlfeldern', dateTime: 'Datum & Uhrzeit',
      dateTimeRange: 'Datum & Zeitbereich', rangeWithTimeRange: 'Bereich mit Zeitbereich',
      startMonString: 'Beginn Montag (String)',
    },
    showcase: { defaultEnglish: 'Standard (Englisch)', hebrewRtl: 'Hebräisch (RTL)', japanese: 'Japanisch' },
  },
  fr: { code: 'fr',
    title: 'Calendrier',
    description: 'Un sélecteur de date prenant en charge les modes simple, plage et sélection multiple.',
    modes: {
      single: 'Mode simple', range: 'Mode plage', multi: 'Mode multiple',
      withSelectors: 'Avec sélecteurs', dateTime: 'Date et heure',
      dateTimeRange: 'Plage date et heure', rangeWithTimeRange: 'Plage avec plage horaire',
      startMonString: 'Début lundi (chaîne)',
    },
    showcase: { defaultEnglish: 'Par défaut (anglais)', hebrewRtl: 'Hébreu (RTL)', japanese: 'Japonais' },
  },
  es: { code: 'es',
    title: 'Calendario',
    description: 'Componente de calendario para seleccionar fechas, con modos único, rango y múltiple.',
    modes: {
      single: 'Modo único', range: 'Modo rango', multi: 'Modo múltiple',
      withSelectors: 'Con selectores', dateTime: 'Fecha y hora',
      dateTimeRange: 'Rango de fecha y hora', rangeWithTimeRange: 'Rango con rango de hora',
      startMonString: 'Inicio lunes (cadena)',
    },
    showcase: { defaultEnglish: 'Predeterminado (inglés)', hebrewRtl: 'Hebreo (RTL)', japanese: 'Japonés' },
  },
  ja: { code: 'ja',
    title: 'カレンダー',
    description: '単一・範囲・複数選択をサポートする日付選択コンポーネントです。',
    modes: {
      single: '単一モード', range: '範囲モード', multi: '複数モード',
      withSelectors: 'セレクター付き', dateTime: '日付と時刻',
      dateTimeRange: '日付と時刻の範囲', rangeWithTimeRange: '範囲＋時刻範囲',
      startMonString: '月曜開始（文字列）',
    },
    showcase: { defaultEnglish: 'デフォルト (英語)', hebrewRtl: 'ヘブライ語 (RTL)', japanese: '日本語' },
  },
  zh: { code: 'zh',
    title: '日历',
    description: '日期选择器组件，支持单选、区间和多选模式。',
    modes: {
      single: '单选模式', range: '区间模式', multi: '多选模式',
      withSelectors: '带选择器', dateTime: '日期和时间',
      dateTimeRange: '日期与时间区间', rangeWithTimeRange: '区间与时间区间',
      startMonString: '周一开始（字符串）',
    },
    showcase: { defaultEnglish: '默认（英语）', hebrewRtl: '希伯来语（RTL）', japanese: '日语' },
  },
  ru: { code: 'ru',
    title: 'Календарь',
    description: 'Компонент выбора даты с режимами одиночного, диапазонного и множественного выбора.',
    modes: {
      single: 'Одиночный режим', range: 'Диапазон', multi: 'Множественный режим',
      withSelectors: 'С селекторами', dateTime: 'Дата и время',
      dateTimeRange: 'Диапазон даты и времени', rangeWithTimeRange: 'Диапазон с диапазоном времени',
      startMonString: 'Начало с понедельника (строка)',
    },
    showcase: { defaultEnglish: 'По умолчанию (английский)', hebrewRtl: 'Иврит (RTL)', japanese: 'Японский' },
  },
  pt: { code: 'pt',
    title: 'Calendário',
    description: 'Componente de seleção de datas com modos único, intervalo e múltipla seleção.',
    modes: {
      single: 'Modo único', range: 'Modo intervalo', multi: 'Modo múltiplo',
      withSelectors: 'Com seletores', dateTime: 'Data e hora',
      dateTimeRange: 'Intervalo de data e hora', rangeWithTimeRange: 'Intervalo com intervalo de hora',
      startMonString: 'Início segunda (string)',
    },
    showcase: { defaultEnglish: 'Padrão (inglês)', hebrewRtl: 'Hebraico (RTL)', japanese: 'Japonês' },
  },
};
