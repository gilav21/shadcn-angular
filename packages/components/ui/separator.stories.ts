import { Meta, StoryObj } from '@storybook/angular';
import { SeparatorComponent } from './separator.component';

const meta: Meta<SeparatorComponent> = {
    title: 'UI/Separator',
    component: SeparatorComponent,
    tags: ['autodocs'],
    argTypes: {
        orientation: {
            control: 'radio',
            options: ['horizontal', 'vertical'],
        },
    },
    args: {
        orientation: 'horizontal',
    },
};

export default meta;
type Story = StoryObj<SeparatorComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
      <div>
        <div class="space-y-1">
          <h4 class="text-sm font-medium leading-none">Radix Primitives</h4>
          <p class="text-sm text-muted-foreground">
            An open-source UI component library.
          </p>
        </div>
        <ui-separator class="my-4" [orientation]="orientation"></ui-separator>
        <div class="flex h-5 items-center space-x-4 text-sm">
          <div>Blog</div>
          <ui-separator orientation="vertical"></ui-separator>
          <div>Docs</div>
          <ui-separator orientation="vertical"></ui-separator>
          <div>Source</div>
        </div>
      </div>
    `,
    }),
};
