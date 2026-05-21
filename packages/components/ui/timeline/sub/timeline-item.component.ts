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
    class = input('');

    // Simple mode inputs
    title = input<string>();
    description = input<string>();
    time = input<string>();
    variant = input<'default' | 'filled' | 'outline' | 'success' | 'error' | 'warning'>('default');
    showConnector = input(true);

    // Content detection - use forwardRef since components are declared after
    @ContentChild(TimelineHeaderComponent) customHeader?: TimelineHeaderComponent;
    @ContentChild(TimelineContentComponent) customContent?: TimelineContentComponent;

    private readonly _hasCustomContent = signal(false);
    hasCustomContent = this._hasCustomContent.asReadonly();

    ngAfterContentInit() {
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
