import { Meta, StoryObj } from '@storybook/angular';
import { SkeletonComponent } from './skeleton.component';

const meta: Meta<SkeletonComponent> = {
    title: 'UI/Skeleton',
    component: SkeletonComponent,
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['pulse', 'shimmer'],
        },
    },
    args: {
        variant: 'pulse',
    },
};

export default meta;
type Story = StoryObj<SkeletonComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
      <div class="flex items-center space-x-4">
        <ui-skeleton class="h-12 w-12 rounded-full" [variant]="variant"></ui-skeleton>
        <div class="space-y-2">
          <ui-skeleton class="h-4 w-[250px]" [variant]="variant"></ui-skeleton>
          <ui-skeleton class="h-4 w-[200px]" [variant]="variant"></ui-skeleton>
        </div>
      </div>
    `,
    }),
};
