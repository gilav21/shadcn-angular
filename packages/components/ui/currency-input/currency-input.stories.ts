import { Meta, StoryObj } from '@storybook/angular';
import { CurrencyInputComponent } from './currency-input.component';

const meta: Meta<CurrencyInputComponent> = {
    title: 'UI/CurrencyInput',
    component: CurrencyInputComponent,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component: [
                    'An amount of money, written the way the reader\'s locale writes it.',
                    '',
                    'The value is in **major units** — `12.34` means twelve dollars thirty-four,',
                    'not 1234 cents — and is rounded on blur to the number of decimal places the',
                    'currency actually has: two for USD, none for JPY, three for KWD. Read',
                    '`minorUnits()` when the integer is wanted.',
                    '',
                    'Formatting happens at rest. While the field has focus it shows a plain',
                    'editable number, because reformatting as someone types moves the caret out',
                    'from under them.',
                ].join('\n'),
            },
        },
    },
    argTypes: {
        value: { control: 'number', description: 'Amount in major units, or `null` when empty.' },
        currency: { control: 'text', description: 'ISO 4217 code — drives the symbol, the decimal places and the parsing.' },
        locale: { control: 'text', description: 'BCP-47 tag. Falls back to the app-wide locale.' },
        min: { control: 'number', description: 'Lower bound, enforced on blur.' },
        max: { control: 'number', description: 'Upper bound, enforced on blur.' },
        disabled: { control: 'boolean', description: 'Disables the field.' },
        placeholder: { control: 'text', description: 'Shown while the value is `null`.' },
        ariaLabel: { control: 'text', description: 'Accessible name for the field.' },
        class: { control: 'text', description: 'Extra classes merged onto the wrapper.' },
        variant: {
            control: 'select',
            options: ['outline', 'underline', 'ghost'],
            description: 'Visual style of the wrapper.',
        },
    },
    args: {
        value: null,
        currency: 'USD',
        locale: 'en-US',
        disabled: false,
        placeholder: '',
        ariaLabel: 'Amount',
        variant: 'outline',
        class: 'w-56',
    },
};

export default meta;
type Story = StoryObj<CurrencyInputComponent>;

export const Default: Story = {};

export const WithValue: Story = {
    args: { value: 1234.5 },
};

/**
 * The same amount in four locales. Note that the separators swap roles between
 * `en-US` and `de-DE`, and that `fr-FR` groups with a narrow no-break space
 * rather than a plain one — the field parses back whatever it wrote.
 */
export const Locales: Story = {
    render: () => ({
        template: `
      <div class="flex flex-col gap-3">
        <ui-currency-input class="w-56" [value]="1234.5" currency="USD" locale="en-US" />
        <ui-currency-input class="w-56" [value]="1234.5" currency="EUR" locale="de-DE" />
        <ui-currency-input class="w-56" [value]="1234.5" currency="EUR" locale="fr-FR" />
        <ui-currency-input class="w-56" [value]="1234.5" currency="GBP" locale="en-GB" />
      </div>
    `,
    }),
};

/**
 * Not every currency has two decimal places. Yen has none and Kuwaiti dinar
 * has three, and the field takes that from the currency rather than assuming.
 */
export const CurrencyPrecision: Story = {
    render: () => ({
        template: `
      <div class="flex flex-col gap-3">
        <ui-currency-input class="w-56" [value]="1234.56" currency="USD" locale="en-US" />
        <ui-currency-input class="w-56" [value]="1235" currency="JPY" locale="ja-JP" />
        <ui-currency-input class="w-56" [value]="1.235" currency="KWD" locale="en-US" />
      </div>
    `,
    }),
};

/**
 * Right-to-left, with Arabic-Indic numerals. Typing either these digits or
 * ASCII ones works — someone with a physical keyboard types ASCII even here.
 */
export const RightToLeft: Story = {
    render: () => ({
        template: `
      <div dir="rtl" class="flex flex-col gap-3">
        <ui-currency-input class="w-56" [value]="1234.5" currency="EGP" locale="ar-EG" />
        <ui-currency-input class="w-56" [value]="1234.5" currency="SAR" locale="ar-SA" />
      </div>
    `,
    }),
};

export const Bounded: Story = {
    args: { value: 250, min: 0, max: 100 },
    parameters: {
        docs: {
            description: {
                story: 'Bounds are applied on blur, so typing past one is allowed until the edit ends — otherwise `250` would be unreachable by typing `2`, `5`, `0`.',
            },
        },
    },
};

export const Variants: Story = {
    render: () => ({
        template: `
      <div class="flex flex-col gap-3">
        <ui-currency-input class="w-56" [value]="42" variant="outline" />
        <ui-currency-input class="w-56" [value]="42" variant="underline" />
        <ui-currency-input class="w-56" [value]="42" variant="ghost" />
      </div>
    `,
    }),
};

export const Disabled: Story = {
    args: { value: 42, disabled: true },
};
