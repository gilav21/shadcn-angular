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
