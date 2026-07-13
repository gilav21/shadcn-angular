import { Meta, StoryObj } from '@storybook/angular';
import { PageBuilderComponent } from './page-builder.component';
import { Component, input } from '@angular/core';
import { ComponentMeta, PageData } from '../../lib/page-builder.types';

@Component({
    template: `
    <div class="h-full w-full bg-blue-100 dark:bg-blue-950 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-900 flex items-center justify-center">
      <span class="text-blue-700 dark:text-blue-400 font-bold">Chart Widget</span>
    </div>
  `,
    standalone: true
})
class MockChartComponent { }

@Component({
    template: `
    <div class="h-full w-full bg-green-100 dark:bg-green-950 p-4 rounded-lg border-2 border-green-200 dark:border-green-900 flex items-center justify-center flex-col gap-2">
      <span class="text-green-700 dark:text-green-400 font-bold">Stats Widget</span>
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

const initialData: PageData = {
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
    ],
};

const meta: Meta<PageBuilderComponent> = {
    title: 'Page Builder/Page Builder',
    component: PageBuilderComponent,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
    },
    argTypes: {
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
        components: { control: 'object', description: 'Widget registry shown in the left sidebar and used to resolve dropped items.' },
        data: { control: 'object', description: 'Initial layout to load into the builder. Changing this input resets the board (like `importJson()`).' },
        enableSave: { control: 'boolean', description: 'Shows the "Save" toolbar button; clicking it emits the current layout via `(save)`.' },
        enableExport: { control: 'boolean', description: 'Shows the "Export" toolbar button; clicking it downloads the current layout as JSON.' },
        save: { control: false, description: 'Emits the current `PageData` layout when the Save button is clicked.' },
        viewModeChange: { control: false, description: 'Emits `"edit" | "preview"` whenever the view mode toggles.' },
    },
    args: {
        components: mockComponents,
        enableSave: true,
        enableExport: false,
        class: '',
    },
};

export default meta;
type Story = StoryObj<PageBuilderComponent>;

const TEMPLATE = `
    <ui-page-builder
        [components]="components" [data]="data" [enableSave]="enableSave"
        [enableExport]="enableExport" [class]="class" />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { args: { data: initialData }, render };

export const Default: Story = {
    args: {
        components: mockComponents,
        enableSave: true,
        enableExport: false
    },
    render,
};

export const WithExport: Story = {
    args: {
        components: mockComponents,
        enableSave: true,
        enableExport: true
    },
    render,
};

/** Loads an initial layout via the `data` input, seeding the board without user interaction. */
export const WithInitialData: Story = {
    args: {
        components: mockComponents,
        data: initialData,
        enableSave: true,
        enableExport: true,
    },
    render,
};
