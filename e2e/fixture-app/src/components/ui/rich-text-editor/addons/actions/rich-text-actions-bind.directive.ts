import { Directive, DestroyRef, effect, ElementRef, inject, input } from '@angular/core';
import {
    bindRichTextActions, type BindRichTextActionsOptions, type RichTextActionHandler,
} from './actions-runtime';

/**
 * Binds {@link bindRichTextActions} to a host element and keeps it re-bound
 * across `[innerHTML]` swaps (a `MutationObserver` re-binds once per coalesced
 * mutation batch). Delivers typed action events to the handler map.
 *
 * @example
 * ```html
 * <article [innerHTML]="trustedHtml" [uiRichTextActions]="handlers"></article>
 * ```
 */
@Directive({ selector: '[uiRichTextActions]', standalone: true })
export class RichTextActionsBindDirective {
    private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

    /** Map of action id → handler, plus an optional `'*'` catch-all. */
    readonly uiRichTextActions = input<Record<string, RichTextActionHandler>>({});
    /**
     * How hover actions behave on touch. `'tap-to-hover'` (default) makes the
     * first tap on a hover element open it (suppressing the synthetic click)
     * and the next tap elsewhere close it; `'off'` delivers no hover on touch,
     * leaving taps to fire click actions only.
     */
    readonly touchHoverBehavior = input<'tap-to-hover' | 'off'>('tap-to-hover');
    /**
     * Add `tabindex="0"` to every actioned element (and `role="button"` to
     * click ones) so keyboard users can reach and `Enter`/`Space` them.
     * Default true — turn it off only if the markup already provides them.
     */
    readonly a11yAffordances = input(true);
    /**
     * Class added to each actioned element as a styling hook, plus a
     * `-click`/`-hover` suffixed variant per trigger. `null` adds none.
     * Applied and reverted on every re-bind, so it must not clash with
     * classes the content itself carries.
     */
    readonly decorateClass = input<string | null>('rte-action');

    private unbind: (() => void) | null = null;
    private observer: MutationObserver | null = null;
    private latestOptions: BindRichTextActionsOptions = { handlers: {} };

    constructor() {
        effect(() => {
            this.latestOptions = {
                handlers: this.uiRichTextActions(),
                touchHoverBehavior: this.touchHoverBehavior(),
                a11yAffordances: this.a11yAffordances(),
                decorateClass: this.decorateClass(),
            };
            this.rebind();
            this.ensureObserver();
        });

        inject(DestroyRef).onDestroy(() => {
            this.unbind?.();
            this.observer?.disconnect();
        });
    }

    private rebind(): void {
        this.unbind?.();
        this.unbind = bindRichTextActions(this.el.nativeElement, this.latestOptions);
    }

    private ensureObserver(): void {
        if (this.observer) return;
        this.observer = new MutationObserver(() => this.rebind());
        this.observer.observe(this.el.nativeElement, { childList: true, subtree: true });
    }
}
