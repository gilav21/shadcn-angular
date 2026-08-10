import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SELECT } from '../select.component';
import { SpinnerComponent } from '../../spinner';
import { SkeletonComponent } from '../../skeleton';

@Component({
    selector: 'ui-select-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SpinnerComponent, SkeletonComponent],
    styleUrl: './select-trigger.component.css',
    template: `
    @if (skeleton()) {
      <ui-skeleton class="h-9 w-full rounded-md" />
    } @else {
      <button
        type="button"
        role="combobox"
        [class]="classes()"
        [disabled]="(select?.isDisabled() ?? false) || loading()"
        [attr.aria-expanded]="select?.open()"
        [attr.data-state]="select?.open() ? 'open' : 'closed'"
        [attr.aria-label]="resolvedAriaLabel()"
        aria-controls="select-content"
        [attr.data-slot]="'select-trigger'"
        (click)="onClick($event)"
        (keydown)="onKeyDown($event)"
      >
        <ng-content />
        @if (loading()) {
          <ui-spinner size="xs" />
        } @else {
          <svg
            [class]="chevronClasses()"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        }
      </button>
    }
  `,
    host: { class: 'contents' },
})
export class SelectTriggerComponent {
    readonly select = inject(SELECT, { optional: true });
    /** Extra classes merged onto the trigger button, after the defaults so they can override them. */
    class = input('');
    /** Explicit accessible name; overrides the placeholder fallback in {@link resolvedAriaLabel}. */
    ariaLabel = input<string | undefined>(undefined);
    /**
     * Swaps the chevron for a spinner and disables the button, e.g. while
     * options are being fetched. The popup can still be opened
     * programmatically — only the trigger is blocked.
     */
    readonly loading = input(false);
    /**
     * Replaces the whole trigger with a fixed-height skeleton placeholder. Wins
     * over {@link loading}: nothing interactive is rendered at all, so use it
     * for initial page load and {@link loading} for a refresh.
     */
    readonly skeleton = input(false);

    /**
     * Accessible name for the trigger. `role="combobox"` takes its name from the
     * author, *not* from its contents — so the visible `<ui-select-value>` text
     * does not name it and the control was reaching screen readers anonymous
     * (axe `button-name`). Fall back to the select's resolved placeholder, which
     * is the same string the user sees, unless the consumer supplies a name.
     */
    readonly resolvedAriaLabel = computed(
        () => this.ariaLabel() ?? this.select?.resolvedPlaceholder() ?? 'Select',
    );

    readonly classes = computed(() =>
        cn(
            'border-input data-[placeholder]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-fit items-center justify-between rounded-md border bg-transparent text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4 dark:bg-input/50 dark:hover:bg-input/70',
            this.class()
        )
    );

    readonly chevronClasses = computed(() =>
        cn(
            'size-4 opacity-50 shrink-0'
        )
    );

    /**
     * Toggles the parent select and stops propagation, so the select's
     * document-level outside-click listener does not immediately close what
     * this click just opened.
     */
    onClick(event: MouseEvent): void {
        event.stopPropagation();
        this.select?.toggle();
    }

    /**
     * Enter, Space and ArrowDown open the parent select — they never close it,
     * so the popup's own handler owns Escape/Tab. Ignored while the select is
     * disabled.
     */
    onKeyDown(event: KeyboardEvent): void {
        if (this.select?.isDisabled()) return;

        switch (event.key) {
            case 'Enter':
            case ' ':
            case 'ArrowDown':
                event.preventDefault();
                if (!this.select?.open()) {
                    this.select?.open.set(true);
                }
                break;
        }
    }
}
