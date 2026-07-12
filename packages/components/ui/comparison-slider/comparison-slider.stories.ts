import { Meta, StoryObj } from '@storybook/angular';
import { ComparisonSliderComponent } from './comparison-slider.component';
import { COMPARISON_SLIDER_LOCALES } from './comparison-slider.locales';

const BEFORE_URL = 'https://picsum.photos/id/10/800/450';
const AFTER_URL = 'https://picsum.photos/id/20/800/450';

const meta: Meta<ComparisonSliderComponent> = {
    title: 'UI/Comparison Slider',
    component: ComparisonSliderComponent,
    tags: ['autodocs'],
    argTypes: {
        orientation: {
            control: 'select',
            options: ['horizontal', 'vertical'],
            description: 'Axis the divider slides along: left/right (`horizontal`) or up/down (`vertical`).',
        },
        position: {
            control: { type: 'range', min: 0, max: 100, step: 1 },
            description: 'Divider position as a percentage (0–100) of the reveal.',
        },
        beforeSrc: { control: 'text', description: 'Image URL shown on the "before" side.' },
        afterSrc: { control: 'text', description: 'Image URL shown on the "after" side.' },
        beforeAlt: { control: 'text', description: 'Alt text for the before image.' },
        afterAlt: { control: 'text', description: 'Alt text for the after image.' },
        beforeLabel: { control: 'text', description: 'Optional visible label overlaid on the before side.' },
        afterLabel: { control: 'text', description: 'Optional visible label overlaid on the after side.' },
        locale: {
            control: 'select',
            options: Object.keys(COMPARISON_SLIDER_LOCALES),
            description: 'Locale dictionary registry key (or a full ComparisonSliderLocale object) for the slider aria-labels/text direction. Falls back to `UI_LOCALE_ID` when unset.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        beforeSrc: BEFORE_URL,
        afterSrc: AFTER_URL,
        beforeAlt: 'Before image',
        afterAlt: 'After image',
        beforeLabel: undefined,
        afterLabel: undefined,
        orientation: 'horizontal',
        position: 50,
        locale: 'en',
        class: '',
    },
};

export default meta;
type Story = StoryObj<ComparisonSliderComponent>;

const TEMPLATE = `
            <div class="w-full max-w-2xl mx-auto">
                <ui-comparison-slider
                    [beforeSrc]="beforeSrc"
                    [afterSrc]="afterSrc"
                    [beforeAlt]="beforeAlt"
                    [afterAlt]="afterAlt"
                    [beforeLabel]="beforeLabel"
                    [afterLabel]="afterLabel"
                    [position]="position"
                    [orientation]="orientation"
                    [locale]="locale"
                    [class]="class"
                />
            </div>
        `;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = { render };

export const Horizontal: Story = {
    args: {
        orientation: 'horizontal',
        position: 40,
    },
    render,
};

export const Vertical: Story = {
    args: {
        orientation: 'vertical',
        position: 55,
    },
    render,
};

export const WithLabels: Story = {
    args: {
        beforeLabel: 'Before',
        afterLabel: 'After',
    },
    render,
};
