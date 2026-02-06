import { Meta, StoryObj } from '@storybook/angular';
import {
  ContextMenuComponent,
  ContextMenuContentComponent,
  ContextMenuItemComponent,
  ContextMenuSeparatorComponent,
  ContextMenuLabelComponent,
} from '../../../packages/components/ui/context-menu.component';
import {
  ContextMenuAttachDirective
} from '../../../packages/components/ui/context-menu-integrations';
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

const meta: Meta = {
  title: 'Components/Context Menu Integration',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
# Context Menu Integration

Easy integration of context menus with Tree, Table, and Data Table components.

## Features

- **ContextMenuAttachDirective**: Attach context menu to any element with data
- **TreeContextMenuDirective**: Right-click on tree nodes
- **TableContextMenuDirective**: Right-click on table rows/cells
- **DataTableContextMenuDirective**: Right-click on data table rows/headers

## Basic Usage

### ContextMenuAttachDirective

Attach a context menu to any element:

\`\`\`typescript
import { 
  ContextMenuComponent,
  ContextMenuAttachDirective 
} from 'shadcn-angular';

@Component({
  imports: [
    ContextMenuComponent,
    ContextMenuAttachDirective
  ],
  template: \`
    <ui-context-menu #myMenu>
      <ui-context-menu-content>
        <ui-context-menu-item>Edit</ui-context-menu-item>
        <ui-context-menu-item>Delete</ui-context-menu-item>
      </ui-context-menu-content>
    </ui-context-menu>

    <div [uiContextMenuAttach]="myMenu" [contextMenuData]="item">
      Right-click me
    </div>
  \`
})
\`\`\`

### TreeContextMenuDirective

Add context menus to tree nodes:

\`\`\`typescript
@Component({
  template: \`
    <ui-context-menu #treeMenu>
      <ui-context-menu-content>
        <ui-context-menu-item>Expand</ui-context-menu-item>
        <ui-context-menu-item>Collapse</ui-context-menu-item>
        <ui-context-menu-separator></ui-context-menu-separator>
        <ui-context-menu-item variant="destructive">Delete</ui-context-menu-item>
      </ui-context-menu-content>
    </ui-context-menu>

    <ui-tree 
      [data]="treeData"
      [uiTreeContextMenu]="treeMenu"
      (nodeContextMenu)="onNodeContextMenu($event)"
    >
    </ui-tree>
  \`
})
\`\`\`

### TableContextMenuDirective

Add context menus to table rows:

\`\`\`typescript
@Component({
  template: \`
    <ui-context-menu #tableMenu>
      <ui-context-menu-content>
        <ui-context-menu-item>Edit Row</ui-context-menu-item>
        <ui-context-menu-item>Duplicate</ui-context-menu-item>
        <ui-context-menu-separator></ui-context-menu-separator>
        <ui-context-menu-item variant="destructive">Delete</ui-context-menu-item>
      </ui-context-menu-content>
    </ui-context-menu>

    <table ui-table [uiTableContextMenu]="tableMenu">
      ...
    </table>
  \`
})
\`\`\`

## API Reference

### ContextMenuAttachDirective

| Input | Type | Description |
|-------|------|-------------|
| uiContextMenuAttach | ContextMenuComponent | Required. The context menu to attach |
| contextMenuData | T | Data to associate with this element |
| disabled | boolean | Disable the context menu trigger |

| Output | Event Type | Description |
|--------|------------|-------------|
| contextMenuTriggered | { event: MouseEvent, item: T } | Emitted when context menu opens |

### TreeContextMenuDirective

| Input | Type | Description |
|-------|------|-------------|
| uiTreeContextMenu | ContextMenuComponent | Required. The context menu to show |
| contextMenuDisabled | boolean | Disable all context menus |

| Output | Event Type | Description |
|--------|------------|-------------|
| nodeContextMenu | { node: any, event: MouseEvent } | Emitted when a node is right-clicked |

### TableContextMenuDirective

| Input | Type | Description |
|-------|------|-------------|
| uiTableContextMenu | ContextMenuComponent | The context menu to show |
| contextMenuDisabled | boolean | Disable all context menus |
| rowDataAttribute | string | Attribute name for row data (default: 'data-row') |

| Output | Event Type | Description |
|--------|------------|-------------|
| rowContextMenu | { row: any, index: number, event: MouseEvent } | Emitted when a row is right-clicked |
| cellContextMenu | { row: any, column: string, index: number, event: MouseEvent } | Emitted when a cell is right-clicked |
        `,
      },
    },
  },
};

export default meta;

type Story = StoryObj;

@Component({
  selector: 'sb-context-menu-attach-demo',
  standalone: true,
  imports: [
    CommonModule,
    ContextMenuComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuSeparatorComponent,
    ContextMenuLabelComponent,
    ContextMenuAttachDirective,
  ],
  template: `
    <div style="padding: 20px;">
      <h3 style="margin-bottom: 16px; font-size: 18px; font-weight: 600;">ContextMenuAttachDirective Demo</h3>
      <p style="margin-bottom: 20px; color: #64748b;">Right-click on any item below to open its context menu</p>
      
      <ui-context-menu #itemMenu>
        <ui-context-menu-content>
          <ui-context-menu-label>Item Actions</ui-context-menu-label>
          <ui-context-menu-separator></ui-context-menu-separator>
          <ui-context-menu-item (click)="onAction('View', selectedItem())">
            View Details
          </ui-context-menu-item>
          <ui-context-menu-item (click)="onAction('Edit', selectedItem())">
            Edit Item
          </ui-context-menu-item>
          <ui-context-menu-item (click)="onAction('Duplicate', selectedItem())">
            Duplicate
          </ui-context-menu-item>
          <ui-context-menu-separator></ui-context-menu-separator>
          <ui-context-menu-item variant="destructive" (click)="onAction('Delete', selectedItem())">
            Delete Item
          </ui-context-menu-item>
        </ui-context-menu-content>
      </ui-context-menu>

      <div style="display: flex; flex-direction: column; gap: 8px; max-width: 400px;">
        <div
          *ngFor="let item of items(); let i = index"
          [uiContextMenuAttach]="itemMenu"
          [contextMenuData]="item"
          (contextMenuTriggered)="selectedItem.set($event.item)"
          style="
            padding: 12px 16px;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            cursor: context-menu;
            display: flex;
            align-items: center;
            gap: 12px;
            transition: all 0.2s;
          "
          onmouseover="this.style.background='#f8fafc'"
          onmouseout="this.style.background='white'"
        >
          <span style="
            width: 32px;
            height: 32px;
            border-radius: 6px;
            background: #3b82f6;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 12px;
          ">{{ item.id }}</span>
          <div style="flex: 1;">
            <div style="font-weight: 500; color: #1e293b;">{{ item.name }}</div>
            <div style="font-size: 12px; color: #64748b;">{{ item.type }} • {{ item.status }}</div>
          </div>
        </div>
      </div>

      @if (lastAction()) {
        <div style="
          margin-top: 20px;
          padding: 12px 16px;
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 6px;
          color: #0369a1;
          font-size: 14px;
        ">
          Last action: <strong>{{ lastAction() }}</strong>
        </div>
      }
    </div>
  `,
})
class ContextMenuAttachDemoComponent {
  items = signal([
    { id: 1, name: 'Project Alpha', type: 'Project', status: 'Active' },
    { id: 2, name: 'Design System', type: 'Resource', status: 'In Progress' },
    { id: 3, name: 'API Documentation', type: 'Document', status: 'Draft' },
    { id: 4, name: 'User Research', type: 'Study', status: 'Completed' },
    { id: 5, name: 'Q4 Roadmap', type: 'Planning', status: 'Active' },
  ]);

  selectedItem = signal<any>(null);
  lastAction = signal<string>('');

  onAction(action: string, item: any) {
    this.lastAction.set(`${action} on "${item?.name || 'Unknown'}"`);
  }
}

@Component({
  selector: 'sb-context-menu-tree-demo',
  standalone: true,
  imports: [
    CommonModule,
  ],
  template: `
    <div style="padding: 20px;">
      <h3 style="margin-bottom: 16px; font-size: 18px; font-weight: 600;">Tree Context Menu Demo</h3>
      <p style="margin-bottom: 20px; color: #64748b;">Right-click on any tree node to see context menu options</p>
      
      <div style="
        padding: 40px;
        background: #f8fafc;
        border: 2px dashed #cbd5e1;
        border-radius: 8px;
        text-align: center;
        color: #64748b;
      ">
        <p>Tree component with context menu integration</p>
        <p style="font-size: 13px; margin-top: 8px;">
          Use <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 3px;">[uiTreeContextMenu]</code> directive
        </p>
      </div>

      <div style="margin-top: 20px; padding: 16px; background: #f1f5f9; border-radius: 6px;">
        <h4 style="font-weight: 600; margin-bottom: 8px;">Usage Example:</h4>
        <pre style="font-size: 12px; overflow-x: auto;"><code>&lt;ui-context-menu #treeMenu&gt;
  &lt;ui-context-menu-content&gt;
    &lt;ui-context-menu-item&gt;Expand&lt;/ui-context-menu-item&gt;
    &lt;ui-context-menu-item&gt;Collapse&lt;/ui-context-menu-item&gt;
    &lt;ui-context-menu-separator&gt;&lt;/ui-context-menu-separator&gt;
    &lt;ui-context-menu-item variant="destructive"&gt;
      Delete
    &lt;/ui-context-menu-item&gt;
  &lt;/ui-context-menu-content&gt;
&lt;/ui-context-menu&gt;

&lt;ui-tree 
  [data]="treeData"
  [uiTreeContextMenu]="treeMenu"
  (nodeContextMenu)="handleNodeContextMenu($event)"&gt;
&lt;/ui-tree&gt;</code></pre>
      </div>
    </div>
  `,
})
class TreeContextMenuDemoComponent { }

@Component({
  selector: 'sb-context-menu-table-demo',
  standalone: true,
  imports: [
    CommonModule,
  ],
  template: `
    <div style="padding: 20px;">
      <h3 style="margin-bottom: 16px; font-size: 18px; font-weight: 600;">Table Context Menu Demo</h3>
      <p style="margin-bottom: 20px; color: #64748b;">Right-click on any table row or cell to see context menu options</p>
      
      <div style="
        padding: 40px;
        background: #f8fafc;
        border: 2px dashed #cbd5e1;
        border-radius: 8px;
        text-align: center;
        color: #64748b;
      ">
        <p>Table component with context menu integration</p>
        <p style="font-size: 13px; margin-top: 8px;">
          Use <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 3px;">[uiTableContextMenu]</code> directive
        </p>
      </div>

      <div style="margin-top: 20px; padding: 16px; background: #f1f5f9; border-radius: 6px;">
        <h4 style="font-weight: 600; margin-bottom: 8px;">Usage Example:</h4>
        <pre style="font-size: 12px; overflow-x: auto;"><code>&lt;ui-context-menu #tableMenu&gt;
  &lt;ui-context-menu-content&gt;
    &lt;ui-context-menu-item&gt;Edit Row&lt;/ui-context-menu-item&gt;
    &lt;ui-context-menu-item&gt;Duplicate&lt;/ui-context-menu-item&gt;
    &lt;ui-context-menu-separator&gt;&lt;/ui-context-menu-separator&gt;
    &lt;ui-context-menu-item variant="destructive"&gt;
      Delete Row
    &lt;/ui-context-menu-item&gt;
  &lt;/ui-context-menu-content&gt;
&lt;/ui-context-menu&gt;

&lt;table ui-table [uiTableContextMenu]="tableMenu"&gt;
  ...
&lt;/table&gt;</code></pre>
      </div>
    </div>
  `,
})
class TableContextMenuDemoComponent { }

export const AttachDirective: Story = {
  name: 'ContextMenuAttachDirective',
  render: () => ({
    template: `<sb-context-menu-attach-demo></sb-context-menu-attach-demo>`,
    moduleMetadata: {
      imports: [ContextMenuAttachDemoComponent],
    },
  }),
};

export const TreeIntegration: Story = {
  name: 'Tree Integration',
  render: () => ({
    template: `<sb-context-menu-tree-demo></sb-context-menu-tree-demo>`,
    moduleMetadata: {
      imports: [TreeContextMenuDemoComponent],
    },
  }),
};

export const TableIntegration: Story = {
  name: 'Table Integration',
  render: () => ({
    template: `<sb-context-menu-table-demo></sb-context-menu-table-demo>`,
    moduleMetadata: {
      imports: [TableContextMenuDemoComponent],
    },
  }),
};
