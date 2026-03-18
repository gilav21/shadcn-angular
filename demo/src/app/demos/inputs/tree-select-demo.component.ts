import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LabelComponent, TreeSelectComponent, TreeNode } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-tree-select-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LabelComponent, TreeSelectComponent],
  template: `
    <section class="space-y-4">
      <h2 id="tree-select" class="text-2xl font-semibold scroll-m-20">Tree Select</h2>
      <p class="text-muted-foreground">
        A hierarchical selection component combining a tree and a dropdown.
      </p>

      <div class="space-y-4 max-w-sm">
        <div class="space-y-2">
          <ui-label>Select a File</ui-label>
          <ui-tree-select [nodes]="treeSelectNodes()" [(ngModel)]="treeSelectValue" placeholder="Browse files..." />
          <p class="text-sm text-muted-foreground">Selected Value: {{ treeSelectValue() }}</p>
        </div>

        <div class="space-y-2">
          <ui-label>Disabled</ui-label>
          <ui-tree-select [nodes]="treeSelectNodes()" placeholder="Select..." [disabled]="true" />
        </div>
      </div>
    </section>
  `,
})
export class TreeSelectDemoComponent {
  readonly treeSelectNodes = signal<TreeNode[]>([
    {
      key: 'documents',
      label: 'Documents',
      icon: '📁',
      children: [
        {
          key: 'work', label: 'Work', icon: '📂', children: [
            { key: 'report', label: 'Report.docx', icon: '📄' },
            { key: 'expenses', label: 'Expenses.xlsx', icon: '📊' },
          ],
        },
        {
          key: 'personal', label: 'Personal', icon: '📂', children: [
            { key: 'resume', label: 'Resume.pdf', icon: '📄' },
          ],
        },
      ],
    },
    {
      key: 'images',
      label: 'Images',
      icon: '🖼️',
      children: [
        {
          key: 'vacation', label: 'Vacation', children: [
            { key: 'beach', label: 'Beach.jpg', icon: '📷' },
            { key: 'mountains', label: 'Mountains.jpg', icon: '📷' },
          ],
        },
      ],
    },
  ]);

  readonly treeSelectValue = signal<string | null>(null);
}
