import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { TabsComponent } from './tabs.component';
import { TabsListComponent } from './sub/tabs-list.component';
import { TabsTriggerComponent } from './sub/tabs-trigger.component';
import { TabsContentComponent } from './sub/tabs-content.component';

/**
 * Browser-only: the tabs wrapper spans its container. A flex row is the case
 * that needs it — there a block child would otherwise shrink to its content.
 */
@Component({
    template: `
        <div data-testid="row" style="display: flex; width: 360px">
            <ui-tabs defaultValue="account">
                <ui-tabs-list>
                    <ui-tabs-trigger value="account">Account</ui-tabs-trigger>
                    <ui-tabs-trigger value="password">Password</ui-tabs-trigger>
                </ui-tabs-list>
                <ui-tabs-content value="account">Account settings</ui-tabs-content>
            </ui-tabs>
        </div>
    `,
    imports: [TabsComponent, TabsListComponent, TabsTriggerComponent, TabsContentComponent],
})
class FlexRowHostComponent {}

describe('TabsComponent layout (browser)', () => {
    it('stretches the tabs wrapper to its container width', () => {
        const fixture = TestBed.createComponent(FlexRowHostComponent);
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;

        const row = root.querySelector('[data-testid="row"]')!.getBoundingClientRect();
        const tabs = root.querySelector('[data-slot="tabs"]')!.getBoundingClientRect();
        expect(tabs.width).toBeCloseTo(row.width, 0);
        expect(tabs.width).toBe(360);
    });
});

@Component({
    template: `
        <div [attr.dir]="dir" style="--density: 1.5">
            <ui-tabs [tabs]="tabs" />
            <ui-tabs defaultValue="a">
                <ui-tabs-list>
                    <ui-tabs-trigger value="a">A</ui-tabs-trigger>
                    <ui-tabs-trigger value="b">B</ui-tabs-trigger>
                    <ui-tabs-trigger value="c">C</ui-tabs-trigger>
                </ui-tabs-list>
            </ui-tabs>
        </div>
    `,
    imports: [TabsComponent, TabsListComponent, TabsTriggerComponent],
})
class DensityHostComponent {
    dir = 'ltr';
    readonly tabs = [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B', disabled: true },
        { value: 'c', label: 'C' },
    ];
}

describe('TabsComponent density and keyboard (browser)', () => {
    it('scales simple-mode trigger padding with --density like custom mode', () => {
        const fixture = TestBed.createComponent(DensityHostComponent);
        fixture.detectChanges();
        const [simple, custom] = Array.from(
            (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[data-slot="tabs-trigger"]'),
        ).filter((el, i) => i === 0 || el.closest('ui-tabs-trigger'));
        expect(getComputedStyle(simple).paddingLeft).toBe('18px');
        expect(getComputedStyle(custom).paddingLeft).toBe('18px');
        expect(getComputedStyle(simple).paddingTop).toBe('6px');
    });

    it.each([
        ['ltr', 'ArrowRight', 'C'],
        ['rtl', 'ArrowLeft', 'C'],
        ['ltr', 'ArrowLeft', 'C'],
        ['ltr', 'End', 'C'],
        ['ltr', 'Home', 'A'],
    ])('simple mode (%s): %s from A lands on %s, skipping the disabled tab and wrapping', (dir, key, label) => {
        const fixture = TestBed.createComponent(DensityHostComponent);
        fixture.componentInstance.dir = dir;
        fixture.detectChanges();
        const tabs = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('ui-tabs:first-of-type [role="tab"]');
        tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        fixture.detectChanges();
        const active = (fixture.nativeElement as HTMLElement).querySelector('[role="tab"][aria-selected="true"]')!;
        expect(active.textContent!.trim()).toBe(label);
    });

    it.each([
        ['ArrowLeft', { altKey: true }],
        ['ArrowRight', { ctrlKey: true }],
        ['ArrowRight', { metaKey: true }],
        ['Home', { shiftKey: true }],
    ])('leaves %s with a modifier (%o) to the browser: no activation, not default-prevented', (key, modifier) => {
        const fixture = TestBed.createComponent(DensityHostComponent);
        fixture.detectChanges();
        const tabs = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('ui-tabs:first-of-type [role="tab"]');
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifier });
        tabs[0].dispatchEvent(event);
        fixture.detectChanges();
        expect(event.defaultPrevented).toBe(false);
        expect((fixture.nativeElement as HTMLElement).querySelector('[role="tab"][aria-selected="true"]')!.textContent!.trim()).toBe('A');
    });

    it('custom mode: ArrowRight moves focus and activation to the next trigger', () => {
        const fixture = TestBed.createComponent(DensityHostComponent);
        fixture.detectChanges();
        const triggers = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('ui-tabs-trigger button');
        triggers[0].focus();
        triggers[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        fixture.detectChanges();
        expect(document.activeElement).toBe(triggers[1]);
        expect(triggers[1].getAttribute('aria-selected')).toBe('true');
    });
});
