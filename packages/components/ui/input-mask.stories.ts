import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { InputMaskDirective } from './input-mask.directive';

const meta: Meta = {
    title: 'UI/InputMask',
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [InputMaskDirective],
        }),
    ],
    argTypes: {
        mask: {
            control: 'text',
            description: "Mask pattern: `0`/`9` = digit, `a` = letter, `*` = alphanumeric, any other character is a literal.",
        },
        slotChar: { control: 'text', description: 'Placeholder character shown for unfilled slots when `showMaskTyped` is true.' },
        showMaskTyped: { control: 'boolean', description: 'Pre-fills unfilled mask slots with `slotChar` instead of leaving them empty.' },
    },
    args: {
        mask: '(000) 000-0000',
        slotChar: '_',
        showMaskTyped: false,
    },
};

export default meta;
type Story = StoryObj;

const TEMPLATE = `
    <div class="space-y-2 w-full max-w-[calc(100vw-2rem)] sm:max-w-[300px]">
        <label class="text-sm font-medium">Phone Number</label>
        <input
            [uiInputMask]="mask"
            [slotChar]="slotChar"
            [showMaskTyped]="showMaskTyped"
            placeholder="(___) ___-____"
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const PhoneNumber: Story = { render };

export const DateMask: Story = {
    render: () => ({
        template: `
            <div class="space-y-2 w-full max-w-[calc(100vw-2rem)] sm:max-w-[300px]">
                <label class="text-sm font-medium">Date</label>
                <input
                    uiInputMask="00/00/0000"
                    placeholder="MM/DD/YYYY"
                    class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
            </div>
        `,
    }),
};

export const CreditCard: Story = {
    render: () => ({
        template: `
            <div class="space-y-2 w-full max-w-[calc(100vw-2rem)] sm:max-w-[300px]">
                <label class="text-sm font-medium">Credit Card</label>
                <input
                    uiInputMask="0000 0000 0000 0000"
                    placeholder="____ ____ ____ ____"
                    class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
            </div>
        `,
    }),
};

export const ZipCode: Story = {
    render: () => ({
        template: `
            <div class="space-y-2 w-full max-w-[calc(100vw-2rem)] sm:max-w-[300px]">
                <label class="text-sm font-medium">Zip Code</label>
                <input
                    uiInputMask="00000-0000"
                    placeholder="_____-____"
                    class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
            </div>
        `,
    }),
};

export const ShowMaskTyped: Story = {
    args: { showMaskTyped: true },
    render,
};
