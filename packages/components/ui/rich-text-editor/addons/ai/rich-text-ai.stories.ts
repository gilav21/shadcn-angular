import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { Observable } from 'rxjs';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import type { AiRequest } from '../../../../lib/ai';
import { RichTextAiDirective } from './rich-text-ai.directive';

/** Streams a canned transformation word-by-word — no network, for the stories. */
function mockAiProvider(req: AiRequest): Observable<string> {
    const output = req.task === 'shorten'
        ? req.input.split(/\s+/).slice(0, 3).join(' ')
        : `Improved: ${req.input}`;
    const words = output.split(' ');
    return new Observable<string>((subscriber) => {
        let i = 0;
        const id = setInterval(() => {
            i++;
            subscriber.next(words.slice(0, i).join(' '));
            if (i >= words.length) {
                clearInterval(id);
                subscriber.complete();
            }
        }, 60);
        return () => clearInterval(id);
    });
}

const meta: Meta = {
    title: 'Editor/Rich Text Editor/Addons/AI',
    decorators: [
        moduleMetadata({
            imports: [RichTextEditorComponent, RichTextAiDirective],
        }),
    ],
    parameters: {
        docs: {
            description: {
                component:
                    'Opt-in AI-assist addon: `apply rich-text-editor/ai`, then bind `[uiRteAi]` to a provider. ' +
                    'Select text to reveal the "Ask AI" chip, or run the `/ai` slash command; the panel lists ' +
                    'built-in tasks plus a free-form prompt. The provider returns a string, Promise, or ' +
                    'Observable that emits the full text so far, streaming live into the editor with ' +
                    'Accept / Discard / Try again. The base editor ships no AI UI.',
            },
        },
    },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
    render: () => ({
        props: { provider: mockAiProvider },
        template: `
            <ui-rich-text-editor
                mode="markdown"
                [uiRteAi]="provider"
                placeholder="Type a sentence, select it, then click the Ask AI chip…"
                minHeight="200px"
            />
        `,
    }),
};

export const RtlAndLocale: Story = {
    render: () => ({
        props: { provider: mockAiProvider },
        template: `
            <ui-rich-text-editor
                mode="markdown"
                [uiRteAi]="provider"
                uiRteAiLocale="he"
                locale="he"
                minHeight="200px"
            />
        `,
    }),
};
