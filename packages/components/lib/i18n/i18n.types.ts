/**
 * Base metadata every locale dictionary in the library must carry.
 *
 * Per-component locale interfaces (e.g. `PaginationLocale`, `CalendarLocale`)
 * extend this so the resolver and consumers always have access to the BCP-47
 * code and the RTL flag.
 */
export interface LocaleMeta {
    /**
     * BCP-47 language tag, e.g. `'en'`, `'he'`, `'ar-EG'`. Used as the registry
     * key and forwarded to native `Intl` formatters.
     */
    code: string;

    /** `true` for Hebrew, Arabic, Farsi, Urdu, etc. */
    rtl?: boolean;
}

/**
 * Generic locale input: either a registry key (`'en'`) or a fully custom
 * dictionary object. Components accept this type so consumers can either pick
 * a built-in locale or supply their own without forking the component.
 */
export type LocaleInput<T extends LocaleMeta> = string | T;
