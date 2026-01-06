import { Meta, StoryObj } from '@storybook/angular';
import {
    SelectComponent,
    SelectTriggerComponent,
    SelectValueComponent,
    SelectContentComponent,
    SelectGroupComponent,
    SelectItemComponent,
    SelectLabelComponent,
    SelectSeparatorComponent,
} from './select.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<SelectComponent> = {
    title: 'UI/Select',
    component: SelectComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                SelectComponent,
                SelectTriggerComponent,
                SelectValueComponent,
                SelectContentComponent,
                SelectGroupComponent,
                SelectItemComponent,
                SelectLabelComponent,
                SelectSeparatorComponent
            ],
        }),
    ],
    argTypes: {
        disabled: { control: 'boolean' },
    },
    args: {
        disabled: false,
    },
};

export default meta;
type Story = StoryObj<SelectComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
      <ui-select [disabled]="disabled" class="w-[180px]">
        <ui-select-trigger>
          <ui-select-value placeholder="Select a fruit" />
        </ui-select-trigger>
        <ui-select-content>
          <ui-select-group>
            <ui-select-label>Fruits</ui-select-label>
            <ui-select-item value="apple">Apple</ui-select-item>
            <ui-select-item value="banana">Banana</ui-select-item>
            <ui-select-item value="blueberry">Blueberry</ui-select-item>
            <ui-select-item value="grapes">Grapes</ui-select-item>
            <ui-select-item value="pineapple">Pineapple</ui-select-item>
          </ui-select-group>
          <ui-select-separator></ui-select-separator>
          <ui-select-group>
            <ui-select-label>Vegetables</ui-select-label>
            <ui-select-item value="aubergine">Aubergine</ui-select-item>
            <ui-select-item value="broccoli">Broccoli</ui-select-item>
            <ui-select-item value="carrot" [disabled]="true">Carrot</ui-select-item>
            <ui-select-item value="courgette">Courgette</ui-select-item>
            <ui-select-item value="leek">Leek</ui-select-item>
          </ui-select-group>
        </ui-select-content>
      </ui-select>
    `,
    }),
};
