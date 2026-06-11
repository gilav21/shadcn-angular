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
import { SpinnerComponent } from '../spinner';
import { SkeletonComponent } from '../skeleton';

export { AvatarImageComponent, AvatarFallbackComponent };

@Component({
    selector: 'ui-avatar',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SpinnerComponent, SkeletonComponent],
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
    readonly loading = input(false);
    readonly skeleton = input(false);
    status = signal<'loading' | 'loaded' | 'error'>('loading');

    readonly classes = computed(() => {
        if (this.skeleton()) return cn('block shrink-0', this.class());
        return cn(
            'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
            this.class()
        );
    });

    onLoad(): void {
        this.status.set('loaded');
    }

    onError(): void {
        this.status.set('error');
    }

    toString(): string {
        return this.fallback() || this.alt() || '';
    }
}


