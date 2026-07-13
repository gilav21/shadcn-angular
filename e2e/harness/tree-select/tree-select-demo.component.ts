import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    TreeSelectComponent,
    TreeSelectTriggerComponent,
    TreeSelectContentComponent,
} from '@/components/ui/tree-select';

/**
 * Auto-generated harness for the `tree-select` component.
 * Extend the template and assertions in `tree-select.spec.ts` as needed.
 */
@Component({
    selector: 'app-tree-select-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TreeSelectComponent, TreeSelectTriggerComponent, TreeSelectContentComponent],
    template: `
        <main class="p-8">
            <ui-tree-select data-testid="root">
                <ui-tree-select-trigger data-testid="tree-select-trigger"></ui-tree-select-trigger>
                <ui-tree-select-content data-testid="tree-select-content"></ui-tree-select-content>
            </ui-tree-select>
        </main>
    `,
})
export class TreeSelectDemoComponent {}
