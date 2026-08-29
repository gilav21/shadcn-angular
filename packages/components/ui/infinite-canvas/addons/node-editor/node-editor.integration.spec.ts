// RT-11 and RT-12 of `specs/node-editor-runtime-spec.md`.
//
// The runtime has its own tests; these prove it is actually WIRED — that a
// typed node renders its own view, that values reach that view, and that the
// motivating example works end to end:
//
//   [ text input ] --text--> [ uppercase ] --out--> [ display ]
//
// Typing streams through with no Run button, which is the whole claim.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { NodeEditorComponent } from './node-editor.component';
import {
    NODE_CONTEXT,
    type NodeContext,
    type NodeTypeDefinition,
} from './node-editor.runtime.types';
import type { EditorNode, NodeConnection } from './node-editor.types';

// ------------------------------------------------------------- node types

interface TextState { value: string }

@Component({
    selector: 'test-text-input-node',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <input data-testid="text-field" [value]="ctx.state().value" (input)="onInput($event)" />
  `,
})
class TextInputNodeComponent {
    readonly ctx = inject(NODE_CONTEXT) as NodeContext<TextState>;
    protected onInput(event: Event): void {
        this.ctx.setState({ value: (event.target as HTMLInputElement).value });
    }
}

@Component({
    selector: 'test-display-node',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<span data-testid="display">{{ shown() ?? '-' }}</span>`,
})
class DisplayNodeComponent {
    private readonly ctx = inject(NODE_CONTEXT);
    /** Reads its INPUT — this node has no compute at all. */
    protected readonly shown = computed(() => this.ctx.input<string>('value')());
}

const TEXT_INPUT: NodeTypeDefinition<TextState> = {
    id: 'text-input',
    label: 'Text input',
    accent: '#22c55e',
    ports: [{ id: 'text', direction: 'out', label: 'Text', type: 'text' }],
    initialState: () => ({ value: '' }),
    view: TextInputNodeComponent,
    compute: (_inputs, ctx) => ({ text: ctx.state.value }),
};

const UPPERCASE: NodeTypeDefinition = {
    id: 'uppercase',
    label: 'Uppercase',
    ports: [
        { id: 'in', direction: 'in', label: 'In', type: 'text' },
        { id: 'out', direction: 'out', label: 'Out', type: 'text' },
    ],
    compute: inputs => ({ out: String(inputs['in'] ?? '').toUpperCase() }),
};

const DISPLAY: NodeTypeDefinition = {
    id: 'display',
    label: 'Display',
    ports: [{ id: 'value', direction: 'in', label: 'Value', type: 'text', required: true }],
    view: DisplayNodeComponent,
};

// ------------------------------------------------------------------- host

@Component({
    standalone: true,
    imports: [NodeEditorComponent],
    template: `
    <ui-node-editor
      class="h-[500px] w-[400px]"
      [(nodes)]="nodes"
      [(connections)]="connections"
      [definitions]="definitions"
      [live]="live()"
    />
  `,
})
class HostComponent {
    readonly definitions = [TEXT_INPUT, UPPERCASE, DISPLAY];
    readonly live = signal(true);
    /** Authored with NO title and NO ports — both come from the definition. */
    readonly nodes = signal<readonly EditorNode[]>([
        { id: 't', type: 'text-input', x: 10, y: 0, width: 170, height: 0 },
        { id: 'u', type: 'uppercase', x: 10, y: 140, width: 170, height: 0 },
        { id: 'd', type: 'display', x: 10, y: 280, width: 170, height: 0 },
    ]);
    readonly connections = signal<readonly NodeConnection[]>([
        { id: 'c1', source: 't', sourcePort: 'text', target: 'u', targetPort: 'in' },
        { id: 'c2', source: 'u', sourcePort: 'out', target: 'd', targetPort: 'value' },
    ]);
}

function nextFrame(): Promise<void> {
    return new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
}

/**
 * One harness for all three suites.
 *
 * Shared rather than repeated: three copies of `settle()` is three chances for
 * them to drift, and the whole point of these tests is that they agree about
 * when the graph has finished reacting.
 */
function setup() {
    let fixture: ComponentFixture<HostComponent>;

    const api = {
        get host(): HostComponent {
            return fixture.componentInstance;
        },
        get editor(): NodeEditorComponent {
            return fixture.debugElement.children[0].componentInstance as NodeEditorComponent;
        },
        get root(): HTMLElement {
            return fixture.nativeElement.querySelector('[data-slot="node-editor"]') as HTMLElement;
        },
        async settle(): Promise<void> {
            fixture.detectChanges();
            await fixture.whenStable();
            await nextFrame();
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();
        },
        card(id: string): Element | null {
            return api.root.querySelector(
                '[data-slot="node-editor-node"][data-node="' + id + '"]',
            );
        },
        display(): string {
            return api.root.querySelector('[data-testid="display"]')?.textContent?.trim() ?? '';
        },
        nodeX(id: string): number {
            return api.host.nodes().find(n => n.id === id)?.x ?? 0;
        },
        async type(value: string): Promise<void> {
            const input = api.root.querySelector<HTMLInputElement>('[data-testid="text-field"]');
            if (!input) throw new Error('the text input node did not render its view');
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await api.settle();
        },
        press(target: Element | null | undefined, x: number, y: number): void {
            target?.dispatchEvent(
                new PointerEvent('pointerdown', {
                    bubbles: true, cancelable: true, pointerId: 1, clientX: x, clientY: y,
                }),
            );
        },
        move(x: number, y: number): void {
            api.root.dispatchEvent(
                new PointerEvent('pointermove', {
                    bubbles: true, cancelable: true, pointerId: 1, clientX: x, clientY: y,
                }),
            );
        },
        /** A drag writes the graph on RELEASE, so a test that reads `nodes` needs one. */
        release(x: number, y: number): void {
            api.root.dispatchEvent(
                new PointerEvent('pointerup', {
                    bubbles: true, cancelable: true, pointerId: 1, clientX: x, clientY: y,
                }),
            );
        },
        async create(): Promise<void> {
            await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
            fixture = TestBed.createComponent(HostComponent);
            await api.settle();
            await api.settle();
        },
        destroy(): void {
            fixture.destroy();
        },
    };
    return api;
}

describe('RT-11 typed nodes render their own view', () => {
    const ctx = setup();

    beforeEach(() => ctx.create());
    afterEach(() => ctx.destroy());

    it('renders each node type view inside its card', () => {
        expect(ctx.root.querySelector('[data-testid="text-field"]')).not.toBeNull();
        expect(ctx.root.querySelector('[data-testid="display"]')).not.toBeNull();
    });

    it('materialises ports and title from the definition, not the node', () => {
        expect(ctx.card('t')?.getAttribute('aria-label')).toContain('Text input');

        const wrapper = ctx.card('t')?.closest('[data-slot="canvas-item"]') as HTMLElement;
        expect(wrapper.querySelectorAll('[data-slot="node-editor-port"]')).toHaveLength(1);
    });

    it('uses the fieldset branch for a card whose body is a view', () => {
        // A view may hold the consumer's own controls, so the card must not
        // claim to be a button around them.
        expect(ctx.card('t')?.tagName).toBe('FIELDSET');
    });

    it('gives a view-bodied card a header, which is its only drag handle', () => {
        expect(ctx.card('t')?.querySelector('[data-slot="node-editor-node-header"]')).not.toBeNull();
    });

    it('surfaces runtime status on every card, whichever branch it took', () => {
        expect(ctx.card('u')?.getAttribute('data-status')).toBeTruthy();
        expect(ctx.card('t')?.getAttribute('data-status')).toBeTruthy();
    });
});

describe('RT-11 the motivating example: typing streams downstream', () => {
    const ctx = setup();

    beforeEach(() => ctx.create());
    afterEach(() => ctx.destroy());

    it('reaches the far end of the graph with no Run button', async () => {
        await ctx.type('hello');
        expect(ctx.display()).toBe('HELLO');
    });

    it('keeps streaming on every keystroke', async () => {
        await ctx.type('a');
        expect(ctx.display()).toBe('A');
        await ctx.type('ab');
        expect(ctx.display()).toBe('AB');
        await ctx.type('abc');
        expect(ctx.display()).toBe('ABC');
    });

    it('does not evaluate at all when live is off', async () => {
        ctx.host.live.set(false);
        await ctx.settle();
        await ctx.type('quiet');
        expect(ctx.display()).not.toBe('QUIET');
    });

    it('catches up when run() is called explicitly', async () => {
        ctx.host.live.set(false);
        await ctx.settle();
        await ctx.type('later');

        await ctx.editor.run();
        await ctx.settle();
        expect(ctx.display()).toBe('LATER');
    });

    it('advances one node at a time with step()', async () => {
        ctx.host.live.set(false);
        await ctx.settle();
        await ctx.type('stepwise');

        await ctx.editor.step();
        await ctx.editor.step();
        await ctx.settle();
        expect(ctx.display()).not.toBe('STEPWISE');

        await ctx.editor.step();
        await ctx.settle();
        expect(ctx.display()).toBe('STEPWISE');
    });

    it('reports a required input that is not connected', async () => {
        ctx.host.connections.set([]);
        await ctx.settle();

        const problem = ctx.editor.problems().find(p => p.kind === 'required-input-unconnected');
        expect(problem?.message).toContain('Value');
    });

    it('records one undo entry for a burst of typing, not one per keystroke', async () => {
        await ctx.type('a');
        await ctx.type('ab');
        await ctx.type('abc');
        expect(ctx.editor.history.entries).toHaveLength(1);
    });
});

describe('RT-12 controls inside a node are usable', () => {
    const ctx = setup();

    beforeEach(() => ctx.create());
    afterEach(() => ctx.destroy());

    /**
     * Without this the motivating example is impossible: a press on the text
     * field would start a node drag, so a caret could never be placed.
     */
    it('does not drag the node when the press lands on its input', async () => {
        const before = ctx.nodeX('t');
        ctx.press(ctx.root.querySelector('[data-testid="text-field"]'), 60, 30);
        ctx.move(160, 30);
        await ctx.settle();

        expect(ctx.nodeX('t')).toBe(before);
    });

    it('still selects the node, so pressing its body is not inert', async () => {
        ctx.press(ctx.root.querySelector('[data-testid="text-field"]'), 60, 30);
        await ctx.settle();
        expect(ctx.card('t')?.getAttribute('data-selected')).toBe('true');
    });

    /** The header stays a drag handle even when the body is full of widgets. */
    it('DOES drag when the press lands on the header', async () => {
        const before = ctx.nodeX('t');
        ctx.press(ctx.card('t')?.querySelector('[data-slot="node-editor-node-header"]'), 60, 10);
        ctx.move(160, 10);
        await ctx.settle();
        ctx.release(160, 10);
        await ctx.settle();

        expect(ctx.nodeX('t')).toBeGreaterThan(before);
    });
});

describe('the highlight on a node that just ran', () => {
    const ctx = setup();

    beforeEach(() => ctx.create());
    afterEach(() => ctx.destroy());

    /*
     * Stepping a graph was unreadable without this: a run that recomputes a
     * node to the same value changes nothing on screen, so the only evidence
     * anything happened was the word "stale" disappearing.
     *
     * It had no test of any kind, through a rewrite that replaced a copied
     * immutable Set and one timer per node with a deadline map and a single
     * sweep — so "the glow never fades and the map grows for the life of the
     * session" was a free mutation.
     */
    it('lights the nodes that ran, then lets the light go out', async () => {
        await ctx.type('hi');

        const lit = (): number => ctx.root.querySelectorAll('[data-ran="true"]').length;
        expect(lit()).toBeGreaterThan(0);

        // Longer than the window, and real timers: the sweep is a timeout.
        await new Promise(resolve => setTimeout(resolve, 1200));
        await ctx.settle();

        expect(lit()).toBe(0);
    });
});

describe('the drain lets the browser breathe', () => {
    const ctx = setup();

    beforeEach(() => ctx.create());
    afterEach(() => ctx.destroy());

    /*
     * The assertion the whole slicing change exists to satisfy, and the only
     * one that fails when the yield degrades to a microtask.
     *
     * Counting calls to `yieldTo` proves nothing: `() => Promise.resolve()`
     * type-checks, satisfies a call-counting spy, and paints exactly nothing,
     * because a microtask never lets the browser do anything. A real frame
     * running BETWEEN two computes is the difference.
     */
    it('yields to the event loop, not to the microtask queue', async () => {
        /*
         * The assertion the whole slicing change exists to satisfy.
         *
         * Counting calls to `yieldTo` proves nothing: `() => Promise.resolve()`
         * type-checks, satisfies a call-counting spy, and paints exactly
         * nothing, because a microtask never lets the browser do anything.
         * So this drains the microtask queue and requires the yield to still
         * be pending.
         *
         * It deliberately does NOT assert that an animation frame ran. The
         * yield races a frame against a 16ms floor, and in a test browser the
         * floor legitimately wins about half the time — two earlier versions
         * asserted the frame and flaked exactly that often. The frame leg is
         * what makes the gap paint-aligned; the floor is what stops a hidden
         * tab wedging the drain, and the test below covers that.
         */
        const yieldTo = ctx.editor.runtime.yieldTo;
        expect(yieldTo).not.toBeNull();

        let resolved = false;
        const pending = yieldTo?.().then(() => {
            resolved = true;
        });

        // Several turns of the microtask queue: a microtask-based yield would
        // have resolved in the first.
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        expect(resolved).toBe(false);

        await pending;
        expect(resolved).toBe(true);
    });

    it('gives up waiting for a frame that never comes', async () => {
        /*
         * A hidden tab fires no animation frames. Without the timer racing the
         * frame, the drain waits for ever holding `draining`, and every later
         * `run()` and `step()` awaits it — the whole runtime wedges.
         *
         * Driven straight at the runtime: the fixture's own `settle()` waits
         * on animation frames too, so stubbing them out hangs the harness
         * rather than testing the runtime. That `run()` RESOLVES at all is the
         * assertion.
         */
        const editor = ctx.editor;
        const real = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = (): number => 0;
        editor.runtime.sliceMs = 0;

        try {
            editor.runtime.setState('t', { value: 'backgrounded' });
            await editor.runtime.run();
        } finally {
            globalThis.requestAnimationFrame = real;
        }

        expect(editor.runtime.outputs('u')()['out']).toBe('BACKGROUNDED');
    }, 15_000);
});

describe('a long evaluation is not silent', () => {
    const ctx = setup();

    beforeEach(() => ctx.create());
    afterEach(() => ctx.destroy());

    /*
     * Evaluation used to finish faster than it could be described, so saying
     * nothing was fair. A sliced run takes seconds, and a screen reader would
     * otherwise sit through the whole thing with no sign that anything was
     * happening — and then no sign that it had stopped.
     */
    it('announces that it started and that it finished', async () => {
        const live = document.querySelector('[aria-live]');
        expect(live).not.toBeNull();

        ctx.editor.runtime.setState('t', { value: 'spoken' });
        await ctx.editor.run();

        // The shared region clears itself and re-publishes 50ms later, so that
        // a repeated identical message is read out again rather than ignored.
        await new Promise(resolve => setTimeout(resolve, 80));

        const said = live?.textContent ?? '';
        expect(said).toContain('finished');
    });
});
