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
