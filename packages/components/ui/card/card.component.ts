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
    template: `
        @if (skeleton()) {
            <ui-skeleton class="h-40 w-full rounded-xl" />
        } @else {
            @if (title()) {
                <!-- Simple mode: auto-generate card structure -->
                <div class="@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6" data-slot="card-header">
                    <div class="leading-none font-semibold" data-slot="card-title">{{ title() }}</div>
                    @if (description()) {
                        <div class="text-muted-foreground text-sm" data-slot="card-description">{{ description() }}</div>
                    }
                </div>
                @if (content()) {
                    <div class="px-6" data-slot="card-content">{{ content() }}</div>
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
    },
})
export class CardComponent {
    class = input('');
    title = input('');
    description = input('');
    content = input('');
    readonly loading = input(false);
    readonly skeleton = input(false);

    readonly classes = computed(() => {
        if (this.skeleton()) return cn('block', this.class());
        return cn(
            'bg-card text-card-foreground flex flex-col gap-4 sm:gap-6 rounded-xl border py-4 sm:py-6 shadow-sm',
            this.loading() && 'relative overflow-hidden',
            this.class()
        );
    });
}
