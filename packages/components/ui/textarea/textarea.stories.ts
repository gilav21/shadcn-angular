import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { TextareaComponent } from './textarea.component';
import { FormsModule } from '@angular/forms';
import { LabelComponent } from '../label';

const meta: Meta<TextareaComponent> = {
    title: 'UI/Textarea',
    component: TextareaComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [FormsModule, TextareaComponent, LabelComponent],
        }),
    ],
    argTypes: {
        placeholder: { control: 'text', description: 'Placeholder text shown when empty.' },
        disabled: { control: 'boolean', description: 'Disables interaction.' },
        rows: { control: 'number', description: 'Number of visible text rows.' },
        skeleton: { control: 'boolean', description: 'Renders a skeleton placeholder instead of the textarea.' },
        variant: {
            control: 'select',
            options: ['outline', 'underline', 'ghost'],
            description: 'Visual style of the textarea.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the textarea.' },
    },
    args: {
        placeholder: 'Type your message here.',
        disabled: false,
        rows: 4,
        skeleton: false,
        variant: 'outline',
        class: '',
    },
};

export default meta;
type Story = StoryObj<TextareaComponent>;

const TEMPLATE = `
    <ui-textarea
        [placeholder]="placeholder" [disabled]="disabled" [rows]="rows"
        [skeleton]="skeleton" [variant]="variant" [class]="class">
    </ui-textarea>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-textarea [placeholder]="placeholder" [disabled]="disabled" [rows]="rows" [variant]="variant"></ui-textarea>`,
    }),
};

export const Variants: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="flex flex-col gap-4 max-w-sm">
                <ui-textarea variant="outline" placeholder="Outline" [rows]="rows"></ui-textarea>
                <ui-textarea variant="underline" placeholder="Underline" [rows]="rows"></ui-textarea>
                <ui-textarea variant="ghost" placeholder="Ghost" [rows]="rows"></ui-textarea>
            </div>`,
    }),
};

export const Disabled: Story = {
    args: { disabled: true },
    render,
};

export const Skeleton: Story = {
    args: { skeleton: true },
    render,
};

export const WithLabel: Story = {
    render: (args) => ({
        props: args,
        template: `
      <div class="grid w-full gap-1.5">
        <ui-label for="message">Your message</ui-label>
        <ui-textarea id="message" [placeholder]="placeholder" [rows]="rows" [variant]="variant"></ui-textarea>
        <p class="text-sm text-muted-foreground">
          Your message will be copied to the support team.
        </p>
      </div>
    `,
    }),
};
