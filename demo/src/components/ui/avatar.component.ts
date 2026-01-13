import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    inject,
} from '@angular/core';
import { cn } from '../lib/utils';

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
    status = signal<'loading' | 'loaded' | 'error'>('loading');

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
      [style.display]="avatar?.status() === 'loaded' ? 'block' : 'none'"
      (load)="onLoad()"
      (error)="onError()"
    />
  `,
    host: { '[class]': '"contents"' },
})
export class AvatarImageComponent {
    avatar = inject(AvatarComponent, { optional: true });

    src = input.required<string>();
    alt = input('');
    class = input('');

    classes = computed(() => cn('aspect-square h-full w-full', this.class()));

    onLoad() {
        this.avatar?.status.set('loaded');
    }

    onError() {
        this.avatar?.status.set('error');
    }
}

@Component({
    selector: 'ui-avatar-fallback',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (avatar?.status() !== 'loaded') {
        <div [class]="classes()" [attr.data-slot]="'avatar-fallback'">
            <ng-content />
        </div>
    }
    `,
    host: { '[class]': '"contents"' },
})
export class AvatarFallbackComponent {
    avatar = inject(AvatarComponent, { optional: true });

    class = input('');

    classes = computed(() =>
        cn(
            'flex h-full w-full items-center justify-center rounded-full bg-muted',
            this.class()
        )
    );
}
