import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { AutocompleteComponent } from './autocomplete.component';
import { FormsModule } from '@angular/forms';
import { signal } from '@angular/core';

const countries = [
    { name: 'United States', code: 'US' },
    { name: 'United Kingdom', code: 'UK' },
    { name: 'Canada', code: 'CA' },
    { name: 'Australia', code: 'AU' },
    { name: 'Germany', code: 'DE' },
    { name: 'France', code: 'FR' },
    { name: 'Japan', code: 'JP' },
    { name: 'China', code: 'CN' },
    { name: 'India', code: 'IN' },
    { name: 'Brazil', code: 'BR' },
];

const meta: Meta<AutocompleteComponent> = {
    title: 'UI/Autocomplete',
    component: AutocompleteComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [AutocompleteComponent, FormsModule],
        }),
    ],
    args: {
        options: countries,
        displayWith: (opt: any) => opt?.name,
        placeholder: 'Select a country...',
        multiple: false,
        filter: true,
    },
};

export default meta;
type Story = StoryObj<AutocompleteComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
      <div class="w-[300px]">
         <ui-autocomplete 
           [options]="options" 
           [displayWith]="displayWith"
           [placeholder]="placeholder"
           [multiple]="multiple"
         />
      </div>
    `,
    }),
};

export const Multiple: Story = {
    args: {
        multiple: true,
    },
    render: (args) => ({
        props: args,
        template: `
      <div class="w-[400px]">
         <ui-autocomplete 
           [options]="options" 
           [displayWith]="displayWith"
           [placeholder]="placeholder"
           [multiple]="true"
         />
      </div>
    `,
    }),
};

export const Async: Story = {
    render: (args) => {
        return {
            props: {
                ...args,
                options: signal<{ name: string }[]>([]), // Initial empty
                searchTerm: '',
                onSearch: (term: string) => {
                    // Mock async API
                    const results = countries.filter(c => c.name.toLowerCase().includes(term.toLowerCase()));
                    // In a real app this would be an HTTP call
                    // We'll update the signal passed to options
                    // Note: In Storybook 'options' arg is separate, we'll implement this logic in a wrapper for a real demo if needed,
                    // but for simple story we can't easily modify the 'options' arg dynamically from the template without a wrapper component.
                }
            },
            template: `
         <div class="h-[200px] w-[300px]">
             <p class="mb-2 text-sm text-muted-foreground">Async filtering (client-side simulation)</p>
             <!-- 
                Note: True async requires a wrapper component to handle the (search) event and update [options]. 
                Here we just demonstrate the component UI.
             -->
             <ui-autocomplete 
                [options]="options"
                [displayWith]="displayWith"
                [filter]="false" 
                placeholder="Type to search (mock...)"
             />
         </div>
      `
        };
    }
};
