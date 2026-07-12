import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
    CollapsibleComponent,
    CollapsibleTriggerComponent,
    CollapsibleContentComponent,
} from './index';
import { ButtonComponent } from '../button';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct mode.
const meta: Meta<CollapsibleComponent> = {
    title: 'UI/Collapsible',
    component: CollapsibleComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                CollapsibleComponent,
                CollapsibleTriggerComponent,
                CollapsibleContentComponent,
                ButtonComponent,
            ],
        }),
    ],
    argTypes: {
        defaultOpen: { control: 'boolean', description: 'Whether the collapsible starts expanded.' },
        disabled: { control: 'boolean', description: 'Disables toggling via the trigger.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        defaultOpen: false,
        disabled: false,
        class: 'w-full max-w-[calc(100vw-2rem)] sm:w-[350px] space-y-2',
    },
};

export default meta;
type Story = StoryObj<CollapsibleComponent>;

const TEMPLATE = `
    <ui-collapsible [defaultOpen]="defaultOpen" [disabled]="disabled" [class]="class">
        <div class="flex items-center justify-between space-x-4 px-4">
            <h4 class="text-sm font-semibold">
                @peduarte starred 3 repositories
            </h4>
            <ui-collapsible-trigger>
                <ui-button variant="ghost" size="sm" class="w-9 p-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M8 9l4-4 4 4"/><path d="M8 15l4 4 4-4"/></svg>
                    <span class="sr-only">Toggle</span>
                </ui-button>
            </ui-collapsible-trigger>
        </div>
        <div class="rounded-md border px-4 py-3 font-mono text-sm">
            @radix-ui/primitives
        </div>
        <ui-collapsible-content class="space-y-2">
            <div class="rounded-md border px-4 py-3 font-mono text-sm">
                @radix-ui/colors
            </div>
            <div class="rounded-md border px-4 py-3 font-mono text-sm">
                @stitches/react
            </div>
        </ui-collapsible-content>
    </ui-collapsible>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = { render };

export const DefaultOpen: Story = {
    args: { defaultOpen: true },
    render,
};

export const Disabled: Story = {
    args: { disabled: true },
    render,
};
