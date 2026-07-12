import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
  SelectComponent,
  SelectTriggerComponent,
  SelectValueComponent,
  SelectContentComponent,
  SelectGroupComponent,
  SelectItemComponent,
  SelectLabelComponent,
  SelectSeparatorComponent,
} from '../select';
import { FormsModule } from '@angular/forms';

// Sample data for data-driven stories
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
  { name: 'Brazil', code: 'BR' },
];

const fruits = ['Apple', 'Banana', 'Blueberry', 'Grapes', 'Pineapple'];

const meta: Meta<SelectComponent<unknown>> = {
  title: 'UI/Select',
  component: SelectComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [
        SelectComponent,
        SelectTriggerComponent,
        SelectValueComponent,
        SelectContentComponent,
        SelectGroupComponent,
        SelectItemComponent,
        SelectLabelComponent,
        SelectSeparatorComponent,
        FormsModule
      ],
    }),
  ],
  argTypes: {
    disabled: { control: 'boolean', description: 'Disables the trigger and prevents opening.' },
    placeholder: { control: 'text', description: 'Override for the placeholder shown when no value is selected.' },
    ariaLabel: { control: 'text', description: 'Accessible name forwarded to the trigger button.' },
    ariaLabelledby: { control: 'text', description: 'Associates the combobox with an external visible label.' },
    defaultValue: { control: false, description: 'Uncontrolled initial value; only applied when `value` is unset.' },
    locale: { control: false, description: 'Locale dictionary or registry key; falls back to `UI_LOCALE_ID`.' },
    position: { control: 'radio', options: ['popper', 'item-aligned'], description: 'How the dropdown is positioned relative to the trigger.' },
    options: { control: 'object', description: 'Data-driven mode: array of options to render (empty array = template-driven mode).' },
    displayWith: { control: false, description: 'Function mapping an option to its display string (data-driven mode).' },
    value: { control: false, description: 'Controlled selected value.' },
    valueAttribute: { control: 'text', description: 'Object key used to extract the value from each option (data-driven mode).' },
    disabledWith: { control: false, description: 'Function marking an option as disabled (data-driven mode).' },
  },
  args: {
    disabled: false,
    placeholder: 'Select an option',
    ariaLabel: undefined,
    ariaLabelledby: undefined,
    position: 'popper',
    options: fruits,
    valueAttribute: undefined,
  },
};

export default meta;
type Story = StoryObj<SelectComponent<unknown>>;

/**
 * Interactive playground — every input is wired to the Controls panel.
 * Uses data-driven mode (`options` defaults to a fruit list) so `ariaLabel`
 * and `ariaLabelledby` — only applied on the internally-rendered combobox
 * button in data-driven mode — are genuinely functional here too.
 */
export const Playground: Story = {
  render: (args) => ({
    props: { ...args, selected: null },
    template: `
      <div class="flex flex-col items-center gap-4 h-[300px] pt-8">
        <ui-select
          [options]="options"
          [disabled]="disabled"
          [placeholder]="placeholder"
          [ariaLabel]="ariaLabel"
          [ariaLabelledby]="ariaLabelledby"
          [position]="position"
          [valueAttribute]="valueAttribute"
          [(value)]="selected"
          class="w-[200px]"
        />
        <p class="text-sm text-muted-foreground">Selected: {{ selected || 'none' }}</p>
      </div>
    `,
  }),
};

/**
 * Template-driven mode: Use ng-content to define items declaratively.
 * This is the traditional shadcn/Radix pattern.
 */
export const TemplateDriven: Story = {
  name: 'Template-Driven (Classic)',
  render: (args) => ({
    props: args,
    template: `
      <div class="flex justify-center items-center h-[300px]">
        <ui-select [disabled]="disabled" class="w-[180px] h-fit" [position]="position">
          <ui-select-trigger ariaLabel="Select a fruit">
            <ui-select-value [placeholder]="placeholder" />
          </ui-select-trigger>
          <ui-select-content>
            <ui-select-group>
              <ui-select-label>Fruits</ui-select-label>
              <ui-select-item value="apple">Apple</ui-select-item>
              <ui-select-item value="banana">Banana</ui-select-item>
              <ui-select-item value="blueberry">Blueberry</ui-select-item>
              <ui-select-item value="grapes">Grapes</ui-select-item>
              <ui-select-item value="pineapple">Pineapple</ui-select-item>
            </ui-select-group>
            <ui-select-separator></ui-select-separator>
            <ui-select-group>
              <ui-select-label>Vegetables</ui-select-label>
              <ui-select-item value="aubergine">Aubergine</ui-select-item>
              <ui-select-item value="broccoli">Broccoli</ui-select-item>
              <ui-select-item value="carrot" [disabled]="true">Carrot</ui-select-item>
              <ui-select-item value="courgette">Courgette</ui-select-item>
              <ui-select-item value="leek">Leek</ui-select-item>
            </ui-select-group>
          </ui-select-content>
        </ui-select>
      </div>
    `,
  }),
};

/**
 * Data-driven mode with simple string array.
 * Just pass an array of strings - no displayWith needed.
 */
export const DataDrivenStrings: Story = {
  name: 'Data-Driven (Strings)',
  render: (args) => ({
    props: {
      ...args,
      fruits,
      selected: null,
    },
    template: `
      <div class="flex flex-col items-center gap-4 h-[300px] pt-8">
        <ui-select 
          [options]="fruits" 
          [(value)]="selected"
          placeholder="Select a fruit..."
          class="w-[200px]"
        />
        <p class="text-sm text-muted-foreground">Selected: {{ selected || 'none' }}</p>
      </div>
    `,
  }),
};

/**
 * Data-driven mode with objects.
 * Use displayWith to control what's shown and valueAttribute to extract the value.
 */
export const DataDrivenObjects: Story = {
  name: 'Data-Driven (Objects)',
  render: (args) => ({
    props: {
      ...args,
      countries,
      selected: null,
      displayFn: (country: Country) => country.name,
    },
    template: `
      <div class="flex flex-col items-center gap-4 h-[300px] pt-8">
        <ui-select 
          [options]="countries" 
          [displayWith]="displayFn"
          valueAttribute="code"
          [(value)]="selected"
          placeholder="Select a country..."
          class="w-[220px]"
        />
        <p class="text-sm text-muted-foreground">Selected code: {{ selected || 'none' }}</p>
      </div>
    `,
  }),
};

/**
 * Data-driven with pre-selected value.
 */
export const DataDrivenWithDefault: Story = {
  name: 'Data-Driven (With Default)',
  render: (args) => ({
    props: {
      ...args,
      countries,
      displayFn: (country: Country) => country.name,
    },
    template: `
      <div class="flex flex-col items-center gap-4 h-[300px] pt-8">
        <ui-select 
          [options]="countries" 
          [displayWith]="displayFn"
          valueAttribute="code"
          [defaultValue]="'DE'"
          placeholder="Select a country..."
          class="w-[220px]"
        />
      </div>
    `,
  }),
};

/**
 * Disabled state in data-driven mode.
 */
export const DataDrivenDisabled: Story = {
  name: 'Data-Driven (Disabled)',
  args: {
    disabled: true,
  },
  render: (args) => ({
    props: {
      ...args,
      fruits,
    },
    template: `
      <div class="flex flex-col items-center gap-4 h-[200px] pt-8">
        <ui-select 
          [options]="fruits" 
          [disabled]="true"
          placeholder="Select a fruit..."
          class="w-[200px]"
        />
      </div>
    `,
  }),
};

/**
 * Comparison: Side-by-side template vs data-driven.
 */
export const Comparison: Story = {
  name: 'Comparison (Both Modes)',
  render: (args) => ({
    props: {
      ...args,
      fruits,
      templateSelected: null,
      dataSelected: null,
    },
    template: `
      <div class="flex gap-8 justify-center items-start h-[350px] pt-8">
        <div class="flex flex-col items-center gap-2">
          <p class="text-sm font-medium">Template-Driven</p>
          <ui-select [(value)]="templateSelected" class="w-[180px]">
            <ui-select-trigger>
              <ui-select-value placeholder="Select..." />
            </ui-select-trigger>
            <ui-select-content>
              <ui-select-item value="apple">Apple</ui-select-item>
              <ui-select-item value="banana">Banana</ui-select-item>
              <ui-select-item value="blueberry">Blueberry</ui-select-item>
            </ui-select-content>
          </ui-select>
          <p class="text-xs text-muted-foreground">{{ templateSelected || 'none' }}</p>
        </div>
        
        <div class="flex flex-col items-center gap-2">
          <p class="text-sm font-medium">Data-Driven</p>
          <ui-select 
            [options]="fruits" 
            [(value)]="dataSelected"
            placeholder="Select..."
            class="w-[180px]"
          />
          <p class="text-xs text-muted-foreground">{{ dataSelected || 'none' }}</p>
        </div>
      </div>
    `,
  }),
};

// Keep original Default story for backwards compatibility
export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="flex justify-center items-center h-[300px]">
        <ui-select [disabled]="disabled" class="w-[180px] h-fit" [position]="position">
          <ui-select-trigger ariaLabel="Select a fruit">
            <ui-select-value [placeholder]="placeholder" />
          </ui-select-trigger>
          <ui-select-content>
            <ui-select-group>
              <ui-select-label>Fruits</ui-select-label>
              <ui-select-item value="apple">Apple</ui-select-item>
              <ui-select-item value="banana">Banana</ui-select-item>
              <ui-select-item value="blueberry">Blueberry</ui-select-item>
              <ui-select-item value="grapes">Grapes</ui-select-item>
              <ui-select-item value="pineapple">Pineapple</ui-select-item>
            </ui-select-group>
            <ui-select-separator></ui-select-separator>
            <ui-select-group>
              <ui-select-label>Vegetables</ui-select-label>
              <ui-select-item value="aubergine">Aubergine</ui-select-item>
              <ui-select-item value="broccoli">Broccoli</ui-select-item>
              <ui-select-item value="carrot" [disabled]="true">Carrot</ui-select-item>
              <ui-select-item value="courgette">Courgette</ui-select-item>
              <ui-select-item value="leek">Leek</ui-select-item>
            </ui-select-group>
          </ui-select-content>
        </ui-select>
      </div>
    `,
  }),
};
