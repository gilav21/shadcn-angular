import { Meta, StoryObj } from '@storybook/angular';
import { NumberTickerComponent } from './number-ticker.component';

const meta: Meta<NumberTickerComponent> = {
  title: 'UI/Number Ticker',
  component: NumberTickerComponent,
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'number' },
    delay: { control: 'number' },
    decimalPlaces: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<NumberTickerComponent>;

export const Default: Story = {
  args: {
    value: 100,
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="text-4xl font-bold tracking-tighter">
        <ui-number-ticker [value]="value" [delay]="delay" [decimalPlaces]="decimalPlaces" />
      </div>
    `,
  }),
};

export const WithDecimals: Story = {
  args: {
    value: 1234.56,
    decimalPlaces: 2,
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="text-4xl font-bold tracking-tighter text-green-500">
        $<ui-number-ticker [value]="value" [decimalPlaces]="decimalPlaces" />
      </div>
    `,
  }),
};

export const HighNumbers: Story = {
  args: {
    value: 1000000,
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="text-4xl font-bold tracking-tighter">
        <ui-number-ticker [value]="value" />
      </div>
    `,
  }),
};
