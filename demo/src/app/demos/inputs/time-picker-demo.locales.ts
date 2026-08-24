import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface TimePickerDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  basicHeading: string;
  basicDescription: string;
  localesHeading: string;
  localesDescription: string;
  secondsHeading: string;
  secondsDescription: string;
  formHeading: string;
  formDescription: string;
  timeLabel: string;
  valueLabel: string;
  touchedLabel: string;
  emptyValue: string;
}

export const TIME_PICKER_DEMO_LOCALES: Record<string, TimePickerDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Time Picker',
    description: 'A time of day, edited one segment at a time.',
    basicHeading: 'Basic',
    basicDescription:
      'The value is always a 24-hour “HH:mm” string, whatever the field shows.',
    localesHeading: 'One value, four locales',
    localesDescription:
      'Segment order, the meridiem and the digits all come from the locale. Traditional Chinese puts the meridiem first.',
    secondsHeading: 'With seconds',
    secondsDescription: 'Adds a third segment and widens the value to “HH:mm:ss”.',
    formHeading: 'In a reactive form',
    formDescription:
      'An hour with no minute is not a time, so the value stays empty until both are set.',
    timeLabel: 'Time',
    valueLabel: 'Value',
    touchedLabel: 'Touched',
    emptyValue: 'empty',
  },
  he: {
    code: 'he',
    heading: 'בורר שעה',
    description: 'שעה ביום, בעריכה מקטע אחר מקטע.',
    basicHeading: 'בסיסי',
    basicDescription: 'הערך תמיד מחרוזת „HH:mm” בפורמט 24 שעות, לא משנה מה מוצג בשדה.',
    localesHeading: 'ערך אחד, ארבעה אזורים',
    localesDescription:
      'סדר המקטעים, ציון חצי היום והספרות נקבעים כולם לפי האזור. בסינית מסורתית ציון חצי היום מופיע ראשון.',
    secondsHeading: 'עם שניות',
    secondsDescription: 'מוסיף מקטע שלישי ומרחיב את הערך ל־„HH:mm:ss”.',
    formHeading: 'בטופס ריאקטיבי',
    formDescription: 'שעה בלי דקות אינה שעה, ולכן הערך נשאר ריק עד שהשניים מוגדרים.',
    timeLabel: 'שעה',
    valueLabel: 'ערך',
    touchedLabel: 'נגעו',
    emptyValue: 'ריק',
  },
  ar: {
    code: 'ar',
    heading: 'منتقي الوقت',
    description: 'وقت من اليوم، يُحرَّر جزءًا تلو الآخر.',
    basicHeading: 'أساسي',
    basicDescription: 'القيمة دائمًا نص «HH:mm» بنظام 24 ساعة، مهما كان المعروض في الحقل.',
    localesHeading: 'قيمة واحدة، أربع لغات',
    localesDescription:
      'ترتيب الأجزاء وعلامة نصف اليوم والأرقام كلها تأتي من اللغة. الصينية التقليدية تضع علامة نصف اليوم أولًا.',
    secondsHeading: 'مع الثواني',
    secondsDescription: 'يضيف جزءًا ثالثًا ويوسّع القيمة إلى «HH:mm:ss».',
    formHeading: 'في نموذج تفاعلي',
    formDescription: 'ساعة بلا دقائق ليست وقتًا، لذا تبقى القيمة فارغة حتى يُضبط كلاهما.',
    timeLabel: 'الوقت',
    valueLabel: 'القيمة',
    touchedLabel: 'تم اللمس',
    emptyValue: 'فارغ',
  },
  de: {
    code: 'de',
    heading: 'Zeitauswahl',
    description: 'Eine Tageszeit, Segment für Segment bearbeitet.',
    basicHeading: 'Grundlagen',
    basicDescription:
      'Der Wert ist immer eine 24-Stunden-Zeichenkette „HH:mm“, egal was das Feld anzeigt.',
    localesHeading: 'Ein Wert, vier Sprachen',
    localesDescription:
      'Reihenfolge, Tageshälfte und Ziffern kommen alle aus der Sprache. Traditionelles Chinesisch stellt die Tageshälfte voran.',
    secondsHeading: 'Mit Sekunden',
    secondsDescription: 'Fügt ein drittes Segment hinzu und erweitert den Wert auf „HH:mm:ss“.',
    formHeading: 'In einem reaktiven Formular',
    formDescription:
      'Eine Stunde ohne Minute ist keine Zeit, daher bleibt der Wert leer, bis beide gesetzt sind.',
    timeLabel: 'Uhrzeit',
    valueLabel: 'Wert',
    touchedLabel: 'Berührt',
    emptyValue: 'leer',
  },
  fr: {
    code: 'fr',
    heading: 'Sélecteur d’heure',
    description: 'Une heure de la journée, modifiée segment par segment.',
    basicHeading: 'Basique',
    basicDescription:
      'La valeur est toujours une chaîne « HH:mm » sur 24 heures, quel que soit l’affichage.',
    localesHeading: 'Une valeur, quatre langues',
    localesDescription:
      'L’ordre des segments, le méridien et les chiffres viennent tous de la langue. Le chinois traditionnel place le méridien en premier.',
    secondsHeading: 'Avec les secondes',
    secondsDescription: 'Ajoute un troisième segment et élargit la valeur à « HH:mm:ss ».',
    formHeading: 'Dans un formulaire réactif',
    formDescription:
      'Une heure sans minute n’est pas une heure : la valeur reste vide tant que les deux ne sont pas saisies.',
    timeLabel: 'Heure',
    valueLabel: 'Valeur',
    touchedLabel: 'Touché',
    emptyValue: 'vide',
  },
  es: {
    code: 'es',
    heading: 'Selector de hora',
    description: 'Una hora del día, editada segmento a segmento.',
    basicHeading: 'Básico',
    basicDescription:
      'El valor siempre es una cadena «HH:mm» de 24 horas, sea cual sea lo que muestre el campo.',
    localesHeading: 'Un valor, cuatro idiomas',
    localesDescription:
      'El orden de los segmentos, el meridiano y los dígitos vienen del idioma. El chino tradicional pone el meridiano primero.',
    secondsHeading: 'Con segundos',
    secondsDescription: 'Añade un tercer segmento y amplía el valor a «HH:mm:ss».',
    formHeading: 'En un formulario reactivo',
    formDescription:
      'Una hora sin minutos no es una hora, así que el valor sigue vacío hasta que se fijen ambos.',
    timeLabel: 'Hora',
    valueLabel: 'Valor',
    touchedLabel: 'Tocado',
    emptyValue: 'vacío',
  },
  ja: {
    code: 'ja',
    heading: '時刻ピッカー',
    description: '一日の時刻を、区切りごとに編集します。',
    basicHeading: '基本',
    basicDescription: '表示が何であれ、値は常に 24 時間表記の「HH:mm」文字列です。',
    localesHeading: '1 つの値、4 つのロケール',
    localesDescription:
      '区切りの順序、午前・午後、数字はすべてロケールが決めます。繁体字中国語では午前・午後が先に来ます。',
    secondsHeading: '秒あり',
    secondsDescription: '3 つ目の区切りを加え、値を「HH:mm:ss」に広げます。',
    formHeading: 'リアクティブフォームで',
    formDescription: '分のない時は時刻ではないため、両方が揃うまで値は空のままです。',
    timeLabel: '時刻',
    valueLabel: '値',
    touchedLabel: 'タッチ済み',
    emptyValue: '空',
  },
  zh: {
    code: 'zh',
    heading: '时间选择器',
    description: '一天中的时间，逐段编辑。',
    basicHeading: '基础',
    basicDescription: '无论字段显示什么，值始终是 24 小时制的“HH:mm”字符串。',
    localesHeading: '一个值，四种语言',
    localesDescription:
      '分段顺序、上午下午以及数字都由语言决定。繁体中文会把上午下午放在最前面。',
    secondsHeading: '带秒',
    secondsDescription: '增加第三个分段，并把值扩展为“HH:mm:ss”。',
    formHeading: '在响应式表单中',
    formDescription: '只有小时没有分钟并不构成时间，因此在两者都设置之前值保持为空。',
    timeLabel: '时间',
    valueLabel: '值',
    touchedLabel: '已触碰',
    emptyValue: '空',
  },
  ru: {
    code: 'ru',
    heading: 'Выбор времени',
    description: 'Время суток, редактируемое посегментно.',
    basicHeading: 'Основное',
    basicDescription:
      'Значение всегда строка «HH:mm» в 24-часовом формате, что бы ни показывало поле.',
    localesHeading: 'Одно значение, четыре локали',
    localesDescription:
      'Порядок сегментов, обозначение половины суток и сами цифры берутся из локали. В традиционном китайском оно идёт первым.',
    secondsHeading: 'С секундами',
    secondsDescription: 'Добавляет третий сегмент и расширяет значение до «HH:mm:ss».',
    formHeading: 'В реактивной форме',
    formDescription:
      'Час без минут — не время, поэтому значение остаётся пустым, пока не заданы оба.',
    timeLabel: 'Время',
    valueLabel: 'Значение',
    touchedLabel: 'Затронуто',
    emptyValue: 'пусто',
  },
  pt: {
    code: 'pt',
    heading: 'Seletor de hora',
    description: 'Uma hora do dia, editada segmento a segmento.',
    basicHeading: 'Básico',
    basicDescription:
      'O valor é sempre uma string «HH:mm» de 24 horas, seja qual for a exibição.',
    localesHeading: 'Um valor, quatro idiomas',
    localesDescription:
      'A ordem dos segmentos, o meridiano e os dígitos vêm todos do idioma. O chinês tradicional coloca o meridiano primeiro.',
    secondsHeading: 'Com segundos',
    secondsDescription: 'Acrescenta um terceiro segmento e amplia o valor para «HH:mm:ss».',
    formHeading: 'Num formulário reativo',
    formDescription:
      'Uma hora sem minutos não é uma hora, por isso o valor permanece vazio até ambos serem definidos.',
    timeLabel: 'Hora',
    valueLabel: 'Valor',
    touchedLabel: 'Tocado',
    emptyValue: 'vazio',
  },
};
