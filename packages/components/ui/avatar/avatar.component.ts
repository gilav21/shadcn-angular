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
    /**
     * Extra classes merged onto the host. The default size (2.5rem, density-scaled)
     * comes from the component's own CSS, so a `size-`/`h-`/`w-` utility here overrides
     * it; the roundness and `overflow-hidden` are also merged from here.
     */
    class = input('');
    /**
     * Image URL for simple mode. When set, the projected `<ng-content>` is ignored
     * entirely — use either `src`/{@link fallback} or `ui-avatar-image` /
     * `ui-avatar-fallback` children, not both.
     */
    src = input('');
    /** `alt` text for the simple-mode image. Leave empty for purely decorative avatars. */
    alt = input('');
    /**
     * Text shown while the image loads and, permanently, if it fails — typically
     * initials. Rendered on its own when there is no {@link src}; without either, the
     * component falls back to projected content.
     */
    fallback = input('');
    /** Overlays a translucent scrim and spinner on top of the avatar. Independent of image load state. */
    readonly loading = input(false);
    /**
     * Placeholder mode: renders a pulsing round skeleton *instead of* the avatar,
     * ignoring {@link src}, {@link fallback} and projected content. Note the skeleton is
     * a fixed 2.5rem, so it does not follow a size override on {@link class}.
     */
    readonly skeleton = input(false);
    status = signal<'loading' | 'loaded' | 'error'>('loading');

    readonly classes = computed(() => {
        if (this.skeleton()) return cn('block shrink-0', this.class());
        return cn(
            'relative flex shrink-0 overflow-hidden rounded-full',
            this.class()
        );
    });

    /**
     * `(load)` handler for the simple-mode image: flips {@link status} to `'loaded'`,
     * which reveals the `<img>` and hides the fallback. Also called by a projected
     * `ui-avatar-image`, so one shared status drives both modes.
     */
    onLoad(): void {
        this.status.set('loaded');
    }

    /**
     * `(error)` handler for a broken/blocked image URL: the `<img>` stays hidden and the
     * fallback remains visible. There is no retry — a later {@link src} change resets
     * nothing, so the status stays `'error'` until the image itself fires `load`.
     */
    onError(): void {
        this.status.set('error');
    }

    /** {@link fallback}, else {@link alt}, else `''` — a readable name for interpolating a template reference. */
    toString(): string {
        return this.fallback() || this.alt() || '';
    }
}


