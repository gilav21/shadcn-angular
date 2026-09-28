import { describe, it, expect, afterEach, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TreeContextMenuDirective, type TreeContextMenuEvent } from './tree-context-menu.directive';
import { ContextMenuComponent } from './context-menu';
import { TreeComponent, TreeItemComponent, TreeLabelComponent } from './tree';

// `[id]` is bound, not a static attribute: a static `id` would also land on the
// `<ui-tree-item>` host and `#item-…` would match the host instead of the row.
@Component({
  selector: 'ui-tct-host',
  standalone: true,
  imports: [TreeContextMenuDirective, TreeComponent, TreeItemComponent, TreeLabelComponent],
  template: `
    <ui-tree selectable="single" [uiTreeContextMenu]="menu" [contextMenuDisabled]="disabled()" (nodeContextMenu)="onCtx($event)">
      <ui-tree-item value="src" [id]="'item-src'">
        <ui-tree-label>Source</ui-tree-label>
        <ui-tree-item value="main" [id]="'item-main'">
          <ui-tree-label>  main.ts  </ui-tree-label>
        </ui-tree-item>
      </ui-tree-item>
      <ui-tree-item value="assets" [id]="'item-assets'">
        <ui-tree-item value="logo" [id]="'item-logo'">
          <ui-tree-label>logo.svg</ui-tree-label>
        </ui-tree-item>
      </ui-tree-item>
      <div class="not-an-item">
        <span>Ignore me</span>
      </div>
    </ui-tree>
  `,
})
class TestHostComponent {
  readonly disabled = signal(false);
  readonly menu = { show: vi.fn() } as unknown as ContextMenuComponent;
  readonly events: TreeContextMenuEvent<unknown>[] = [];

  onCtx(event: TreeContextMenuEvent<unknown>): void {
    this.events.push(event);
  }
}

function setup(): {
  fixture: ComponentFixture<TestHostComponent>;
  comp: TestHostComponent;
  treeEl: HTMLElement;
  item: (id: string) => HTMLElement;
} {
  TestBed.configureTestingModule({ imports: [TestHostComponent] });
  const fixture = TestBed.createComponent(TestHostComponent);
  const comp = fixture.componentInstance;
  fixture.detectChanges();
  const treeEl = fixture.debugElement.query(By.directive(TreeContextMenuDirective))
    .nativeElement as HTMLElement;
  const item = (id: string): HTMLElement => treeEl.querySelector<HTMLElement>(`#item-${id}`) as HTMLElement;
  return { fixture, comp, treeEl, item };
}

@Component({
  selector: 'ui-tct-no-menu-host',
  standalone: true,
  imports: [TreeContextMenuDirective, TreeComponent, TreeItemComponent, TreeLabelComponent],
  template: `
    <ui-tree [uiTreeContextMenu]="menu" (nodeContextMenu)="onCtx($event)">
      <ui-tree-item value="a" [id]="'item-a'">
        <ui-tree-label>Alpha</ui-tree-label>
      </ui-tree-item>
    </ui-tree>
  `,
})
class NoMenuHostComponent {
  readonly menu = undefined as unknown as ContextMenuComponent;
  readonly events: TreeContextMenuEvent<unknown>[] = [];

  onCtx(event: TreeContextMenuEvent<unknown>): void {
    this.events.push(event);
  }
}

function contextMenuEventAt(target: HTMLElement, x: number, y: number): MouseEvent {
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
  target.dispatchEvent(event);
  return event;
}

describe('TreeContextMenuDirective', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits node data and opens the menu at the cursor on right-click of a tree item', () => {
    const { comp, fixture, item } = setup();
    const src = item('src');
    const srcHeader = src.firstElementChild as HTMLElement;
    srcHeader.querySelector<HTMLButtonElement>('button')?.click();
    srcHeader.click();
    fixture.detectChanges();

    contextMenuEventAt(src.querySelector('[data-slot="tree-label"]') as HTMLElement, 111, 222);
    contextMenuEventAt(item('main'), 5, 6);

    expect(comp.events.map(e => e.node)).toEqual([
      { key: 'src', label: 'Source', expanded: true, selected: true, element: src },
      { key: 'main', label: 'main.ts', expanded: false, selected: false, element: item('main') },
    ]);
    const [emitted] = comp.events;
    expect(emitted.event.clientX).toBe(111);
    expect(emitted.event.clientY).toBe(222);
    expect(comp.menu.show).toHaveBeenCalledWith(111, 222, emitted.node);
  });

  it('prevents default and stops propagation for a tree-item right-click', () => {
    const { item } = setup();
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');
    const stopPropagation = vi.spyOn(event, 'stopPropagation');

    item('src').dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the context menu is disabled', () => {
    const { comp, fixture, item } = setup();
    comp.disabled.set(true);
    fixture.detectChanges();

    contextMenuEventAt(item('src'), 1, 2);

    expect(comp.events).toHaveLength(0);
    expect(comp.menu.show).not.toHaveBeenCalled();
  });

  it('reports an empty label for an item without its own label, never a descendant label', () => {
    const { comp, item } = setup();

    contextMenuEventAt(item('assets'), 3, 4);

    expect(comp.events).toHaveLength(1);
    expect(comp.events[0].node).toEqual({
      key: 'assets',
      label: '',
      expanded: false,
      selected: false,
      element: item('assets'),
    });
  });

  it('still emits the node event but skips opening when the context menu is falsy', () => {
    TestBed.configureTestingModule({ imports: [NoMenuHostComponent] });
    const fixture = TestBed.createComponent(NoMenuHostComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    const treeEl = fixture.debugElement.query(By.directive(TreeContextMenuDirective))
      .nativeElement as HTMLElement;
    const item = treeEl.querySelector<HTMLElement>('#item-a') as HTMLElement;

    expect(() => contextMenuEventAt(item, 1, 2)).not.toThrow();

    expect(comp.events).toHaveLength(1);
    expect(comp.events[0].node).toEqual({
      key: 'a',
      label: 'Alpha',
      expanded: false,
      selected: false,
      element: item,
    });
  });

  it('is a no-op when right-clicking outside any tree item', () => {
    const { comp, treeEl } = setup();
    const outside = treeEl.querySelector<HTMLElement>('.not-an-item span') as HTMLElement;

    contextMenuEventAt(outside, 1, 2);

    expect(comp.events).toHaveLength(0);
    expect(comp.menu.show).not.toHaveBeenCalled();
  });

  it('removes the contextmenu listener on destroy', () => {
    const { comp, fixture, item } = setup();
    const src = item('src');

    fixture.destroy();
    contextMenuEventAt(src, 1, 2);

    expect(comp.events).toHaveLength(0);
    expect(comp.menu.show).not.toHaveBeenCalled();
  });
});
