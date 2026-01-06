import { Meta, StoryObj } from '@storybook/angular';
import { ToggleGroupComponent, ToggleGroupItemComponent } from './toggle-group.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<ToggleGroupComponent> = {
  title: 'UI/ToggleGroup',
  component: ToggleGroupComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [ToggleGroupComponent, ToggleGroupItemComponent],
    }),
  ],
  argTypes: {
    type: { control: 'radio', options: ['single', 'multiple'] },
    variant: { control: 'select', options: ['default', 'outline'] },
    size: { control: 'select', options: ['default', 'sm', 'lg'] },
    disabled: { control: 'boolean' },
  },
  args: {
    type: 'single',
    variant: 'default',
    size: 'default',
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<ToggleGroupComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <ui-toggle-group [type]="type" [variant]="variant" [size]="size" [disabled]="disabled" defaultValue="left">
        <ui-toggle-group-item value="left" ariaLabel="Toggle bold">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M14 5a4 4 0 0 0 0 8h-4v7H4V5Z"/><path d="M4 13h4"/></svg>
        </ui-toggle-group-item>
        <ui-toggle-group-item value="center" ariaLabel="Toggle italic">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>
        </ui-toggle-group-item>
        <ui-toggle-group-item value="right" ariaLabel="Toggle underline">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/></svg>
        </ui-toggle-group-item>
      </ui-toggle-group>
    `,
  }),
};

export const Outline: Story = {
  args: {
    variant: 'outline',
  },
  render: (args) => ({
    props: args,
    template: `
          <ui-toggle-group [type]="type" [variant]="variant" [size]="size" [disabled]="disabled">
            <ui-toggle-group-item value="a">A</ui-toggle-group-item>
            <ui-toggle-group-item value="b">B</ui-toggle-group-item>
            <ui-toggle-group-item value="c">C</ui-toggle-group-item>
          </ui-toggle-group>
        `,
  }),
};
