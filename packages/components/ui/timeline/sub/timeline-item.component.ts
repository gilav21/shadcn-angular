import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    ContentChild,
    AfterContentInit,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { TimelineHeaderComponent } from './timeline-header.component';
import { TimelineContentComponent } from './timeline-content.component';

@Component({
    selector: 'ui-timeline-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'timeline-item'">
      @if (hasCustomContent()) {
        <!-- Custom mode: render projected content -->
        <ng-content />
      } @else {
        <!-- Simple mode: render default structure from inputs -->
        <div class="flex flex-col items-center" data-slot="timeline-header">
          <div [class]="dotClasses()" data-slot="timeline-dot"></div>
          @if (showConnector()) {
            <div class="absolute top-6 h-[calc(100%-24px)] w-0.5 bg-border" data-slot="timeline-connector"></div>
          }
        </div>
        <div class="flex-1 pt-0.5" data-slot="timeline-content">
          @if (title()) {
            <h4 class="text-sm font-semibold leading-none" data-slot="timeline-title">{{ title() }}</h4>
          }
          @if (description()) {
            <p class="mt-1 text-sm text-muted-foreground" data-slot="timeline-description">{{ description() }}</p>
          }
          @if (time()) {
            <time class="text-xs text-muted-foreground" data-slot="timeline-time">{{ time() }}</time>
          }
        </div>
      }
    </div>
  `,
    host: { class: 'contents' },
})
export class TimelineItemComponent implements AfterContentInit {
    /** Extra utilities for the item's row wrapper, merged through `cn()` so they override the built-in `relative flex gap-4 pb-8 last:pb-0` — this is where you change the gap between dot and content, or the spacing to the next item. */
    class = input('');

    /**
     * Simple-mode heading, rendered as an `h4`.
     *
     * Ignored — along with {@link description}, {@link time}, {@link variant} and
     * {@link showConnector} — as soon as a `ui-timeline-header` or
     * `ui-timeline-content` is projected, because {@link hasCustomContent} then
     * swaps the whole default structure for the projected content.
     */
    title = input<string>();
    /** Simple-mode body text under the {@link title}, rendered as a muted `p`. Omitted entirely when empty, and ignored in custom mode (see {@link title}). */
    description = input<string>();
    /** Simple-mode timestamp rendered as a plain `time` element below the {@link description}; pass an already-formatted string — no date parsing or `datetime` attribute is applied. Ignored in custom mode (see {@link title}). */
    time = input<string>();
    /** Colour scheme of the simple-mode dot: `'default'` is a hollow bordered circle, `'filled'`/`'outline'` follow the primary colour, and `'success'`/`'error'`/`'warning'` are status colours. Mirrors {@link TimelineDotComponent}'s variant, and is ignored in custom mode (see {@link title}) — project a `ui-timeline-dot` and set its own `variant` instead. */
    variant = input<'default' | 'filled' | 'outline' | 'success' | 'error' | 'warning'>('default');
    /** Whether the simple-mode vertical line to the next item is drawn (default `true`). Set it to `false` on the last item, since the line is absolutely positioned from the dot to the bottom of this item and does not stop itself. Ignored in custom mode (see {@link title}). */
    showConnector = input(true);

    // Content detection - use forwardRef since components are declared after
    @ContentChild(TimelineHeaderComponent) customHeader?: TimelineHeaderComponent;
    @ContentChild(TimelineContentComponent) customContent?: TimelineContentComponent;

    private readonly _hasCustomContent = signal(false);
    hasCustomContent = this._hasCustomContent.asReadonly();

    ngAfterContentInit(): void {
        this._hasCustomContent.set(!!this.customHeader || !!this.customContent);
    }

    classes = computed(() =>
        cn(
            'relative flex gap-4 pb-8 last:pb-0',
            this.class()
        )
    );

    dotClasses = computed(() =>
        cn(
            'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
            {
                'border-border bg-background': this.variant() === 'default',
                'border-primary bg-primary text-primary-foreground': this.variant() === 'filled',
                'border-primary bg-background': this.variant() === 'outline',
                'border-green-500 bg-green-500 text-white': this.variant() === 'success',
                'border-destructive bg-destructive text-destructive-foreground': this.variant() === 'error',
                'border-yellow-500 bg-yellow-500 text-white': this.variant() === 'warning',
            }
        )
    );
}
