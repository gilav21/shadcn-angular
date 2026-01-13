import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    inject,
    InjectionToken,
    forwardRef,
} from '@angular/core';
import { cn } from '../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const toggleVariants = cva(
    'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] whitespace-nowrap',
    {
        variants: {
            variant: {
                default: 'bg-transparent',
                outline:
                    'border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground',
            },
            size: {
                default: 'h-9 px-2 min-w-9',
                sm: 'h-8 px-1.5 min-w-8',
                lg: 'h-10 px-2.5 min-w-10',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);

export type ToggleGroupVariant = VariantProps<typeof toggleVariants>['variant'];
export type ToggleGroupSize = VariantProps<typeof toggleVariants>['size'];
export type ToggleGroupType = 'single' | 'multiple';

export const TOGGLE_GROUP = new InjectionToken<ToggleGroupComponent>('TOGGLE_GROUP');

@Component({
    selector: 'ui-toggle-group',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div 
      [class]="classes()" 
      [attr.data-slot]="'toggle-group'"
      [attr.data-variant]="variant()"
      [attr.data-size]="size()"
      role="group"
    >
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
    providers: [{ provide: TOGGLE_GROUP, useExisting: forwardRef(() => ToggleGroupComponent) }],
})
export class ToggleGroupComponent {
    type = input<ToggleGroupType>('single');
    variant = input<ToggleGroupVariant>('default');
    size = input<ToggleGroupSize>('default');
    disabled = input(false);
    defaultValue = input<string | string[] | undefined>(undefined);
    class = input('');
    valueChange = output<string | string[]>();

    value = signal<string[]>([]);

    ngOnInit() {
        const defaultVal = this.defaultValue();
        if (defaultVal) {
            this.value.set(Array.isArray(defaultVal) ? defaultVal : [defaultVal]);
        }
    }

    classes = computed(() =>
        cn(
            'group/toggle-group flex w-fit items-center rounded-md',
            this.variant() === 'outline' && 'shadow-xs',
            this.class()
        )
    );

    isSelected(itemValue: string): boolean {
        return this.value().includes(itemValue);
    }

    toggle(itemValue: string) {
        if (this.disabled()) return;

        const current = this.value();
        let newValue: string[];

        if (this.type() === 'single') {
            newValue = current.includes(itemValue) ? [] : [itemValue];
        } else {
            if (current.includes(itemValue)) {
                newValue = current.filter(v => v !== itemValue);
            } else {
                newValue = [...current, itemValue];
            }
        }

        this.value.set(newValue);

        if (this.type() === 'single') {
            this.valueChange.emit(newValue[0] ?? '');
        } else {
            this.valueChange.emit(newValue);
        }
    }
}

@Component({
    selector: 'ui-toggle-group-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <button
      type="button"
      [class]="classes()"
      [disabled]="group?.disabled() || disabled()"
      [attr.aria-pressed]="isSelected()"
      [attr.data-state]="isSelected() ? 'on' : 'off'"
      [attr.aria-label]="ariaLabel()"
      [attr.data-slot]="'toggle-group-item'"
      (click)="onClick()"
    >
      <ng-content />
    </button>
  `,
    host: {
        class: 'contents',
        '[attr.aria-label]': 'null'
    },
})
export class ToggleGroupItemComponent {
    group = inject(TOGGLE_GROUP, { optional: true });

    value = input.required<string>();
    disabled = input(false);
    class = input('');
    ariaLabel = input<string | undefined>(undefined);

    isSelected = computed(() => this.group?.isSelected(this.value()) ?? false);

    classes = computed(() => {
        const variant = this.group?.variant() ?? 'default';
        const size = this.group?.size() ?? 'default';

        return cn(
            toggleVariants({ variant, size }),
            'w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10',
            'rounded-none shadow-none ltr:first:rounded-l-md ltr:last:rounded-r-md rtl:first:rounded-r-md rtl:last:rounded-l-md',
            variant === 'outline' && 'ltr:border-l-0 ltr:first:border-l rtl:border-r-0 rtl:first:border-r',
            this.class()
        );
    });

    onClick() {
        if (!this.disabled()) {
            this.group?.toggle(this.value());
        }
    }
}
