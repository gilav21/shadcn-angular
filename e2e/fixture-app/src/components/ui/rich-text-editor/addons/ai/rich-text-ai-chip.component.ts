import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RICH_TEXT_AI_CONTEXT } from './rich-text-ai.context';

/**
 * The floating "✨ Ask AI" chip the AI addon shows above an active text
 * selection. Mounted once into the editor's overlay anchor; it reads its
 * visibility, position, and label from {@link RICH_TEXT_AI_CONTEXT} and opens
 * the task panel on click. Reproduces the chip the base editor used to render
 * inline, now driven entirely by the addon.
 */
@Component({
    selector: 'ui-rte-ai-chip',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './rich-text-ai-chip.component.html',
    host: { class: 'contents' },
})
export class RichTextAiChipComponent {
    protected readonly ctx = inject(RICH_TEXT_AI_CONTEXT);
}
