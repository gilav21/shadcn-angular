import { InjectionToken, Injector, Type, computed, inject, signal, type Provider, type Signal } from '@angular/core';

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

/**
 * Make a compound component re-broadcast its `locale` input as the
 * `UI_LOCALE_ID` for descendants in its template. Add to the component's
 * **`viewProviders`** (not `providers` — `providers` would make the parent
 * recursively inject itself, causing a cyclic-DI error).
 *
 * ```ts
 * @Component({
 *   selector: 'ui-pagination',
 *   viewProviders: [provideComponentLocale(() => PaginationComponent)],
 * })
 * export class PaginationComponent {
 *   readonly locale = input<LocaleInput<PaginationLocale>>();
 * }
 * ```
 *
 * Projected sub-components (`<ui-pagination-previous>`, etc.) that inject
 * `UI_LOCALE_ID` now see the parent's locale instead of the app-wide token,
 * so `<ui-pagination locale="he">` localises every child without each child
 * needing its own `[locale]` binding.
 *
 * Falls through to the upstream `UI_LOCALE_ID` (skipSelf) when the parent's
 * `locale` input is unset / empty.
 */
export function provideComponentLocale<T extends { locale: Signal<unknown> }>(
    forwardCmp: () => Type<T>,
): Provider {
    return {
        provide: UI_LOCALE_ID,
        useFactory: (): Signal<string> => {
            // Capture the upstream UI_LOCALE_ID and an Injector handle EAGERLY
            // (these don't cycle); defer the component lookup to computed-time
            // so it doesn't recurse into the still-constructing parent.
            const upstream = inject(UI_LOCALE_ID, { skipSelf: true });
            const injector = inject(Injector);
            return computed(() => {
                const cmp = injector.get(forwardCmp(), null);
                if (!cmp) return upstream();
                const input = cmp.locale();
                if (input && typeof input === 'object' && 'code' in input) {
                    return (input as { code: string }).code;
                }
                if (typeof input === 'string' && input.length > 0) {
                    return input;
                }
                return upstream();
            });
        },
    };
}
