import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    TreeComponent,
    TreeItemComponent,
    TreeLabelComponent,
} from '@/components/ui/tree';

@Component({
    selector: 'app-tree-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TreeComponent, TreeItemComponent, TreeLabelComponent],
    template: `
        <main class="p-8 w-[400px]">
            <ui-tree>
                <ui-tree-item value="docs" data-testid="item-docs">
                    <ui-tree-label>Documents</ui-tree-label>
                    <ui-tree-item value="resume" data-testid="item-resume">
                        <ui-tree-label>Resume.pdf</ui-tree-label>
                    </ui-tree-item>
                    <ui-tree-item value="cover" data-testid="item-cover">
                        <ui-tree-label>Cover Letter.docx</ui-tree-label>
                    </ui-tree-item>
                </ui-tree-item>
                <ui-tree-item value="photos" data-testid="item-photos">
                    <ui-tree-label>Photos</ui-tree-label>
                </ui-tree-item>
            </ui-tree>
        </main>
    `,
})
export class TreeDemoComponent {}
