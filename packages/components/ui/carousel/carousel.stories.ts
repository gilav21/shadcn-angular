import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
    CarouselComponent,
    CarouselContentComponent,
    CarouselItemComponent,
    CarouselPreviousComponent,
    CarouselNextComponent,
} from './index';
import { CardComponent, CardContentComponent } from '../card';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct mode.
const meta: Meta<CarouselComponent> = {
    title: 'UI/Carousel',
    component: CarouselComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                CarouselContentComponent,
                CarouselItemComponent,
                CarouselPreviousComponent,
                CarouselNextComponent,
                CardComponent,
                CardContentComponent,
            ],
        }),
    ],
    parameters: {
        docs: {
            description: {
                component:
                    'A carousel for displaying a series of content in a scrollable, snap-aligned container with keyboard support and prev/next navigation controls.',
            },
        },
    },
    argTypes: {
        orientation: {
            control: 'radio',
            options: ['horizontal', 'vertical'],
            description: 'Scroll/layout axis of the carousel.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the carousel host.' },
    },
    args: {
        orientation: 'horizontal',
        class: '',
    },
};

export default meta;
type Story = StoryObj<CarouselComponent>;

const ITEMS = [1, 2, 3, 4, 5];

const render: NonNullable<Story['render']> = (args) => ({
    props: { ...args, items: ITEMS },
    template: `
        <div class="w-full max-w-xs mx-auto px-12 pt-20">
            <ui-carousel [orientation]="orientation" [class]="class">
                <ui-carousel-previous />
                <ui-carousel-content [class]="orientation === 'vertical' ? 'h-[300px]' : ''">
                    @for (item of items; track item) {
                        <ui-carousel-item>
                            <div class="p-1">
                                <ui-card>
                                    <ui-card-content class="flex aspect-square items-center justify-center p-6">
                                        <span class="text-4xl font-semibold">{{ item }}</span>
                                    </ui-card-content>
                                </ui-card>
                            </div>
                        </ui-carousel-item>
                    }
                </ui-carousel-content>
                <ui-carousel-next />
            </ui-carousel>
        </div>
    `,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Horizontal: Story = {
    args: { orientation: 'horizontal' },
    render,
};

export const Vertical: Story = {
    args: { orientation: 'vertical' },
    render,
};

export const WithImages: Story = {
    render: (args) => ({
        props: {
            ...args,
            images: [
                'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
                'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=400&h=300&fit=crop',
                'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=300&fit=crop',
                'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=300&fit=crop',
                'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=400&h=300&fit=crop',
            ],
        },
        template: `
            <div class="w-full max-w-md mx-auto px-12">
                <ui-carousel [orientation]="orientation" [class]="class">
                    <ui-carousel-content>
                        @for (image of images; track image; let i = $index) {
                            <ui-carousel-item>
                                <div class="p-1">
                                    <img [src]="image" [alt]="'Image ' + (i + 1)" class="w-full aspect-video object-cover rounded-lg" />
                                </div>
                            </ui-carousel-item>
                        }
                    </ui-carousel-content>
                    <ui-carousel-previous />
                    <ui-carousel-next />
                </ui-carousel>
            </div>
        `,
    }),
};

export const WithoutNavigation: Story = {
    render: (args) => ({
        props: { ...args, items: ITEMS },
        template: `
            <div class="w-full max-w-xs mx-auto">
                <ui-carousel [orientation]="orientation" [class]="class">
                    <ui-carousel-content>
                        @for (item of items; track item) {
                            <ui-carousel-item>
                                <div class="p-1">
                                    <ui-card>
                                        <ui-card-content class="flex aspect-square items-center justify-center p-6">
                                            <span class="text-4xl font-semibold">{{ item }}</span>
                                        </ui-card-content>
                                    </ui-card>
                                </div>
                            </ui-carousel-item>
                        }
                    </ui-carousel-content>
                </ui-carousel>
            </div>
        `,
    }),
};

export const Rtl: Story = {
    render: (args) => ({
        props: { ...args, items: ITEMS },
        template: `
            <div dir="rtl" class="w-full max-w-xs mx-auto px-12 pt-20">
                <ui-carousel [orientation]="orientation" [class]="class">
                    <ui-carousel-previous />
                    <ui-carousel-content>
                        @for (item of items; track item) {
                            <ui-carousel-item>
                                <div class="p-1">
                                    <ui-card>
                                        <ui-card-content class="flex aspect-square items-center justify-center p-6">
                                            <span class="text-4xl font-semibold">{{ item }}</span>
                                        </ui-card-content>
                                    </ui-card>
                                </div>
                            </ui-carousel-item>
                        }
                    </ui-carousel-content>
                    <ui-carousel-next />
                </ui-carousel>
            </div>
        `,
    }),
};
