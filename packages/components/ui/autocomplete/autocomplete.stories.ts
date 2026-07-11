import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutocompleteComponent } from './autocomplete.component';

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

const displayWith = (opt: Country) => opt?.name ?? '';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<AutocompleteComponent<Country>> = {
    title: 'UI/Autocomplete',
    component: AutocompleteComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [AutocompleteComponent, FormsModule],
        }),
    ],
    argTypes: {
        options: { control: 'object', description: 'Array of options rendered in the dropdown list.' },
        displayWith: { control: false, description: 'Function mapping an option to its display string. Defaults to `String`.' },
        valueAttribute: { control: 'text', description: 'Property name read off each option to derive its underlying value. Falls back to the whole option when unset.' },
        filter: { control: 'boolean', description: 'When true, the built-in command filter matches options against the search term.' },
        multiple: { control: 'boolean', description: 'Allows selecting more than one option; selections render as removable chips.' },
        placeholder: { control: 'text', description: "Override for the input placeholder. Falls back to the locale's `selectPlaceholder`." },
        disabled: { control: 'boolean', description: 'Disables the input and prevents opening the dropdown.' },
        debounceTime: { control: 'number', min: 0, max: 2000, step: 50, description: 'Milliseconds to debounce `searchChange` emissions. `0` emits immediately.' },
        value: { control: 'object', description: 'Current value: a single option, an array of options (multiple mode), or undefined.' },
        locale: {
            control: 'select',
            options: ['en', 'he', 'ar', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'pt'],
            description: 'Locale dictionary or registry key controlling placeholder/empty-state strings and RTL direction.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the input container.' },
    },
    args: {
        options: countries,
        displayWith,
        valueAttribute: undefined,
        filter: true,
        multiple: false,
        placeholder: 'Select a country...',
        disabled: false,
        debounceTime: 0,
        value: undefined,
        locale: 'en',
        class: '',
    },
};

export default meta;
type Story = StoryObj<AutocompleteComponent<Country>>;

const TEMPLATE = `
    <div class="w-full max-w-[calc(100vw-2rem)] sm:w-[320px]">
        <ui-autocomplete
            [options]="options" [displayWith]="displayWith" [valueAttribute]="valueAttribute"
            [filter]="filter" [multiple]="multiple" [placeholder]="placeholder"
            [disabled]="disabled" [debounceTime]="debounceTime" [value]="value"
            [locale]="locale" [class]="class">
        </ui-autocomplete>
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = { render };

export const Multiple: Story = {
    args: { multiple: true, placeholder: 'Select countries...' },
    render,
};

export const Filtered: Story = {
    args: { filter: true },
    render,
};

export const Debounced: Story = {
    args: { debounceTime: 300, filter: false },
    render: (args) => ({
        props: {
            ...args,
            searchCount: 0,
            onSearch(this: { searchCount: number }, term: string) {
                this.searchCount++;
                console.error(`Search triggered: "${term}" (count: ${this.searchCount})`);
            },
        },
        template: `
            <div class="w-full max-w-[calc(100vw-2rem)] sm:w-[320px] space-y-2">
                <p class="text-sm text-muted-foreground">Debounce: 300ms — check console for search events.</p>
                <ui-autocomplete
                    [options]="options" [displayWith]="displayWith" [placeholder]="placeholder"
                    [debounceTime]="debounceTime" [filter]="filter"
                    (searchChange)="onSearch($event)">
                </ui-autocomplete>
                <p class="text-xs text-muted-foreground">Search events: {{ searchCount }}</p>
            </div>`,
    }),
};

export const Async: Story = {
    render: (args) => {
        const options = signal<Country[]>([]);
        const onSearch = (term: string) => {
            setTimeout(() => {
                options.set(countries.filter((c) => c.name.toLowerCase().includes(term.toLowerCase())));
            }, 300);
        };

        return {
            props: { ...args, options, onSearch },
            template: `
                <div class="w-full max-w-[calc(100vw-2rem)] sm:w-[320px]">
                    <p class="mb-2 text-sm text-muted-foreground">Async filtering (client-side simulation).</p>
                    <ui-autocomplete
                        [options]="options()" [displayWith]="displayWith" [filter]="false"
                        (searchChange)="onSearch($event)"
                        placeholder="Type to search (e.g. 'Un')...">
                    </ui-autocomplete>
                </div>`,
        };
    },
};

export const Disabled: Story = {
    args: { disabled: true },
    render,
};

export const RTL: Story = {
    args: { locale: 'ar', placeholder: 'اختر دولة...' },
    render,
};
