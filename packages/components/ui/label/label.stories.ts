import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { LabelComponent } from './label.component';
import { CheckboxComponent } from '../checkbox';

const meta: Meta<LabelComponent> = {
    title: 'UI/Label',
    component: LabelComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [CheckboxComponent]
        })
    ],
    argTypes: {
        for: { control: 'text', description: 'The `id` of the form control this label is bound to.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        for: 'terms',
        class: '',
    },
};

export default meta;
type Story = StoryObj<LabelComponent>;

const TEMPLATE = `<ui-label [for]="for" [class]="class">Accept terms</ui-label>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const WithControl: Story = {
    render: (args) => ({
        props: args,
        template: `
      <div class="flex items-center space-x-2">
        <ui-checkbox id="terms" [elementId]="'terms'"></ui-checkbox>
        <ui-label for="terms">Accept terms and conditions</ui-label>
      </div>
    `,
    }),
};
