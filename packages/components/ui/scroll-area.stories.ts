import { Meta, StoryObj } from '@storybook/angular';
import { ScrollAreaComponent } from './scroll-area.component';
import { moduleMetadata } from '@storybook/angular';
import { SeparatorComponent } from './separator.component';

const meta: Meta<ScrollAreaComponent> = {
    title: 'UI/ScrollArea',
    component: ScrollAreaComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [ScrollAreaComponent, SeparatorComponent],
        }),
    ],
    argTypes: {
        orientation: {
            control: 'radio',
            options: ['vertical', 'horizontal', 'both'],
        },
    },
    args: {
        orientation: 'vertical',
    },
};

export default meta;
type Story = StoryObj<ScrollAreaComponent>;

export const Default: Story = {
    render: (args) => ({
        template: `
      <ui-scroll-area class="h-[200px] w-[350px] rounded-md border p-4">
        <div class="mb-4 text-sm font-medium leading-none">Tags</div>
        <div class="flex flex-col gap-2">
            @for (tag of tags; track tag) {
                <div class="text-sm">{{ tag }}</div>
                <ui-separator class="my-2" />
            }
        </div>
      </ui-scroll-area>
    `,
        moduleMetadata: {
            imports: [ScrollAreaComponent, SeparatorComponent]
        },
        props: {
            ...args,
            tags: Array.from({ length: 50 }).map((_, i, a) => `v1.2.0-beta.${a.length - i}`),
        }
    }),
};
