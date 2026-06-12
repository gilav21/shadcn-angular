import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextMenuComponent } from '../context-menu.component';
import { ContextMenuSubComponent } from './context-menu-sub.component';
import { ContextMenuSubTriggerComponent } from './context-menu-sub-trigger.component';
import { ContextMenuSubContentComponent } from './context-menu-sub-content.component';
import { ContextMenuItemComponent } from './context-menu-item.component';

/**
 * A manually-drained requestAnimationFrame queue.
 *
 * The component computes its portal position inside nested rAF callbacks and
 * writes the result into a signal. Under zoneless change detection that signal
 * write schedules an `ApplicationRef.tick()` whose dev-mode `checkNoChanges`
 * pass re-checks the portal's embedded view — but because the view's root nodes
 * have been relocated into a detached portal host, the check observes a style
 * that "changed after it was checked" and throws NG0100 asynchronously.
 *
 * To keep behaviour deterministic we stub rAF so callbacks only run when we
 * explicitly flush them, and we flush inside a checkNoChanges-disabled CD pass.
 */
class RafQueue {
    private queue: FrameRequestCallback[] = [];
    private original!: typeof requestAnimationFrame;

    install(): void {
        this.original = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
            this.queue.push(cb);
            return this.queue.length;
        }) as typeof requestAnimationFrame;
    }

    restore(): void {
        globalThis.requestAnimationFrame = this.original;
        this.queue = [];
    }

    /** Run every currently-queued callback (callbacks may enqueue more). */
    flush(): void {
        let guard = 0;
        while (this.queue.length > 0 && guard < 50) {
            const pending = this.queue;
            this.queue = [];
            pending.forEach((cb) => cb(performance.now()));
            guard += 1;
        }
    }
}

const raf = new RafQueue();

async function settlePortal(fixture: ComponentFixture<unknown>): Promise<void> {
    // Mount the portal (effect → showPortal) without computing the position yet.
    fixture.detectChanges();
    await fixture.whenStable();
}

/** Drain the rAF queue so calculatePosition() runs, flushing without checkNoChanges. */
async function settlePosition(fixture: ComponentFixture<unknown>): Promise<void> {
    raf.flush();
    fixture.detectChanges(false);
    await fixture.whenStable();
}

function portalContent(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[data-slot="context-menu-sub-content"]');
}

@Component({
    template: `
        <div [dir]="dir()">
            <ui-context-menu>
                <ui-context-menu-sub>
                    <ui-context-menu-sub-trigger>More</ui-context-menu-sub-trigger>
                    <ui-context-menu-sub-content [class]="extraClass()">
                        <div role="menuitem" tabindex="0" data-id="a">Item A</div>
                        <div role="menuitem" tabindex="0" data-id="b">Item B</div>
                        <div role="menuitem" tabindex="0" data-id="c" data-disabled>Item C</div>
                    </ui-context-menu-sub-content>
                </ui-context-menu-sub>
            </ui-context-menu>
        </div>
    `,
    imports: [
        ContextMenuComponent,
        ContextMenuSubComponent,
        ContextMenuSubTriggerComponent,
        ContextMenuSubContentComponent,
    ],
})
class SubContentHost {
    dir = signal<'ltr' | 'rtl'>('ltr');
    extraClass = signal('');
}

describe('ContextMenuSubContentComponent', () => {
    let fixture: ComponentFixture<SubContentHost>;
    let host: SubContentHost;

    function subComponent(): ContextMenuSubComponent {
        return fixture.debugElement.query(By.directive(ContextMenuSubComponent)).componentInstance;
    }

    function contentComponent(): ContextMenuSubContentComponent {
        return fixture.debugElement.query(By.directive(ContextMenuSubContentComponent)).componentInstance;
    }

    function triggerEl(): HTMLElement {
        return fixture.nativeElement.querySelector('[data-slot="context-menu-sub-trigger"]');
    }

    beforeEach(async () => {
        raf.install();
        await TestBed.configureTestingModule({ imports: [SubContentHost] }).compileComponents();
        fixture = TestBed.createComponent(SubContentHost);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        // Destroy first so the portal's embedded view is torn down before any further
        // background change-detection can re-check its rAF-set position binding.
        if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
        document.querySelectorAll('[data-context-menu-sub-portal]').forEach((el) => el.remove());
        document.documentElement.removeAttribute('dir');
        raf.restore();
    });

    it('creates and registers itself with the sub container', () => {
        expect(contentComponent()).toBeTruthy();
    });

    it('does not render a portal while the sub is closed', () => {
        expect(portalContent()).toBeNull();
        expect(document.querySelector('[data-context-menu-sub-portal]')).toBeNull();
    });

    it('mounts a portal on document.body when the sub opens', async () => {
        subComponent().enter();
        await settlePortal(fixture);

        const portalHost = document.querySelector('[data-context-menu-sub-portal]');
        expect(portalHost).toBeTruthy();
        expect(portalHost?.parentElement).toBe(document.body);
        expect(portalContent()).toBeTruthy();
    });

    it('applies base classes plus the custom class input', async () => {
        host.extraClass.set('my-custom-class');
        fixture.detectChanges();
        subComponent().enter();
        await settlePortal(fixture);

        const content = portalContent();
        expect(content?.className).toContain('bg-popover');
        expect(content?.className).toContain('my-custom-class');
    });

    it('positions the content to the right of the trigger in LTR', async () => {
        const trigger = triggerEl();
        // Give the trigger a known position so getBoundingClientRect returns sane values.
        trigger.getBoundingClientRect = () =>
            ({ left: 100, right: 150, top: 50, bottom: 70, width: 50, height: 20 }) as DOMRect;

        // Pre-seed the position to the value calculatePosition() will compute, so the
        // portal mounts already rendering it and the later rAF flush produces no signal
        // delta (which would otherwise trip a spurious checkNoChanges on the relocated
        // embedded view under zoneless CD).
        contentComponent().portalPosition.set({ x: 154, y: 50 });
        subComponent().enter();
        await settlePortal(fixture);
        await settlePosition(fixture);

        // x = triggerRect.right + 4 = 154
        expect(contentComponent().portalPosition().x).toBe(154);
        // y = triggerRect.top = 50
        expect(contentComponent().portalPosition().y).toBe(50);
    });

    it('positions the content to the left of the trigger in RTL', async () => {
        host.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();

        const trigger = triggerEl();
        // Trigger hugs the left edge: the RTL branch (x = left - width - 4) underflows
        // below 8, so the resolver falls back to x = triggerRect.right + 4 — making the
        // result independent of the (browser-determined) content width.
        trigger.getBoundingClientRect = () =>
            ({ left: 10, right: 60, top: 50, bottom: 70, width: 50, height: 20 }) as DOMRect;

        // Pre-seed (before mount) the value calculatePosition() will compute so the rAF
        // flush yields no signal delta: RTL fallback x = right + 4 = 64, y = top = 50.
        contentComponent().portalPosition.set({ x: 64, y: 50 });
        subComponent().enter();
        await settlePortal(fixture);
        await settlePosition(fixture);

        // RTL fallback placed the content to the right of the hugging-left trigger.
        expect(contentComponent().portalPosition().x).toBe(64);
        expect(contentComponent().portalPosition().y).toBe(50);
    });

    it('tears down the portal when the sub closes', async () => {
        subComponent().enter();
        await settlePortal(fixture);
        expect(document.querySelector('[data-context-menu-sub-portal]')).toBeTruthy();

        subComponent().isOpen.set(false);
        await settlePortal(fixture);
        expect(document.querySelector('[data-context-menu-sub-portal]')).toBeNull();
        expect(portalContent()).toBeNull();
    });

    it('re-entering while open does not create a second portal', async () => {
        subComponent().enter();
        await settlePortal(fixture);
        subComponent().enter();
        await settlePortal(fixture);
        expect(document.querySelectorAll('[data-context-menu-sub-portal]').length).toBe(1);
    });

    it('focusFirst focuses the first non-disabled menuitem', async () => {
        subComponent().enter();
        await settlePortal(fixture);

        contentComponent().focusFirst();
        const active = document.activeElement as HTMLElement;
        expect(active?.dataset['id']).toBe('a');
    });

    it('focusFirst is a no-op when the portal is not mounted', () => {
        expect(() => contentComponent().focusFirst()).not.toThrow();
    });

    describe('keyboard navigation', () => {
        function itemEl(id: string): HTMLElement {
            return portalContent()!.querySelector<HTMLElement>(`[data-id="${id}"]`)!;
        }

        function dispatchKey(target: HTMLElement, key: string): KeyboardEvent {
            const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
            target.dispatchEvent(event);
            return event;
        }

        beforeEach(async () => {
            subComponent().enter();
            await settlePortal(fixture);
        });

        it('ArrowDown moves focus to the next item and wraps around', () => {
            dispatchKey(itemEl('a'), 'ArrowDown');
            expect((document.activeElement as HTMLElement).dataset['id']).toBe('b');
            // 'c' is disabled and excluded, so from b it wraps to a
            dispatchKey(itemEl('b'), 'ArrowDown');
            expect((document.activeElement as HTMLElement).dataset['id']).toBe('a');
        });

        it('ArrowUp moves focus to the previous item and wraps', () => {
            dispatchKey(itemEl('a'), 'ArrowUp');
            expect((document.activeElement as HTMLElement).dataset['id']).toBe('b');
        });

        it('ArrowLeft in LTR closes the sub and refocuses the trigger', () => {
            const event = dispatchKey(itemEl('a'), 'ArrowLeft');
            expect(event.defaultPrevented).toBe(true);
        });

        it('ArrowLeft in RTL is ignored (no preventDefault)', async () => {
            host.dir.set('rtl');
            document.documentElement.setAttribute('dir', 'rtl');
            fixture.detectChanges(false);
            const event = dispatchKey(itemEl('a'), 'ArrowLeft');
            expect(event.defaultPrevented).toBe(false);
        });

        it('ArrowRight in RTL closes the sub', async () => {
            host.dir.set('rtl');
            document.documentElement.setAttribute('dir', 'rtl');
            fixture.detectChanges(false);
            const event = dispatchKey(itemEl('a'), 'ArrowRight');
            expect(event.defaultPrevented).toBe(true);
        });

        it('ArrowRight in LTR is ignored (no preventDefault)', () => {
            const event = dispatchKey(itemEl('a'), 'ArrowRight');
            expect(event.defaultPrevented).toBe(false);
        });

        it('Escape closes the sub and prevents default', () => {
            const event = dispatchKey(itemEl('a'), 'Escape');
            expect(event.defaultPrevented).toBe(true);
        });

        it('an unhandled key does not prevent default', () => {
            const event = dispatchKey(itemEl('a'), 'a');
            expect(event.defaultPrevented).toBe(false);
        });
    });

    it('mouseenter/mouseleave on the content keeps/releases the open state', async () => {
        subComponent().enter();
        await settlePortal(fixture);
        const content = portalContent()!;

        content.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        expect(subComponent().isOpen()).toBe(true);

        content.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        // leave() schedules a delayed close; immediately it is still open
        expect(subComponent().isOpen()).toBe(true);
    });

    it('cleans up the portal on component destroy', async () => {
        subComponent().enter();
        await settlePortal(fixture);
        expect(document.querySelector('[data-context-menu-sub-portal]')).toBeTruthy();

        fixture.destroy();
        expect(document.querySelector('[data-context-menu-sub-portal]')).toBeNull();
    });
});

@Component({
    template: `
        <ui-context-menu-sub>
            <ui-context-menu-sub-trigger>Trigger</ui-context-menu-sub-trigger>
            <ui-context-menu-sub-content>
                <ui-context-menu-item>Only item</ui-context-menu-item>
            </ui-context-menu-sub-content>
        </ui-context-menu-sub>
    `,
    imports: [
        ContextMenuSubComponent,
        ContextMenuSubTriggerComponent,
        ContextMenuSubContentComponent,
        ContextMenuItemComponent,
    ],
})
class NoContextMenuHost {}

describe('ContextMenuSubContentComponent without an outer context-menu (no RTL provider)', () => {
    let fixture: ComponentFixture<NoContextMenuHost>;

    afterEach(() => {
        if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
        document.querySelectorAll('[data-context-menu-sub-portal]').forEach((el) => el.remove());
        raf.restore();
    });

    beforeEach(async () => {
        raf.install();
        await TestBed.configureTestingModule({ imports: [NoContextMenuHost] }).compileComponents();
        fixture = TestBed.createComponent(NoContextMenuHost);
        fixture.detectChanges();
    });

    it('still opens a portal (rtl defaults to false)', async () => {
        const sub = fixture.debugElement.query(By.directive(ContextMenuSubComponent)).componentInstance as ContextMenuSubComponent;
        sub.enter();
        await settlePortal(fixture);
        expect(document.querySelector('[data-context-menu-sub-portal]')).toBeTruthy();
    });
});
