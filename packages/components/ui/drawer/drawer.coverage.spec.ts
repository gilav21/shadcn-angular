import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    DrawerComponent,
    DrawerTriggerComponent,
    DrawerContentComponent,
    DrawerCloseComponent,
} from './index';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function flushMicrotimers(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 10));
}

// Host that starts open so DrawerContentComponent.ngAfterViewInit sees an
// already-open drawer, and whose content has NO focusable children so the
// focus-first `else` branch (content.focus()) is exercised.
@Component({
    template: `
        <ui-drawer [open]="true" direction="top">
            <ui-drawer-content>Just text, no focusable controls</ui-drawer-content>
        </ui-drawer>
    `,
    imports: [DrawerComponent, DrawerContentComponent],
})
class OpenAtInitHostComponent {}

// Host with multiple focusable controls inside the content for focus-trap tests.
@Component({
    template: `
        <ui-drawer>
            <ui-drawer-trigger>Open</ui-drawer-trigger>
            <ui-drawer-content>
                <button type="button" id="first">First</button>
                <button type="button" id="middle">Middle</button>
                <button type="button" id="last">Last</button>
            </ui-drawer-content>
        </ui-drawer>
    `,
    imports: [DrawerComponent, DrawerTriggerComponent, DrawerContentComponent],
})
class FocusTrapHostComponent {}

describe('Drawer trigger keyboard handling', () => {
    let fixture: ComponentFixture<FocusTrapHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [FocusTrapHostComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(FocusTrapHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    });

    it('opens the drawer when Enter is pressed on the trigger itself', () => {
        const span = fixture.nativeElement.querySelector('[data-slot="drawer-trigger"]') as HTMLElement;
        const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        span.dispatchEvent(enter);
        fixture.detectChanges();

        expect(enter.defaultPrevented).toBe(true);
        expect(fixture.nativeElement.querySelector('[data-slot="drawer-content"]')).not.toBeNull();
    });

    it('ignores keydown that bubbled from a child element (target !== currentTarget)', () => {
        // A projected control's Enter already clicks it, and that click bubbles
        // to the trigger; toggling on the keydown too would open-then-close.
        @Component({
            template: `
                <ui-drawer>
                    <ui-drawer-trigger><button type="button">Open</button></ui-drawer-trigger>
                    <ui-drawer-content>Panel</ui-drawer-content>
                </ui-drawer>
            `,
            imports: [DrawerComponent, DrawerTriggerComponent, DrawerContentComponent],
        })
        class ButtonTriggerHost {}

        const host = TestBed.createComponent(ButtonTriggerHost);
        host.detectChanges();
        const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        (host.nativeElement.querySelector('button') as HTMLElement).dispatchEvent(enter);
        host.detectChanges();

        expect(enter.defaultPrevented).toBe(false);
        expect(host.nativeElement.querySelector('[data-slot="drawer-content"]')).toBeNull();
    });
});

describe('Drawer close keyboard handling', () => {
    it('keeps the drawer open when Enter bubbles from a control inside the close element', async () => {
        @Component({
            template: `
                <ui-drawer [open]="true">
                    <ui-drawer-content>
                        <ui-drawer-close><button type="button">Close</button></ui-drawer-close>
                    </ui-drawer-content>
                </ui-drawer>
            `,
            imports: [DrawerComponent, DrawerContentComponent, DrawerCloseComponent],
        })
        class ButtonCloseHost {}

        await TestBed.configureTestingModule({ imports: [ButtonCloseHost] }).compileComponents();
        const fixture = TestBed.createComponent(ButtonCloseHost);
        fixture.detectChanges();

        const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        (fixture.nativeElement.querySelector('ui-drawer-close button') as HTMLElement).dispatchEvent(enter);
        fixture.detectChanges();

        expect(enter.defaultPrevented).toBe(false);
        expect(fixture.nativeElement.querySelector('[data-slot="drawer-content"]')).not.toBeNull();

        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    });

    it('hides the drawer through a close bound to a real drawer', async () => {
        @Component({
            template: `
                <ui-drawer [open]="true">
                    <ui-drawer-content>
                        <ui-drawer-close>Close</ui-drawer-close>
                    </ui-drawer-content>
                </ui-drawer>
            `,
            imports: [DrawerComponent, DrawerContentComponent, DrawerCloseComponent],
        })
        class CloseHost {}

        await TestBed.configureTestingModule({ imports: [CloseHost] }).compileComponents();
        const fixture = TestBed.createComponent(CloseHost);
        fixture.detectChanges();

        const drawer = fixture.debugElement.query(By.directive(DrawerComponent))
            .componentInstance as DrawerComponent;
        expect(drawer.open()).toBe(true);

        const close = fixture.debugElement.query(By.directive(DrawerCloseComponent))
            .componentInstance as DrawerCloseComponent;
        const span = fixture.nativeElement.querySelector('[data-slot="drawer-close"]');
        const preventDefault = vi.fn();
        close.onKeydown({ target: span, currentTarget: span, preventDefault } as unknown as Event);
        fixture.detectChanges();

        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(drawer.open()).toBe(false);

        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    });
});

describe('DrawerContent focus + direction fallback', () => {
    afterEach(() => {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    });

    it('falls back to "bottom" direction when there is no parent drawer', async () => {
        @Component({
            template: `<ui-drawer-content>orphan</ui-drawer-content>`,
            imports: [DrawerContentComponent],
        })
        class OrphanHost {}

        await TestBed.configureTestingModule({ imports: [OrphanHost] }).compileComponents();
        const fixture = TestBed.createComponent(OrphanHost);
        fixture.detectChanges();

        const content = fixture.debugElement.query(By.directive(DrawerContentComponent))
            .componentInstance as DrawerContentComponent;
        expect(content.drawer).toBeNull();
        expect(content.direction()).toBe('bottom');
    });

    it('focuses the content element itself when it has no focusable children (ngAfterViewInit open path)', async () => {
        await TestBed.configureTestingModule({
            imports: [OpenAtInitHostComponent],
        }).compileComponents();
        const fixture = TestBed.createComponent(OpenAtInitHostComponent);
        fixture.detectChanges();
        await flushMicrotimers();

        const contentDiv = fixture.nativeElement.querySelector('[data-slot="drawer-content"]') as HTMLElement;
        expect(document.activeElement).toBe(contentDiv);
    });

    it('runs focusFirstElement with no content present (drawer closed before deferred focus)', async () => {
        await TestBed.configureTestingModule({
            imports: [FocusTrapHostComponent],
        }).compileComponents();
        const fixture = TestBed.createComponent(FocusTrapHostComponent);
        fixture.detectChanges();

        const drawer = fixture.debugElement.query(By.directive(DrawerComponent))
            .componentInstance as DrawerComponent;

        // Open schedules a deferred focusFirstElement via setTimeout(0)...
        drawer.show();
        fixture.detectChanges();
        // ...then close synchronously so the content is gone when it fires.
        drawer.hide();
        fixture.detectChanges();

        await flushMicrotimers();

        expect(fixture.nativeElement.querySelector('[data-slot="drawer-content"]')).toBeNull();
        expect(drawer.open()).toBe(false);
    });
});

describe('DrawerContent Tab focus trap', () => {
    let fixture: ComponentFixture<FocusTrapHostComponent>;
    let content: DrawerContentComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [FocusTrapHostComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(FocusTrapHostComponent);
        fixture.detectChanges();

        const drawer = fixture.debugElement.query(By.directive(DrawerComponent))
            .componentInstance as DrawerComponent;
        drawer.show();
        fixture.detectChanges();

        // Let the effect's setTimeout run so focusFirstElement sets contentEl.
        await flushMicrotimers();
        fixture.detectChanges();

        content = fixture.debugElement.query(By.directive(DrawerContentComponent))
            .componentInstance as DrawerContentComponent;
    });

    afterEach(() => {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    });

    function makeTab(shiftKey: boolean) {
        const preventDefault = vi.fn();
        return {
            event: { key: 'Tab', shiftKey, preventDefault } as unknown as KeyboardEvent,
            preventDefault,
        };
    }

    it('wraps to the last element on Shift+Tab from the first element', () => {
        const first = fixture.nativeElement.querySelector('#first') as HTMLElement;
        const last = fixture.nativeElement.querySelector('#last') as HTMLElement;
        const lastFocus = vi.spyOn(last, 'focus');
        first.focus();
        expect(document.activeElement).toBe(first);

        const { event, preventDefault } = makeTab(true);
        content.onKeydown(event);

        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(lastFocus).toHaveBeenCalledTimes(1);
    });

    it('does nothing on Shift+Tab when focus is not on the first element', () => {
        const middle = fixture.nativeElement.querySelector('#middle') as HTMLElement;
        middle.focus();
        expect(document.activeElement).toBe(middle);

        const { event, preventDefault } = makeTab(true);
        content.onKeydown(event);

        expect(preventDefault).not.toHaveBeenCalled();
    });

    it('wraps to the first element on Tab from the last element', () => {
        const first = fixture.nativeElement.querySelector('#first') as HTMLElement;
        const last = fixture.nativeElement.querySelector('#last') as HTMLElement;
        const firstFocus = vi.spyOn(first, 'focus');
        last.focus();
        expect(document.activeElement).toBe(last);

        const { event, preventDefault } = makeTab(false);
        content.onKeydown(event);

        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(firstFocus).toHaveBeenCalledTimes(1);
    });

    it('does nothing on Tab when focus is not on the last element', () => {
        const first = fixture.nativeElement.querySelector('#first') as HTMLElement;
        first.focus();
        expect(document.activeElement).toBe(first);

        const { event, preventDefault } = makeTab(false);
        content.onKeydown(event);

        expect(preventDefault).not.toHaveBeenCalled();
    });

    it('ignores non-Escape, non-Tab keys', () => {
        const preventDefault = vi.fn();
        content.onKeydown({ key: 'a', shiftKey: false, preventDefault } as unknown as KeyboardEvent);
        expect(preventDefault).not.toHaveBeenCalled();
    });
});
