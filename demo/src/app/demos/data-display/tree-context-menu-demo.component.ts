import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BadgeComponent,
  ButtonComponent,
  ContextMenuComponent,
  ContextMenuContentComponent,
  ContextMenuIntegrations,
  ContextMenuItemComponent,
  ContextMenuLabelComponent,
  ContextMenuSeparatorComponent,
  ContextMenuShortcutComponent,
  InputComponent,
  TreeComponent,
  TreeContextMenuEvent,
  TreeNode,
} from '../../../../../packages/components/ui';
import { onLongPress } from '../../../../../packages/components/lib/touch';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { TREE_CONTEXT_MENU_DEMO_LOCALES } from './tree-context-menu-demo.locales';

/** Node data the directive extracts from the tree item DOM. */
interface TreeContextNode {
  key?: string;
  label: string;
  expanded: boolean;
  selected: boolean;
  element: HTMLElement;
}

function isContextNode(value: unknown): value is TreeContextNode {
  return typeof value === 'object' && value !== null && 'label' in value;
}

interface LastEvent {
  label: string;
  key?: string;
  expanded: boolean;
  selected: boolean;
  x: number;
  y: number;
}

const INITIAL_TREE: TreeNode[] = [
  {
    key: 'src',
    label: 'src',
    icon: '\u{1f4c1}',
    children: [
      {
        key: 'app',
        label: 'app',
        icon: '\u{1f4c1}',
        children: [
          { key: 'app-component', label: 'app.component.ts', icon: '\u{1f4c4}' },
          { key: 'app-routes', label: 'app.routes.ts', icon: '\u{1f4c4}' },
        ],
      },
      { key: 'main', label: 'main.ts', icon: '\u{1f4c4}' },
      { key: 'styles', label: 'styles.css', icon: '\u{1f3a8}' },
    ],
  },
  {
    key: 'assets',
    label: 'assets',
    icon: '\u{1f4c1}',
    children: [{ key: 'logo', label: 'logo.svg', icon: '\u{1f5bc}️' }],
  },
  { key: 'readme', label: 'README.md', icon: '\u{1f4dd}' },
];

@Component({
  selector: 'app-tree-context-menu-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TreeComponent,
    ContextMenuComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuLabelComponent,
    ContextMenuSeparatorComponent,
    ContextMenuShortcutComponent,
    ButtonComponent,
    BadgeComponent,
    InputComponent,
    ...ContextMenuIntegrations,
  ],
  template: `
    <div class="space-y-8">
      <section class="space-y-4">
        <h2 id="tree-context-menu" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
        <p class="text-muted-foreground">{{ t().description }}</p>
        <p class="text-sm rounded-md border border-dashed p-3 text-muted-foreground">{{ t().touchHint }}</p>
      </section>

      <section class="space-y-4">
        <h3 class="text-lg font-semibold">{{ t().explorerHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().explorerDesc }}</p>

        <div class="flex flex-wrap items-center gap-2">
          <ui-button size="sm" variant="outline" (click)="toggleDisabled()">
            {{ disabled() ? t().disabledToggleOff : t().disabledToggleOn }}
          </ui-button>
          <ui-button size="sm" variant="ghost" (click)="resetTree()">{{ t().resetTree }}</ui-button>
          <ui-badge [variant]="disabled() ? 'destructive' : 'secondary'">
            {{ disabled() ? t().disabledStateOn : t().disabledStateOff }}
          </ui-badge>
        </div>

        <div class="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div #treeHost class="w-full lg:w-80 rounded-md border p-4">
            <ui-tree
              [data]="nodes()"
              [initialExpandDepth]="2"
              selectable="single"
              [uiTreeContextMenu]="menu"
              [contextMenuDisabled]="disabled()"
              (nodeContextMenu)="onNodeContextMenu($event)" />

            @if (renaming(); as node) {
              <div class="mt-4 space-y-2 rounded-md border bg-muted/40 p-3">
                <p class="text-xs font-medium">{{ t().renameHeading }} — {{ node.label }}</p>
                <ui-input
                  [ngModel]="renameValue()"
                  (ngModelChange)="renameValue.set($event)"
                  [placeholder]="t().renamePlaceholder"
                  [ariaLabel]="t().renamePlaceholder" />
                <div class="flex flex-wrap gap-2">
                  <ui-button size="sm" (click)="confirmRename()">{{ t().renameConfirm }}</ui-button>
                  <ui-button size="sm" variant="ghost" (click)="cancelRename()">{{ t().renameCancel }}</ui-button>
                </div>
              </div>
            }

            <ui-context-menu #menu>
              <ui-context-menu-content class="w-56 max-w-[calc(100vw-2rem)]">
                @if (target(); as node) {
                  <ui-context-menu-label>
                    {{ isFolder(node) ? t().menuFolderLabel : t().menuFileLabel }} — {{ node.label }}
                  </ui-context-menu-label>
                  <ui-context-menu-separator />
                  @if (isFolder(node)) {
                    <ui-context-menu-item (click)="createFile()">
                      {{ t().menuNewFile }}
                      <ui-context-menu-shortcut>&#8984;N</ui-context-menu-shortcut>
                    </ui-context-menu-item>
                    <ui-context-menu-item (click)="createFolder()">
                      {{ t().menuNewFolder }}
                    </ui-context-menu-item>
                  } @else {
                    <ui-context-menu-item (click)="openNode()">
                      {{ t().menuOpen }}
                      <ui-context-menu-shortcut>&#x23ce;</ui-context-menu-shortcut>
                    </ui-context-menu-item>
                  }
                  <ui-context-menu-item (click)="startRename()">
                    {{ t().menuRename }}
                    <ui-context-menu-shortcut>F2</ui-context-menu-shortcut>
                  </ui-context-menu-item>
                  <ui-context-menu-item (click)="duplicateNode()">{{ t().menuDuplicate }}</ui-context-menu-item>
                  <ui-context-menu-separator />
                  <ui-context-menu-item variant="destructive" (click)="deleteNode()">
                    {{ t().menuDelete }}
                    <ui-context-menu-shortcut>&#8984;&#9003;</ui-context-menu-shortcut>
                  </ui-context-menu-item>
                }
              </ui-context-menu-content>
            </ui-context-menu>
          </div>

          <div class="w-full lg:flex-1 space-y-4">
            <div class="rounded-md border p-4 space-y-2">
              <h4 class="text-sm font-medium">{{ t().eventHeading }}</h4>
              <p class="text-xs text-muted-foreground">{{ t().eventDesc }}</p>
              @if (lastEvent(); as ev) {
                <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt class="text-muted-foreground">{{ t().eventLabel }}</dt>
                  <dd class="truncate">{{ ev.label }}</dd>
                  <dt class="text-muted-foreground">{{ t().eventKey }}</dt>
                  <dd class="truncate">{{ ev.key ?? t().eventKeyNote }}</dd>
                  <dt class="text-muted-foreground">{{ t().eventExpanded }}</dt>
                  <dd>{{ ev.expanded }}</dd>
                  <dt class="text-muted-foreground">{{ t().eventSelected }}</dt>
                  <dd>{{ ev.selected }}</dd>
                  <dt class="text-muted-foreground">{{ t().eventPosition }}</dt>
                  <dd>{{ ev.x }} / {{ ev.y }}</dd>
                </dl>
              } @else {
                <p class="text-xs text-muted-foreground">{{ t().eventEmpty }}</p>
              }
            </div>

            <div class="rounded-md border p-4 space-y-2">
              <h4 class="text-sm font-medium">{{ t().logHeading }}</h4>
              @if (log().length) {
                <ul class="space-y-1 text-xs">
                  @for (entry of log(); track $index) {
                    <li class="truncate">{{ entry }}</li>
                  }
                </ul>
              } @else {
                <p class="text-xs text-muted-foreground">{{ t().logEmpty }}</p>
              }
            </div>
          </div>
        </div>
      </section>

      <section class="space-y-2">
        <h3 class="text-lg font-semibold">{{ t().disabledHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().disabledDesc }}</p>
      </section>
    </div>
  `,
})
export class TreeContextMenuDemoComponent implements AfterViewInit, OnDestroy {
  private readonly localeId = inject(UI_LOCALE_ID);
  readonly t = computed(
    () => TREE_CONTEXT_MENU_DEMO_LOCALES[this.localeId()] ?? TREE_CONTEXT_MENU_DEMO_LOCALES['en'],
  );

  private readonly treeHost = viewChild.required<ElementRef<HTMLElement>>('treeHost');
  private readonly menu = viewChild.required(ContextMenuComponent);

  readonly nodes = signal<TreeNode[]>(structuredClone(INITIAL_TREE));
  readonly disabled = signal(false);
  readonly target = signal<TreeNode | null>(null);
  readonly lastEvent = signal<LastEvent | null>(null);
  readonly log = signal<string[]>([]);
  readonly renaming = signal<TreeNode | null>(null);
  readonly renameValue = signal('');

  private nextId = 0;
  private cleanupLongPress: (() => void) | null = null;

  ngAfterViewInit(): void {
    this.cleanupLongPress = onLongPress(this.treeHost().nativeElement, (event) => this.onLongPress(event));
  }

  ngOnDestroy(): void {
    this.cleanupLongPress?.();
  }

  isFolder(node: TreeNode): boolean {
    return Array.isArray(node.children);
  }

  toggleDisabled(): void {
    this.disabled.update((value) => !value);
  }

  resetTree(): void {
    this.nodes.set(structuredClone(INITIAL_TREE));
    this.target.set(null);
    this.lastEvent.set(null);
    this.renaming.set(null);
    this.log.set([]);
  }

  onNodeContextMenu(event: TreeContextMenuEvent): void {
    const hit = event.node;
    if (!isContextNode(hit)) return;
    const node = this.resolveNode(hit.label);
    this.target.set(node);
    this.lastEvent.set({
      label: node?.label ?? this.normalize(hit.label),
      key: hit.key,
      expanded: hit.expanded,
      selected: hit.selected,
      x: Math.round(event.event.clientX),
      y: Math.round(event.event.clientY),
    });
  }

  openNode(): void {
    const node = this.target();
    if (node) {
      this.pushLog(this.t().actionOpen, node.label);
    }
  }

  startRename(): void {
    const node = this.target();
    if (!node) return;
    this.renaming.set(node);
    this.renameValue.set(node.label);
  }

  cancelRename(): void {
    this.renaming.set(null);
  }

  confirmRename(): void {
    const node = this.renaming();
    const name = this.renameValue().trim();
    if (!node || !name) return;
    this.nodes.update((nodes) => this.mapNodes(nodes, node.key, (n) => ({ ...n, label: name })));
    this.pushLog(this.t().actionRename, `${node.label} → ${name}`);
    this.renaming.set(null);
    this.target.set(null);
  }

  createFile(): void {
    const locale = this.t();
    this.addChild(
      { key: this.makeKey(), label: `${this.nextId}-${locale.newFileName}`, icon: '\u{1f4c4}' },
      locale.actionNewFile,
    );
  }

  createFolder(): void {
    const locale = this.t();
    this.addChild(
      { key: this.makeKey(), label: `${locale.newFolderName}-${this.nextId}`, icon: '\u{1f4c1}', children: [] },
      locale.actionNewFolder,
    );
  }

  duplicateNode(): void {
    const node = this.target();
    if (!node) return;
    const copy: TreeNode = {
      ...this.rekey(structuredClone(node)),
      label: `${node.label} (${this.t().copySuffix})`,
    };
    this.nodes.update((nodes) => this.insertAfter(nodes, node.key, copy));
    this.pushLog(this.t().actionDuplicate, node.label);
    this.target.set(null);
  }

  deleteNode(): void {
    const node = this.target();
    if (!node) return;
    this.nodes.update((nodes) => this.removeNode(nodes, node.key));
    this.pushLog(this.t().actionDelete, node.label);
    this.target.set(null);
    this.renaming.set(null);
  }

  /**
   * Touch fallback — the directive itself is right-click only, so a 500 ms
   * long-press is wired here with `onLongPress()` from `lib/touch`.
   */
  private onLongPress(event: TouchEvent): void {
    if (this.disabled()) return;
    const touch = event.touches[0];
    const origin = event.target as HTMLElement | null;
    const item = origin?.closest('[data-slot="tree-item"]');
    if (!touch || !item) return;

    const label = item.querySelector('[data-slot="tree-label"]')?.textContent ?? '';
    const node = this.resolveNode(label);
    this.target.set(node);
    this.lastEvent.set({
      label: node?.label ?? this.normalize(label),
      key: undefined,
      expanded: (item as HTMLElement).dataset['expanded'] === 'true',
      selected: (item as HTMLElement).dataset['selected'] === 'true',
      x: Math.round(touch.clientX),
      y: Math.round(touch.clientY),
    });
    this.menu().show(touch.clientX, touch.clientY, node);
  }

  private addChild(child: TreeNode, action: string): void {
    const parent = this.target();
    if (!parent) return;
    this.nodes.update((nodes) =>
      this.mapNodes(nodes, parent.key, (n) => ({ ...n, children: [...(n.children ?? []), child] })),
    );
    this.pushLog(action, parent.label);
    this.target.set(null);
  }

  private rekey(node: TreeNode): TreeNode {
    return {
      ...node,
      key: this.makeKey(),
      children: node.children?.map((child) => this.rekey(child)),
    };
  }

  private pushLog(action: string, label: string): void {
    this.log.update((entries) => [`${action}: ${label}`, ...entries].slice(0, 8));
  }

  private makeKey(): string {
    return `node-${++this.nextId}`;
  }

  private normalize(label: string): string {
    return label.replaceAll(/\s+/g, ' ').trim();
  }

  /** The DOM label carries the icon (e.g. `📁 src`), so match on icon + label. */
  private resolveNode(domLabel: string): TreeNode | null {
    const normalized = this.normalize(domLabel);
    const walk = (nodes: TreeNode[]): TreeNode | null => {
      for (const node of nodes) {
        const expected = node.icon ? `${node.icon} ${node.label}` : node.label;
        if (normalized === expected || normalized === node.label) return node;
        const found = node.children ? walk(node.children) : null;
        if (found) return found;
      }
      return null;
    };
    return walk(this.nodes());
  }

  private mapNodes(nodes: TreeNode[], key: string, update: (node: TreeNode) => TreeNode): TreeNode[] {
    return nodes.map((node) => {
      if (node.key === key) return update(node);
      if (node.children) return { ...node, children: this.mapNodes(node.children, key, update) };
      return node;
    });
  }

  private removeNode(nodes: TreeNode[], key: string): TreeNode[] {
    return nodes
      .filter((node) => node.key !== key)
      .map((node) => (node.children ? { ...node, children: this.removeNode(node.children, key) } : node));
  }

  private insertAfter(nodes: TreeNode[], key: string, copy: TreeNode): TreeNode[] {
    return nodes.flatMap((node) => {
      if (node.key === key) return [node, copy];
      if (node.children) return [{ ...node, children: this.insertAfter(node.children, key, copy) }];
      return [node];
    });
  }
}
