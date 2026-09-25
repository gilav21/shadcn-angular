// Two bugs in the node card's vertical layout, reported from a consumer
// building on the addon (docs/upstream/node-editor-node-body.md in that repo).
//
//   1. a node with a SUBTITLE drew its ports NODE_SUBTITLE_HEIGHT too low,
//      because the card restated the header's height instead of deriving it
//      from `portListTop`. The two expressions agree when there is no
//      subtitle, so only a fixture WITH one can fail.
//
//   2. a body projected through `*uiNodeEditorNode` was sized as zero and
//      spilled out of the card, because the editor supplied a flat `0` for
//      any node without a `type` — overriding whatever the consumer had
//      computed.
//
// Everything here asserts RENDERED geometry, never class names: a card can
// carry every intended class and still lay out wrong, which is how both of
// these shipped.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { InfiniteCanvasComponent } from '../..';
import { NodeEditorComponent } from './node-editor.component';
import { NodeEditorNodeDirective } from './node-editor-node.directive';
import {
  POINTER_METRICS,
  TOUCH_METRICS,
  portListTop,
  portRowsHeight,
} from './node-editor.layout';
import type { EditorNode } from './node-editor.types';

/** Height of one row in the projected body, and how many there are. */
const ROW_HEIGHT = 20;
const ROW_COUNT = 6;

@Component({
  standalone: true,
  imports: [NodeEditorComponent, NodeEditorNodeDirective],
  template: `
    <ui-node-editor class="h-[520px] w-[520px]" [(nodes)]="nodes">
      <ng-template uiNodeEditorNode let-node>
        <div data-testid="body" class="flex flex-col">
          @for (row of rows(); track row) {
            <div
              data-testid="row"
              class="text-xs"
              [style.height.px]="rowHeight"
              [style.line-height.px]="rowHeight"
            >
              {{ node.title }} · {{ row }}
            </div>
          }
        </div>
      </ng-template>
    </ui-node-editor>
  `,
})
class HostComponent {
  readonly rowHeight = ROW_HEIGHT;
  readonly rows = signal<readonly string[]>(
    Array.from({ length: ROW_COUNT }, (_, i) => 'row ' + i),
  );
  readonly nodes = signal<readonly EditorNode[]>([
    {
      id: 'a',
      x: 40,
      y: 40,
      width: 230,
      height: 0,
      title: 'survey-results-2026-08-30',
      subtitle: '1 rows · 21 columns',
      ports: [
        { id: 'in', direction: 'in', label: 'Connect' },
        { id: 'out', direction: 'out', label: 'Connect' },
      ],
    },
  ]);
}

function nextFrame(): Promise<void> {
  return new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

describe('the node card fits its subtitle and its projected body', () => {
  let fixture: ComponentFixture<HostComponent>;
  let root: HTMLElement;

  /**
   * Two frames, twice.
   *
   * The body's height is MEASURED, so it settles over a round trip: the card
   * renders, the observer reports, the editor resizes the node, the card
   * re-renders at its new height. One pass would catch the card mid-settle.
   */
  async function settle(): Promise<void> {
    for (let i = 0; i < 2; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await nextFrame();
    }
    fixture.detectChanges();
  }

  function one<T extends HTMLElement>(selector: string): T {
    const el = root.querySelector<T>(selector);
    if (!el) throw new Error('missing ' + selector);
    return el;
  }

  function editor(): NodeEditorComponent {
    return fixture.debugElement.query(By.directive(NodeEditorComponent))
      .componentInstance as NodeEditorComponent;
  }

  function renderedHeight(id: string): number {
    const node = editor().renderedNodes().find(candidate => candidate.id === id);
    if (!node) throw new Error('no rendered node ' + id);
    return node.height;
  }

  function canvas(): InfiniteCanvasComponent {
    return fixture.debugElement.query(By.directive(InfiniteCanvasComponent))
      .componentInstance as InfiniteCanvasComponent;
  }

  function zoomTo(zoom: number): void {
    canvas().zoomTo(zoom);
  }

  /** A rect measured relative to the node card's own top edge. */
  function relativeTo(card: DOMRect, el: HTMLElement): { top: number; bottom: number } {
    const rect = el.getBoundingClientRect();
    return { top: rect.top - card.top, bottom: rect.bottom - card.top };
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    root = fixture.nativeElement as HTMLElement;
    document.body.appendChild(root);
    await settle();
  });

  afterEach(() => {
    root.remove();
    fixture.destroy();
  });

  it('draws a port inside the band reserved for it, on a node WITH a subtitle', () => {
    const node = fixture.componentInstance.nodes()[0];
    expect(node.subtitle, 'the fixture must have a subtitle or it cannot fail').toBeTruthy();

    const card = one('[data-slot="node-editor-node"]').getBoundingClientRect();
    const port = relativeTo(card, one<HTMLElement>('[data-slot="node-editor-port"][data-port="in"]'));
    const band = relativeTo(card, one<HTMLElement>('[data-slot="node-editor-port-band"]'));

    // Deliberately NOT compared against `portOffsetTop`: the dot is POSITIONED
    // from that function, so asserting it against the same function passes
    // however wrong the card around it is. The bug was the header and the band
    // disagreeing with the geometry, which only a cross-check against the
    // RENDERED band can see.
    expect(port.top).toBeGreaterThanOrEqual(band.top - 1);
    expect(port.bottom).toBeLessThanOrEqual(band.bottom + 1);
  });

  it('ends the header where the port band begins', () => {
    const node = fixture.componentInstance.nodes()[0];
    const card = one('[data-slot="node-editor-node"]').getBoundingClientRect();
    const header = relativeTo(card, one<HTMLElement>('[data-slot="node-editor-node-header"]'));

    // The header and the ports are laid out by different systems — flow and
    // absolute positioning — from the same rule. This is that rule.
    expect(Math.abs(header.bottom - (portListTop(node) - 8))).toBeLessThanOrEqual(1);
  });

  it('keeps the ports clear of the body', () => {
    const card = one('[data-slot="node-editor-node"]').getBoundingClientRect();
    const port = relativeTo(card, one<HTMLElement>('[data-slot="node-editor-port"][data-port="in"]'));
    const body = relativeTo(card, one<HTMLElement>('[data-testid="body"]'));

    // The symptom as reported: the port landed on the body's first row.
    expect(port.bottom).toBeLessThanOrEqual(body.top + 1);
  });

  it('grows the card to fit a projected body it never declared a height for', () => {
    const card = one<HTMLElement>('[data-slot="node-editor-node"]');
    const rect = card.getBoundingClientRect();
    const body = one<HTMLElement>('[data-testid="body"]');

    expect(body.getBoundingClientRect().height).toBeGreaterThanOrEqual(ROW_HEIGHT * ROW_COUNT);
    // Nothing hangs out of the card: the reported card was 96px around 193px
    // of content, spilling the difference over the canvas.
    expect(card.scrollHeight).toBeLessThanOrEqual(Math.ceil(rect.height) + 1);
    expect(relativeTo(rect, body).bottom).toBeLessThanOrEqual(rect.height + 1);
  });

  it('grows again when the body does', async () => {
    const before = one('[data-slot="node-editor-node"]').getBoundingClientRect().height;

    fixture.componentInstance.rows.update(rows => [...rows, 'row 6', 'row 7']);
    await settle();

    const after = one<HTMLElement>('[data-slot="node-editor-node"]');
    const rect = after.getBoundingClientRect();
    // A declared height cannot do this — it is the same number after the
    // content changed. Only a measured one follows the content.
    expect(rect.height).toBeGreaterThanOrEqual(before + ROW_HEIGHT * 2 - 1);
    expect(after.scrollHeight).toBeLessThanOrEqual(Math.ceil(rect.height) + 1);
  });

  it('forgets the measured height of a deleted node', async () => {
    const measured = () =>
      (editor() as unknown as { measuredBodies: () => ReadonlyMap<unknown, number> })
        .measuredBodies();

    expect(measured().has('a')).toBe(true);

    // Delete it, then add a DIFFERENT node so a measurement arrives and the
    // prune has something to run on.
    fixture.componentInstance.nodes.set([
      {
        id: 'b',
        x: 40,
        y: 40,
        width: 200,
        height: 0,
        title: 'replacement',
        ports: [{ id: 'in', direction: 'in', label: 'In' }],
      },
    ]);
    await settle();

    // Otherwise a long session keeps one entry per node it has ever rendered.
    expect(measured().has('a')).toBe(false);
    // And the replacement was measured, on what is the SAME card: the pool
    // releases a's view before mounting b, and b's body is exactly as tall as
    // a's was, so a report keyed to the old id would leave b unmeasured.
    expect(measured().get('b')).toBe(ROW_HEIGHT * ROW_COUNT);
  });

  /*
   * Every other test here runs at zoom 1 — the one zoom where a height read
   * off the screen equals the height in the world, so a measurement taken
   * through the canvas's `scale()` passes them all. It shipped that way: the
   * first time a node changed while zoomed, its body was re-measured at its
   * ON-SCREEN size, and the card became twice as tall at 200% and half as tall
   * at 50%, with the body spilling out of it again.
   */
  for (const zoom of [2, 0.5]) {
    it(`keeps a body at its world height while a node is dragged at ${zoom * 100}% zoom`, async () => {
      const atRest = renderedHeight('a');

      zoomTo(zoom);
      await settle();
      // A drag replaces the node object every frame; any edit does the same.
      for (let step = 0; step < 3; step++) {
        fixture.componentInstance.nodes.update(nodes =>
          nodes.map(node => ({ ...node, x: node.x + 10 })),
        );
        await settle();
        expect(renderedHeight('a')).toBe(atRest);
      }
    });

    it(`measures a node that first appears at ${zoom * 100}% zoom in world units`, async () => {
      const atRest = renderedHeight('a');

      zoomTo(zoom);
      await settle();
      // What scrolling a zoomed-out graph does: a card mounts for a node that
      // has never been measured, with the scale already applied.
      fixture.componentInstance.nodes.update(nodes => [
        ...nodes,
        { ...nodes[0], id: 'late', x: nodes[0].x + 20, y: nodes[0].y + 20 },
      ]);
      await settle();

      expect(renderedHeight('late')).toBe(atRest);
    });
  }

  it('keeps a node its height while it is scrolled out of view', async () => {
    const atRest = renderedHeight('a');

    // Far enough that the node is culled and its card goes back to the pool.
    canvas().panTo({ x: 20_000, y: 20_000 });
    await settle();
    expect(root.querySelector('[data-slot="node-editor-node"][data-node="a"]')).toBeNull();

    // A pooled card is detached, not destroyed, and a detached element measures
    // 0 x 0. An observer still watching it reported a body of 0 for the node
    // that just left, shrinking its world box for everything that reads it
    // off screen: culling, fit-view, the minimap, auto-layout.
    expect(renderedHeight('a')).toBe(atRest);

    // And back: the card comes out of the pool re-attached, and must still be
    // measured — the ignored zero is what makes its return a resize.
    fixture.componentInstance.rows.update(rows => [...rows, 'row 6']);
    canvas().panTo({ x: 150, y: 150 });
    await settle();
    expect(root.querySelector('[data-slot="node-editor-node"][data-node="a"]')).not.toBeNull();
    expect(renderedHeight('a')).toBe(atRest + ROW_HEIGHT);
  });

  it('honours a declared bodyHeight when there is no body to measure', async () => {
    // The declared value is the first-frame floor, and the only height a node
    // has when its body renders nothing. Before the fix this was a flat 0 for
    // every node without a `type`, which is what made a projected body
    // unusable: the consumer's own number was overridden on the way in.
    fixture.componentInstance.rows.set([]);
    fixture.componentInstance.nodes.update(nodes =>
      nodes.map(node => ({ ...node, bodyHeight: 120 })),
    );
    await settle();

    // `renderedNodes`, not the authored input: the editor derives the height
    // and does not write it back to the consumer's signal.
    const node = editor().renderedNodes().find(candidate => candidate.id === 'a') as EditorNode;
    const floor = portListTop(node) + POINTER_METRICS.rowHeight + 8 + 120;
    expect(node.height).toBeGreaterThanOrEqual(floor - 1);
  });
});

/*
 * Shared by the suites below, which each need a fixture built under a
 * condition the default one cannot provide: a browser global replaced BEFORE
 * the editor exists, because the editor reads it once, on creation.
 */
async function mountHost(): Promise<ComponentFixture<HostComponent>> {
  await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  document.body.appendChild(fixture.nativeElement as HTMLElement);
  for (let i = 0; i < 2; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
    await nextFrame();
  }
  fixture.detectChanges();
  return fixture;
}

function rectOf(fixture: ComponentFixture<HostComponent>, selector: string): DOMRect {
  const el = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);
  if (!el) throw new Error('missing ' + selector);
  return el.getBoundingClientRect();
}

function editorOf(fixture: ComponentFixture<HostComponent>): NodeEditorComponent {
  return fixture.debugElement.query(By.directive(NodeEditorComponent))
    .componentInstance as NodeEditorComponent;
}

describe('a card is drawn at its content height before the measurement lands', () => {
  /*
   * The node's box learns the body's height from a ResizeObserver, whose
   * report arrives a frame after the card mounts. A card that FILLED its box
   * was drawn that frame short, with the body hanging out of it.
   *
   * "Before the report" is one frame and cannot be caught reliably, so the
   * observer is replaced with one that never reports: the box then never
   * learns the height at all, and only a card sized by its own content can
   * still contain the body.
   */
  const RealObserver = globalThis.ResizeObserver;
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    globalThis.ResizeObserver = class {
      observe(): void {
        // Never reports: this is the state of the frame before a real report.
      }
      unobserve(): void {
        // Nothing to stop.
      }
      disconnect(): void {
        // Nothing to stop.
      }
    } as unknown as typeof ResizeObserver;
    fixture = await mountHost();
  });

  afterEach(() => {
    globalThis.ResizeObserver = RealObserver;
    (fixture.nativeElement as HTMLElement).remove();
    fixture.destroy();
  });

  it('contains its body although the box never learned the body height', () => {
    const card = rectOf(fixture, '[data-slot="node-editor-node"]');
    const body = rectOf(fixture, '[data-testid="body"]');

    // The premise: the box really is short, or this proves nothing.
    expect(editorOf(fixture).renderedNodes()[0].height).toBeLessThan(body.bottom - card.top);

    expect(body.bottom).toBeLessThanOrEqual(card.bottom + 1);
  });
});

describe('touch-sized port rows with a subtitle', () => {
  /*
   * On a coarse pointer every port row is 44px, and the header still has to
   * end where the rows begin. The header height and the row height come from
   * different inputs, so the pointer-sized fixture above cannot show that the
   * two compose.
   */
  const realMatchMedia = globalThis.matchMedia;
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    globalThis.matchMedia = ((query: string): MediaQueryList => {
      if (query !== '(pointer: coarse)') return realMatchMedia.call(globalThis, query);
      // `matches` is a getter on the real list, so a stand-in is the only way
      // to answer yes; nothing here listens for changes.
      return {
        matches: true,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      } as MediaQueryList;
    }) as typeof matchMedia;
    fixture = await mountHost();
  });

  afterEach(() => {
    globalThis.matchMedia = realMatchMedia;
    (fixture.nativeElement as HTMLElement).remove();
    fixture.destroy();
  });

  it('keeps each port inside its band, below the header', () => {
    const node = fixture.componentInstance.nodes()[0];
    const card = rectOf(fixture, '[data-slot="node-editor-node"]');
    const header = rectOf(fixture, '[data-slot="node-editor-node-header"]');
    const band = rectOf(fixture, '[data-slot="node-editor-port-band"]');
    const port = rectOf(fixture, '[data-slot="node-editor-port"][data-port="in"]');

    // The premise: touch rows really are in force, or this is the pointer
    // test again under another name.
    expect(band.height).toBeCloseTo(portRowsHeight(node, TOUCH_METRICS), 0);

    expect(Math.abs(header.bottom - card.top - (portListTop(node) - 8))).toBeLessThanOrEqual(1);
    expect(port.top).toBeGreaterThanOrEqual(band.top - 1);
    expect(port.bottom).toBeLessThanOrEqual(band.bottom + 1);
  });
});

describe('measuring stays off the per-frame path', () => {
  /*
   * Every mounted card with a body owns an observer, and each report can write
   * the editor's height map, which re-derives every node's height and
   * re-renders the canvas. That is only affordable while a report that
   * changes nothing writes nothing; otherwise panning a board of such nodes
   * turns every recycled card into a full re-render.
   *
   * Asserted as a count, never a time: pan the whole board once so every node
   * is measured, then take the same route again. The second pass re-attaches
   * recycled cards, and every one of them reports; none of those reports may
   * write.
   */
  let fixture: ComponentFixture<HostComponent>;

  const COLUMNS = 20;
  const board = (): EditorNode[] =>
    Array.from({ length: 300 }, (_, i) => ({
      id: 'n' + i,
      x: (i % COLUMNS) * 300,
      y: Math.floor(i / COLUMNS) * 300,
      width: 230,
      height: 0,
      title: 'n' + i,
      ports: [{ id: 'in', direction: 'in' as const, label: 'In' }],
    }));

  beforeEach(async () => {
    fixture = await mountHost();
    fixture.componentInstance.nodes.set(board());
    fixture.detectChanges();
    await fixture.whenStable();
    await nextFrame();
  });

  afterEach(() => {
    (fixture.nativeElement as HTMLElement).remove();
    fixture.destroy();
  });

  it('writes nothing when a pan revisits bodies it already measured', async () => {
    const canvas = fixture.debugElement.query(By.directive(InfiniteCanvasComponent))
      .componentInstance as InfiniteCanvasComponent;
    const heights = (editorOf(fixture) as unknown as {
      measuredBodies: { set: (value: unknown) => void } & (() => ReadonlyMap<unknown, number>);
    }).measuredBodies;
    const writes = vi.spyOn(heights, 'set');

    const route = [
      { x: 0, y: 0 },
      { x: 2400, y: 0 },
      { x: 5700, y: 0 },
      { x: 5700, y: 2100 },
      { x: 2400, y: 4200 },
      { x: 0, y: 4200 },
      { x: 0, y: 0 },
    ];
    const travel = async (): Promise<void> => {
      for (const point of route) {
        canvas.panTo(point);
        for (let i = 0; i < 2; i++) {
          fixture.detectChanges();
          await fixture.whenStable();
          await nextFrame();
        }
      }
    };

    await travel();
    // The premise: the first pass measured, and measured more nodes than are
    // ever mounted at once, so the second pass runs on recycled cards.
    const mountedAtOnce = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '[data-slot="node-editor-node"]',
    ).length;
    expect(writes.mock.calls.length).toBeGreaterThan(0);
    expect(heights().size).toBeGreaterThan(mountedAtOnce);

    writes.mockClear();
    await travel();

    expect(writes).not.toHaveBeenCalled();
    writes.mockRestore();
  }, 60_000);
});
