import {
    Component,
    ChangeDetectionStrategy,
    ElementRef,
    AfterViewInit,
    computed,
    signal,
    inject,
    viewChild,
} from '@angular/core';
import { CollapsibleComponent } from '../collapsible.component';

/** What counts as a control the user can already reach and operate on its own. */
const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"], [tabindex]';

@Component({
    selector: 'ui-collapsible-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
      #trigger
      (click)="onClick()"
      (keydown.enter)="onClick()"
      (keydown.space)="onClick()"
      [class]="classes()"
      [attr.role]="ownsFocus() ? 'button' : null"
      [attr.tabindex]="ownsFocus() ? 0 : null"
      [attr.aria-expanded]="ownsFocus() ? isOpen() : null"
      [attr.aria-disabled]="ownsFocus() && isDisabled() ? 'true' : null"
      [attr.data-state]="isOpen() ? 'open' : 'closed'"
      [attr.data-slot]="'collapsible-trigger'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class CollapsibleTriggerComponent implements AfterViewInit {
    readonly collapsible = inject(CollapsibleComponent, { optional: true });
    private readonly trigger = viewChild.required<ElementRef<HTMLElement>>('trigger');

    private readonly projectsOwnControl = signal(false);

    /**
     * Whether this wrapper is itself the control, rather than a shell around one
     * the consumer supplied.
     *
     * Both shapes are in use. Some triggers wrap plain content — a label and a
     * chevron — and must therefore be the button themselves. Others project a
     * real `<ui-button>`, and there the wrapper must stay out of the way: giving
     * it `role="button"` would nest one control inside another (axe's
     * `nested-interactive`, a WCAG 4.1.2 failure), and giving it `tabindex`
     * adds a second tab stop with no accessible name — which is what it did
     * before, on every such usage.
     */
    readonly ownsFocus = computed(() => !this.projectsOwnControl());

    readonly isOpen = computed(() => this.collapsible?.open() ?? false);
    readonly isDisabled = computed(() => this.collapsible?.disabled() ?? false);

    readonly classes = computed(() =>
        this.ownsFocus()
            ? 'cursor-pointer select-none outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-sm'
            : '',
    );

    /**
     * Read after the view is up, not at `ngAfterContentInit`: a projected
     * `<ui-button>` is a component, and its own view — the `<button>` this
     * query looks for — does not exist yet at content-init. Checking too early
     * reported "no control projected" for every such usage.
     */
    ngAfterViewInit(): void {
        // Query from inside the span, never from the host: the host's only
        // element child IS this span, which carries `tabindex` itself, so a
        // host-rooted query matches its own trigger and every usage looks as
        // though it projects a control.
        const span = this.trigger().nativeElement;
        this.projectsOwnControl.set(span.querySelector(INTERACTIVE) !== null);
    }

    /**
     * Toggles the enclosing `<ui-collapsible>`. Already bound to the trigger's click, Enter and
     * Space; does nothing when the trigger is used outside a collapsible. Respects the parent's
     * `disabled` input, since it delegates to its `toggle()`.
     */
    onClick(): void {
        this.collapsible?.toggle();
    }
}
