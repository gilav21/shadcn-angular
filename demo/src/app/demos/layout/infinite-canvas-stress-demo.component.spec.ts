// The stress demo, and the one thing about it that is not cosmetic.
//
// The graph is built off the interaction that asked for it, so the "building"
// state can paint first. The FIRST version deferred that to an animation
// frame, and a hidden tab does not run animation frames — so switching tabs
// mid-build left the page with every control disabled, no graph, and nothing
// in the console to explain it. These pin the behaviour that replaced it.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { InfiniteCanvasStressDemoComponent } from './infinite-canvas-stress-demo.component';

describe('InfiniteCanvasStressDemoComponent', () => {
  let fixture: ComponentFixture<InfiniteCanvasStressDemoComponent>;

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [InfiniteCanvasStressDemoComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(InfiniteCanvasStressDemoComponent);
    fixture.detectChanges();
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  /** The scale buttons, which are disabled for as long as a build is pending. */
  function scaleButtons(): HTMLButtonElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].filter(button =>
      /^[\d,.\s]+$/.test(button.textContent?.trim() ?? ''),
    ) as HTMLButtonElement[];
  }

  /*
   * The regression test for the hidden-tab bug.
   *
   * Only the TIMER functions are faked, deliberately: vitest's fake timers
   * also fake `requestAnimationFrame` by default, so advancing them would run
   * animation frames too and the test would pass whichever the build used —
   * which it did, until this was narrowed. Leaving rAF real and never awaiting
   * one is what makes this a hidden tab: if the build moves back onto an
   * animation frame the graph stays empty here and the controls stay disabled.
   */
  it('finishes the build without an animation frame ever running', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await setup();

    vi.runOnlyPendingTimers();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('1,000');
    expect(scaleButtons().every(button => !button.disabled)).toBe(true);
  });

  it('leaves no control disabled once a build has settled', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await setup();
    vi.runOnlyPendingTimers();
    fixture.detectChanges();

    /*
     * Stop is exempt, and only Stop: it is disabled while nothing is running,
     * which is the point of it. Everything else disabled after a build has
     * settled is a control the build forgot to release — the failure this
     * guards, which left every button dead when a hidden tab stalled the
     * deferred build.
     */
    const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
    const stop = buttons.find(button => button.textContent?.trim() === 'Stop');
    const stuck = buttons.filter(
      button => button !== stop && (button as HTMLButtonElement).disabled,
    );

    expect(stuck).toEqual([]);
    expect((stop as HTMLButtonElement | undefined)?.disabled).toBe(true);
  });

  /** A build that has settled, with real timers back so a run can actually elapse. */
  async function setupBuiltWithRealTimers(): Promise<{
    run(): Promise<void>;
    stop(): void;
    settled: () => number;
    evaluating: () => boolean;
    editorRef: () => { runtime: { sliceMs: number; onNodeSettled: ((event: unknown) => void) | null } } | undefined;
  }> {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await setup();
    vi.runOnlyPendingTimers();
    fixture.detectChanges();
    vi.useRealTimers();
    return fixture.componentInstance as never;
  }

  it('lights the nodes it runs while running, then counts what settled once stopped', async () => {
    /*
     * The page's whole point is watching the wave move, and a Run button
     * without a Stop is a page you can only escape by leaving it, because real
     * computes make a large run last seconds. The editor lights a node from its
     * OWN settle handler, so measuring the run by assigning over that handler
     * turns the flow effect off entirely — what shipped once.
     *
     * Sampled WHILE it runs, the only time there is anything to see: the
     * highlight lasts under a second, so after the run the first cards to
     * settle have long gone dark. Stopped rather than run to the end because a
     * run is pinned to seconds of real compute at every size, and the `finally`
     * that counts and releases the controls is the same on both paths.
     */
    const demo = await setupBuiltWithRealTimers();

    const running = demo.run();
    await new Promise(resolve => setTimeout(resolve, 300));
    fixture.detectChanges();
    const lit = (fixture.nativeElement as HTMLElement).querySelectorAll('[data-ran="true"]');
    expect(lit.length).toBeGreaterThan(0);

    demo.stop();
    await running;

    expect(demo.evaluating()).toBe(false);
    expect(demo.settled()).toBeGreaterThan(0);
  });

  it('counts the nodes of a run that never yields', async () => {
    /*
     * The final slice has no gap after it, so anything counted there is
     * published only by the flush at the end of the run. A run that never
     * yields is entirely that case — and with the flush removed, it reports
     * zero while having evaluated everything.
     *
     * Cut short from inside the run by a handler chained behind the demo's own,
     * because with no yield point a timer can never fire to stop it.
     */
    const demo = await setupBuiltWithRealTimers();

    // A budget nothing here can spend, so the drain never pauses.
    const runtime = demo.editorRef()?.runtime;
    expect(runtime).toBeDefined();
    if (!runtime) return;
    runtime.sliceMs = 600_000;

    const running = demo.run();
    const demosOwn = runtime.onNodeSettled;
    let seen = 0;
    runtime.onNodeSettled = event => {
      demosOwn?.(event);
      if (++seen === 25) demo.stop();
    };
    await running;

    expect(demo.settled()).toBeGreaterThanOrEqual(25);
  });

  it('reports a graph whose connection and zone counts match its node count', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await setup();
    vi.runOnlyPendingTimers();
    fixture.detectChanges();

    const values = [...(fixture.nativeElement as HTMLElement).querySelectorAll('dd')].map(dd =>
      dd.textContent?.trim(),
    );
    // 40 databases: 1,000 nodes, 960 connections, 40 zones. The demo is worth
    // nothing if the load it claims to apply is not the load it builds.
    expect(values[0]).toBe('1,000');
    expect(values[1]).toBe('960');
    expect(values[2]).toBe('40');
  });
});
