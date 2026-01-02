import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-card',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"card"',
    },
})
export class CardComponent {
    class = input('');

    classes = computed(() =>
        cn(
            'bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm',
            this.class()
        )
    );
}

@Component({
    selector: 'ui-card-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"card-header"',
    },
})
export class CardHeaderComponent {
    class = input('');

    classes = computed(() =>
        cn(
            '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
            this.class()
        )
    );
}

@Component({
    selector: 'ui-card-title',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"card-title"',
    },
})
export class CardTitleComponent {
    class = input('');

    classes = computed(() => cn('leading-none font-semibold', this.class()));
}

@Component({
    selector: 'ui-card-description',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"card-description"',
    },
})
export class CardDescriptionComponent {
    class = input('');

    classes = computed(() => cn('text-muted-foreground text-sm', this.class()));
}

@Component({
    selector: 'ui-card-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"card-content"',
    },
})
export class CardContentComponent {
    class = input('');

    classes = computed(() => cn('px-6', this.class()));
}

@Component({
    selector: 'ui-card-footer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"card-footer"',
    },
})
export class CardFooterComponent {
    class = input('');

    classes = computed(() =>
        cn('flex items-center px-6 [.border-t]:pt-6', this.class())
    );
}
