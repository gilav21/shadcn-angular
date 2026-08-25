import { computed, inject, type Signal } from '@angular/core';
import { UI_LOCALE_ID } from './i18n.token';
import type { LocaleInput, LocaleMeta } from './i18n.types';

/**
 * Pure locale resolver — resolve a per-component input + a global locale key
 * to a concrete dictionary.
 *
 * Resolution order:
 * 1. `input` is a non-null object → use it as-is (consumer-supplied custom
 *    locale).
 * 2. `input` is a non-empty string → look up `registry[input]`.
 * 3. If step 2 missed (or `input` was `undefined`/`''`) → look up
 *    `registry[globalKey]`.
 * 4. If that also missed → `registry[fallback]` (default `'en'`).
 * 5. If even the fallback is absent the registry is malformed; throw a
 *    descriptive error so the failure mode is loud, not a silent
 *    `undefined` reaching a template.
 *
 * Treating `''` the same as `undefined` means components binding `locale`
 * to a form control / query param that hasn't been set yet still inherit
 * the app-wide global locale.
 */
export function resolveLocale<T extends LocaleMeta>(
    input: LocaleInput<T> | undefined,
    registry: Record<string, T>,
    globalKey: string,
    fallback = 'en',
): T {
    if (input && typeof input === 'object') return input;
    const explicit =
        typeof input === 'string' && input.length > 0 ? registry[input] : undefined;
    const resolved = explicit ?? registry[globalKey] ?? registry[fallback];
    if (!resolved) {
        throw new Error(
            `[shadcn-angular i18n] Locale registry is missing the "${fallback}" fallback entry. ` +
                `Every registry must define at least the fallback locale.`,
        );
    }
    return resolved;
}

/**
 * Component helper — build a `Signal<T>` that resolves the active locale,
 * reacting to both the per-instance `locale` input and the global
 * `UI_LOCALE_ID` signal.
 *
 * Must be called in an injection context (component constructor or field
 * initializer).
 *
 * ```ts
 * readonly locale = input<LocaleInput<PaginationLocale>>();
 * protected readonly t = createLocaleSelector(this.locale, PAGINATION_LOCALES);
 * ```
 */
export function createLocaleSelector<T extends LocaleMeta>(
    localeInput: Signal<LocaleInput<T> | undefined>,
    registry: Record<string, T>,
    fallback = 'en',
): Signal<T> {
    if (typeof localeInput !== 'function') {
        throw new TypeError(
            '[shadcn-angular i18n] createLocaleSelector received a non-Signal `localeInput`. ' +
                'Common cause: the `locale = input(...)` field is declared AFTER the field that ' +
                'calls createLocaleSelector / createLocaleBindings. Declare `locale` BEFORE ' +
                'any field that depends on `this.locale` so its initializer has already run.',
        );
    }
    const globalLocale = inject(UI_LOCALE_ID);
    return computed(() => resolveLocale(localeInput(), registry, globalLocale(), fallback));
}

/**
 * Convenience bundle: the resolved locale, an `isRtl` signal, and a `dir`
 * signal ready to bind to `[attr.dir]`. Use this in components to avoid
 * duplicating the same three computed signals across the library.
 *
 * ```ts
 * private readonly i18n = createLocaleBindings(this.locale, PAGINATION_LOCALES);
 * protected readonly t = this.i18n.t;
 * protected readonly dir = this.i18n.dir;
 * ```
 *
 * `dir` resolves to `'rtl'` when the active locale is RTL and to `null`
 * otherwise. Binding `[attr.dir]="dir()"` therefore emits `dir="rtl"`
 * only when needed — and crucially never `dir="ltr"`, so an ancestor
 * `<html dir="rtl">` continues to apply for LTR-base locales the
 * component doesn't recognise as explicitly RTL.
 *
 * Must be called in an injection context.
 */
export interface LocaleBindings<T extends LocaleMeta> {
    readonly t: Signal<T>;
    readonly isRtl: Signal<boolean>;
    readonly dir: Signal<'rtl' | null>;
}

export function createLocaleBindings<T extends LocaleMeta>(
    localeInput: Signal<LocaleInput<T> | undefined>,
    registry: Record<string, T>,
    fallback = 'en',
): LocaleBindings<T> {
    const t = createLocaleSelector(localeInput, registry, fallback);
    const isRtl = computed(() => t().rtl === true);
    const dir = computed<'rtl' | null>(() => (isRtl() ? 'rtl' : null));
    return { t, isRtl, dir };
}

/**
 * Replace `{placeholder}` tokens in a template with values from `values`.
 *
 * Placeholder names may contain any character except `}` — so `{user.name}`,
 * `{count-total}`, and `{0}` are all valid.
 *
 * ```ts
 * interpolate('Page {n} of {total}', { n: 3, total: 7 }); // 'Page 3 of 7'
 * ```
 *
 * Unknown placeholders are left as-is (e.g. `{unknown}`) so missing values
 * surface at runtime instead of silently rendering `undefined` or an empty
 * string.
 *
 * Note: the JS template-literal form `${name}` is NOT a special case — only
 * the bare `{name}` braces are recognised. A template like `'$${x}'` with
 * `{ x: 'v' }` yields `'$$v'`, which is rarely what a translator intends.
 */
export function interpolate(
    template: string,
    values: Record<string, string | number>,
): string {
    return template.replaceAll(/\{([^}]{1,256})\}/g, (match, k: string) =>
        Object.hasOwn(values, k) ? String(values[k]) : match,
    );
}

/** Thin wrapper around `Intl.DateTimeFormat`. */
export function formatDate(
    date: Date,
    locale: string,
    options?: Intl.DateTimeFormatOptions,
): string {
    return new Intl.DateTimeFormat(locale, options).format(date);
}

/** Thin wrapper around `Intl.NumberFormat`. */
export function formatNumber(
    value: number,
    locale: string,
    options?: Intl.NumberFormatOptions,
): string {
    return new Intl.NumberFormat(locale, options).format(value);
}

/** Thin wrapper around `Intl.ListFormat`. */
export function formatList(
    items: readonly string[],
    locale: string,
    options?: Intl.ListFormatOptions,
): string {
    return new Intl.ListFormat(locale, options).format(items);
}

/** Thin wrapper around `Intl.RelativeTimeFormat`. */
export function formatRelativeTime(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    locale: string,
    options?: Intl.RelativeTimeFormatOptions,
): string {
    return new Intl.RelativeTimeFormat(locale, options).format(value, unit);
}

/**
 * This locale's glyphs for 0–9, in order.
 *
 * A locale's digits are not necessarily ASCII: `ar-EG` writes `١٢٣`, `fa-IR`
 * writes `۱۲۳`. A field that formats with `Intl` and then parses with a
 * `[0-9]` class does not merely mishandle foreign input — it rejects the exact
 * string it just produced.
 */
export function localeDigits(locale: string): readonly string[] {
    const formatter = new Intl.NumberFormat(locale, { useGrouping: false });
    return Array.from({ length: 10 }, (_, digit) => formatter.format(digit));
}

/**
 * Rewrite a locale's digits as ASCII so the result can be parsed as a number.
 *
 * Pass the locale's own `digits` when they are already to hand; otherwise this
 * asks for them. Characters that are not digits are left exactly as they are —
 * separators and symbols are the caller's problem, not this function's.
 */
export function toAsciiDigits(text: string, digits: readonly string[]): string {
    let result = '';
    for (const char of text) {
        const value = digits.indexOf(char);
        result += value === -1 ? char : String(value);
    }
    return result;
}
