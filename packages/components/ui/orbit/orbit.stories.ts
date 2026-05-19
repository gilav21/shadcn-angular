import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { OrbitComponent } from './orbit.component';

const meta: Meta<OrbitComponent> = {
    title: 'UI/Orbit',
    component: OrbitComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [OrbitComponent],
        }),
    ],
    argTypes: {
        radius: {
            control: 'number',
        },
        duration: {
            control: 'number',
        },
        delay: {
            control: 'number',
        },
        reverse: {
            control: 'boolean',
        },
    },
    args: {
        radius: 100,
        duration: 10,
        delay: 0,
        reverse: false,
    },
};

export default meta;
type Story = StoryObj<OrbitComponent>;

export const Default: Story = {
    args: {
        radius: 100,
        duration: 10,
        reverse: false,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="flex items-center justify-center p-16 min-h-72">
                <ui-orbit [radius]="radius" [duration]="duration" [reverse]="reverse" class="w-64 h-64">
                    <div orbit-center class="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl shadow-lg">
                        ⚛️
                    </div>
                    <div class="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center text-white text-lg shadow-md">
                        ★
                    </div>
                </ui-orbit>
            </div>
        `,
    }),
};

export const Reverse: Story = {
    args: {
        radius: 110,
        duration: 8,
        reverse: true,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="flex items-center justify-center p-16 min-h-72">
                <ui-orbit [radius]="radius" [duration]="duration" [reverse]="reverse" class="w-64 h-64">
                    <div orbit-center class="w-16 h-16 rounded-full bg-slate-800 dark:bg-slate-200 flex items-center justify-center text-white dark:text-slate-800 text-2xl shadow-lg">
                        🌍
                    </div>
                    <div class="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-sm shadow-md">
                        🌙
                    </div>
                </ui-orbit>
            </div>
        `,
    }),
};

export const MultipleOrbits: Story = {
    render: () => ({
        template: `
            <div class="flex items-center justify-center p-16 min-h-80">
                <ui-orbit [radius]="140" [duration]="20" class="w-80 h-80">
                    <ui-orbit orbit-center [radius]="80" [duration]="10" class="w-40 h-40">
                        <div orbit-center class="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-2xl text-white shadow-xl">
                            ⚡
                        </div>
                        <div class="w-8 h-8 rounded-full bg-cyan-400 shadow-md flex items-center justify-center text-xs">🔵</div>
                    </ui-orbit>
                    <div class="w-10 h-10 rounded-full bg-orange-400 shadow-md flex items-center justify-center text-sm">🔴</div>
                </ui-orbit>
            </div>
        `,
    }),
};

export const SolarSystem: Story = {
    render: () => ({
        template: `
            <div class="flex items-center justify-center p-16 min-h-96">
                <div class="relative" style="width: 360px; height: 360px;">
                    <ui-orbit [radius]="160" [duration]="30" class="w-full h-full absolute inset-0">
                        <div orbit-center class="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-3xl shadow-2xl">
                            ☀️
                        </div>
                        <div class="w-7 h-7 rounded-full bg-blue-500 shadow-md flex items-center justify-center text-xs border-2 border-white/30">
                            🌍
                        </div>
                    </ui-orbit>
                    <ui-orbit [radius]="100" [duration]="15" class="absolute inset-0" style="width: 360px; height: 360px;">
                        <div class="w-6 h-6 rounded-full bg-red-600 shadow-md border-2 border-white/30 flex items-center justify-center text-xs">
                            🔴
                        </div>
                    </ui-orbit>
                    <ui-orbit [radius]="55" [duration]="6" class="absolute inset-0" style="width: 360px; height: 360px;">
                        <div class="w-5 h-5 rounded-full bg-slate-400 shadow-md border-2 border-white/30 flex items-center justify-center text-xs">
                            ⚫
                        </div>
                    </ui-orbit>
                </div>
            </div>
        `,
    }),
};
