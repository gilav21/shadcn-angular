import { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import {
    EmptyComponent,
    EmptyHeaderComponent,
    EmptyMediaComponent,
    EmptyTitleComponent,
    EmptyDescriptionComponent,
    EmptyContentComponent,
} from './empty.component';
import { ButtonComponent } from './button.component';

const meta: Meta<EmptyComponent> = {
    title: 'UI/Empty',
    component: EmptyComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                EmptyComponent,
                EmptyHeaderComponent,
                EmptyMediaComponent,
                EmptyTitleComponent,
                EmptyDescriptionComponent,
                EmptyContentComponent,
                ButtonComponent,
            ],
        }),
    ],
};

export default meta;
type Story = StoryObj<EmptyComponent>;

export const Default: Story = {
    render: () => ({
        template: `
            <ui-empty>
                <ui-empty-header>
                    <ui-empty-media>
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </ui-empty-media>
                    <ui-empty-title>No users found</ui-empty-title>
                    <ui-empty-description>
                        There are no users matching your search criteria. Try adjusting your filters or create a new user.
                    </ui-empty-description>
                </ui-empty-header>
                <ui-empty-content>
                    <ui-button>Add User</ui-button>
                </ui-empty-content>
            </ui-empty>
        `,
    }),
};

export const WithIconVariant: Story = {
    render: () => ({
        template: `
            <ui-empty>
                <ui-empty-header>
                    <ui-empty-media variant="icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                            <path d="m3.3 7 8.7 5 8.7-5" />
                            <path d="M12 22V12" />
                        </svg>
                    </ui-empty-media>
                    <ui-empty-title>No items in your inventory</ui-empty-title>
                    <ui-empty-description>
                        Your inventory is empty. Start by adding some products to get started.
                    </ui-empty-description>
                </ui-empty-header>
                <ui-empty-content>
                    <ui-button>Add Product</ui-button>
                    <ui-button variant="outline">Import from CSV</ui-button>
                </ui-empty-content>
            </ui-empty>
        `,
    }),
};

export const MinimalWithoutAction: Story = {
    render: () => ({
        template: `
            <ui-empty>
                <ui-empty-header>
                    <ui-empty-title>No results</ui-empty-title>
                    <ui-empty-description>
                        No matching records found for your query.
                    </ui-empty-description>
                </ui-empty-header>
            </ui-empty>
        `,
    }),
};

export const CustomClass: Story = {
    render: () => ({
        template: `
            <ui-empty class="bg-muted/50 min-h-[300px]">
                <ui-empty-header>
                    <ui-empty-media variant="icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                        </svg>
                    </ui-empty-media>
                    <ui-empty-title>No filters applied</ui-empty-title>
                    <ui-empty-description>
                        Apply filters to narrow down the results displayed in this table.
                    </ui-empty-description>
                </ui-empty-header>
                <ui-empty-content>
                    <ui-button variant="outline" size="sm">Apply Filters</ui-button>
                </ui-empty-content>
            </ui-empty>
        `,
    }),
};
