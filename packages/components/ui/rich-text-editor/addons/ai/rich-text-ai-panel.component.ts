import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { ButtonComponent } from '../../../button';
import { RICH_TEXT_AI_CONTEXT } from './rich-text-ai.context';

/**
 * The AI addon's task panel: a fixed, viewport-clamped popover anchored under
 * the selection. In the `menu` phase it lists the six built-in tasks plus a
 * free-form prompt field; in `loading`/`review` it shows the streaming status,
 * any error, and the accept / discard / try-again controls. Mounted once into
 * the editor's overlay anchor, it reads its state and callbacks from
 * {@link RICH_TEXT_AI_CONTEXT}, reproducing the panel the base editor used to
 * render inline.
 */
@Component({
    selector: 'ui-rte-ai-panel',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent],
    templateUrl: './rich-text-ai-panel.component.html',
    host: { class: 'contents' },
})
export class RichTextAiPanelComponent {
    protected readonly ctx = inject(RICH_TEXT_AI_CONTEXT);
    protected readonly customPrompt = signal('');

    constructor() {
        effect(() => {
            if (this.ctx.panelOpen() && this.ctx.phase() === 'menu') {
                this.customPrompt.set('');
            }
        });
    }

    protected onCustomInput(event: Event): void {
        this.customPrompt.set((event.target as HTMLInputElement).value);
    }

    protected runCustom(): void {
        const prompt = this.customPrompt().trim();
        if (prompt) this.ctx.runCustom(prompt);
    }
}
