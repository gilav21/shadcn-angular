import { Meta, StoryObj } from '@storybook/angular';
import { SignaturePadComponent } from './signature-pad.component';

const meta: Meta<SignaturePadComponent> = {
    title: 'UI/SignaturePad',
    component: SignaturePadComponent,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component: [
                    'A hand-drawn mark.',
                    '',
                    'The **value** is a `data:image/png;base64,…` URL, because a form value has to',
                    'be a submittable scalar and a data URL is what every backend, `<img src>` and',
                    'PDF renderer already accepts. The **strokes** are the source of truth: they',
                    'are kept normalised to the pad and re-drawn whenever the size or the pixel',
                    'ratio changes, so the signature neither blurs on a retina screen nor vanishes',
                    'when the layout moves.',
                    '',
                    'Touch is the primary input. The pad takes the gesture (`touch-action: none`)',
                    'so the page cannot scroll out from under a stroke, and a second finger',
                    '**abandons** the stroke rather than dragging a spike across the signature.',
                    '',
                    '## Accessibility — read this before shipping it',
                    '',
                    'This control **cannot be made accessible by labelling it**. A drawn mark is',
                    'irreducibly visual and irreducibly motor: someone using a keyboard, a switch,',
                    'or a screen reader cannot produce one, and no `aria-label` changes that.',
                    '',
                    'If you ship a signature pad, you must ship an alternative alongside it —',
                    'typically a typed-name field that carries the same legal weight. The demo',
                    'page shows one. Anything else excludes people from signing.',
                ].join('\n'),
            },
        },
    },
    argTypes: {
        value: { control: false, description: 'PNG data URL, or `null` when blank.' },
        penColor: { control: 'color', description: 'Ink colour. Defaults to the current text colour.' },
        penWidth: { control: { type: 'number', min: 1, max: 10 }, description: 'Ink width in CSS pixels.' },
        height: { control: 'number', description: 'Pad height in CSS pixels; width follows the container.' },
        disabled: { control: 'boolean', description: 'Disables drawing and both buttons.' },
        hideControls: { control: 'boolean', description: 'Hides the built-in Clear and Undo buttons.' },
        ariaLabel: { control: 'text', description: 'Accessible name for the surface.' },
        clearLabel: { control: 'text', description: 'Text of the Clear button.' },
        undoLabel: { control: 'text', description: 'Text of the Undo button.' },
        class: { control: 'text', description: 'Extra classes merged onto the wrapper.' },
        variant: {
            control: 'select',
            options: ['outline', 'underline', 'ghost'],
            description: 'Visual style of the wrapper.',
        },
    },
};

export default meta;
type Story = StoryObj<SignaturePadComponent>;

export const Default: Story = {
    args: { height: 180 },
};

export const ThickInk: Story = {
    args: { penWidth: 5, height: 180 },
};

export const ColouredInk: Story = {
    args: { penColor: '#1d4ed8', penWidth: 3, height: 180 },
};

export const Short: Story = {
    args: { height: 110 },
};

/** For a consumer supplying their own toolbar. */
export const WithoutControls: Story = {
    args: { hideControls: true, height: 180 },
};

export const Disabled: Story = {
    args: { disabled: true, height: 180 },
};

export const Variants: Story = {
    render: () => ({
        template: `
            <div class="space-y-4">
                <ui-signature-pad variant="outline" [height]="120" ariaLabel="Outline" />
                <ui-signature-pad variant="underline" [height]="120" ariaLabel="Underline" />
                <ui-signature-pad variant="ghost" [height]="120" ariaLabel="Ghost" />
            </div>
        `,
    }),
};
