import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { AvatarImageComponent } from './sub/avatar-image.component';
import { AvatarFallbackComponent } from './sub/avatar-fallback.component';

export { AvatarImageComponent, AvatarFallbackComponent };

@Component({
    selector: 'ui-avatar',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './avatar.component.html',
    styleUrl: './avatar.component.css',
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"avatar"',
    },
})
export class AvatarComponent {
    class = input('');
    src = input('');
    alt = input('');
    fallback = input('');
    status = signal<'loading' | 'loaded' | 'error'>('loading');

    readonly classes = computed(() =>
        cn(
            'relative flex h-[calc(2.5rem*var(--_d))] w-[calc(2.5rem*var(--_d))] shrink-0 overflow-hidden rounded-full',
            this.class()
        )
    );

    onLoad() {
        this.status.set('loaded');
    }

    onError() {
        this.status.set('error');
    }

    toString(): string {
        return this.fallback() || this.alt() || '';
    }
}


