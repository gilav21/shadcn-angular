import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    InjectionToken,
    forwardRef,
    OnInit,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { ToggleGroupItemComponent } from './sub/toggle-group-item.component';

export interface ToggleGroupItem {
    value: string;
    label?: string;
    icon?: string;
    disabled?: boolean;
}

export const toggleVariants = cva(
    'inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] whitespace-nowrap',
    {
        variants: {
            variant: {
                default: 'bg-transparent',
                outline:
                    'border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground',
            },
            size: {
                default: 'min-w-9',
                sm: 'min-w-8',
                lg: 'min-w-10',
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
    imports: [forwardRef(() => ToggleGroupItemComponent)],
    templateUrl: './toggle-group.component.html',
    host: { class: 'contents' },
    providers: [{ provide: TOGGLE_GROUP, useExisting: forwardRef(() => ToggleGroupComponent) }],
})
export class ToggleGroupComponent implements OnInit {
    type = input<ToggleGroupType>('single');
    variant = input<ToggleGroupVariant>('default');
    size = input<ToggleGroupSize>('default');
    disabled = input(false);
    defaultValue = input<string | string[] | undefined>(undefined);
    class = input('');
    items = input<ToggleGroupItem[]>([]);
    valueChange = output<string | string[]>();

    readonly isDataDriven = computed(() => this.items().length > 0);

    value = signal<string[]>([]);

    ngOnInit(): void {
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

    toggle(itemValue: string): void {
        if (this.disabled()) return;

        const current = this.value();
        let newValue: string[];

        if (this.type() === 'single') {
            newValue = current.includes(itemValue) ? [] : [itemValue];
        } else if (current.includes(itemValue)) {
                newValue = current.filter(v => v !== itemValue);
            } else {
                newValue = [...current, itemValue];
            }

        this.value.set(newValue);

        if (this.type() === 'single') {
            this.valueChange.emit(newValue[0] ?? '');
        } else {
            this.valueChange.emit(newValue);
        }
    }
}
