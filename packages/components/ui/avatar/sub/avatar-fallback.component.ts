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
    selector: 'ui-avatar-fallback',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './avatar-fallback.component.html',
    host: { '[class]': '"contents"' },
})
export class AvatarFallbackComponent {
    readonly avatar = inject(AvatarComponent, { optional: true });

    class = input('');

    classes = computed(() =>
        cn(
            'flex h-full w-full items-center justify-center rounded-full bg-muted',
            this.class()
        )
    );
}
