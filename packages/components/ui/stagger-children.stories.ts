import { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { StaggerChildrenComponent } from './stagger-children.component';

const meta: Meta<StaggerChildrenComponent> = {
    title: 'UI/Stagger Children',
    component: StaggerChildrenComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [StaggerChildrenComponent],
        }),
    ],
    argTypes: {
        delay: {
            control: 'number',
        },
        duration: {
            control: 'number',
        },
        staggerDelay: {
            control: 'number',
        },
        direction: {
            control: 'select',
            options: ['up', 'down', 'left', 'right'],
        },
    },
    args: {
        delay: 0,
        duration: 400,
        staggerDelay: 80,
        direction: 'up',
    },
};

export default meta;
type Story = StoryObj<StaggerChildrenComponent>;

export const Default: Story = {
    args: {
        staggerDelay: 80,
        direction: 'up',
        duration: 400,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="p-8 max-w-md mx-auto">
                <ui-stagger-children [staggerDelay]="staggerDelay" [direction]="direction" [duration]="duration" class="space-y-3">
                    <div class="p-4 rounded-xl border bg-card shadow-sm flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-lg">📋</div>
                        <div>
                            <p class="font-medium text-sm">Design System Setup</p>
                            <p class="text-xs text-muted-foreground">Completed · 2 days ago</p>
                        </div>
                    </div>
                    <div class="p-4 rounded-xl border bg-card shadow-sm flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-lg">🚀</div>
                        <div>
                            <p class="font-medium text-sm">Component Library</p>
                            <p class="text-xs text-muted-foreground">In progress · 50 components</p>
                        </div>
                    </div>
                    <div class="p-4 rounded-xl border bg-card shadow-sm flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-lg">📚</div>
                        <div>
                            <p class="font-medium text-sm">Documentation</p>
                            <p class="text-xs text-muted-foreground">In progress · Storybook</p>
                        </div>
                    </div>
                    <div class="p-4 rounded-xl border bg-card shadow-sm flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-lg">🧪</div>
                        <div>
                            <p class="font-medium text-sm">Testing Suite</p>
                            <p class="text-xs text-muted-foreground">Pending · Jest + Playwright</p>
                        </div>
                    </div>
                    <div class="p-4 rounded-xl border bg-card shadow-sm flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-lg">🎉</div>
                        <div>
                            <p class="font-medium text-sm">Public Launch</p>
                            <p class="text-xs text-muted-foreground">Upcoming · v2.0</p>
                        </div>
                    </div>
                </ui-stagger-children>
            </div>
        `,
    }),
};

export const FastStagger: Story = {
    args: {
        staggerDelay: 40,
        direction: 'up',
        duration: 300,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="p-8 max-w-md mx-auto">
                <p class="text-xs text-muted-foreground mb-4">staggerDelay={{ staggerDelay }}ms — elements appear in quick succession</p>
                <ui-stagger-children [staggerDelay]="staggerDelay" [direction]="direction" [duration]="duration" class="grid grid-cols-3 gap-3">
                    <div class="aspect-square rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border flex items-center justify-center font-bold text-violet-600 dark:text-violet-400">A</div>
                    <div class="aspect-square rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border flex items-center justify-center font-bold text-cyan-600 dark:text-cyan-400">B</div>
                    <div class="aspect-square rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border flex items-center justify-center font-bold text-orange-600 dark:text-orange-400">C</div>
                    <div class="aspect-square rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border flex items-center justify-center font-bold text-green-600 dark:text-green-400">D</div>
                    <div class="aspect-square rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 border flex items-center justify-center font-bold text-pink-600 dark:text-pink-400">E</div>
                    <div class="aspect-square rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border flex items-center justify-center font-bold text-yellow-600 dark:text-yellow-400">F</div>
                </ui-stagger-children>
            </div>
        `,
    }),
};

export const DirectionLeft: Story = {
    args: {
        direction: 'left',
        staggerDelay: 100,
        duration: 500,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="p-8 max-w-md mx-auto">
                <p class="text-xs text-muted-foreground mb-4">Direction: left — elements slide in from the right</p>
                <ui-stagger-children [direction]="direction" [staggerDelay]="staggerDelay" [duration]="duration" class="space-y-2">
                    <div class="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <span class="text-sm font-medium">Feature A</span>
                        <span class="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">Active</span>
                    </div>
                    <div class="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <span class="text-sm font-medium">Feature B</span>
                        <span class="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">Beta</span>
                    </div>
                    <div class="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <span class="text-sm font-medium">Feature C</span>
                        <span class="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full">Preview</span>
                    </div>
                    <div class="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <span class="text-sm font-medium">Feature D</span>
                        <span class="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">Planned</span>
                    </div>
                </ui-stagger-children>
            </div>
        `,
    }),
};
