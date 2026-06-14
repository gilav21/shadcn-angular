import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { SpinnerComponent } from '../spinner';
import { SkeletonComponent } from '../skeleton';

export { AvatarFallbackComponent } from './sub/avatar-fallback.component';
export { AvatarImageComponent } from './sub/avatar-image.component';

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
            'relative flex shrink-0 overflow-hidden rounded-full',
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


