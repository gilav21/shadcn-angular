import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
    ChangeDetectionStrategy,
    Component,
    ComponentRef,
    Type,
    input,
    output,
    signal,
} from '@angular/core';
import { UiComponentOutletDirective } from './component-outlet.directive';
import { ComponentPoolService } from '../lib/component-pool.service';

/** A simple presentational component rendered dynamically by the outlet. */
@Component({
    selector: 'story-alert-card',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="rounded-lg border bg-card p-4 text-card-foreground">
            <h4 class="font-semibold text-sm">{{ title() }}</h4>
            <p class="text-sm text-muted-foreground mt-1">{{ message() }}</p>
        </div>
    `,
})
class StoryAlertCardComponent {
    readonly title = input('Alert card');
    readonly message = input('Rendered dynamically by uiComponentOutlet.');
}

/**
 * A second renderer for the same `{ title, message }` data — swapping between
 * renderers that share an input contract is the canonical outlet use case.
 */
@Component({
    selector: 'story-compact-row',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="flex flex-wrap items-baseline gap-2 rounded-md border-l-4 border-primary bg-muted/40 px-3 py-2">
            <span class="text-sm font-semibold">{{ title() }}</span>
            <span class="text-xs text-muted-foreground">{{ message() }}</span>
        </div>
    `,
})
class StoryCompactRowComponent {
    readonly title = input('Compact row');
    readonly message = input('Same data, a different renderer.');
}

/** A stat tile — used for the inputs and recycling stories. */
@Component({
    selector: 'story-stat-tile',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="rounded-lg border bg-card p-4 text-card-foreground">
            <p class="text-xs uppercase tracking-wide text-muted-foreground">{{ label() }}</p>
            <p class="text-2xl font-bold mt-1">{{ value() }}</p>
        </div>
    `,
})
class StoryStatTileComponent {
    readonly label = input('Revenue');
    readonly value = input('$0');
}

/** A component with an output, used to demonstrate the `outputs` map. */
@Component({
    selector: 'story-vote-card',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="rounded-lg border bg-card p-4 text-card-foreground flex flex-wrap items-center gap-3">
            <span class="text-sm font-medium">{{ title() }}</span>
            <button
                type="button"
                class="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium min-h-[44px] sm:min-h-0"
                (click)="voted.emit('up')"
            >
                Vote up
            </button>
            <button
                type="button"
                class="px-3 py-1.5 rounded-md border text-xs font-medium min-h-[44px] sm:min-h-0"
                (click)="voted.emit('down')"
            >
                Vote down
            </button>
        </div>
    `,
})
class StoryVoteCardComponent {
    readonly title = input('Dynamic component with an output');
    readonly voted = output<string>();
}

/** Interactive host for the swap / recycle stories. */
@Component({
    selector: 'story-outlet-swap-host',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [UiComponentOutletDirective],
    template: `
        <div class="space-y-4 p-4 sm:p-6">
            <div class="flex flex-wrap gap-2">
                <button
                    type="button"
                    class="px-3 py-2 rounded-md border text-sm font-medium"
                    (click)="current.set(cardType)"
                >
                    Card renderer
                </button>
                <button
                    type="button"
                    class="px-3 py-2 rounded-md border text-sm font-medium"
                    (click)="current.set(compactType)"
                >
                    Compact renderer
                </button>
            </div>
            <ng-container [uiComponentOutlet]="current()" [inputs]="inputs()" />
        </div>
    `,
})
class StoryOutletSwapHostComponent {
    readonly cardType: Type<unknown> = StoryAlertCardComponent;
    readonly compactType: Type<unknown> = StoryCompactRowComponent;
    readonly current = signal<Type<unknown>>(StoryAlertCardComponent);
    readonly inputs = signal<Record<string, unknown>>({
        title: 'Swapped at runtime',
        message: 'Both renderers accept the same { title, message } inputs.',
    });
}

/** Recycling host — rows are added / removed and instances come back from the pool. */
@Component({
    selector: 'story-outlet-recycle-host',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [UiComponentOutletDirective],
    providers: [ComponentPoolService],
    template: `
        <div class="space-y-4 p-4 sm:p-6">
            <div class="flex flex-wrap gap-2">
                <button type="button" class="px-3 py-2 rounded-md border text-sm font-medium" (click)="addRow()">
                    Add row
                </button>
                <button type="button" class="px-3 py-2 rounded-md border text-sm font-medium" (click)="removeRow()">
                    Remove row
                </button>
            </div>
            <div class="grid gap-3 grid-cols-1 sm:grid-cols-2">
                @for (row of rows(); track row) {
                    <div [uiComponentOutlet]="tileType" [inputs]="{ label: 'Row', value: '#' + row }" [recycle]="true"></div>
                }
            </div>
        </div>
    `,
})
class StoryOutletRecycleHostComponent {
    readonly tileType: Type<unknown> = StoryStatTileComponent;
    readonly rows = signal<number[]>([1, 2]);
    private next = 3;

    addRow(): void {
        this.rows.update((rows) => [...rows, this.next++]);
    }

    removeRow(): void {
        this.rows.update((rows) => rows.slice(0, -1));
    }
}

// `UiComponentOutletDirective` has no `component` metadata target since it is a
// directive; every input is still exposed via argTypes so the Controls panel
// drives it live.
const meta: Meta = {
    title: 'UI/Component Outlet',
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                UiComponentOutletDirective,
                StoryOutletSwapHostComponent,
                StoryOutletRecycleHostComponent,
            ],
        }),
    ],
    argTypes: {
        uiComponentOutlet: {
            description:
                'Required. The component class (`Type<unknown>`) to instantiate. Changing it destroys the previous instance and renders the new one.',
            options: ['Alert card', 'Compact row'],
            mapping: {
                'Alert card': StoryAlertCardComponent,
                'Compact row': StoryCompactRowComponent,
            },
            control: { type: 'select' },
        },
        inputs: {
            description:
                'A `Record<string, unknown>` applied to the rendered component with `setInput()`. Updating the record re-applies the values without re-creating the component.',
            control: 'object',
        },
        outputs: {
            description:
                'A `Record<string, (event) => void>` of handlers subscribed to the rendered component\'s outputs by name. Replacing the record re-subscribes.',
            control: false,
        },
        recycle: {
            description:
                'When true and a `ComponentPoolService` is available in the injector, instances are released to the pool on destroy and re-acquired instead of being re-created. Useful for long virtualized lists.',
            control: 'boolean',
        },
        initialized: {
            description: 'Emits the `ComponentRef<unknown>` every time an instance is rendered (initial render and after each swap).',
            action: 'initialized',
        },
    },
    args: {
        uiComponentOutlet: 'Alert card',
        inputs: { title: 'Hello from the outlet', message: 'Inputs are applied via setInput().' },
        recycle: false,
    },
};

export default meta;
type Story = StoryObj;

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="p-4 sm:p-6 max-w-xl">
                <ng-container
                    [uiComponentOutlet]="uiComponentOutlet"
                    [inputs]="inputs"
                    [recycle]="recycle"
                    (initialized)="initialized($event)"
                />
            </div>
        `,
    }),
};

/** The minimal case: render a component class held in a variable. */
export const DynamicComponent: Story = {
    render: () => ({
        props: { component: StoryAlertCardComponent },
        template: `
            <div class="p-4 sm:p-6 max-w-xl">
                <ng-container [uiComponentOutlet]="component" />
            </div>
        `,
    }),
};

/** Inputs are pushed into the rendered component through the `inputs` record. */
export const WithInputs: Story = {
    render: () => ({
        props: {
            component: StoryStatTileComponent,
            inputs: { label: 'Monthly recurring revenue', value: '$48,120' },
        },
        template: `
            <div class="p-4 sm:p-6 max-w-xl">
                <ng-container [uiComponentOutlet]="component" [inputs]="inputs" />
            </div>
        `,
    }),
};

/** Outputs are subscribed by name; the handler receives the emitted payload. */
export const WithOutputs: Story = {
    render: (args) => ({
        props: {
            component: StoryVoteCardComponent,
            inputs: { title: 'Outputs are wired by name' },
            outputs: { voted: (value: string) => args['onVoted']?.(value) },
            onVoted: args['onVoted'],
        },
        template: `
            <div class="p-4 sm:p-6 max-w-xl">
                <ng-container [uiComponentOutlet]="component" [inputs]="inputs" [outputs]="outputs" />
            </div>
        `,
    }),
    argTypes: {
        onVoted: { action: 'voted' },
    },
};

/** `(initialized)` hands you the `ComponentRef` for imperative access. */
export const InitializedEvent: Story = {
    render: (args) => ({
        props: {
            component: StoryStatTileComponent,
            inputs: { label: 'Sessions', value: '1,204' },
            onInit: (ref: ComponentRef<unknown>) => args['initialized']?.(ref.componentType.name),
        },
        template: `
            <div class="p-4 sm:p-6 max-w-xl">
                <ng-container [uiComponentOutlet]="component" [inputs]="inputs" (initialized)="onInit($event)" />
            </div>
        `,
    }),
};

/** Swapping the component input at runtime destroys the old instance and renders the new one. */
export const SwapAtRuntime: Story = {
    render: () => ({
        template: `<story-outlet-swap-host />`,
    }),
};

/**
 * With `[recycle]="true"` and a `ComponentPoolService` provider, destroyed
 * instances are returned to the pool and reused instead of re-created.
 */
export const Recycling: Story = {
    render: () => ({
        template: `<story-outlet-recycle-host />`,
    }),
};
