import { Meta, StoryObj } from '@storybook/angular';
import { SkeletonComponent } from './skeleton.component';

const meta: Meta<SkeletonComponent> = {
    title: 'UI/Skeleton',
    component: SkeletonComponent,
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<SkeletonComponent>;

export const Default: Story = {
    render: () => ({
        template: `
      <div class="flex items-center space-x-4">
        <ui-skeleton class="h-12 w-12 rounded-full"></ui-skeleton>
        <div class="space-y-2">
          <ui-skeleton class="h-4 w-[250px]"></ui-skeleton>
          <ui-skeleton class="h-4 w-[200px]"></ui-skeleton>
        </div>
      </div>
    `,
    }),
};
