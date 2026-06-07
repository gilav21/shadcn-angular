import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SELECT } from '../select.component';

@Component({
    selector: 'ui-select-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    styleUrl: './select-trigger.component.css',
    template: `
    <button
      type="button"
      role="combobox"
      [class]="classes()"
      [disabled]="select?.isDisabled() ?? false"
      [attr.aria-expanded]="select?.open()"
      [attr.data-state]="select?.open() ? 'open' : 'closed'"
      [attr.aria-label]="ariaLabel()"
      [attr.data-slot]="'select-trigger'"
      (click)="onClick($event)"
      (keydown)="onKeyDown($event)"
    >
      <ng-content />
      <svg
        [class]="chevronClasses()"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  `,
    host: { class: 'contents' },
})
export class SelectTriggerComponent {
    readonly select = inject(SELECT, { optional: true });
    class = input('');
    ariaLabel = input<string | undefined>(undefined);

    classes = computed(() =>
        cn(
            'border-input data-[placeholder]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-fit items-center justify-between gap-[calc(0.5rem*var(--_d))] rounded-md border bg-transparent px-[calc(0.75rem*var(--_d))] py-[calc(0.5rem*var(--_d))] text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 h-[calc(2.25rem*var(--_d))] [&>span]:line-clamp-1 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4 dark:bg-input/50 dark:hover:bg-input/70',
            this.class()
        )
    );

    chevronClasses = computed(() =>
        cn(
            'size-4 opacity-50 shrink-0'
        )
    );

    onClick(event: MouseEvent) {
        event.stopPropagation();
        this.select?.toggle();
    }

    onKeyDown(event: KeyboardEvent) {
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
