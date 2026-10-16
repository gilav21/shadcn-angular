import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { cn } from '../../../../lib/utils';
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

    /** Extra classes merged onto the chip button, after its floating popover styling. */
    readonly class = input('');
    readonly classes = computed(() => cn(
        'fixed z-[9999] inline-flex items-center gap-1 rounded-md border bg-popover px-2 py-1 text-xs font-medium shadow-lg hover:bg-accent',
        this.class(),
    ));
}
