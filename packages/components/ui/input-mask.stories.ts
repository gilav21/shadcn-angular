import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { InputMaskDirective } from './input-mask.directive';

const meta: Meta = {
    title: 'UI/InputMask',
    decorators: [
        moduleMetadata({
            imports: [InputMaskDirective],
        }),
    ],
};

export default meta;
type Story = StoryObj;

export const PhoneNumber: Story = {
    render: () => ({
        template: `
            <div class="space-y-2" style="max-width: 300px;">
                <label class="text-sm font-medium">Phone Number</label>
                <input
                    uiInputMask="(000) 000-0000"
                    placeholder="(___) ___-____"
                    class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
            </div>
        `,
    }),
};

export const DateMask: Story = {
    render: () => ({
        template: `
            <div class="space-y-2" style="max-width: 300px;">
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
            <div class="space-y-2" style="max-width: 300px;">
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
            <div class="space-y-2" style="max-width: 300px;">
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
