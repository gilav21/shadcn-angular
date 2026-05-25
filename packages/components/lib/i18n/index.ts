export type { LocaleMeta, LocaleInput } from './i18n.types';
export { UI_LOCALE_ID, provideUiLocale, provideComponentLocale } from './i18n.token';
export {
    resolveLocale,
    createLocaleSelector,
    createLocaleBindings,
    interpolate,
    formatDate,
    formatNumber,
    formatList,
    formatRelativeTime,
    type LocaleBindings,
} from './i18n.utils';
export { COMMON_LOCALES, type CommonLocale } from './common.locales';
export { CALENDAR_LOCALES, type CalendarLocale } from './calendar.locales';
