import { Meta, StoryObj } from '@storybook/angular';
import {
  VirtualScrollComponent,
  VirtualItemDirective,
  VirtualItem
} from '../../../packages/components/ui/virtual-scroll';
import { CommonModule } from '@angular/common';

interface ExampleItem extends VirtualItem {
  id: number;
  title: string;
  content: string;
}

const meta: Meta<VirtualScrollComponent<any>> = {
  title: 'Components/Virtual Scroll',
  component: VirtualScrollComponent,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Window-based virtual scrolling for Angular. No height measurement needed - works with any content size!',
      },
    },
  },
};

export default meta;

type Story = StoryObj<VirtualScrollComponent<any>>;

const generateItems = (count: number): ExampleItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Item ${i + 1}`,
    content: `This is the content for item ${i + 1}`,
  }));

export const Basic: Story = {
  name: 'Basic Usage',
  args: {
    items: generateItems(10000),

    minItemHeight: 50,
    buffer: 10,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="padding: 20px;">
        <h3 style="margin-bottom: 16px; font-size: 18px; font-weight: 600;">Basic Virtual Scroll (10000 items)</h3>
        <ui-virtual-scroll
          [items]="items"
          [minItemHeight]="minItemHeight"
          [buffer]="buffer"
          style="border: 1px solid #e2e8f0; border-radius: 8px; height: 400px; display: block;"
        >
          <ng-template uiVirtualItem let-item let-index="index">
            <div style="
              padding: 12px 16px;
              border-bottom: 1px solid #e2e8f0;
              background: white;
              display: flex;
              align-items: center;
              gap: 12px;
              height: 50px;
              box-sizing: border-box;
            ">
              <span style="
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: #3b82f6;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                font-size: 14px;
              ">{{ item.id }}</span>
              <div>
                <div style="font-weight: 500; color: #1e293b;">{{ item.title }}</div>
                <div style="font-size: 13px; color: #64748b;">{{ item.content }}</div>
              </div>
            </div>
          </ng-template>
        </ui-virtual-scroll>
        <p style="margin-top: 12px; font-size: 13px; color: #64748b;">
          Only rendering visible items + overscan buffer
        </p>
      </div>
    `,
    moduleMetadata: {
      imports: [CommonModule, VirtualScrollComponent, VirtualItemDirective],
    },
  }),
};

export const VariableHeight: Story = {
  name: 'Variable Height Items',
  args: {
    items: Array.from({ length: 1000 }, (_, i) => {
      const heights = [60, 80, 100, 120, 150, 200, 300, 500];
      const height = heights[i % heights.length];
      return {
        id: i + 1,
        title: `Item ${i + 1}`,
        content: `This item has ${height}px height`,
        height,
      };
    }),
    minItemHeight: 50,
    buffer: 10,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="padding: 20px;">
        <h3 style="margin-bottom: 16px; font-size: 18px; font-weight: 600;">Variable Height Items</h3>
        <ui-virtual-scroll
          [items]="items"
          [minItemHeight]="minItemHeight"
          [buffer]="buffer"
          style="border: 1px solid #e2e8f0; border-radius: 8px; height: 400px; display: block;"
        >
          <ng-template uiVirtualItem let-item let-index="index">
            <div 
              style="
                padding: 16px;
                border-bottom: 1px solid #e2e8f0;
                background: white;
              "
              [style.height.px]="item.height"
            >
              <div style="font-weight: 600; color: #1e293b; margin-bottom: 8px;">
                Item {{ item.id }} ({{ item.height }}px height)
              </div>
              <div style="font-size: 14px; color: #475569;">
                {{ item.content }}
              </div>
            </div>
          </ng-template>
        </ui-virtual-scroll>
        <p style="margin-top: 12px; font-size: 13px; color: #64748b;">
          Each item has a different height. No measurement needed!
        </p>
      </div>
    `,
    moduleMetadata: {
      imports: [CommonModule, VirtualScrollComponent, VirtualItemDirective],
    },
  }),
};
