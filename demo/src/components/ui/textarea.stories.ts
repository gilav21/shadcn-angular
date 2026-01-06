import { Meta, StoryObj } from '@storybook/angular';
import { TextareaComponent } from './textarea.component';
import { moduleMetadata } from '@storybook/angular';
import { FormsModule } from '@angular/forms';
import { LabelComponent } from './label.component';

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
        placeholder: { control: 'text' },
        disabled: { control: 'boolean' },
        rows: { control: 'number' },
    },
    args: {
        placeholder: 'Type your message here.',
        disabled: false,
        rows: 4,
    },
};

export default meta;
type Story = StoryObj<TextareaComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-textarea [placeholder]="placeholder" [disabled]="disabled" [rows]="rows"></ui-textarea>`,
    }),
};

export const WithLabel: Story = {
    render: (args) => ({
        props: args,
        template: `
      <div class="grid w-full gap-1.5">
        <ui-label htmlFor="message">Your message</ui-label>
        <ui-textarea id="message" [placeholder]="placeholder" [rows]="rows"></ui-textarea>
        <p class="text-sm text-muted-foreground">
          Your message will be copied to the support team.
        </p>
      </div>
    `,
    }),
};
