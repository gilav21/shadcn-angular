import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
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

export type ToggleVariant = VariantProps<typeof toggleVariants>['variant'];
export type ToggleSize = VariantProps<typeof toggleVariants>['size'];

@Component({
    selector: 'ui-toggle',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <button
      type="button"
      [class]="classes()"
      [disabled]="disabled()"
      [attr.aria-pressed]="pressed()"
      [attr.data-state]="pressed() ? 'on' : 'off'"
      [attr.data-slot]="'toggle'"
      (click)="onClick()"
    >
      <ng-content />
    </button>
  `,
    host: { class: 'contents' },
})
export class ToggleComponent {
    variant = input<ToggleVariant>('default');
    size = input<ToggleSize>('default');
    disabled = input(false);
    defaultPressed = input(false);
    class = input('');
    pressedChange = output<boolean>();

    pressed = signal(false);

    constructor() {
        const defaultVal = this.defaultPressed();
        if (defaultVal) {
            this.pressed.set(defaultVal);
        }
    }

    classes = computed(() =>
        cn(
            toggleVariants({ variant: this.variant(), size: this.size() }),
            this.class()
        )
    );

    onClick() {
        if (!this.disabled()) {
            const newState = !this.pressed();
            this.pressed.set(newState);
            this.pressedChange.emit(newState);
        }
    }

    setPressed(value: boolean) {
        this.pressed.set(value);
    }
}
