import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { AutocompleteComponent } from './autocomplete.component';
import { FormsModule } from '@angular/forms';
import { signal } from '@angular/core';

interface Country {
    name: string;
    code: string;
}

const countries: Country[] = [
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

const meta: Meta<AutocompleteComponent<Country>> = {
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
        displayWith: (opt: Country) => opt?.name,
        placeholder: 'Select a country...',
        multiple: false,
        filter: true,
        debounceTime: 0,
    },
};

export default meta;
type Story = StoryObj<AutocompleteComponent<Country>>;

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

export const Debounced: Story = {
    args: {
        debounceTime: 300,
        filter: false,
    },
    render: (args) => ({
        props: {
            ...args,
            searchCount: 0,
            onSearch: function (this: { searchCount: number }, term: string) {
                this.searchCount++;
                console.log(`Search triggered: "${term}" (count: ${this.searchCount})`);
            }
        },
        template: `
      <div class="w-[300px] space-y-2">
         <p class="text-sm text-muted-foreground">Debounce: 300ms - Check console for search events</p>
         <ui-autocomplete 
           [options]="options" 
           [displayWith]="displayWith"
           [placeholder]="placeholder"
           [debounceTime]="300"
           [filter]="false"
           (search)="onSearch($event)"
         />
         <p class="text-xs text-muted-foreground">Search events: {{ searchCount }}</p>
      </div>
    `,
    }),
};

export const Async: Story = {
    render: (args) => {
        return {
            props: {
                ...args,
                options: signal<Country[]>([]),
                searchTerm: '',
                onSearch: (term: string) => {
                    // Mock async API
                    const results = countries.filter(c => c.name.toLowerCase().includes(term.toLowerCase()));
                    // In a real app this would be an HTTP call
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

