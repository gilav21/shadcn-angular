import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { cn } from '../../../../lib/utils';
import { ButtonComponent } from '../../../button';
import { ScrollAreaComponent } from '../../../scroll-area';
import { RICH_TEXT_OUTLINE_CONTEXT } from './rich-text-outline.context';

let outlinePanelInstances = 0;

/**
 * The document-outline addon's docked side panel: a scrollable table of
 * contents anchored to the editor's start edge (left in LTR, right in RTL). It
 * lists every heading in document order, indented by level, and scrolls the
 * editor to a heading on click or Enter/Space. Mounted once into the editor's
 * overlay anchor, it reads its state and callbacks from
 * {@link RICH_TEXT_OUTLINE_CONTEXT}, reproducing the panel the base editor used
 * to render inline. Renders nothing while the panel is closed.
 */
@Component({
    selector: 'ui-rte-outline-panel',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent, ScrollAreaComponent],
    templateUrl: './rich-text-outline-panel.component.html',
    host: { class: 'contents' },
})
export class RichTextOutlinePanelComponent {
    protected readonly ctx = inject(RICH_TEXT_OUTLINE_CONTEXT);

    /** Extra classes merged onto the docked panel, after its start-edge positioning and width steps. */
    readonly class = input('');
    readonly classes = computed(() => cn('absolute top-0 bottom-0 z-20 w-full md:w-64 lg:w-80 max-w-full md:max-w-[calc(100vw-2rem)] overflow-y-auto bg-popover ltr:left-0 ltr:border-r rtl:right-0 rtl:border-l', this.class()));

    /**
     * Id wiring the panel's `aria-labelledby` to its visible heading. Counted
     * per instance so two editors on one page do not both claim the same id,
     * which would make the second panel's accessible name resolve to the
     * first panel's heading.
     */
    protected readonly titleId = `rte-outline-title-${++outlinePanelInstances}`;
}
