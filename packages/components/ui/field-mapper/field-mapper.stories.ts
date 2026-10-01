import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { FieldMapperComponent } from './field-mapper.component';
import { FieldMapperItemDirective } from './sub/field-mapper-item.directive';
import { FieldMapperLinkLabelDirective } from './sub/field-mapper-link-label.directive';
import type { FieldMapperItem, FieldMapperLink, FieldMapperLinkTone } from './field-mapper.types';

const ORDERS: FieldMapperItem[] = [
    { id: 'customer_id', label: 'customer_id' },
    { id: 'region', label: 'region' },
    { id: 'order_id', label: 'order_id' },
    { id: 'placed_at', label: 'placed_at' },
    { id: 'total', label: 'total' },
];

const CUSTOMERS: FieldMapperItem[] = [
    { id: 'segment', label: 'segment' },
    { id: 'id', label: 'id' },
    { id: 'name', label: 'name' },
    { id: 'area', label: 'area' },
    { id: 'legacy_code', label: 'legacy_code', disabled: true },
];

const SAMPLES: Record<string, string> = {
    customer_id: '1042, 1043, 977',
    region: 'North, South',
    order_id: '1, 2, 3',
    placed_at: '2026-09-30, 2026-10-01',
    total: '19.90, 7.50',
    segment: 'Retail, Trade',
    id: '1042, 977, 15',
    name: 'Dana, יעל, Omar',
    area: 'North, East',
    legacy_code: 'A-1, B-7',
};

const COVERAGE: Record<string, string> = { 'customer_id>id': '94% found', 'region>area': '61% found' };

const LINKS: FieldMapperLink[] = [
    { startId: 'customer_id', endId: 'id' },
    { startId: 'region', endId: 'area' },
];

const meta: Meta<FieldMapperComponent> = {
    title: 'UI/Field Mapper',
    component: FieldMapperComponent,
    tags: ['autodocs'],
    decorators: [moduleMetadata({ imports: [FieldMapperItemDirective, FieldMapperLinkLabelDirective] })],
    argTypes: {
        start: { control: 'object', description: 'Items of the start list (left in LTR, right in RTL).' },
        end: { control: 'object', description: 'Items of the end list.' },
        links: { control: 'object', description: 'The links, two-way bound with `[(links)]`.' },
        maxLinks: { control: 'object', description: 'Links per item on each side; default `{ start: 1, end: 1 }`. Going over moves the oldest.' },
        startHeading: { control: 'text', description: 'Heading over the start list.' },
        endHeading: { control: 'text', description: 'Heading over the end list.' },
        align: { control: 'boolean', description: 'Order the end list so linked items sit level with their partner.' },
        layout: { control: 'select', options: ['auto', 'columns', 'rows'], description: '`auto` switches to rows below ~28rem of width; the others force one layout.' },
        searchable: { control: 'boolean', description: 'A filter box over each list.' },
        linkTone: { control: false, description: '`(link) => "default" | "muted" | "strong"` — per-line tone.' },
        locale: { control: 'select', options: ['en', 'he', 'ar', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'pt'], description: 'Locale for every built-in string.' },
        class: { control: 'text', description: 'Extra classes merged onto the root.' },
    },
    args: {
        start: ORDERS,
        end: CUSTOMERS,
        links: LINKS,
        maxLinks: { start: 1, end: 1 },
        startHeading: 'Column in orders',
        endHeading: 'Column in customers',
        align: true,
        layout: 'auto',
        searchable: false,
        locale: 'en',
        class: '',
    },
};

export default meta;
type Story = StoryObj<FieldMapperComponent>;

const ITEM_TEMPLATE = `
    <ng-template uiFieldMapperItem let-item>
        <span class="block truncate font-medium" dir="auto">{{ item.label }}</span>
        <span class="text-muted-foreground block truncate text-xs" dir="auto">{{ samples[item.id] }}</span>
    </ng-template>`;

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
    render: args => ({
        props: { ...args, samples: SAMPLES, coverage: COVERAGE },
        template: `
            <div class="max-w-3xl">
                <ui-field-mapper
                    [start]="start" [end]="end" [(links)]="links" [maxLinks]="maxLinks"
                    [startHeading]="startHeading" [endHeading]="endHeading"
                    [align]="align" [layout]="layout" [searchable]="searchable" [locale]="locale" [class]="class">
                    ${ITEM_TEMPLATE}
                    <ng-template uiFieldMapperLinkLabel let-link>{{ coverage[link.startId + '>' + link.endId] }}</ng-template>
                </ui-field-mapper>
            </div>`,
    }),
};

/** Simple mode: just the lists, plain labels, nothing projected. */
export const Simple: Story = {
    args: { links: [] },
    render: args => ({
        props: args,
        template: `<div class="max-w-xl"><ui-field-mapper [start]="start" [end]="end" [(links)]="links" /></div>`,
    }),
};

/** Many-to-many with tones: a dashed muted line reads as "proposed", a heavy one as "confirmed". */
export const ManyToManyWithTones: Story = {
    args: {
        maxLinks: { start: Infinity, end: Infinity },
        links: [
            { startId: 'customer_id', endId: 'id' },
            { startId: 'customer_id', endId: 'name' },
            { startId: 'region', endId: 'area' },
            { startId: 'order_id', endId: 'id' },
        ],
    },
    render: args => ({
        props: {
            ...args,
            tone: (link: FieldMapperLink): FieldMapperLinkTone => {
                if (link.startId === 'customer_id' && link.endId === 'id') return 'strong';
                return link.startId === 'order_id' ? 'muted' : 'default';
            },
        },
        template: `
            <div class="max-w-3xl">
                <ui-field-mapper [start]="start" [end]="end" [(links)]="links" [maxLinks]="maxLinks" [linkTone]="tone"
                    startHeading="Column in orders" endHeading="Column in customers" />
            </div>`,
    }),
};

/** Searchable lists: a line to a filtered-out item runs to the list's edge, beside a count. */
export const Searchable: Story = {
    args: { searchable: true },
    render: args => ({
        props: args,
        template: `
            <div class="max-w-3xl">
                <ui-field-mapper [start]="start" [end]="end" [(links)]="links" [searchable]="true"
                    [startHeading]="startHeading" [endHeading]="endHeading" />
            </div>`,
    }),
};

/** Right-to-left: the start list sits on the right and every line mirrors. */
export const RightToLeft: Story = {
    args: { locale: 'he' },
    render: args => ({
        props: { ...args, samples: SAMPLES },
        template: `
            <div dir="rtl" class="max-w-3xl">
                <ui-field-mapper [start]="start" [end]="end" [(links)]="links" locale="he"
                    startHeading="עמודה בהזמנות" endHeading="עמודה בלקוחות">
                    ${ITEM_TEMPLATE}
                </ui-field-mapper>
            </div>`,
    }),
};

/** Below ~28rem of width the lists become rows, each with a picker for its partner. */
export const NarrowContainer: Story = {
    render: args => ({
        props: args,
        template: `
            <div class="w-[320px] max-w-full border p-2">
                <ui-field-mapper [start]="start" [end]="end" [(links)]="links" [searchable]="true"
                    [startHeading]="startHeading" [endHeading]="endHeading" />
            </div>`,
    }),
};
