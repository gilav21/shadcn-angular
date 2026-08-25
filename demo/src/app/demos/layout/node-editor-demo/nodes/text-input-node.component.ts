import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
    NODE_CONTEXT,
    type NodeContext,
    type NodeTypeDefinition,
} from '../../../../../../../packages/components/ui';

/** What this node type remembers between runs. */
export interface TextInputState {
    value: string;
}

/**
 * A node whose output is whatever the user types into it.
 *
 * The whole library-specific surface is `inject(NODE_CONTEXT)`: read state,
 * write state. There is no scheduler, no subscription and no lifecycle to
 * manage — setting state marks the node dirty, and the runtime does the rest.
 */
@Component({
    selector: 'app-text-input-node',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <input
      class="h-8 w-full rounded-md border bg-background px-2 text-sm
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      [value]="ctx.state().value"
      [attr.aria-label]="'Value for ' + ctx.nodeId"
      (input)="onInput($event)"
      data-testid="text-input-node"
    />
  `,
})
export class TextInputNodeComponent {
    protected readonly ctx = inject(NODE_CONTEXT) as NodeContext<TextInputState>;

    protected onInput(event: Event): void {
        this.ctx.setState({ value: (event.target as HTMLInputElement).value });
    }
}

export const TEXT_INPUT_NODE: NodeTypeDefinition<TextInputState> = {
    id: 'text-input',
    label: 'Text input',
    category: 'Input',
    accent: '#22c55e',
    ports: [{ id: 'text', direction: 'out', label: 'Text', type: 'text' }],
    initialState: () => ({ value: 'example.com' }),
    view: TextInputNodeComponent,
    bodyHeight: 46,
    compute: (_inputs, ctx) => ({ text: ctx.state.value }),
};
