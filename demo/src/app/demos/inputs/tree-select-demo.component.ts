import { Component, ChangeDetectionStrategy, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LabelComponent, TreeSelectComponent, TreeNode } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { TREE_SELECT_DEMO_LOCALES } from './tree-select-demo.locales';

@Component({
  selector: 'app-tree-select-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LabelComponent, TreeSelectComponent],
  template: `
    <section class="space-y-4">
      <h2 id="tree-select" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="space-y-4 max-w-sm">
        <div class="space-y-2">
          <ui-label>{{ t().selectFileLabel }}</ui-label>
          <ui-tree-select [nodes]="treeSelectNodes()" [(ngModel)]="treeSelectValue" [placeholder]="t().browsePlaceholder" />
          <p class="text-sm text-muted-foreground">{{ t().selectedValueLabel }} {{ treeSelectValue() }}</p>
        </div>

        <div class="space-y-2">
          <ui-label>{{ t().disabledLabel }}</ui-label>
          <ui-tree-select [nodes]="treeSelectNodes()" [placeholder]="t().selectPlaceholder" [disabled]="true" />
        </div>
      </div>
    </section>
  `,
})
export class TreeSelectDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => TREE_SELECT_DEMO_LOCALES[this.localeId()] ?? TREE_SELECT_DEMO_LOCALES['en']);

  readonly treeSelectNodes = signal<TreeNode[]>([]);
  readonly treeSelectValue = signal<string | null>(null);

  constructor() {
    effect(() => {
      const loc = this.t();
      this.treeSelectNodes.set([
        {
          key: 'documents',
          label: loc.nodeDocuments,
          icon: '📁',
          children: [
            {
              key: 'work', label: loc.nodeWork, icon: '📂', children: [
                { key: 'report', label: loc.nodeReport, icon: '📄' },
                { key: 'expenses', label: loc.nodeExpenses, icon: '📊' },
              ],
            },
            {
              key: 'personal', label: loc.nodePersonal, icon: '📂', children: [
                { key: 'resume', label: loc.nodeResume, icon: '📄' },
              ],
            },
          ],
        },
        {
          key: 'images',
          label: loc.nodeImages,
          icon: '🖼️',
          children: [
            {
              key: 'vacation', label: loc.nodeVacation, children: [
                { key: 'beach', label: loc.nodeBeach, icon: '📷' },
                { key: 'mountains', label: loc.nodeMountains, icon: '📷' },
              ],
            },
          ],
        },
      ]);
    });
  }
}
