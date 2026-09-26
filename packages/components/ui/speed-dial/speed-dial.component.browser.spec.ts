import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, afterEach } from 'vitest';
import {
    SpeedDialComponent,
    SpeedDialTriggerComponent,
    SpeedDialMenuComponent,
    SpeedDialItemComponent,
    SpeedDialType,
    SpeedDialDirection,
} from './index';

/** Browser-only speed-dial placement: the menu is placed with utility classes, so only real layout shows where it lands. */
@Component({
    template: `
        <div style="padding: 200px 0 0 150px">
            <ui-speed-dial [type]="type()" [direction]="direction()">
                <ui-speed-dial-trigger><button type="button" data-test="trigger">+</button></ui-speed-dial-trigger>
                <ui-speed-dial-menu>
                    <ui-speed-dial-item><button type="button">One</button></ui-speed-dial-item>
                    <ui-speed-dial-item><button type="button">Two</button></ui-speed-dial-item>
                </ui-speed-dial-menu>
            </ui-speed-dial>
        </div>
    `,
    imports: [SpeedDialComponent, SpeedDialTriggerComponent, SpeedDialMenuComponent, SpeedDialItemComponent],
})
class PlacementHost {
    readonly type = input<SpeedDialType>('linear');
    readonly direction = input<SpeedDialDirection>('up');
}

function mount(type: SpeedDialType = 'linear', direction: SpeedDialDirection = 'up') {
    const fixture = TestBed.createComponent(PlacementHost);
    fixture.componentRef.setInput('type', type);
    fixture.componentRef.setInput('direction', direction);
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);
    const root = fixture.nativeElement as HTMLElement;
    const dial = fixture.debugElement.query(By.directive(SpeedDialComponent)).componentInstance as SpeedDialComponent;
    return {
        fixture,
        dial,
        menu: () => root.querySelector<HTMLElement>('[data-slot="speed-dial-menu"]')!,
        trigger: () => root.querySelector<HTMLElement>('[data-test="trigger"]')!,
        host: () => root.querySelector<HTMLElement>('ui-speed-dial')!,
    };
}

describe('SpeedDial placement', () => {
    afterEach(() => document.querySelectorAll('[ng-version]').forEach((n) => n.parentElement === document.body && n.remove()));

    it('opens a linear "up" menu above the trigger, centred on it', () => {
        const m = mount();
        m.trigger().click();
        m.fixture.detectChanges();
        const menu = m.menu().getBoundingClientRect();
        const trigger = m.trigger().getBoundingClientRect();
        expect(menu.bottom).toBeLessThanOrEqual(trigger.top);
        expect(Math.abs((menu.left + menu.width / 2) - (trigger.left + trigger.width / 2))).toBeLessThanOrEqual(1);
    });

    it('lays a context-opened linear menu out as a fixed, clickable column', () => {
        const m = mount('linear', 'down');
        m.dial.contextPosition.set({ x: 10, y: 10 });
        m.dial.open.set(true);
        m.fixture.detectChanges();
        const style = getComputedStyle(m.menu());
        expect(style.position).toBe('fixed');
        expect(style.flexDirection).toBe('column');
        expect(style.pointerEvents).toBe('auto');
    });

    it('overlays a closed circular menu exactly on the dial, click-through', () => {
        const m = mount('circle', 'up');
        const style = getComputedStyle(m.menu());
        const menu = m.menu().getBoundingClientRect();
        const host = m.host().getBoundingClientRect();
        expect(style.position).toBe('absolute');
        expect(style.pointerEvents).toBe('none');
        expect([menu.left, menu.top, menu.width, menu.height]).toEqual([host.left, host.top, host.width, host.height]);
    });
});
