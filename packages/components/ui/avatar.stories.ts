import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { AvatarComponent, AvatarImageComponent, AvatarFallbackComponent } from './avatar.component';

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
        src: { control: 'text' },
        alt: { control: 'text' },
        fallback: { control: 'text' },
    },
    args: {
        src: 'https://github.com/shadcn.png',
        alt: '@shadcn',
        fallback: 'CN',
    },
};

export default meta;
type Story = StoryObj<AvatarComponent>;

export const Default: Story = {
    render: () => ({
        template: `
      <ui-avatar>
        <ui-avatar-image src="https://github.com/shadcn.png" alt="@shadcn" />
        <ui-avatar-fallback>CN</ui-avatar-fallback>
      </ui-avatar>
    `,
    }),
};

export const Fallback: Story = {
    render: () => ({
        template: `
      <ui-avatar>
        <ui-avatar-image src="" alt="@shadcn" />
        <ui-avatar-fallback>CN</ui-avatar-fallback>
      </ui-avatar>
    `,
    }),
};

export const SimpleMode: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-avatar [src]="src" [alt]="alt" [fallback]="fallback" />`,
    }),
};
