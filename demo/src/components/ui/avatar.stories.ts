import { Meta, StoryObj } from '@storybook/angular';
import { AvatarComponent, AvatarImageComponent, AvatarFallbackComponent } from './avatar.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<AvatarComponent> = {
    title: 'UI/Avatar',
    component: AvatarComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [AvatarComponent, AvatarImageComponent, AvatarFallbackComponent],
        }),
    ],
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
