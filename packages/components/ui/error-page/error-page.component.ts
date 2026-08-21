import {
    ChangeDetectionStrategy,
    Component,
    computed,
    contentChild,
    input,
    output,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { createLocaleBindings, type LocaleInput } from '../../lib/i18n';
import { ERROR_PAGE_LOCALES, type ErrorPageLocale } from './error-page.locales';
import { ButtonComponent } from '../button';
import { ErrorPageActionsComponent } from './sub/error-page-actions.component';
import { ErrorPageIllustrationComponent } from './sub/error-page-illustration.component';

/**
 * HTTP status code the page is reporting.
 *
 * `'404' | '403' | '500'` are the codes shipped with default copy; any other
 * string is accepted and falls back to the locale's generic copy, so a
 * consumer can render `'418'` or `'maintenance'` without forking the component.
 */
export type ErrorPageCode = '404' | '403' | '500' | (string & {});

/**
 * ErrorPage — a full-page 404 / 403 / 500 state with an illustration slot,
 * message and recovery actions.
 *
 * **It reports; the consumer decides where to go.** The component emits
 * {@link goBack} and {@link goHome} and has no routing dependency of any kind —
 * routing is out of scope by design, in line with the project's rule against
 * DI-based configuration in owned code.
 *
 * ```html
 * <ui-error-page code="404" (goHome)="onHome()" (goBack)="onBack()" />
 * ```
 *
 * Default copy comes from `error-page.locales.ts`, keyed by {@link code}, and
 * is overridden per instance by {@link title} / {@link description}. Project a
 * `<ui-error-page-illustration>` to replace the typographic code, or a
 * `<ui-error-page-actions>` to replace both default buttons.
 */
@Component({
    selector: 'ui-error-page',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent],
    templateUrl: './error-page.component.html',
    host: {
        class: 'contents',
        '[attr.data-slot]': '"error-page-host"',
    },
})
export class ErrorPageComponent {
    /** Status code shown as the default illustration and used to pick the default copy. */
    readonly code = input<ErrorPageCode>('404');
    /** Overrides the code's default heading. */
    readonly title = input('');
    /** Overrides the code's default supporting line. */
    readonly description = input('');
    /** Extra classes merged onto the page container. */
    readonly class = input('');

    /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
    readonly locale = input<LocaleInput<ErrorPageLocale>>();
    private readonly i18n = createLocaleBindings(this.locale, ERROR_PAGE_LOCALES);
    protected readonly t = this.i18n.t;
    /** `'rtl'` for an RTL locale, otherwise null so an ancestor `dir` still applies. */
    protected readonly dir = this.i18n.dir;

    /** Emitted by the default back action. The consumer decides what "back" means. */
    readonly goBack = output<void>();
    /** Emitted by the default home action. The consumer decides where home is. */
    readonly goHome = output<void>();

    // `descendants: false` deliberately: `<ng-content select=...>` only matches
    // DIRECT children, so a descendants-true query would report an actions row
    // nested inside a wrapper `<div>` as present, suppress the default row, and
    // then project nothing at all — leaving the page with no actions.
    private readonly projectedIllustration = contentChild(ErrorPageIllustrationComponent, {
        descendants: false,
    });
    private readonly projectedActions = contentChild(ErrorPageActionsComponent, {
        descendants: false,
    });

    /** True while no `<ui-error-page-illustration>` is projected. */
    readonly showDefaultIllustration = computed(() => !this.projectedIllustration());
    /** True while no `<ui-error-page-actions>` is projected. */
    readonly showDefaultActions = computed(() => !this.projectedActions());

    /** Copy for the current {@link code}, falling back to the locale's generic copy. */
    private readonly copy = computed(() => {
        const { codes, fallback } = this.t();
        const code = this.code();
        // `Object.hasOwn`, not a truthiness check: a code like `'toString'` would
        // otherwise resolve to the inherited prototype member, which is neither
        // null nor undefined, so `??` would hand back a function to render.
        return Object.hasOwn(codes, code) ? codes[code] : fallback;
    });

    /** Effective heading — explicit {@link title} wins over the code's default. */
    readonly resolvedTitle = computed(() => this.title() || this.copy().title);
    /** Effective body — explicit {@link description} wins over the code's default. */
    readonly resolvedDescription = computed(
        () => this.description() || this.copy().description,
    );

    readonly classes = computed(() =>
        cn(
            'flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 p-4 text-center sm:min-h-[70vh] sm:gap-6 sm:p-6',
            this.class(),
        ),
    );
}
