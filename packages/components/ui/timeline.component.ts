import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-timeline',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'timeline'">
      <ng-content />
    </div>
  `,
    host: { class: 'block' },
})
export class TimelineComponent {
    class = input('');
    orientation = input<'vertical' | 'horizontal'>('vertical');

    classes = computed(() =>
        cn(
            'relative',
            this.orientation() === 'vertical' ? 'flex flex-col' : 'flex flex-row',
            this.class()
        )
    );
}

@Component({
    selector: 'ui-timeline-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'timeline-item'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class TimelineItemComponent {
    class = input('');

    classes = computed(() =>
        cn(
            'relative flex gap-4 pb-8 last:pb-0',
            this.class()
        )
    );
}

@Component({
    selector: 'ui-timeline-connector',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'timeline-connector'"></div>
  `,
    host: { class: 'contents' },
})
export class TimelineConnectorComponent {
    class = input('');

    classes = computed(() =>
        cn(
            'absolute top-6 h-[calc(100%-24px)] w-0.5 bg-border',
            this.class()
        )
    );
}

@Component({
    selector: 'ui-timeline-dot',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'timeline-dot'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class TimelineDotComponent {
    class = input('');
    variant = input<'default' | 'filled' | 'outline' | 'success' | 'error' | 'warning'>('default');

    classes = computed(() =>
        cn(
            'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
            {
                'border-border bg-background': this.variant() === 'default',
                'border-primary bg-primary text-primary-foreground': this.variant() === 'filled',
                'border-primary bg-background': this.variant() === 'outline',
                'border-green-500 bg-green-500 text-white': this.variant() === 'success',
                'border-destructive bg-destructive text-destructive-foreground': this.variant() === 'error',
                'border-yellow-500 bg-yellow-500 text-white': this.variant() === 'warning',
            },
            this.class()
        )
    );
}

@Component({
    selector: 'ui-timeline-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'timeline-header'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class TimelineHeaderComponent {
    class = input('');

    classes = computed(() =>
        cn(
            'flex flex-col items-center',
            this.class()
        )
    );
}

@Component({
    selector: 'ui-timeline-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'timeline-content'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class TimelineContentComponent {
    class = input('');

    classes = computed(() =>
        cn(
            'flex-1 pt-0.5',
            this.class()
        )
    );
}

@Component({
    selector: 'ui-timeline-title',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <h4 [class]="classes()" [attr.data-slot]="'timeline-title'">
      <ng-content />
    </h4>
  `,
    host: { class: 'contents' },
})
export class TimelineTitleComponent {
    class = input('');

    classes = computed(() =>
        cn(
            'text-sm font-semibold leading-none',
            this.class()
        )
    );
}

@Component({
    selector: 'ui-timeline-description',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <p [class]="classes()" [attr.data-slot]="'timeline-description'">
      <ng-content />
    </p>
  `,
    host: { class: 'contents' },
})
export class TimelineDescriptionComponent {
    class = input('');

    classes = computed(() =>
        cn(
            'mt-1 text-sm text-muted-foreground',
            this.class()
        )
    );
}

@Component({
    selector: 'ui-timeline-time',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <time [class]="classes()" [attr.data-slot]="'timeline-time'">
      <ng-content />
    </time>
  `,
    host: { class: 'contents' },
})
export class TimelineTimeComponent {
    class = input('');

    classes = computed(() =>
        cn(
            'text-xs text-muted-foreground',
            this.class()
        )
    );
}
