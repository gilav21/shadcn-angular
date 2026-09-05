import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonComponent } from '../../../button';
import { ScrollAreaComponent } from '../../../scroll-area';
import { RICH_TEXT_OUTLINE_CONTEXT } from './rich-text-outline.context';

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
}
