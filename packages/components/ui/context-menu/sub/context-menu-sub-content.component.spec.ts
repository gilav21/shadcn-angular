import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContextMenuComponent } from '../context-menu.component';
import { ContextMenuSubComponent } from './context-menu-sub.component';
import { ContextMenuSubTriggerComponent } from './context-menu-sub-trigger.component';
import { ContextMenuSubContentComponent } from './context-menu-sub-content.component';
import { ContextMenuItemComponent } from './context-menu-item.component';

async function settlePortal(fixture: ComponentFixture<unknown>): Promise<void> {
    fixture.detectChanges();
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

    function forceRtl(): void {
        // jsdom does not derive getComputedStyle().direction from the `dir`
        // attribute, so isRtl() would report LTR. Spy on the outer menu's RTL
        // resolver to reflect the host's requested direction under jsdom.
        const menu = fixture.debugElement.query(By.directive(ContextMenuComponent)).componentInstance as ContextMenuComponent;
        vi.spyOn(menu, 'isRtl').mockReturnValue(true);
    }

    function triggerEl(): HTMLElement {
        return fixture.nativeElement.querySelector('[data-slot="context-menu-sub-trigger"]');
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [SubContentHost] }).compileComponents();
        fixture = TestBed.createComponent(SubContentHost);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
        document.querySelectorAll('[data-context-menu-sub-portal]').forEach((el) => el.remove());
        document.documentElement.removeAttribute('dir');
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
        expect(document.querySelectorAll('[data-context-menu-sub-portal]')).toHaveLength(1);
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
            vi.useFakeTimers();
            try {
                const event = dispatchKey(itemEl('a'), 'ArrowLeft');
                vi.advanceTimersByTime(100);
                expect(event.defaultPrevented).toBe(true);
                expect(subComponent().isOpen()).toBe(false);
                expect(document.activeElement).toBe(triggerEl());
            } finally {
                vi.useRealTimers();
            }
        });

        it('ArrowLeft in RTL is ignored (no preventDefault)', async () => {
            host.dir.set('rtl');
            document.documentElement.setAttribute('dir', 'rtl');
            forceRtl();
            fixture.detectChanges();
            const event = dispatchKey(itemEl('a'), 'ArrowLeft');
            expect(event.defaultPrevented).toBe(false);
        });

        it('ArrowRight in RTL closes the sub', async () => {
            host.dir.set('rtl');
            document.documentElement.setAttribute('dir', 'rtl');
            forceRtl();
            fixture.detectChanges();
            vi.useFakeTimers();
            try {
                const event = dispatchKey(itemEl('a'), 'ArrowRight');
                vi.advanceTimersByTime(100);
                expect(event.defaultPrevented).toBe(true);
                expect(subComponent().isOpen()).toBe(false);
            } finally {
                vi.useRealTimers();
            }
        });

        it('ArrowRight in LTR is ignored (no preventDefault)', () => {
            const event = dispatchKey(itemEl('a'), 'ArrowRight');
            expect(event.defaultPrevented).toBe(false);
        });

        it('Escape closes the sub but leaves the root menu open', () => {
            const menu = fixture.debugElement.query(By.directive(ContextMenuComponent)).componentInstance as ContextMenuComponent;
            menu.show(100, 100);
            vi.useFakeTimers();
            try {
                const event = dispatchKey(itemEl('a'), 'Escape');
                vi.advanceTimersByTime(100);
                expect(event.defaultPrevented).toBe(true);
                expect(subComponent().isOpen()).toBe(false);
                expect(menu.open()).toBe(true);
            } finally {
                vi.useRealTimers();
            }
        });

        it('an unhandled key does not prevent default', () => {
            const event = dispatchKey(itemEl('a'), 'a');
            expect(event.defaultPrevented).toBe(false);
        });
    });

    it('mouseleave closes the content after 100ms unless the pointer comes back', async () => {
        subComponent().enter();
        await settlePortal(fixture);
        const content = portalContent()!;

        vi.useFakeTimers();
        try {
            content.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
            vi.advanceTimersByTime(50);
            content.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            vi.advanceTimersByTime(100);
            expect(subComponent().isOpen()).toBe(true);

            content.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
            vi.advanceTimersByTime(100);
            expect(subComponent().isOpen()).toBe(false);
        } finally {
            vi.useRealTimers();
        }
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
    });

    beforeEach(async () => {
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
