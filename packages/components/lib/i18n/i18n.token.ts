import { InjectionToken, computed, signal, type Provider, type Signal } from '@angular/core';

/**
 * App-wide UI locale id (BCP-47 string) exposed as a **readonly** `Signal`.
 *
 * Components that accept a `locale` input fall back to this token when no
 * explicit input is provided, so consumers can wire one global signal at
 * the application root and have every shadcn-angular component pick it up.
 *
 * Defaults to a constant `'en'` signal so the library works out of the box
 * with no provider configuration.
 *
 * The token's type is intentionally `Signal<string>` (not `WritableSignal`)
 * — to switch the active locale at runtime, hold the writable handle in
 * your own code and pass it to `provideUiLocale(myWritableSignal)`.
 */
export const UI_LOCALE_ID = new InjectionToken<Signal<string>>('UI_LOCALE_ID', {
    providedIn: 'root',
    factory: () => signal('en').asReadonly(),
});

/**
 * Provide the app-wide UI locale.
 *
 * - A string sets a constant locale at bootstrap time.
 * - A `Signal<string>` (or `WritableSignal<string>`) enables runtime locale
 *   switching across the entire UI; mutate the original handle and every
 *   component that depends on `UI_LOCALE_ID` re-renders.
 *
 * The injected value is always exposed as a readonly `Signal<string>` —
 * caller-supplied writable signals are wrapped in a `computed()` so that
 * other code that injects the token cannot downcast and mutate it.
 *
 * ```ts
 * bootstrapApplication(App, {
 *   providers: [provideUiLocale(myLocaleSignal)],
 * });
 * ```
 */
export function provideUiLocale(locale: Signal<string> | string): Provider {
    const sig: Signal<string> =
        typeof locale === 'string' ? signal(locale).asReadonly() : computed(() => locale());
    return { provide: UI_LOCALE_ID, useValue: sig };
}
