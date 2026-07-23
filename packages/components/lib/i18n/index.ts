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
// Locale string bundles are intentionally NOT re-exported by this barrel:
// re-exporting them would drag every locale file into any consumer that imports
// the barrel. Import CALENDAR_LOCALES / COMMON_LOCALES straight from their own
// sibling modules where they are actually needed.
