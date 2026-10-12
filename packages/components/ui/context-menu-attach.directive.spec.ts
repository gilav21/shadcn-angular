import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ContextMenuAttachDirective, type ContextMenuEvent } from './context-menu-attach.directive';
import { ContextMenuComponent } from './context-menu';

interface Row {
  id: number;
  label: string;
}

@Component({
  selector: 'ui-cma-host',
  standalone: true,
  imports: [ContextMenuAttachDirective],
  template: `
    <div
      [uiContextMenuAttach]="menu()!"
      [contextMenuData]="data()"
      [disabled]="disabled()"
      (contextMenuTriggered)="onTriggered($event)"
    ></div>
  `,
})
class TestHostComponent {
  readonly disabled = signal(false);
  readonly data = signal<Row>({ id: 1, label: 'Alpha' });
  readonly stubMenu = { show: vi.fn() } as unknown as ContextMenuComponent;
  readonly menu = signal<ContextMenuComponent | undefined>(this.stubMenu);
  readonly events: ContextMenuEvent<Row>[] = [];

  onTriggered(event: ContextMenuEvent<Row>): void {
    this.events.push(event);
  }
}

function setup(): {
  fixture: ComponentFixture<TestHostComponent>;
  comp: TestHostComponent;
  hostEl: HTMLElement;
} {
  TestBed.configureTestingModule({ imports: [TestHostComponent] });
  const fixture = TestBed.createComponent(TestHostComponent);
  const comp = fixture.componentInstance;
  fixture.detectChanges();
  const hostEl = fixture.debugElement.query(By.directive(ContextMenuAttachDirective))
    .nativeElement as HTMLElement;
  return { fixture, comp, hostEl };
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

/** RED until spec 8 Task 5: an expected failure under vitest, skipped where `it.fails` does not exist (the jest consumer leg). */
const redUntilTask5 = Reflect.has(it, 'fails') ? it.fails : it.skip;

/** A finger held on `target` for the long-press duration (fake timers must be installed). */
function holdFinger(target: HTMLElement, x: number, y: number): Event {
  const event = new Event('touchstart', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: [{ clientX: x, clientY: y }] });
  target.dispatchEvent(event);
  vi.advanceTimersByTime(500);
  return event;
}

/** The contextmenu Android raises after the hold, a moment later. */
function androidEcho(target: HTMLElement, x: number, y: number): MouseEvent {
  vi.advanceTimersByTime(100);
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y });
  target.dispatchEvent(event);
  return event;
}

describe('ContextMenuAttachDirective', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the menu at the cursor and emits the bound item on right-click', () => {
    const { comp, hostEl } = setup();

    const event = contextMenuEventAt(hostEl, 123, 456);

    expect(event.defaultPrevented).toBe(true);
    expect(comp.events).toHaveLength(1);
    const [emitted] = comp.events;
    expect(emitted.event).toBe(event);
    expect(emitted.item).toEqual({ id: 1, label: 'Alpha' });
    expect(emitted.index).toBeUndefined();
    expect(comp.stubMenu.show).toHaveBeenCalledTimes(1);
    expect(comp.stubMenu.show).toHaveBeenCalledWith(123, 456);
  });

  redUntilTask5('opens the menu at the finger and emits what a right-click emits on a long-press, once on Android', () => {
    vi.useFakeTimers();
    try {
      const { comp, hostEl } = setup();
      contextMenuEventAt(hostEl, 123, 456);

      const touch = holdFinger(hostEl, 123, 456);
      const echo = androidEcho(hostEl, 123, 456);

      expect(comp.events).toHaveLength(2);
      expect(comp.events[1].item).toEqual(comp.events[0].item);
      expect(comp.events[1].event).toBe(touch);
      expect(comp.stubMenu.show).toHaveBeenCalledTimes(2);
      expect(comp.stubMenu.show).toHaveBeenLastCalledWith(123, 456);
      expect(echo.defaultPrevented).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does nothing on a long-press when disabled', () => {
    vi.useFakeTimers();
    try {
      const { comp, fixture, hostEl } = setup();
      comp.disabled.set(true);
      fixture.detectChanges();

      holdFinger(hostEl, 1, 2);

      expect(comp.events).toHaveLength(0);
      expect(comp.stubMenu.show).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops propagation of the contextmenu event', () => {
    const { hostEl } = setup();
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const stopPropagation = vi.spyOn(event, 'stopPropagation');

    hostEl.dispatchEvent(event);

    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled: no preventDefault, no emit, no menu open', () => {
    const { comp, fixture, hostEl } = setup();
    comp.disabled.set(true);
    fixture.detectChanges();

    const event = contextMenuEventAt(hostEl, 1, 2);

    expect(event.defaultPrevented).toBe(false);
    expect(comp.events).toHaveLength(0);
    expect(comp.stubMenu.show).not.toHaveBeenCalled();
  });

  it('prevents default but does not emit or open a menu when none is bound', () => {
    const { comp, fixture, hostEl } = setup();
    comp.menu.set(undefined);
    fixture.detectChanges();

    const event = contextMenuEventAt(hostEl, 7, 8);

    expect(event.defaultPrevented).toBe(true);
    expect(comp.events).toHaveLength(0);
    expect(comp.stubMenu.show).not.toHaveBeenCalled();
  });

  it('reflects updated contextMenuData on subsequent right-clicks', () => {
    const { comp, fixture, hostEl } = setup();
    comp.data.set({ id: 2, label: 'Beta' });
    fixture.detectChanges();

    contextMenuEventAt(hostEl, 10, 20);

    expect(comp.events).toHaveLength(1);
    expect(comp.events[0].item).toEqual({ id: 2, label: 'Beta' });
  });
});
