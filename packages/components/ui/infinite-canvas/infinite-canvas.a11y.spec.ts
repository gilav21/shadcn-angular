import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import axe from 'axe-core';
import { InfiniteCanvasComponent } from './infinite-canvas.component';
import { InfiniteCanvasItemDirective } from './infinite-canvas-item.directive';
import type { CanvasEdge, CanvasItem } from './infinite-canvas.types';

/**
 * T-15 — axe clean.
 *
 * The project's canonical axe gate is `npm run test-storybook:a11y`. That gate
 * CANNOT run from inside `.claude/worktrees/*` on Windows: the runner builds its
 * `testMatch` from an absolute rootDir, and the backslash in
 * `shadcn-angular\.claude` is consumed as a glob escape, so the path separator is
 * lost and the pattern matches nothing. Measured: 3417 files checked, 0 matches,
 * against 127 real `*.stories.ts` files — the runner then exits 1 with
 * "No tests found" without asserting anything.
 *
 * So T-15 is asserted here instead, against the same axe-core the Storybook
 * runner uses (axe-playwright wraps this exact package) and with the same
 * unweakened default ruleset — no `runOnly`, no disabled rules. Scoped to the
 * canvas root, mirroring the runner's `#storybook-root` scope.
 */

interface DemoNode extends CanvasItem {
  label: string;
}

const NODES: DemoNode[] = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  x: (i % 4) * 200,
  y: Math.floor(i / 4) * 140,
  width: 160,
  height: 90,
  label: `Node ${i + 1}`,
}));

const EDGES: CanvasEdge[] = [
  { id: 'a', source: 0, target: 1 },
  { id: 'b', source: 1, target: 5, dash: [4, 4] },
];

@Component({
  standalone: true,
  imports: [InfiniteCanvasComponent, InfiniteCanvasItemDirective],
  template: `
    <ui-infinite-canvas
      class="h-[400px] w-[600px]"
      [items]="items()"
      [edges]="edges()"
      ariaLabel="Diagram canvas"
    >
      <ng-template uiInfiniteCanvasItem [ofType]="items()" let-item>
        <div class="rounded border bg-white p-2 text-xs text-black">{{ item.label }}</div>
      </ng-template>
    </ui-infinite-canvas>
  `,
})
class A11yHostComponent {
  readonly items = signal<DemoNode[]>(NODES);
  readonly edges = signal<CanvasEdge[]>(EDGES);
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/** Runs axe over the canvas root and returns a readable violation list. */
async function audit(root: HTMLElement): Promise<string[]> {
  const results = await axe.run(root, { resultTypes: ['violations'] });
  return results.violations.map(
    v => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.map(n => n.target.join(' ')).join(' | ')}`,
  );
}

describe('InfiniteCanvasComponent accessibility (T-15)', () => {
  let fixture: ComponentFixture<A11yHostComponent>;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [A11yHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(A11yHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    root = fixture.nativeElement.querySelector('[data-slot="infinite-canvas"]') as HTMLElement;
    await nextFrame();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('has no axe violations with items and edges rendered', async () => {
    expect(await audit(root)).toEqual([]);
  });

  it('has no axe violations when empty', async () => {
    fixture.componentInstance.items.set([]);
    fixture.componentInstance.edges.set([]);
    fixture.detectChanges();
    await fixture.whenStable();
    await nextFrame();

    expect(await audit(root)).toEqual([]);
  });

  it('has no axe violations in an RTL container', async () => {
    fixture.nativeElement.setAttribute('dir', 'rtl');
    fixture.detectChanges();
    await nextFrame();

    expect(await audit(root)).toEqual([]);
  });

  it('exposes the canvas as a named landmark region without needing a role attribute', () => {
    expect(root.tagName).toBe('SECTION');
    expect(root.getAttribute('aria-label')).toBe('Diagram canvas');
    expect(root.hasAttribute('role')).toBe(false);
  });

  it('keeps the decorative edge canvas out of the accessibility tree', () => {
    const edgeCanvas = root.querySelector('[data-slot="canvas-edges"]') as HTMLElement;
    expect(edgeCanvas.hasAttribute('aria-hidden')).toBe(false);
    expect(edgeCanvas.hasAttribute('role')).toBe(false);
    expect(edgeCanvas.childElementCount).toBe(0);
  });
});
