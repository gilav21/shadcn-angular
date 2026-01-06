import { Meta, StoryObj } from '@storybook/angular';
import { AspectRatioComponent } from './aspect-ratio.component';

const meta: Meta<AspectRatioComponent> = {
    title: 'UI/AspectRatio',
    component: AspectRatioComponent,
    tags: ['autodocs'],
    argTypes: {
        ratio: {
            control: 'number',
            description: 'The aspect ratio of the content (width / height)',
        },
    },
    args: {
        ratio: 16 / 9,
    },
};

export default meta;
type Story = StoryObj<AspectRatioComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
      <div class="w-[450px]">
        <ui-aspect-ratio [ratio]="ratio">
          <img
            src="https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=800&dpr=2&q=80"
            alt="Photo by Drew Beamer"
            class="rounded-md object-cover h-full w-full"
          />
        </ui-aspect-ratio>
      </div>
    `,
    }),
};

export const Square: Story = {
    args: {
        ratio: 1,
    },
    render: (args) => ({
        props: args,
        template: `
        <div class="w-[200px]">
          <ui-aspect-ratio [ratio]="ratio">
            <img
              src="https://images.unsplash.com/photo-1576075796033-848c2a5f3696?w=800&dpr=2&q=80"
              alt="Photo by Alvaro Pinot"
              class="rounded-md object-cover h-full w-full"
            />
          </ui-aspect-ratio>
        </div>
      `,
    }),
};
