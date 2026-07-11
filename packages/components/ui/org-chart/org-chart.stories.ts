import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { OrgChartComponent } from './org-chart.component';
import { OrgNode } from '../../lib/chart.types';

const meta: Meta<OrgChartComponent> = {
    title: 'UI/OrgChart',
    component: OrgChartComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [OrgChartComponent],
        }),
    ],
    argTypes: {
        data: { control: 'object', description: 'Flat list of nodes; each references its parent via `parentId` (`null`/`undefined` marks the root).' },
        layout: {
            control: 'select',
            options: ['vertical', 'horizontal'],
            description: 'Tree growth direction.',
        },
        nodeWidth: { control: 'number', description: 'Width of each node box in pixels.' },
        nodeHeight: { control: 'number', description: 'Height of each node box in pixels.' },
        nodePaddingX: { control: 'number', description: 'Horizontal gap between sibling subtrees in pixels.' },
        nodePaddingY: { control: 'number', description: 'Vertical gap between levels in pixels.' },
        showImages: { control: 'boolean', description: 'Shows the node avatar image (falls back to initials when absent).' },
        lineType: {
            control: 'select',
            options: ['curved', 'straight'],
            description: 'Connector line style.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
        title: { control: 'text', description: 'Accessible chart title, announced with the node count.' },
        nodeClick: { control: false, description: 'Emits `{ node, event }` when a node is clicked.' },
        nodeHover: { control: false, description: 'Emits the hovered node, or `null` on leave.' },
    },
    args: {
        layout: 'vertical',
        nodeWidth: 180,
        nodeHeight: 80,
        nodePaddingX: 40,
        nodePaddingY: 60,
        showImages: true,
        lineType: 'curved',
        class: '',
        title: 'Company Org Chart',
    },
};

export default meta;
type Story = StoryObj<OrgChartComponent>;

const orgData: OrgNode[] = [
    { id: '1', name: 'Ava Stone', title: 'CEO', parentId: null },
    { id: '2', name: 'Liam Chen', title: 'CTO', parentId: '1' },
    { id: '3', name: 'Maya Patel', title: 'CFO', parentId: '1' },
    { id: '4', name: 'Noah Kim', title: 'VP Engineering', parentId: '2' },
    { id: '5', name: 'Zoe Ward', title: 'VP Design', parentId: '2' },
    { id: '6', name: 'Ethan Cruz', title: 'Controller', parentId: '3' },
];

const TEMPLATE = `
    <div class="overflow-auto border rounded-lg p-4" style="max-height: 500px;">
        <ui-org-chart
            [data]="data" [layout]="layout" [nodeWidth]="nodeWidth" [nodeHeight]="nodeHeight"
            [nodePaddingX]="nodePaddingX" [nodePaddingY]="nodePaddingY" [showImages]="showImages"
            [lineType]="lineType" [class]="class" [title]="title" />
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: { ...args, data: orgData },
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Horizontal: Story = {
    args: { layout: 'horizontal' },
    render,
};

export const StraightLines: Story = {
    args: { lineType: 'straight' },
    render,
};

export const WithoutImages: Story = {
    args: { showImages: false },
    render,
};
