import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { SkeletonComponent } from '../skeleton';

const badgeVariants = cva(
    'inline-flex items-center rounded-md border px-[calc(0.625rem*var(--_d))] py-[calc(0.125rem*var(--_d))] text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    {
        variants: {
            variant: {
                default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
                secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
                destructive: 'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
                outline: 'text-foreground',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
);

export type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

@Component({
    selector: 'ui-badge',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SkeletonComponent],
    templateUrl: './badge.component.html',
    styleUrl: './badge.component.css',
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"badge"',
    },
})
export class BadgeComponent {
    variant = input<BadgeVariant>('default');
    label = input<string>('');
    class = input('');
    readonly skeleton = input(false);

    readonly classes = computed(() => {
        if (this.skeleton()) return cn('inline-flex', this.class());
        return cn(badgeVariants({ variant: this.variant() }), this.class());
    });

    toString(): string {
        return this.label() ?? '';
    }
}

export { badgeVariants };
