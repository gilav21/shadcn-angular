import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { AvatarComponent } from '../avatar.component';

@Component({
    selector: 'ui-avatar-image',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './avatar-image.component.html',
    host: { '[class]': '"contents"' },
})
export class AvatarImageComponent {
    readonly avatar = inject(AvatarComponent, { optional: true });

    /** Image URL. Required — for the input-driven form use `ui-avatar`'s own `src` instead. */
    src = input.required<string>();
    /** `alt` text; leave empty when the avatar is decorative and the name is already in the DOM. */
    alt = input('');
    /**
     * Extra classes merged onto the `<img>` (default `aspect-square h-full w-full`) —
     * e.g. `object-top` to change the crop anchor.
     */
    class = input('');

    classes = computed(() => cn('aspect-square h-full w-full', this.class()));

    /**
     * Reports a successful load up to the parent avatar, which is what makes the
     * sibling `ui-avatar-fallback` disappear — the image itself stays
     * `display: none` until then, so it never flashes half-loaded.
     */
    onLoad(): void {
        this.avatar?.status.set('loaded');
    }

    /**
     * Reports a failed load, leaving the fallback in place permanently. Outside a
     * `ui-avatar` both handlers are no-ops and the image simply stays hidden, since the
     * reveal is driven by the parent's status.
     */
    onError(): void {
        this.avatar?.status.set('error');
    }
}
