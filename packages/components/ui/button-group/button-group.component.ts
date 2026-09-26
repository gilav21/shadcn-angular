import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

/**
 * ButtonGroup - Group buttons together with seamless borders
 *
 * Usage:
 * <ui-button-group>
 *   <ui-button variant="outline">Left</ui-button>
 *   <ui-button variant="outline">Center</ui-button>
 *   <ui-button variant="outline">Right</ui-button>
 * </ui-button-group>
 *
 * <ui-button-group orientation="vertical">
 *   <ui-button>Top</ui-button>
 *   <ui-button>Bottom</ui-button>
 * </ui-button-group>
 */
@Component({
    selector: 'ui-button-group',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './button-group.component.html',
    host: { class: 'contents' },
})
export class ButtonGroupComponent {
    /** Extra classes merged onto the group wrapper — e.g. `w-full` to stretch it, since the group is `w-fit` by default. */
    class = input('');
    /**
     * Stacking axis. Drives which corner radii and adjoining borders are
     * stripped from the children so they read as one control — only the outer
     * corners stay rounded and each join shows a single border. The rules reach
     * through `display: contents` hosts (`<ui-button>`) to the element that
     * draws the box, and apply to a plain `<button>` child directly. The
     * horizontal form uses logical `-s`/`-e` sides and therefore flips
     * correctly in RTL.
     * Set the matching `orientation` on any
     * {@link ButtonGroupSeparatorComponent} inside.
     */
    orientation = input<'horizontal' | 'vertical'>('horizontal');

    // Each rule is written twice: once for a plain child (a consumer's own
    // <button>) and once through a `display: contents` host such as
    // <ui-button>, whose box is its inner element, so styling the host alone
    // would change nothing on screen.
    classes = computed(() => {
        const isVertical = this.orientation() === 'vertical';

        return cn(
            'flex w-fit items-stretch',
            '[&>*]:focus-visible:z-10 [&>*]:focus-visible:relative',
            '[&>.contents>*]:focus-visible:z-10 [&>.contents>*]:focus-visible:relative',
            isVertical ? [
                'flex-col',
                '[&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0',
                '[&>.contents:not(:first-child)>*]:rounded-t-none [&>.contents:not(:first-child)>*]:border-t-0',
                '[&>*:not(:last-child)]:rounded-b-none [&>.contents:not(:last-child)>*]:rounded-b-none',
            ] : [
                '[&>*:not(:first-child)]:rounded-s-none [&>*:not(:first-child)]:border-s-0',
                '[&>.contents:not(:first-child)>*]:rounded-s-none [&>.contents:not(:first-child)>*]:border-s-0',
                '[&>*:not(:last-child)]:rounded-e-none [&>.contents:not(:last-child)>*]:rounded-e-none',
            ],
            this.class()
        );
    });
}
