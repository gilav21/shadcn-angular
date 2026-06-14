import { Component, computed, signal, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageRendererComponent } from '../../../packages/components/ui/page-renderer';
import { PageData, ComponentMeta } from '../../../packages/components/lib/page-builder.types';
import { CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent, CardContentComponent, ButtonComponent, InputComponent, LabelComponent, SwitchComponent, DataTableComponent, PieChartComponent, BarChartComponent, ColumnDef, IconComponent, FieldComponent, FieldLabelComponent, FieldDescriptionComponent } from '../../../packages/components/ui';

// --- Wrapper Components (Defined first to avoid reference errors) ---

@Component({
    selector: 'demo-header-card',
    standalone: true,
    imports: [CommonModule, CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent],
    template: `
        <ui-card [class]="variantClass()">
            <ui-card-header>
                <ui-card-title>{{ title() }}</ui-card-title>
                <ui-card-description>{{ description() }}</ui-card-description>
            </ui-card-header>
        </ui-card>
    `
})
export class DemoHeaderCardComponent {
    title = input('');
    description = input('');
    variant = input('default');
    variantClass = computed(() => this.variant() === 'ghost' ? 'border-none shadow-none bg-transparent' : '');
}

@Component({
    selector: 'demo-metric-card',
    standalone: true,
    imports: [CommonModule, CardComponent, CardHeaderComponent, CardTitleComponent, CardContentComponent, IconComponent],
    template: `
        <ui-card>
            <ui-card-header class="flex flex-row items-center justify-between space-y-0 pb-2">
                <ui-card-title class="text-sm font-medium">{{ title() }}</ui-card-title>
                @if (icon()) {
                    <ui-icon [name]="icon()" class="h-4 w-4 text-muted-foreground" />
                }
            </ui-card-header>
            <ui-card-content>
                <div class="text-2xl font-bold">{{ formattedValue() }}</div>
                <p class="text-xs text-muted-foreground">+20.1% from last month</p>
            </ui-card-content>
        </ui-card>
    `
})
export class DemoMetricCardComponent {
    title = input('');
    value = input(0);
    icon = input('');

    formattedValue = computed(() => {
        const val = this.value();
        if (this.title().toLowerCase().includes('revenue') || this.title().toLowerCase().includes('sales')) {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
        }
        return new Intl.NumberFormat('en-US').format(val);
    });
}
@Component({
    selector: 'demo-bar-chart-card',
    standalone: true,
    imports: [CommonModule, CardComponent, CardHeaderComponent, CardTitleComponent, CardContentComponent, BarChartComponent],
    template: `
        <ui-card class="h-full">
            <ui-card-header>
                <ui-card-title>{{ title() }}</ui-card-title>
            </ui-card-header>
            <ui-card-content class="pl-2">
                 <ui-bar-chart 
                    [data]="data()" 
                    [height]="250"
                    [width]="700"
                    [showGrid]="false"
                 />
            </ui-card-content>
        </ui-card>
    `
})
export class DemoBarChartCardComponent {
    title = input('');
    data = input<any[]>([]);
}

@Component({
    selector: 'demo-pie-chart-card',
    standalone: true,
    imports: [CommonModule, CardComponent, CardHeaderComponent, CardTitleComponent, CardContentComponent, PieChartComponent],
    template: `
        <ui-card class="h-full">
            <ui-card-header>
                <ui-card-title>{{ title() }}</ui-card-title>
            </ui-card-header>
            <ui-card-content class="flex items-center justify-center">
                 <ui-pie-chart 
                    [data]="data()" 
                    [size]="180"
                    [showLegend]="true"
                    legendPosition="bottom"
                 />
            </ui-card-content>
        </ui-card>
    `
})
export class DemoPieChartCardComponent {
    title = input('');
    data = input<any[]>([]);
}

@Component({
    selector: 'demo-data-table-card',
    standalone: true,
    imports: [CommonModule, CardComponent, CardHeaderComponent, CardTitleComponent, CardContentComponent, DataTableComponent],
    template: `
        <ui-card class="h-full">
            <ui-card-header>
                <ui-card-title>{{ title() }}</ui-card-title>
            </ui-card-header>
            <ui-card-content>
                <ui-data-table [data]="data()" [columns]="columns()"  [enableColumnResize]="true"/>
            </ui-card-content>
        </ui-card>
    `
})
export class DemoDataTableCardComponent {
    title = input('');
    data = input<any[]>([]);
    columns = input<ColumnDef<any>[]>([]);
}

@Component({
    selector: 'demo-settings-form',
    standalone: true,
    imports: [CommonModule, CardComponent, CardHeaderComponent, CardTitleComponent, CardContentComponent, InputComponent, FieldComponent, FieldLabelComponent, FieldDescriptionComponent, ButtonComponent],
    template: `
        <ui-card class="h-full">
            <ui-card-header>
                <ui-card-title>{{ title() || 'Settings' }}</ui-card-title>
            </ui-card-header>
            <ui-card-content class="space-y-6">
            <!-- Insert form settings here -->
            <div class="max-w-md border rounded-md p-6">
            <form class="space-y-6">
              <ui-field>
                <ui-field-label>Username</ui-field-label>
                <ui-input placeholder="moyshes" />
                <ui-field-description>
                  This is your public display name.
                </ui-field-description>
              </ui-field>

              <ui-field>
                <ui-field-label>Email</ui-field-label>
                <ui-input placeholder="m@example.com" />
              </ui-field>

              <ui-button class="mt-4">Submit</ui-button>
            </form>
          </div>
               
            </ui-card-content>
        </ui-card>
    `
})
export class DemoSettingsFormComponent {
    title = input('');
}

@Component({
    selector: 'app-revenue-stream',
    standalone: true,
    imports: [CommonModule, CardComponent, CardHeaderComponent, CardTitleComponent, CardContentComponent, SwitchComponent, LabelComponent, ButtonComponent],
    template: `
        <ui-card class="h-full">
            <ui-card-header>
                <ui-card-title>{{ title() || 'Revenue Stream' }}</ui-card-title>
            </ui-card-header>
            <ui-card-content class="space-y-6">
                <div class="flex items-center justify-between space-x-2">
                    <ui-label htmlFor="revenue-toggle">Show Revenue Stream</ui-label>
                    <ui-switch id="revenue-toggle" [checked]="revenueEnabled()" (checkedChange)="revenueEnabled.set($event)" />
                </div>
                
                @if (revenueEnabled()) {
                    <div class="space-y-2">
                        <ui-label>Revenue Target ($)</ui-label>
                        <div class="text-2xl font-bold text-green-600">
                            \${{ revenueAmount() | number }}
                        </div>
                        <p class="text-xs text-muted-foreground">
                            Target for Q4 2024 based on current growth.
                        </p>
                    </div>
                }

                <div class="mt-6 pt-4 border-t">
                    <ui-button class="w-full">Save Configuration</ui-button>
                </div>
            </ui-card-content>
        </ui-card>
    `
})
export class DemoRevenueStreamComponent {
    title = input('');
    revenueEnabled = model(false);
    revenueAmount = input(Math.random() * 10000);
}



@Component({
    selector: 'app-page-viewer-demo',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        PageRendererComponent,
        ButtonComponent,
        IconComponent
    ],
    template: `
        <div class="space-y-6">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-3xl font-bold tracking-tight">Dashboard</h2>
                    <p class="text-muted-foreground">Overview of your financial performance.</p>
                </div>
                <div class="flex items-center gap-x-2">
                    <ui-button variant="outline" (click)="resetContext()">
                        <ui-icon name="refresh-cw"  class="mr-2 h-5 w-5" />
                        Reset Context
                    </ui-button>
                    <ui-button (click)="randomizeData()">
                        <ui-icon name="shuffle" class="mr-2 h-5 w-5" />
                        Randomize Data
                    </ui-button>
                </div>
            </div>

            <!-- The Page Renderer takes over the main content area -->
            <ui-page-renderer 
                [data]="pageData" 
                [context]="context()" 
                [components]="components" 
                class="block"
            />
        </div>
    `
})
export class PageViewerDemoComponent {
    // Initial Context: Realistic SaaS Data
    initialContext = {
        meta: {
            title: 'Financial Dashboard',
        },
        user: {
            name: 'Alice Johnson',
            role: 'Admin',
            avatar: 'https://github.com/shadcn.png'
        },
        stats: {
            totalRevenue: 45231.89,
            subscriptions: 2350,
            activeUsers: 1250,
            revenue: 45231.89,
            growth: '+20.1%'
        },
        chart: {
            revenueOverTime: [
                { name: 'Jan', value: 2000 },
                { name: 'Feb', value: 4500 },
                { name: 'Mar', value: 3000 },
                { name: 'Apr', value: 5800 },
                { name: 'May', value: 4900 },
                { name: 'Jun', value: 7200 },
                { name: 'Jul', value: 6500 },
                { name: 'Aug', value: 8100 },
                { name: 'Sep', value: 7600 },
                { name: 'Oct', value: 9400 },
                { name: 'Nov', value: 8800 },
                { name: 'Dec', value: 10500 }
            ]
        },
        recentSales: [
            { id: 'TRX-9871', user: 'Olivia Martin', email: 'olivia.martin@email.com', amount: 1999, status: 'Success' },
            { id: 'TRX-9872', user: 'Jackson Lee', email: 'jackson.lee@email.com', amount: 39, status: 'Success' },
            { id: 'TRX-9873', user: 'Isabella Nguyen', email: 'isabella.nguyen@email.com', amount: 299, status: 'Processing' },
            { id: 'TRX-9874', user: 'William Kim', email: 'will@email.com', amount: 99, status: 'Success' },
            { id: 'TRX-9875', user: 'Sofia Davis', email: 'sofia.davis@email.com', amount: 39, status: 'Failed' }
        ],
        recentSalesColumns: [
            { accessorKey: 'user', header: 'Customer' },
            { accessorKey: 'email', header: 'Email' },
            { accessorKey: 'amount', header: 'Amount' },
            { accessorKey: 'status', header: 'Status' }
        ]
    };

    context = signal(structuredClone(this.initialContext));

    // Page Layout Definition
    pageData: PageData = {
        grid: {
            cols: 4,
            rowHeight: '160px',
            columnWidth: '1fr',
            gap: '1rem',
            showBorders: false,
            borderRadius: '0',
            itemPadding: '0',
            squareCells: false
        },
        items: [
            // Column 1: Stacked Metric Cards
            {
                id: 'metric-1',
                x: 1, y: 1, cols: 1, rows: 1,
                componentId: 'metric-card',
                inputs: { title: 'Total Revenue', icon: 'dollar-sign' },
                bindings: { value: 'stats.totalRevenue' }
            },
            {
                id: 'metric-2',
                x: 1, y: 2, cols: 1, rows: 1,
                componentId: 'metric-card',
                inputs: { title: 'Subscriptions', icon: 'users' },
                bindings: { value: 'stats.subscriptions' }
            },
            {
                id: 'metric-3',
                x: 1, y: 3, cols: 1, rows: 1,
                componentId: 'metric-card',
                inputs: { title: 'Active Now', icon: 'activity' },
                bindings: { value: 'stats.activeUsers' }
            },
            {
                id: 'metric-4',
                x: 1, y: 4, cols: 1, rows: 1,
                componentId: 'metric-card',
                inputs: { title: 'Sales', icon: 'credit-card' },
                bindings: { value: 'stats.activeUsers' }
            },

            // Middle: Pie Chart (Span 2 cols, 4 rows)
            {
                id: 'pie-chart',
                x: 2, y: 1, cols: 2, rows: 2,
                componentId: 'pie-chart-card',
                inputs: { title: 'Sales Distribution' },
                bindings: { data: 'chart.revenueOverTime' }
            },

            // Right: Bar Chart (Span 1 col, 4 rows)
            {
                id: 'main-chart',
                x: 2, y: 3, cols: 2, rows: 2,
                componentId: 'bar-chart-card',
                inputs: { title: 'Revenue Overview' },
                bindings: { data: 'chart.revenueOverTime' }
            },

            {
                id: 'settings-form',
                x: 4, y: 1, cols: 2, rows: 2,
                componentId: 'settings-form',
                inputs: { title: 'Settings' },
                bindings: { revenueEnabled: 'settings.revenueEnabled', revenueAmount: 'settings.revenueAmount' }
            },
            {
                id: 'revenue-stream',
                x: 4, y: 3, cols: 2, rows: 2,
                componentId: 'revenue-stream',
                inputs: { title: 'Revenue Stream' },
                bindings: { revenueEnabled: 'settings.revenueEnabled', revenueAmount: 'settings.revenueAmount' }
            },



            // Bottom: Transaction Table
            {
                id: 'transactions-table',
                x: 1, y: 5, cols: 4, rows: 3,
                componentId: 'data-table-card',
                inputs: { title: 'Recent Transactions' },
                bindings: { data: 'recentSales', columns: 'recentSalesColumns' }
            }
        ]
    };

    // Components Definition
    components: ComponentMeta[] = [
        {
            id: 'metric-card',
            name: 'Metric Card',
            category: 'Data Display',
            component: DemoMetricCardComponent,
            inputs: [
                { name: 'title', type: 'string' },
                { name: 'value', type: 'number' },
                { name: 'icon', type: 'string' }
            ]
        },
        {
            id: 'bar-chart-card',
            name: 'Bar Chart',
            category: 'Charts',
            component: DemoBarChartCardComponent,
            inputs: [
                { name: 'data', type: 'json' },
                { name: 'title', type: 'string' }
            ]
        },
        {
            id: 'pie-chart-card',
            name: 'Pie Chart',
            category: 'Charts',
            component: DemoPieChartCardComponent,
            inputs: [
                { name: 'data', type: 'json' },
                { name: 'title', type: 'string' }
            ]
        },
        {
            id: 'data-table-card',
            name: 'Data Table',
            category: 'Data Display',
            component: DemoDataTableCardComponent,
            inputs: [
                { name: 'data', type: 'json' },
                { name: 'columns', type: 'json' },
                { name: 'title', type: 'string' }
            ]
        },
        {
            id: 'settings-form',
            name: 'Settings Form',
            category: 'Forms',
            component: DemoSettingsFormComponent,
            inputs: [
                { name: 'revenueEnabled', type: 'boolean' },
                { name: 'revenueAmount', type: 'number' },
                { name: 'title', type: 'string' }
            ]
        },
        {
            id: 'revenue-stream',
            name: 'Revenue Stream',
            category: 'Data Display',
            component: DemoRevenueStreamComponent,
            inputs: [
                { name: 'title', type: 'string' }
            ]
        }
    ];

    randomizeData() {
        this.context.update(ctx => ({
            ...ctx,
            stats: {
                ...ctx.stats,
                totalRevenue: Math.floor(Math.random() * 50000) + 10000,
                activeUsers: Math.floor(Math.random() * 5000) + 500
            },
            chart: {
                ...ctx.chart,
                revenueOverTime: ctx.chart.revenueOverTime.map((d: any) => ({ ...d, value: Math.floor(Math.random() * 10000) + 1000 }))
            }
        }));
    }

    resetContext() {
        this.context.set(structuredClone(this.initialContext));
    }

    updateMeta(prop: string, value: string) {
        this.context.update(ctx => ({
            ...ctx,
            meta: { ...ctx.meta, [prop]: value }
        }));
    }
}
