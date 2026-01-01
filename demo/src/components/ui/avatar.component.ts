import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
    selector: 'ui-avatar',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"avatar"',
    },
})
export class AvatarComponent {
    class = input('');

    classes = computed(() =>
        cn(
            'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
            this.class()
        )
    );
}

@Component({
    selector: 'ui-avatar-image',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <img
      [src]="src()"
      [alt]="alt()"
      [class]="classes()"
      [attr.data-slot]="'avatar-image'"
    />
  `,
    host: { '[class]': '"contents"' },
})
export class AvatarImageComponent {
    src = input.required<string>();
    alt = input('');
    class = input('');

    classes = computed(() => cn('aspect-square h-full w-full', this.class()));
}

@Component({
    selector: 'ui-avatar-fallback',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"avatar-fallback"',
    },
})
export class AvatarFallbackComponent {
    class = input('');

    classes = computed(() =>
        cn(
            'flex h-full w-full items-center justify-center rounded-full bg-muted',
            this.class()
        )
    );
}
