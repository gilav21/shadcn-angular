import { Meta, StoryObj } from '@storybook/angular';
import {
    CollapsibleComponent,
    CollapsibleTriggerComponent,
    CollapsibleContentComponent,
} from './collapsible.component';
import { ButtonComponent } from './button.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<CollapsibleComponent> = {
    title: 'UI/Collapsible',
    component: CollapsibleComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                CollapsibleComponent,
                CollapsibleTriggerComponent,
                CollapsibleContentComponent,
                ButtonComponent
            ],
        }),
    ],
    argTypes: {
        open: { control: 'boolean' },
        disabled: { control: 'boolean' },
    },
};

export default meta;
type Story = StoryObj<CollapsibleComponent>;

export const Default: Story = {
    render: () => ({
        template: `
      <ui-collapsible class="w-[350px] space-y-2">
        <div class="flex items-center justify-between space-x-4 px-4">
          <h4 class="text-sm font-semibold">
            @peduarte starred 3 repositories
          </h4>
          <ui-collapsible-trigger>
            <ui-button variant="ghost" size="sm" class="w-9 p-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M8 9l4-4 4 4"/><path d="M8 15l4 4 4-4"/></svg>
              <span class="sr-only">Toggle</span>
            </ui-button>
          </ui-collapsible-trigger>
        </div>
        <div class="rounded-md border px-4 py-3 font-mono text-sm">
          @radix-ui/primitives
        </div>
        <ui-collapsible-content class="space-y-2">
          <div class="rounded-md border px-4 py-3 font-mono text-sm">
            @radix-ui/colors
          </div>
          <div class="rounded-md border px-4 py-3 font-mono text-sm">
            @stitches/react
          </div>
        </ui-collapsible-content>
      </ui-collapsible>
    `,
    }),
};
