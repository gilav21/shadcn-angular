import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
    ResizablePanelGroupComponent,
    ResizablePanelComponent,
    ResizableHandleComponent,
} from './index';

// `withHandle` and `disabled` live on `ui-resizable-handle`, not the panel
// group — the meta type intersects the group's inputs with them so both
// surface together in the Controls panel / auto props table.
type ResizableStoryProps = ResizablePanelGroupComponent & {
    withHandle: boolean;
    handleDisabled: boolean;
    handleSize: number;
};

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<ResizableStoryProps> = {
    title: 'UI/Resizable',
    component: ResizablePanelGroupComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                ResizablePanelGroupComponent,
                ResizablePanelComponent,
                ResizableHandleComponent,
            ],
        }),
    ],
    argTypes: {
        direction: {
            control: 'radio',
            options: ['horizontal', 'vertical'],
            description: 'Layout direction of the panel group.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the panel group host.' },
        withHandle: { control: 'boolean', description: '(ui-resizable-handle) Shows the visible grip icon on the handle.' },
        handleDisabled: { control: 'boolean', description: '(ui-resizable-handle) Hides and disables the handle, locking the panel sizes.' },
        handleSize: { control: 'number', description: '(ui-resizable-handle) Thickness of the drag handle, in pixels.' },
    },
    args: {
        direction: 'horizontal',
        class: '',
        withHandle: false,
        handleDisabled: false,
        handleSize: 4,
    },
};

export default meta;
type Story = StoryObj<ResizableStoryProps>;

const TEMPLATE = `
    <ui-resizable-panel-group
        [direction]="direction"
        [class]="'max-w-full sm:max-w-md rounded-lg border min-h-[200px] ' + class"
    >
        <ui-resizable-panel [defaultSize]="50">
            <div class="flex h-full items-center justify-center p-6">
                <span class="font-semibold">One</span>
            </div>
        </ui-resizable-panel>
        <ui-resizable-handle ariaLabel="Resize horizontal panel" [withHandle]="withHandle" [disabled]="handleDisabled" [handleSize]="handleSize" />
        <ui-resizable-panel [defaultSize]="50">
            <div class="flex h-full items-center justify-center p-6">
                <span class="font-semibold">Two</span>
            </div>
        </ui-resizable-panel>
    </ui-resizable-panel-group>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input (group + handle) is wired to the Controls panel. */
export const Playground: Story = { render };

export const Vertical: Story = {
    args: { direction: 'vertical' },
    render: (args) => ({
        props: args,
        template: `
            <ui-resizable-panel-group
                [direction]="direction"
                class="h-[300px] max-w-full sm:max-w-md rounded-lg border"
            >
                <ui-resizable-panel [defaultSize]="50">
                    <div class="flex h-full items-center justify-center p-6">
                        <span class="font-semibold">One</span>
                    </div>
                </ui-resizable-panel>
                <ui-resizable-handle ariaLabel="Resize vertical panel" [withHandle]="withHandle" [disabled]="handleDisabled" />
                <ui-resizable-panel [defaultSize]="50">
                    <div class="flex h-full items-center justify-center p-6">
                        <span class="font-semibold">Two</span>
                    </div>
                </ui-resizable-panel>
            </ui-resizable-panel-group>`,
    }),
};

export const WithHandleGrip: Story = {
    args: { withHandle: true },
    render,
};

export const DisabledHandle: Story = {
    args: { handleDisabled: true },
    render,
};

export const NestedGroups: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-resizable-panel-group
                [direction]="direction"
                class="max-w-full sm:max-w-md rounded-lg border min-h-[200px]"
            >
                <ui-resizable-panel [defaultSize]="50">
                    <div class="flex h-full items-center justify-center p-6">
                        <span class="font-semibold">One</span>
                    </div>
                </ui-resizable-panel>
                <ui-resizable-handle ariaLabel="Resize horizontal panel" [withHandle]="withHandle" />
                <ui-resizable-panel [defaultSize]="50">
                    <ui-resizable-panel-group direction="vertical">
                        <ui-resizable-panel [defaultSize]="25">
                            <div class="flex h-full items-center justify-center p-6">
                                <span class="font-semibold">Two</span>
                            </div>
                        </ui-resizable-panel>
                        <ui-resizable-handle ariaLabel="Resize vertical panel" [withHandle]="withHandle" />
                        <ui-resizable-panel [defaultSize]="75">
                            <div class="flex h-full items-center justify-center p-6">
                                <span class="font-semibold">Three</span>
                            </div>
                        </ui-resizable-panel>
                    </ui-resizable-panel-group>
                </ui-resizable-panel>
            </ui-resizable-panel-group>`,
    }),
};
