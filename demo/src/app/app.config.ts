import { ApplicationConfig, InjectionToken, WritableSignal, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideUiLocale } from '../../../packages/components/lib/i18n';
import { DEMO_ROUTES } from './demo.routes';

/**
 * Token exposing the demo app's writable locale signal so any component
 * (the locale switcher in the header) can inject it and call `.set()`.
 * `provideUiLocale(...)` wraps this same signal as the read-only
 * `UI_LOCALE_ID` that every shadcn-angular component subscribes to.
 */
export const APP_LOCALE = new InjectionToken<WritableSignal<string>>('APP_LOCALE');

const appLocale = signal<string>('en');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // `withComponentInputBinding()` lets `/docs/:name` bind the route parameter
    // straight into `DocsPageComponent`'s `name` input, with no ActivatedRoute
    // plumbing in the component.
    provideRouter(DEMO_ROUTES, withComponentInputBinding()),
    { provide: APP_LOCALE, useValue: appLocale },
    provideUiLocale(appLocale),
  ],
};
