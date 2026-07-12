import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { AvatarComponent, AvatarImageComponent, AvatarFallbackComponent } from './avatar.component';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<AvatarComponent> = {
    title: 'UI/Avatar',
    component: AvatarComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [AvatarComponent, AvatarImageComponent, AvatarFallbackComponent],
        }),
    ],
    argTypes: {
        src: { control: 'text', description: 'Image URL for simple mode (auto-generates the avatar image).' },
        alt: { control: 'text', description: 'Alt text for the simple-mode image.' },
        fallback: { control: 'text', description: 'Text shown while loading or if the image fails to load.' },
        loading: { control: 'boolean', description: 'Shows a spinner overlay on top of the avatar.' },
        skeleton: { control: 'boolean', description: 'Renders a skeleton placeholder instead of the avatar.' },
        class: { control: 'text', description: 'Extra classes merged onto the host (e.g. size overrides).' },
    },
    args: {
        src: 'https://github.com/shadcn.png',
        alt: '@shadcn',
        fallback: 'CN',
        loading: false,
        skeleton: false,
        class: '',
    },
};

export default meta;
type Story = StoryObj<AvatarComponent>;

const TEMPLATE = `
    <ui-avatar
        [src]="src" [alt]="alt" [fallback]="fallback"
        [loading]="loading" [skeleton]="skeleton" [class]="class">
    </ui-avatar>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel (simple/data-driven mode). */
export const Playground: Story = { render };

export const TemplateMode: Story = {
    render: () => ({
        template: `
      <ui-avatar>
        <ui-avatar-image src="https://github.com/shadcn.png" alt="@shadcn" />
        <ui-avatar-fallback>CN</ui-avatar-fallback>
      </ui-avatar>
    `,
    }),
};

export const SimpleMode: Story = {
    render,
};

export const Fallback: Story = {
    args: { src: '' },
    render,
};

export const FallbackTemplateMode: Story = {
    render: () => ({
        template: `
      <ui-avatar>
        <ui-avatar-image src="" alt="@shadcn" />
        <ui-avatar-fallback>CN</ui-avatar-fallback>
      </ui-avatar>
    `,
    }),
};

export const Loading: Story = {
    args: { loading: true },
    render,
};

export const Skeleton: Story = {
    args: { skeleton: true },
    render,
};

export const Sizes: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="flex flex-wrap items-center gap-3">
                <ui-avatar src="https://github.com/shadcn.png" alt="@shadcn" fallback="CN" class="h-6 w-6" />
                <ui-avatar src="https://github.com/shadcn.png" alt="@shadcn" fallback="CN" class="h-10 w-10" />
                <ui-avatar src="https://github.com/shadcn.png" alt="@shadcn" fallback="CN" class="h-16 w-16" />
                <ui-avatar src="https://github.com/shadcn.png" alt="@shadcn" fallback="CN" class="h-24 w-24" />
            </div>`,
    }),
};
