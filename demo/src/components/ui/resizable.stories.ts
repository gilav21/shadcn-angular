import { Meta, StoryObj } from '@storybook/angular';
import {
    ResizablePanelGroupComponent,
    ResizablePanelComponent,
    ResizableHandleComponent,
} from './resizable.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<ResizablePanelGroupComponent> = {
    title: 'UI/Resizable',
    component: ResizablePanelGroupComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                ResizablePanelGroupComponent,
                ResizablePanelComponent,
                ResizableHandleComponent,
            ],
        }),
    ],
    argTypes: {
        direction: {
            control: 'radio',
            options: ['horizontal', 'vertical'],
        },
    },
    args: {
        direction: 'horizontal',
    },
};

export default meta;
type Story = StoryObj<ResizablePanelGroupComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
      <ui-resizable-panel-group
        [direction]="direction"
        class="max-w-md rounded-lg border min-h-[200px]"
      >
        <ui-resizable-panel [defaultSize]="50">
          <div class="flex h-full items-center justify-center p-6">
            <span class="font-semibold">One</span>
          </div>
        </ui-resizable-panel>
        <ui-resizable-handle />
        <ui-resizable-panel [defaultSize]="50">
          <ui-resizable-panel-group direction="vertical">
            <ui-resizable-panel [defaultSize]="25">
              <div class="flex h-full items-center justify-center p-6">
                <span class="font-semibold">Two</span>
              </div>
            </ui-resizable-panel>
            <ui-resizable-handle />
            <ui-resizable-panel [defaultSize]="75">
              <div class="flex h-full items-center justify-center p-6">
                <span class="font-semibold">Three</span>
              </div>
            </ui-resizable-panel>
          </ui-resizable-panel-group>
        </ui-resizable-panel>
      </ui-resizable-panel-group>
    `,
    }),
};
