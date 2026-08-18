import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { SpinnerComponent } from '../spinner';
import { SkeletonComponent } from '../skeleton';

@Component({
    selector: 'ui-card',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SpinnerComponent, SkeletonComponent],
    styleUrl: './card.component.css',
    template: `
        @if (skeleton()) {
            <ui-skeleton class="h-40 w-full rounded-xl" />
        } @else {
            @if (title()) {
                <!-- Simple mode: auto-generate card structure -->
                <div class="@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6" data-slot="card-header">
                    <div class="leading-none font-semibold" data-slot="card-title">{{ title() }}</div>
                    @if (description()) {
                        <div class="text-muted-foreground text-sm" data-slot="card-description">{{ description() }}</div>
                    }
                </div>
                @if (content()) {
                    <div data-slot="card-content">{{ content() }}</div>
                }
                <ng-content />
            } @else {
                <!-- Template mode: project content -->
                <ng-content />
            }
            @if (loading()) {
                <div class="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60">
                    <ui-spinner size="default" />
                </div>
            }
        }
    `,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"card"',
        '[attr.data-skeleton]': 'skeleton() || null',
    },
})
export class CardComponent {
    /** Extra classes merged onto the card surface. Padding comes from the card's density CSS rather than inline utilities, so prefer a density variable over hard-coded `p-*` here. */
    class = input('');
    /**
     * Simple-mode heading. Supplying it switches the card to the generated
     * layout — header, optional {@link description} and {@link content}, then any
     * projected content underneath. Leave it empty to compose `ui-card-header`
     * and friends yourself.
     */
    title = input('');
    /** Simple-mode muted subtitle under the title. Only rendered when {@link title} is also set. */
    description = input('');
    /** Simple-mode body text. Plain text only and, like {@link description}, only rendered when {@link title} is set — project `ui-card-content` for rich bodies. */
    content = input('');
    /** Overlays a translucent scrim and a spinner across the card while keeping the content visible underneath, for in-place refreshes. Use {@link skeleton} instead for a first load with no content yet. */
    readonly loading = input(false);
    /** Replaces the whole card with a fixed-height placeholder block, and strips the card's own surface styling. Takes precedence over every other input, including {@link loading}. */
    readonly skeleton = input(false);

    readonly classes = computed(() => {
        if (this.skeleton()) return cn('block', this.class());
        return cn(
            'bg-card text-card-foreground flex flex-col rounded-xl border shadow-sm',
            this.loading() && 'relative overflow-hidden',
            this.class()
        );
    });
}
