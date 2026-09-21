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
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NodeEditorComponent } from './node-editor.component';
import { NodeEditorNodeDirective } from './node-editor-node.directive';
import { POINTER_METRICS, portListTop } from './node-editor.layout';
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
    const editor = fixture.debugElement.query(
      By.directive(NodeEditorComponent),
    ).componentInstance as NodeEditorComponent;
    const measured = () =>
      (editor as unknown as { measuredBodies: () => ReadonlyMap<unknown, number> })
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
    const editor = fixture.debugElement.query(
      By.directive(NodeEditorComponent),
    ).componentInstance as NodeEditorComponent;
    const node = editor.renderedNodes().find(candidate => candidate.id === 'a') as EditorNode;
    const floor = portListTop(node) + POINTER_METRICS.rowHeight + 8 + 120;
    expect(node.height).toBeGreaterThanOrEqual(floor - 1);
  });
});
