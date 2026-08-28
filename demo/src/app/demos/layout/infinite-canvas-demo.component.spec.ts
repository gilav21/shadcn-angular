// The combined Infinite Canvas demo — the run-history wiring specifically.
//
// The recording handlers are bound on `<ui-node-editor>`, which sits OUTSIDE
// the `@if` that renders the History panel. So switching the addon off hid the
// list and went on recording behind it: every run serialised the whole graph
// into a store the user could no longer see, and the store keeps the last
// twenty-five of those. On a large board that is twenty-five deep copies of
// every node and connection, pinned, with the Clear button hidden behind the
// same toggle that hid the list.
//
// A feature that is switched off has to cost nothing, including memory.
import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { InfiniteCanvasDemoComponent } from './infinite-canvas-demo.component';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import type {
  RunFinishedEvent,
  RunStartedEvent,
} from '../../../../../packages/components/ui/infinite-canvas/addons/node-editor';

/** Reaches the protected members the template binds to. */
interface DemoInternals {
  addons: ReturnType<typeof signal<Record<string, boolean>>>;
  history: { runs: () => readonly unknown[]; openCount: number };
  onRunStarted(event: RunStartedEvent): void;
  onRunFinished(event: RunFinishedEvent): void;
}

describe('InfiniteCanvasDemoComponent — run history is only recorded when asked for', () => {
  let fixture: ComponentFixture<InfiniteCanvasDemoComponent>;
  let demo: DemoInternals;

  const started: RunStartedEvent = { runId: 1, startedAt: 0, nodes: [] };
  const finished: RunFinishedEvent = {
    runId: 1,
    startedAt: 0,
    durationMs: 1,
    nodes: [],
    status: 'done',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InfiniteCanvasDemoComponent],
      providers: [{ provide: UI_LOCALE_ID, useValue: signal('en') }],
    }).compileComponents();

    fixture = TestBed.createComponent(InfiniteCanvasDemoComponent);
    fixture.detectChanges();
    demo = fixture.componentInstance as unknown as DemoInternals;
  });

  function setHistory(on: boolean): void {
    demo.addons.update(current => ({ ...current, history: on }));
    fixture.detectChanges();
  }

  it('records a run while the addon is on', () => {
    setHistory(true);
    demo.onRunStarted(started);
    demo.onRunFinished(finished);

    expect(demo.history.runs()).toHaveLength(1);
  });

  it('records nothing while the addon is off', () => {
    setHistory(false);
    demo.onRunStarted(started);
    demo.onRunFinished(finished);

    expect(demo.history.runs()).toEqual([]);
    /*
     * And took no snapshot on the way. Asserting only on `runs` would pass
     * with the guard on the START handler removed, because the guard on the
     * FINISH handler alone is enough to keep the list empty — while `begin`
     * went on serialising the whole graph and leaving it in the open-run map.
     * The expensive half of the work is the half that would not have shown.
     */
    expect(demo.history.openCount).toBe(0);
  });

  it('gives back what it recorded when the addon is switched off', () => {
    setHistory(true);
    demo.onRunStarted(started);
    demo.onRunFinished(finished);
    expect(demo.history.runs()).toHaveLength(1);

    setHistory(false);

    // Not merely hidden — released. The Clear button went away with the panel.
    expect(demo.history.runs()).toEqual([]);
  });
});
