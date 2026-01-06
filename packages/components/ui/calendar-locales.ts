export interface CalendarLocale {
    monthNames: string[];
    dayNames: string[];
    timeLabel?: string;
    prevMonthLabel?: string;
    nextMonthLabel?: string;
}

export const CALENDAR_LOCALES: Record<string, CalendarLocale> = {
    en: {
        monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        dayNames: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
        timeLabel: 'Time',
        prevMonthLabel: 'Previous month',
        nextMonthLabel: 'Next month',
    },
    he: {
        monthNames: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'],
        dayNames: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'],
        timeLabel: 'שעה',
        prevMonthLabel: 'החודש הקודם',
        nextMonthLabel: 'החודש הבא',
    },
    ar: {
        monthNames: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
        dayNames: ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'],
        timeLabel: 'الوقت',
        prevMonthLabel: 'الشهر السابق',
        nextMonthLabel: 'الشهر التالي',
    },
    de: {
        monthNames: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
        dayNames: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
        timeLabel: 'Zeit',
        prevMonthLabel: 'Vorheriger Monat',
        nextMonthLabel: 'Nächster Monat',
    },
    fr: {
        monthNames: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
        dayNames: ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'],
        timeLabel: 'Heure',
        prevMonthLabel: 'Mois précédent',
        nextMonthLabel: 'Mois suivant',
    },
    es: {
        monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
        dayNames: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
        timeLabel: 'Hora',
        prevMonthLabel: 'Mes anterior',
        nextMonthLabel: 'Mes siguiente',
    },
    ja: {
        monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
        dayNames: ['日', '月', '火', '水', '木', '金', '土'],
        timeLabel: '時間',
        prevMonthLabel: '前月',
        nextMonthLabel: '翌月',
    },
    zh: {
        monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
        dayNames: ['日', '一', '二', '三', '四', '五', '六'],
        timeLabel: '时间',
        prevMonthLabel: '上个月',
        nextMonthLabel: '下个月',
    },
    ru: {
        monthNames: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
        dayNames: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
        timeLabel: 'Время',
        prevMonthLabel: 'Предыдущий месяц',
        nextMonthLabel: 'Следующий месяц',
    },
    pt: {
        monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
        dayNames: ['Do', 'Se', 'Te', 'Qu', 'Qu', 'Se', 'Sá'],
        timeLabel: 'Hora',
        prevMonthLabel: 'Mês anterior',
        nextMonthLabel: 'Próximo mês',
    },
};
