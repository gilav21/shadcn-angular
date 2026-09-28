import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContextMenuComponent, ContextMenuTriggerComponent, ContextMenuContentComponent, ContextMenuItemComponent, ContextMenuSeparatorComponent, ContextMenuLabelComponent, ContextMenuItem, ContextMenuSubComponent, ContextMenuSubTriggerComponent, ContextMenuSubContentComponent } from './';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Test host for integration
@Component({
    template: `
        <ui-context-menu>
            <ui-context-menu-trigger>
                <div style="width: 200px; height: 100px; background: #eee;">Right-click here</div>
            </ui-context-menu-trigger>
            <ui-context-menu-content>
                <ui-context-menu-label>Actions</ui-context-menu-label>
                <ui-context-menu-separator />
                <ui-context-menu-item>Copy</ui-context-menu-item>
                <ui-context-menu-item>Paste</ui-context-menu-item>
                <ui-context-menu-item [disabled]="true">Delete</ui-context-menu-item>
            </ui-context-menu-content>
        </ui-context-menu>
    `,
    imports: [ContextMenuComponent, ContextMenuTriggerComponent, ContextMenuContentComponent, ContextMenuItemComponent, ContextMenuSeparatorComponent, ContextMenuLabelComponent]
})
class TestHostComponent { }

describe('ContextMenuComponent', () => {
    let component: ContextMenuComponent;
    let fixture: ComponentFixture<ContextMenuComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ContextMenuComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ContextMenuComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('exposes data-slot="context-menu", shows at a position and closes', () => {
        expect(fixture.nativeElement.dataset.slot).toBe('context-menu');

        component.show(100, 200);
        expect(component.open()).toBe(true);
        expect(component.position()).toEqual({ x: 100, y: 200 });

        component.close();
        expect(component.open()).toBe(false);
    });
});

describe('ContextMenu Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        // Clean up any portals
        document.querySelectorAll('[data-context-menu-portal]').forEach(el => el.remove());
    });

    it('renders no content while closed, then the label, separator and items once shown', async () => {
        expect(document.querySelector('[data-slot="context-menu-content"]')).toBeNull();

        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();

        const content = document.querySelector('[data-slot="context-menu-content"]')!;
        const items = Array.from(content.querySelectorAll('[data-slot="context-menu-item"]'));
        expect(items.map(i => i.textContent?.trim())).toEqual(['Copy', 'Paste', 'Delete']);
        expect(content.querySelector('[data-slot="context-menu-label"]')?.textContent?.trim()).toBe('Actions');
        expect(content.querySelector('[data-slot="context-menu-separator"]')).toBeTruthy();
    });
});

@Component({
    template: `
        <ui-context-menu [items]="items()">
            <ui-context-menu-trigger>
                <div style="width: 200px; height: 100px; background: #eee;">Right-click here</div>
            </ui-context-menu-trigger>
        </ui-context-menu>
    `,
    imports: [ContextMenuComponent, ContextMenuTriggerComponent]
})
class ItemsDrivenTestHostComponent {
    items = signal<ContextMenuItem[]>([
        { label: 'Copy', shortcut: '⌘C' },
        { label: 'Paste', shortcut: '⌘V' },
        { type: 'separator' },
        { type: 'label', label: 'Actions' },
        { label: 'Delete', disabled: true },
        { type: 'sub', label: 'More', children: [
            { label: 'Sub Item 1' },
            { label: 'Sub Item 2' },
        ]},
    ]);
}

describe('ContextMenu Items-Driven Mode', () => {
    let fixture: ComponentFixture<ItemsDrivenTestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ItemsDrivenTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ItemsDrivenTestHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        document.querySelectorAll('[data-context-menu-portal]').forEach(el => el.remove());
    });

    it('renders items, shortcuts, separator, label, disabled state and sub-menu trigger from the items input', async () => {
        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();

        const items = document.querySelectorAll('[data-slot="context-menu-item"]');
        expect(items).toHaveLength(3);
        expect(items[0]?.textContent?.trim()).toContain('Copy');
        expect(items[1]?.textContent?.trim()).toContain('Paste');
        expect(items[2]?.textContent?.trim()).toContain('Delete');
        expect(items[0]?.textContent).toContain('⌘C');
        expect(items[1]?.textContent).toContain('⌘V');
        expect(items[2]?.className).toContain('pointer-events-none');
        expect(items[2]?.className).toContain('opacity-50');

        expect(document.querySelectorAll('[data-slot="context-menu-separator"]')).toHaveLength(1);
        const labels = document.querySelectorAll('[data-slot="context-menu-label"]');
        expect(labels).toHaveLength(1);
        expect(labels[0]?.textContent?.trim()).toBe('Actions');

        const subTriggers = document.querySelectorAll('[data-slot="context-menu-sub-trigger"]');
        expect(subTriggers).toHaveLength(1);
        expect(subTriggers[0]?.textContent?.trim()).toContain('More');
    });

    it('should not render auto-generated content when items is empty', async () => {
        fixture.componentInstance.items.set([]);
        fixture.detectChanges();

        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();

        const content = document.querySelector('[data-slot="context-menu-content"]');
        expect(content).toBeNull();
    });
});

@Component({
    template: `
        <ui-context-menu>
            <ui-context-menu-trigger>
                <div style="width: 200px; height: 100px; background: #eee;">Right-click here</div>
            </ui-context-menu-trigger>
            <ui-context-menu-content>
                <ui-context-menu-item>Custom Item</ui-context-menu-item>
                <ui-context-menu-sub>
                    <ui-context-menu-sub-trigger>More Options</ui-context-menu-sub-trigger>
                    <ui-context-menu-sub-content>
                        <ui-context-menu-item>Sub Action 1</ui-context-menu-item>
                        <ui-context-menu-item>Sub Action 2</ui-context-menu-item>
                    </ui-context-menu-sub-content>
                </ui-context-menu-sub>
            </ui-context-menu-content>
        </ui-context-menu>
    `,
    imports: [ContextMenuComponent, ContextMenuTriggerComponent, ContextMenuContentComponent, ContextMenuItemComponent, ContextMenuSubComponent, ContextMenuSubTriggerComponent, ContextMenuSubContentComponent]
})
class SubMenuTestHostComponent { }

describe('ContextMenu close on stopPropagation clicks', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        document.querySelectorAll('[data-context-menu-portal]').forEach(el => el.remove());
    });

    it('closes on a stopPropagation click outside the portal, but not on a click inside it', async () => {
        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        expect(contextMenuComp.componentInstance.open()).toBe(true);

        const portal = document.querySelector<HTMLElement>('[data-context-menu-portal]');
        expect(portal).toBeTruthy();
        const menuContent = portal!.querySelector<HTMLElement>('[data-slot="context-menu-content"]');
        expect(menuContent).toBeTruthy();
        menuContent!.click();
        expect(contextMenuComp.componentInstance.open()).toBe(true);

        const outsideEl = document.createElement('div');
        document.body.appendChild(outsideEl);
        outsideEl.addEventListener('click', (e) => e.stopPropagation());
        outsideEl.click();
        outsideEl.remove();

        expect(contextMenuComp.componentInstance.open()).toBe(false);
    });
});

@Component({
    template: `
        <ui-context-menu>
            <ui-context-menu-trigger>
                <div>Right-click here</div>
            </ui-context-menu-trigger>
            <ui-context-menu-content>
                <ui-context-menu-item>Custom Item</ui-context-menu-item>
                <ui-context-menu-sub>
                    <ui-context-menu-sub-trigger [disabled]="true">More Options</ui-context-menu-sub-trigger>
                    <ui-context-menu-sub-content>
                        <ui-context-menu-item>Sub Action 1</ui-context-menu-item>
                    </ui-context-menu-sub-content>
                </ui-context-menu-sub>
            </ui-context-menu-content>
        </ui-context-menu>
    `,
    imports: [ContextMenuComponent, ContextMenuTriggerComponent, ContextMenuContentComponent, ContextMenuItemComponent, ContextMenuSubComponent, ContextMenuSubTriggerComponent, ContextMenuSubContentComponent]
})
class DisabledSubTriggerHostComponent { }

describe('ContextMenu disabled sub-trigger', () => {
    let fixture: ComponentFixture<DisabledSubTriggerHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DisabledSubTriggerHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(DisabledSubTriggerHostComponent);
        fixture.detectChanges();
        fixture.debugElement.query(By.directive(ContextMenuComponent)).componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
    });

    afterEach(() => {
        fixture.destroy();
        document.querySelectorAll('[data-context-menu-portal]').forEach(el => el.remove());
    });

    function sub(): ContextMenuSubComponent {
        return fixture.debugElement.query(By.directive(ContextMenuSubComponent)).componentInstance as ContextMenuSubComponent;
    }

    function triggerRow(): HTMLElement {
        return document.querySelector('[data-slot="context-menu-sub-trigger"]') as HTMLElement;
    }

    it('marks the row disabled, and does not open the flyout on hover or from the keyboard', () => {
        expect(triggerRow().hasAttribute('data-disabled')).toBe(true);
        expect(triggerRow().getAttribute('aria-disabled')).toBe('true');

        triggerRow().dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        triggerRow().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        triggerRow().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        fixture.detectChanges();
        expect(sub().isOpen()).toBe(false);
    });
});

describe('ContextMenu sub-trigger hover', () => {
    let fixture: ComponentFixture<SubMenuTestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SubMenuTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SubMenuTestHostComponent);
        fixture.detectChanges();
        fixture.debugElement.query(By.directive(ContextMenuComponent)).componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
    });

    afterEach(() => {
        fixture.destroy();
        document.querySelectorAll('[data-context-menu-portal], [data-context-menu-sub-portal]').forEach(el => el.remove());
    });

    it('opens the flyout with its items when the pointer enters an enabled branch', async () => {
        const row = document.querySelector<HTMLElement>('[data-slot="context-menu-sub-trigger"]')!;
        row.dispatchEvent(new MouseEvent('mouseenter'));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(row.getAttribute('aria-expanded')).toBe('true');
        const flyout = document.querySelector('[data-slot="context-menu-sub-content"]');
        expect(flyout?.textContent).toContain('Sub Action 1');
    });
});

describe('ContextMenu sub timer teardown', () => {
    let fixture: ComponentFixture<SubMenuTestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SubMenuTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SubMenuTestHostComponent);
        fixture.detectChanges();
        fixture.debugElement.query(By.directive(ContextMenuComponent)).componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
    });

    afterEach(() => {
        vi.useRealTimers();
        document.querySelectorAll('[data-context-menu-portal]').forEach(el => el.remove());
    });

    it('cancels a pending close when the sub is destroyed inside the grace period', () => {
        vi.useFakeTimers();
        const sub = fixture.debugElement.query(By.directive(ContextMenuSubComponent)).componentInstance as ContextMenuSubComponent;
        sub.enter();
        fixture.detectChanges();
        sub.leave();
        fixture.destroy();
        vi.advanceTimersByTime(150);
        expect(sub.isOpen()).toBe(true);
    });
});
