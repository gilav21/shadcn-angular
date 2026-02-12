import { Meta, StoryObj } from '@storybook/angular';
import { PageBuilderComponent } from './page-builder.component';
import { Component, input } from '@angular/core';
import { ComponentMeta } from './page-builder.types';

@Component({
    template: `
    <div class="h-full w-full bg-blue-100 dark:bg-blue-950 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-900 flex items-center justify-center">
      <span class="text-blue-600 dark:text-blue-400 font-bold">Chart Widget</span>
    </div>
  `,
    standalone: true
})
class MockChartComponent { }

@Component({
    template: `
    <div class="h-full w-full bg-green-100 dark:bg-green-950 p-4 rounded-lg border-2 border-green-200 dark:border-green-900 flex items-center justify-center flex-col gap-2">
      <span class="text-green-600 dark:text-green-400 font-bold">Stats Widget</span>
      <span class="text-2xl font-mono">{{ value() }}</span>
    </div>
  `,
    standalone: true
})
class MockStatsComponent {
    value = input(1234);
}

const mockComponents: ComponentMeta[] = [
    {
        id: 'chart',
        name: 'Analytics Chart',
        category: 'Analytics',
        icon: 'bar-chart-2',
        component: MockChartComponent,
        defaultCols: 4,
        defaultRows: 3
    },
    {
        id: 'stats',
        name: 'Stat Card',
        category: 'Metrics',
        icon: 'activity',
        component: MockStatsComponent,
        defaultCols: 2,
        defaultRows: 2,
        defaultInputs: { value: 500 },
        inputs: [
            { name: 'value', type: 'number', label: 'Value' }
        ]
    }
];

const meta: Meta<PageBuilderComponent> = {
    title: 'Page Builder/Page Builder',
    component: PageBuilderComponent,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
    },
};

export default meta;
type Story = StoryObj<PageBuilderComponent>;

export const Default: Story = {
    args: {
        components: mockComponents
    },
};
