import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
    NODE_CONTEXT,
    type NodeContext,
    type NodeTypeDefinition,
} from '../../../../../../../packages/components/ui';

/** Shows whatever arrives, so a value can be watched mid-graph. */
@Component({
    selector: 'app-display-node',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <p
      class="min-h-8 truncate rounded-md border bg-muted/40 px-2 py-1.5 font-mono text-xs"
      data-testid="display-node"
      dir="auto"
    >
      {{ shown() }}
    </p>
  `,
})
export class DisplayNodeComponent {
    private readonly ctx = inject(NODE_CONTEXT) as NodeContext;
    private readonly value = this.ctx.input<unknown>('value');

    protected readonly shown = computed(() => {
        const value = this.value();
        if (value === undefined || value === null) return '—';
        return typeof value === 'string' ? value : JSON.stringify(value);
    });
}

export const DISPLAY_NODE: NodeTypeDefinition = {
    id: 'display',
    label: 'Display',
    category: 'Output',
    ports: [{ id: 'value', direction: 'in', label: 'Value' }],
    view: DisplayNodeComponent,
    bodyHeight: 46,
};

/** A pure transform: no view, no state — four lines of definition. */
export const UPPERCASE_NODE: NodeTypeDefinition = {
    id: 'uppercase',
    label: 'Uppercase',
    category: 'Transform',
    ports: [
        { id: 'in', direction: 'in', label: 'Text', type: 'text' },
        { id: 'out', direction: 'out', label: 'Text', type: 'text' },
    ],
    compute: inputs => ({ out: String(inputs['in'] ?? '').toUpperCase() }),
};

/** Counts characters — shows a second branch reading the same output. */
export const LENGTH_NODE: NodeTypeDefinition = {
    id: 'length',
    label: 'Character count',
    category: 'Transform',
    ports: [
        { id: 'in', direction: 'in', label: 'Text', type: 'text' },
        { id: 'out', direction: 'out', label: 'Count', type: 'number' },
    ],
    compute: inputs => ({ out: String(inputs['in'] ?? '').length }),
};

/**
 * Deliberately slow, and deliberately side-effecting in spirit.
 *
 * `reactive: false` keeps it out of live evaluation, so it only runs when the
 * graph is run explicitly — which is what any node that costs money or sends
 * something wants.
 */
export const DELAY_NODE: NodeTypeDefinition = {
    id: 'delay',
    label: 'Slow step',
    category: 'Transform',
    reactive: false,
    ports: [
        { id: 'in', direction: 'in', label: 'In' },
        { id: 'out', direction: 'out', label: 'Out' },
    ],
    compute: async (inputs, ctx) => {
        await new Promise(resolve => setTimeout(resolve, 600));
        // Honouring the signal is what makes cancellation real rather than
        // advisory — a superseded run stops here instead of finishing.
        if (ctx.signal.aborted) return {};
        return { out: inputs['in'] };
    },
};
