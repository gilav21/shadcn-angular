import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * One projected row of a {@link DataListComponent}: a plain-text label and
 * arbitrary projected content as its value.
 *
 * The host is `display: contents` so the `<dt>`/`<dd>` it renders stay direct
 * children of the parent `<dl>` for both grid placement and assistive tech
 * (risk R-4).
 */
@Component({
    selector: 'ui-data-list-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './data-list-item.component.html',
    host: {
        class: 'contents',
        '[attr.data-slot]': '"data-list-item"',
    },
})
export class DataListItemComponent {
    /** The row's term. Rendered into the `<dt>`. */
    readonly label = input('');
    /** Extra classes merged onto the `<dd>` holding the projected value. */
    readonly class = input('');

    protected readonly valueClasses = computed(() =>
        cn('min-w-0 break-words text-foreground', this.class())
    );
}
