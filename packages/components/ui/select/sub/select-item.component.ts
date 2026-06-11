import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    computed,
    ElementRef,
    inject,
    input,
    OnDestroy,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SELECT } from '../select.component';

@Component({
    selector: 'ui-select-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <ng-content />
    <span [class]="checkmarkClasses()">
      @if (isSelected()) {
        <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      }
    </span>
  `,
    host: {
        '[class]': 'classes()',
        '[attr.role]': '"option"',
        '[attr.aria-selected]': 'isSelected()',
        '[attr.data-state]': 'isSelected() ? "checked" : "unchecked"',
        '[attr.data-slot]': '"select-item"',
        '[attr.tabindex]': '"-1"',
        '(click)': 'onClick()',
    },
})
export class SelectItemComponent implements AfterViewInit, OnDestroy {
    private readonly select = inject(SELECT, { optional: true });
    private readonly el = inject(ElementRef);

    value = input.required<string>();
    disabled = input(false);
    class = input('');

    isSelected = computed(() => this.select?.internalValue() === this.value());

    classes = computed(() => {
        return cn(
            'focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
            'ltr:pr-8 ltr:pl-2 rtl:pl-8 rtl:pr-2',
            this.disabled() && 'pointer-events-none opacity-50',
            this.class()
        );
    });

    checkmarkClasses = computed(() => {
        return cn(
            'absolute flex size-3.5 items-center justify-center ltr:right-2 rtl:left-2'
        );
    });

    ngAfterViewInit(): void {
        this.select?.registerItem(this.value(), this.el.nativeElement);
    }

    ngOnDestroy(): void {
        this.select?.unregisterItem(this.value());
    }

    onClick(): void {
        if (!this.disabled()) {
            this.select?.select(this.value() as string);
        }
    }
}
