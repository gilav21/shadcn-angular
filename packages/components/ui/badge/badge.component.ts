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
    'inline-flex items-center rounded-md border text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    {
        variants: {
            variant: {
                default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
                secondary: 'border-border bg-secondary text-secondary-foreground hover:bg-secondary/80',
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
    /**
     * Colour treatment from {@link badgeVariants}. `'outline'` is the only one
     * without a filled background — it keeps the inherited surface and just
     * draws the border and `text-foreground`. Ignored while {@link skeleton} is
     * true.
     */
    variant = input<BadgeVariant>('default');
    /**
     * Convenience text content. When non-empty it is rendered *instead of* any
     * projected content, so use one or the other — projection is the escape
     * hatch for icons or markup inside the badge.
     */
    label = input<string>('');
    /** Extra classes merged onto the host; padding/size utilities go here since the variants set colour only. */
    class = input('');
    /**
     * Renders a fixed-size {@link SkeletonComponent} placeholder in place of the
     * badge and drops all variant styling, for loading states that must not
     * shift layout.
     */
    readonly skeleton = input(false);

    readonly classes = computed(() => {
        if (this.skeleton()) return cn('inline-flex', this.class());
        return cn(badgeVariants({ variant: this.variant() }), this.class());
    });

    /**
     * String form of the badge — its {@link label}, or `''` when the content was
     * projected instead. Lets a badge instance be interpolated directly in a
     * template or used as a filter/sort key.
     */
    toString(): string {
        return this.label() ?? '';
    }
}

export { badgeVariants };
