import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  TreeComponent,
  TreeIconComponent,
  TreeItemComponent,
  TreeLabelComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-tree-view-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TreeComponent, TreeItemComponent, TreeLabelComponent, TreeIconComponent],
  template: `
    <section class="space-y-4">
      <h2 id="tree-view" class="text-2xl font-semibold scroll-m-20">Tree View</h2>
      <p class="text-muted-foreground">
        A hierarchical list for displaying nested data like file systems.
      </p>

      <div class="rounded-md border p-4 max-w-sm">
        <ui-tree selectable="single">
          <ui-tree-item value="documents">
            <ui-tree-label>
              <ui-tree-icon>&#x1f4c1;</ui-tree-icon>
              Documents
            </ui-tree-label>
            <ui-tree-item value="resume">
              <ui-tree-label>
                <ui-tree-icon>&#x1f4c4;</ui-tree-icon>
                Resume.pdf
              </ui-tree-label>
            </ui-tree-item>
            <ui-tree-item value="cover-letter">
              <ui-tree-label>
                <ui-tree-icon>&#x1f4c4;</ui-tree-icon>
                Cover Letter.docx
              </ui-tree-label>
            </ui-tree-item>
          </ui-tree-item>
          <ui-tree-item value="images">
            <ui-tree-label>
              <ui-tree-icon>&#x1f4c1;</ui-tree-icon>
              Images
            </ui-tree-label>
            <ui-tree-item value="photo1">
              <ui-tree-label>
                <ui-tree-icon>&#x1f5bc;&#xfe0f;</ui-tree-icon>
                vacation.jpg
              </ui-tree-label>
            </ui-tree-item>
          </ui-tree-item>
        </ui-tree>
      </div>

      <h3 class="text-lg font-medium mt-8">Simple Mode (Data-driven)</h3>
      <p class="text-muted-foreground text-sm mb-4">Using the data input.</p>
      <ui-tree [data]="[
        { key: '1', label: 'Projects', children: [
            { key: '1-1', label: 'Frontend', children: [
                { key: '1-1-1', label: 'app.component.ts', icon: '&#x1f4c4;' },
                { key: '1-1-2', label: 'app.html', icon: '&#x1f4c4;' }
            ]},
            { key: '1-2', label: 'Backend' }
        ]},
        { key: '2', label: 'Settings', icon: '&#x2699;&#xfe0f;' }
      ]" />
    </section>
  `,
})
export class TreeViewDemoComponent {}
