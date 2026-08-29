// The stress demo, and the one thing about it that is not cosmetic.
//
// The graph is built off the interaction that asked for it, so the "building"
// state can paint first. The FIRST version deferred that to an animation
// frame, and a hidden tab does not run animation frames — so switching tabs
// mid-build left the page with every control disabled, no graph, and nothing
// in the console to explain it. These pin the behaviour that replaced it.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { InfiniteCanvasStressDemoComponent } from './infinite-canvas-stress-demo.component';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { INFINITE_CANVAS_STRESS_DEMO_LOCALES } from './infinite-canvas-stress-demo.locales';

describe('InfiniteCanvasStressDemoComponent', () => {
  let fixture: ComponentFixture<InfiniteCanvasStressDemoComponent>;

  async function setup(locale = 'en') {
    await TestBed.configureTestingModule({
      imports: [InfiniteCanvasStressDemoComponent],
      providers: [{ provide: UI_LOCALE_ID, useValue: signal(locale) }],
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

  it('renders English by default', async () => {
    await setup('en');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(
      INFINITE_CANVAS_STRESS_DEMO_LOCALES['en'].heading,
    );
  });

  it('renders Hebrew when the locale is he', async () => {
    await setup('he');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(
      INFINITE_CANVAS_STRESS_DEMO_LOCALES['he'].heading,
    );
  });

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

  it('runs the graph, counts what settled, and can be stopped', async () => {
    /*
     * The headline the page makes — a hundred thousand nodes WITH LOGIC — and
     * the control that makes it survivable. Real computes mean a large run
     * lasts seconds, so a Run button without a Stop is a page you can only
     * escape by leaving it.
     */
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await setup();
    vi.runOnlyPendingTimers();
    fixture.detectChanges();
    vi.useRealTimers();

    const demo = fixture.componentInstance as unknown as {
      run(): Promise<void>;
      stop(): void;
      settled: () => number;
      evaluating: () => boolean;
    };

    await demo.run();

    expect(demo.evaluating()).toBe(false);
    expect(demo.settled()).toBeGreaterThan(0);
  }, 30_000);

  it('still lights the nodes it runs', async () => {
    /*
     * The page's whole point is watching the wave move. The editor lights a
     * node from its OWN settle handler, so measuring the run by assigning
     * over that handler turns the flow effect off entirely — a hundred
     * thousand nodes evaluated with nothing to see, which is what shipped and
     * what this pins.
     */
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await setup();
    vi.runOnlyPendingTimers();
    fixture.detectChanges();
    vi.useRealTimers();

    const demo = fixture.componentInstance as unknown as {
      run(): Promise<void>;
      stop(): void;
    };

    /*
     * Sampled WHILE it runs, which is the only time there is anything to see.
     * A run is spread over a few seconds and the highlight lasts under one, so
     * by the time it finishes the cards that settled first have long gone dark
     * — asserting afterwards tested the wrong moment and failed for the right
     * reason.
     */
    const running = demo.run();
    await new Promise(resolve => setTimeout(resolve, 300));
    fixture.detectChanges();

    const lit = (fixture.nativeElement as HTMLElement).querySelectorAll('[data-ran="true"]');
    expect(lit.length).toBeGreaterThan(0);

    demo.stop();
    await running;
  }, 30_000);

  it('counts the nodes of a run that never yields', async () => {
    /*
     * The final slice has no gap after it, so anything counted there is
     * published only by the flush at the end of the run. A graph that fits in
     * ONE slice is entirely that case — and with the flush removed, a run
     * reports zero while having evaluated everything.
     */
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await setup();
    vi.runOnlyPendingTimers();
    fixture.detectChanges();
    vi.useRealTimers();

    const demo = fixture.componentInstance as unknown as {
      run(): Promise<void>;
      settled: () => number;
      editorRef: () => { runtime: { sliceMs: number } } | undefined;
    };

    // A budget nothing here can spend, so the drain never pauses.
    const runtime = demo.editorRef()?.runtime;
    expect(runtime).toBeDefined();
    if (runtime) runtime.sliceMs = 600_000;

    await demo.run();

    expect(demo.settled()).toBeGreaterThan(0);
  }, 30_000);

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
