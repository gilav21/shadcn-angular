import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    TemplateRef,
    viewChild,
} from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * One projected row of a `ui-data-list`: a plain-text label and arbitrary
 * projected content as its value.
 *
 * The row's markup lives in an `<ng-template>` rather than in this component's
 * host element, and the parent stamps it into its `<dl>` through
 * `ngTemplateOutlet`. That is not indirection for its own sake — it is what
 * makes the `<dt>`/`<dd>` **direct** children of the `<dl>`.
 *
 * The obvious alternative, projecting `<ui-data-list-item>` into the `<dl>` and
 * giving it `display: contents`, looks right and is what risk R-4 in the spec
 * suggests, but axe rejects it: `definition-list` and `dlitem` inspect the DOM
 * tree, not the accessibility tree, so a custom element between `<dl>` and
 * `<dt>` is a serious violation no matter what it computes to. Because the
 * parent renders no `<ng-content>` inside the list, these host elements are
 * never attached to the document at all.
 */
@Component({
    selector: 'ui-data-list-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './data-list-item.component.html',
    host: { class: 'contents' },
})
export class DataListItemComponent {
    /** The row's term. Rendered into the `<dt>`. */
    readonly label = input('');
    /** Extra classes merged onto the `<dd>` holding the projected value. */
    readonly class = input('');

    /** The row's `<dt>`/`<dd>` pair, stamped into the parent's `<dl>`. */
    readonly row = viewChild.required<TemplateRef<unknown>>('row');

    protected readonly valueClasses = computed(() =>
        cn('min-w-0 break-words text-foreground', this.class())
    );
}
