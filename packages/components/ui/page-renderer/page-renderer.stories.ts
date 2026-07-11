import { Meta, StoryObj } from '@storybook/angular';
import { Component, input } from '@angular/core';
import { PageRendererComponent } from './page-renderer.component';
import { ComponentMeta, PageData } from '../../lib/page-builder.types';

@Component({
    template: `
    <div class="h-full w-full bg-green-100 dark:bg-green-950 p-4 rounded-lg border-2 border-green-200 dark:border-green-900 flex items-center justify-center flex-col gap-2">
      <span class="text-green-600 dark:text-green-400 font-bold">Stats Widget</span>
      <span class="text-2xl font-mono">{{ value() }}</span>
    </div>
  `,
    standalone: true,
})
class MockStatsComponent {
    value = input(1234);
}

@Component({
    template: `
    <div class="h-full w-full bg-blue-100 dark:bg-blue-950 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-900 flex items-center justify-center">
      <span class="text-blue-600 dark:text-blue-400 font-bold">Chart Widget</span>
    </div>
  `,
    standalone: true,
})
class MockChartComponent { }

const mockComponents: ComponentMeta[] = [
    {
        id: 'chart',
        name: 'Analytics Chart',
        category: 'Analytics',
        icon: 'bar-chart-2',
        component: MockChartComponent,
        defaultCols: 4,
        defaultRows: 3,
    },
    {
        id: 'stats',
        name: 'Stat Card',
        category: 'Metrics',
        icon: 'activity',
        component: MockStatsComponent,
        defaultCols: 2,
        defaultRows: 2,
    },
];

const mockData: PageData = {
    grid: {
        cols: 12,
        rowHeight: '20px',
        columnWidth: '1fr',
        gap: '1.5rem',
        showBorders: true,
        borderRadius: '0.75rem',
        itemPadding: '1rem',
        squareCells: true,
    },
    items: [
        { id: 'a', x: 0, y: 0, cols: 4, rows: 3, componentId: 'chart' },
        { id: 'b', x: 4, y: 0, cols: 2, rows: 2, componentId: 'stats', inputs: { value: 500 } },
        { id: 'c', x: 6, y: 0, cols: 2, rows: 2, componentId: 'stats', bindings: { value: 'liveValue' } },
    ],
};

const meta: Meta<PageRendererComponent> = {
    title: 'Page Builder/Page Renderer',
    component: PageRendererComponent,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Read-only renderer for a `PageData` layout produced by `ui-page-builder`. Resolves `bindings` against `context` at render time.',
            },
        },
    },
    argTypes: {
        data: { control: 'object', description: 'Layout to render (grid config + items). Required.' },
        components: { control: 'object', description: 'Component registry used to resolve each item\'s `componentId`.' },
        context: { control: 'object', description: 'Data context used to resolve item `bindings` (dot-path lookups).' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        data: mockData,
        components: mockComponents,
        context: { liveValue: 777 },
        class: '',
    },
};

export default meta;
type Story = StoryObj<PageRendererComponent>;

const TEMPLATE = `
    <div style="height: 400px;">
        <ui-page-renderer [data]="data" [components]="components" [context]="context" [class]="class" />
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const WithBoundData: Story = {
    args: {
        context: { liveValue: 42 },
    },
    render,
};
