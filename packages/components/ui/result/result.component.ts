import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../../lib/utils';

/**
 * Outcome of the operation the panel is reporting. Drives the icon glyph and
 * its colour; it never changes how loudly the panel is announced, which stays
 * polite for every status — see the class JSDoc.
 */
export type ResultStatus = 'success' | 'error' | 'warning' | 'info';

/** Colour treatment per status — four distinct hues, one the shared destructive token. */
const STATUS_COLOURS: Readonly<Record<ResultStatus, string>> = {
    success: 'text-green-600 dark:text-green-500',
    error: 'text-destructive',
    warning: 'text-amber-600 dark:text-amber-500',
    info: 'text-blue-600 dark:text-blue-500',
};

/** Single-path 24×24 glyph per status, stroked with `currentColor`. */
const STATUS_GLYPHS: Readonly<Record<ResultStatus, string>> = {
    success: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Zm-3.5-9 2.5 2.5 4.5-4.5',
    error: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18ZM9 9l6 6m0-6-6 6',
    warning:
        'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01',
    info: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Zm0-13h.01M11 12h1v4h1',
};

/**
 * Result — a centred in-page outcome panel shown after an operation completes:
 * a form submit, a checkout, a bulk action.
 *
 * **It announces, but never interrupts and never focuses.** The panel is a
 * `role="status"` / `aria-live="polite"` region for *every* status, error
 * included. An assertive region cuts a screen reader off mid-sentence, which a
 * result is not worth; and nothing here calls `.focus()`, so a panel appearing
 * beside a form cannot pull the caret out of it.
 *
 * ```html
 * <ui-result status="success" title="Payment received"
 *            description="We emailed your receipt.">
 *   <ui-button>Back to dashboard</ui-button>
 * </ui-result>
 * ```
 *
 * Projected content lands in the actions row. For anything bulkier — an error
 * dump, a summary table — project a `<ui-result-detail>`, which is pulled out
 * of the default slot and rendered above the actions.
 */
@Component({
    selector: 'ui-result',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './result.component.html',
    host: {
        class: 'contents',
        '[attr.data-slot]': '"result-host"',
    },
})
export class ResultComponent {
    /** Outcome being reported. Drives the glyph and its colour. */
    readonly status = input<ResultStatus>('info');
    /** Headline, e.g. `'Payment received'`. Omitted entirely when empty. */
    readonly title = input('');
    /** Supporting line under the headline. Omitted entirely when empty. */
    readonly description = input('');
    /** Extra classes merged onto the panel. */
    readonly class = input('');

    /** Glyph path for the active {@link status}. */
    readonly glyph = computed(() => STATUS_GLYPHS[this.status()]);

    readonly classes = computed(() =>
        cn(
            'flex w-full flex-col items-center gap-2 p-4 text-center sm:gap-3 sm:p-6',
            this.class(),
        ),
    );

    readonly iconClasses = computed(() =>
        cn('flex items-center justify-center', STATUS_COLOURS[this.status()]),
    );
}
