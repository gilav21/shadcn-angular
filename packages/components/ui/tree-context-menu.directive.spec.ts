import { describe, it, expect, afterEach, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TreeContextMenuDirective, type TreeContextMenuEvent } from './tree-context-menu.directive';
import { ContextMenuComponent } from './context-menu';

@Component({
  selector: 'ui-tct-host',
  standalone: true,
  imports: [TreeContextMenuDirective],
  template: `
    <ui-tree [uiTreeContextMenu]="menu" [contextMenuDisabled]="disabled()" (nodeContextMenu)="onCtx($event)">
      <div data-slot="tree-item" data-key="a" data-expanded="true" data-selected="false">
        <span data-slot="tree-label">Alpha</span>
      </div>
      <div data-slot="tree-item" data-key="b">
        <span data-slot="tree-label">  Beta  </span>
      </div>
      <div data-slot="tree-item" data-key="c"></div>
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
} {
  TestBed.configureTestingModule({ imports: [TestHostComponent] });
  const fixture = TestBed.createComponent(TestHostComponent);
  const comp = fixture.componentInstance;
  fixture.detectChanges();
  const treeEl = fixture.debugElement.query(By.directive(TreeContextMenuDirective))
    .nativeElement as HTMLElement;
  return { fixture, comp, treeEl };
}

@Component({
  selector: 'ui-tct-no-menu-host',
  standalone: true,
  imports: [TreeContextMenuDirective],
  template: `
    <ui-tree [uiTreeContextMenu]="menu" (nodeContextMenu)="onCtx($event)">
      <div data-slot="tree-item" data-key="a">
        <span data-slot="tree-label">Alpha</span>
      </div>
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
    const { comp, treeEl } = setup();
    const item = treeEl.querySelector<HTMLElement>('[data-key="a"]') as HTMLElement;
    const label = item.querySelector('[data-slot="tree-label"]') as HTMLElement;

    contextMenuEventAt(label, 111, 222);

    expect(comp.events).toHaveLength(1);
    const [emitted] = comp.events;
    expect(emitted.node).toEqual({
      key: 'a',
      label: 'Alpha',
      expanded: true,
      selected: false,
      element: item,
    });
    expect(emitted.event.clientX).toBe(111);
    expect(emitted.event.clientY).toBe(222);
    expect(comp.menu.show).toHaveBeenCalledWith(111, 222, emitted.node);
  });

  it('trims label text and defaults expanded/selected to false when data attrs are absent', () => {
    const { comp, treeEl } = setup();
    const item = treeEl.querySelector<HTMLElement>('[data-key="b"]') as HTMLElement;

    contextMenuEventAt(item, 5, 6);

    expect(comp.events).toHaveLength(1);
    expect(comp.events[0].node).toEqual({
      key: 'b',
      label: 'Beta',
      expanded: false,
      selected: false,
      element: item,
    });
  });

  it('prevents default and stops propagation for a tree-item right-click', () => {
    const { treeEl } = setup();
    const item = treeEl.querySelector<HTMLElement>('[data-key="a"]') as HTMLElement;
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');
    const stopPropagation = vi.spyOn(event, 'stopPropagation');

    item.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the context menu is disabled', () => {
    const { comp, fixture, treeEl } = setup();
    comp.disabled.set(true);
    fixture.detectChanges();
    const item = treeEl.querySelector<HTMLElement>('[data-key="a"]') as HTMLElement;

    contextMenuEventAt(item, 1, 2);

    expect(comp.events).toHaveLength(0);
    expect(comp.menu.show).not.toHaveBeenCalled();
  });

  it('defaults label to empty string when the tree item has no tree-label child', () => {
    const { comp, treeEl } = setup();
    const item = treeEl.querySelector<HTMLElement>('[data-key="c"]') as HTMLElement;

    contextMenuEventAt(item, 3, 4);

    expect(comp.events).toHaveLength(1);
    expect(comp.events[0].node).toEqual({
      key: 'c',
      label: '',
      expanded: false,
      selected: false,
      element: item,
    });
  });

  it('still emits the node event but skips opening when the context menu is falsy', () => {
    TestBed.configureTestingModule({ imports: [NoMenuHostComponent] });
    const fixture = TestBed.createComponent(NoMenuHostComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    const treeEl = fixture.debugElement.query(By.directive(TreeContextMenuDirective))
      .nativeElement as HTMLElement;
    const item = treeEl.querySelector<HTMLElement>('[data-key="a"]') as HTMLElement;

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
    const { comp, fixture, treeEl } = setup();
    const item = treeEl.querySelector<HTMLElement>('[data-key="a"]') as HTMLElement;

    fixture.destroy();
    contextMenuEventAt(item, 1, 2);

    expect(comp.events).toHaveLength(0);
    expect(comp.menu.show).not.toHaveBeenCalled();
  });
});
