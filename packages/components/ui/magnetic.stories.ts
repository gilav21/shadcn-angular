import { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { UiMagneticDirective } from './magnetic.directive';

const meta: Meta = {
    title: 'UI/Magnetic',
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [UiMagneticDirective],
        }),
    ],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
    render: () => ({
        template: `
            <div class="flex items-center justify-center p-24 min-h-56">
                <button
                    uiMagnetic
                    class="px-8 py-4 bg-primary text-primary-foreground rounded-xl font-semibold text-base hover:bg-primary/90 transition-colors shadow-lg"
                >
                    Hover Near Me
                </button>
            </div>
        `,
    }),
};

export const StrongPull: Story = {
    render: () => ({
        template: `
            <div class="flex items-center justify-center gap-16 p-24 min-h-56">
                <button
                    uiMagnetic
                    [uiMagneticStrength]="0.6"
                    [uiMagneticRadius]="200"
                    class="px-6 py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition-colors shadow-lg"
                >
                    Strong Pull (0.6)
                </button>
                <button
                    uiMagnetic
                    [uiMagneticStrength]="0.15"
                    [uiMagneticRadius]="150"
                    class="px-6 py-3 bg-slate-700 text-white rounded-xl font-semibold hover:bg-slate-600 transition-colors shadow-lg dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
                >
                    Subtle Pull (0.15)
                </button>
            </div>
        `,
    }),
};

export const IconButtons: Story = {
    render: () => ({
        template: `
            <div class="flex items-center justify-center gap-10 p-24 min-h-56">
                <button
                    uiMagnetic
                    [uiMagneticStrength]="0.4"
                    class="h-14 w-14 flex items-center justify-center rounded-full bg-blue-500 text-white text-xl shadow-lg hover:bg-blue-600 transition-colors"
                >
                    𝕏
                </button>
                <button
                    uiMagnetic
                    [uiMagneticStrength]="0.4"
                    class="h-14 w-14 flex items-center justify-center rounded-full bg-pink-600 text-white text-xl shadow-lg hover:bg-pink-700 transition-colors"
                >
                    ♥
                </button>
                <button
                    uiMagnetic
                    [uiMagneticStrength]="0.4"
                    class="h-14 w-14 flex items-center justify-center rounded-full bg-green-500 text-white text-xl shadow-lg hover:bg-green-600 transition-colors"
                >
                    ★
                </button>
                <button
                    uiMagnetic
                    [uiMagneticStrength]="0.4"
                    class="h-14 w-14 flex items-center justify-center rounded-full bg-orange-500 text-white text-xl shadow-lg hover:bg-orange-600 transition-colors"
                >
                    ⚡
                </button>
            </div>
        `,
    }),
};

export const NavLinks: Story = {
    render: () => ({
        template: `
            <nav class="flex items-center justify-center gap-8 p-16 border rounded-xl">
                <a uiMagnetic [uiMagneticStrength]="0.25" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2 py-1">
                    Home
                </a>
                <a uiMagnetic [uiMagneticStrength]="0.25" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2 py-1">
                    About
                </a>
                <a uiMagnetic [uiMagneticStrength]="0.25" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2 py-1">
                    Components
                </a>
                <a uiMagnetic [uiMagneticStrength]="0.25" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2 py-1">
                    Blog
                </a>
                <a uiMagnetic [uiMagneticStrength]="0.25" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2 py-1">
                    Contact
                </a>
            </nav>
        `,
    }),
};
