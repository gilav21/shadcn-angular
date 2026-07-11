import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
    CardFooterComponent,
} from './index';
import { ButtonComponent } from '../button';
import { InputComponent } from '../input';
import { LabelComponent } from '../label';
import { FormsModule } from '@angular/forms';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds them so the Controls panel drives the
// live component. The card supports a simple mode (title/description/content
// inputs) and a template mode (projected sub-components) — both are covered.
const meta: Meta<CardComponent> = {
    title: 'UI/Card',
    component: CardComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                CardComponent,
                CardHeaderComponent,
                CardTitleComponent,
                CardDescriptionComponent,
                CardContentComponent,
                CardFooterComponent,
                ButtonComponent,
                InputComponent,
                LabelComponent,
                FormsModule,
            ],
        }),
    ],
    argTypes: {
        title: { control: 'text', description: 'Simple mode: card title text. Enables auto-generated structure.' },
        description: { control: 'text', description: 'Simple mode: muted subtitle under the title.' },
        content: { control: 'text', description: 'Simple mode: body text.' },
        loading: { control: 'boolean', description: 'Overlays a centered spinner and dims the card.' },
        skeleton: { control: 'boolean', description: 'Renders a skeleton placeholder instead of the card.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        title: 'Create Project',
        description: 'Deploy your new project in one-click.',
        content: 'Everything you need to ship, in a single card.',
        loading: false,
        skeleton: false,
        class: 'w-[350px]',
    },
};

export default meta;
type Story = StoryObj<CardComponent>;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: `
        <ui-card
            [title]="title" [description]="description" [content]="content"
            [loading]="loading" [skeleton]="skeleton" [class]="class" />`,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

/** Simple mode: the whole card is generated from inputs alone. */
export const SimpleMode: Story = { render };

export const Loading: Story = {
    args: { loading: true },
    render,
};

export const Skeleton: Story = {
    args: { skeleton: true },
    render,
};

/** Template mode: full control via projected sub-components. */
export const Composed: Story = {
    render: () => ({
        template: `
            <ui-card class="w-[350px]">
                <ui-card-header>
                    <ui-card-title>Create Project</ui-card-title>
                    <ui-card-description>Deploy your new project in one-click.</ui-card-description>
                </ui-card-header>
                <ui-card-content>
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <ui-label for="name">Name</ui-label>
                            <ui-input placeholder="Name of your project" />
                        </div>
                        <div class="space-y-2">
                            <ui-label for="framework">Framework</ui-label>
                            <ui-input placeholder="Angular" />
                        </div>
                    </div>
                </ui-card-content>
                <ui-card-footer class="flex justify-between">
                    <ui-button variant="outline">Cancel</ui-button>
                    <ui-button>Deploy</ui-button>
                </ui-card-footer>
            </ui-card>`,
    }),
};
