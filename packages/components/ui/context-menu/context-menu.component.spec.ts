import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContextMenuComponent, ContextMenuTriggerComponent, ContextMenuContentComponent, ContextMenuItemComponent, ContextMenuSeparatorComponent, ContextMenuLabelComponent, ContextMenuShortcutComponent, ContextMenuItem, ContextMenuSubComponent, ContextMenuSubTriggerComponent, ContextMenuSubContentComponent } from './';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

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

// RTL Test host with shortcuts for proper layout verification
@Component({
    template: `
        <div [dir]="dir()">
            <ui-context-menu>
                <ui-context-menu-trigger>
                    <div style="width: 200px;">انقر بزر الفأرة الأيمن</div>
                </ui-context-menu-trigger>
                <ui-context-menu-content>
                    <ui-context-menu-item>
                        نسخ
                        <ui-context-menu-shortcut>⌘C</ui-context-menu-shortcut>
                    </ui-context-menu-item>
                    <ui-context-menu-item>
                        لصق
                        <ui-context-menu-shortcut>⌘V</ui-context-menu-shortcut>
                    </ui-context-menu-item>
                </ui-context-menu-content>
            </ui-context-menu>
        </div>
    `,
    imports: [ContextMenuComponent, ContextMenuTriggerComponent, ContextMenuContentComponent, ContextMenuItemComponent, ContextMenuShortcutComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

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

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="context-menu"', () => {
        expect(fixture.nativeElement.dataset.slot).toBe('context-menu');
    });

    it('should be closed by default', () => {
        expect(component.open()).toBe(false);
    });

    it('should show at position', () => {
        component.show(100, 200);
        expect(component.open()).toBe(true);
        expect(component.position()).toEqual({ x: 100, y: 200 });
    });

    it('should close', () => {
        component.show(100, 200);
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

    it('should render trigger', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="context-menu-trigger"]'));
        expect(trigger).toBeTruthy();
    });

    it('should not show content when closed', () => {
        const content = document.querySelector('[data-slot="context-menu-content"]');
        expect(content).toBeNull();
    });

    it('should show content on right-click', async () => {
        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const content = document.querySelector('[data-slot="context-menu-content"]');
        expect(content).toBeTruthy();
    });

    it('should render menu items', async () => {
        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const items = document.querySelectorAll('[data-slot="context-menu-item"]');
        expect(items).toHaveLength(3);
    });

    it('should render separator', async () => {
        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const separator = document.querySelector('[data-slot="context-menu-separator"]');
        expect(separator).toBeTruthy();
    });

    it('should render label', async () => {
        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const label = document.querySelector('[data-slot="context-menu-label"]');
        expect(label).toBeTruthy();
    });
});

describe('ContextMenu RTL Support', () => {
    let fixture: ComponentFixture<RTLTestHostComponent>;
    let component: RTLTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RTLTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RTLTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
        document.querySelectorAll('[data-context-menu-portal]').forEach(el => el.remove());
    });

    it('should render in LTR mode', () => {
        const container = fixture.debugElement.query(By.css('[dir="ltr"]'));
        expect(container).toBeTruthy();
    });

    it('should render in RTL mode', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
        expect(container).toBeTruthy();
    });

    it('should open context menu in RTL', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const content = document.querySelector('[data-slot="context-menu-content"]');
        expect(content).toBeTruthy();
    });

    it('should have shortcut with RTL margin class (mr-auto pushes to left)', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        // The shortcut should have rtl:mr-auto class which pushes it to the left in RTL
        const shortcut = document.querySelector('[data-slot="context-menu-shortcut"]');
        expect(shortcut).toBeTruthy();
        const shortcutClass = shortcut?.className ?? '';
        // Verify the RTL-specific class is present
        expect(shortcutClass).toContain('rtl:mr-auto');
        expect(shortcutClass).toContain('ltr:ml-auto');
    });

    it('should render menu items in RTL', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const items = document.querySelectorAll('[data-slot="context-menu-item"]');
        expect(items).toHaveLength(2);
    });

    it('should render shortcuts in RTL', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const shortcuts = document.querySelectorAll('[data-slot="context-menu-shortcut"]');
        expect(shortcuts).toHaveLength(2);
        // Verify shortcut text
        expect(shortcuts[0]?.textContent).toContain('⌘C');
        expect(shortcuts[1]?.textContent).toContain('⌘V');
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

    it('should render auto-generated menu items from items input', async () => {
        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const items = document.querySelectorAll('[data-slot="context-menu-item"]');
        expect(items).toHaveLength(3);
        expect(items[0]?.textContent?.trim()).toContain('Copy');
        expect(items[1]?.textContent?.trim()).toContain('Paste');
        expect(items[2]?.textContent?.trim()).toContain('Delete');
    });

    it('should render separator from items input', async () => {
        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const separators = document.querySelectorAll('[data-slot="context-menu-separator"]');
        expect(separators).toHaveLength(1);
    });

    it('should render label from items input', async () => {
        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const labels = document.querySelectorAll('[data-slot="context-menu-label"]');
        expect(labels).toHaveLength(1);
        expect(labels[0]?.textContent?.trim()).toBe('Actions');
    });

    it('should render disabled item from items input', async () => {
        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const items = document.querySelectorAll('[data-slot="context-menu-item"]');
        const deleteItem = items[2];
        expect(deleteItem?.className).toContain('pointer-events-none');
        expect(deleteItem?.className).toContain('opacity-50');
    });

    it('should render sub-menu trigger from items input', async () => {
        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const subTriggers = document.querySelectorAll('[data-slot="context-menu-sub-trigger"]');
        expect(subTriggers).toHaveLength(1);
        expect(subTriggers[0]?.textContent?.trim()).toContain('More');
    });

    it('should render shortcuts from items input', async () => {
        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const items = document.querySelectorAll('[data-slot="context-menu-item"]');
        expect(items[0]?.textContent).toContain('⌘C');
        expect(items[1]?.textContent).toContain('⌘V');
    });

    it('should not render auto-generated content when items is empty', async () => {
        fixture.componentInstance.items.set([]);
        fixture.detectChanges();

        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

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

describe('ContextMenu Sub-Menu (Template-Driven)', () => {
    let fixture: ComponentFixture<SubMenuTestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SubMenuTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SubMenuTestHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        document.querySelectorAll('[data-context-menu-portal]').forEach(el => el.remove());
    });

    it('should render sub-menu trigger', async () => {
        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const subTrigger = document.querySelector('[data-slot="context-menu-sub-trigger"]');
        expect(subTrigger).toBeTruthy();
        expect(subTrigger?.textContent?.trim()).toContain('More Options');
    });

    it('should not show sub-content initially', async () => {
        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const subContent = document.querySelector('[data-slot="context-menu-sub-content"]');
        expect(subContent).toBeNull();
    });
});

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

    it('should close when a click with stopPropagation is dispatched outside the portal', async () => {
        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(contextMenuComp.componentInstance.open()).toBe(true);

        const outsideEl = document.createElement('div');
        document.body.appendChild(outsideEl);

        outsideEl.addEventListener('click', (e) => e.stopPropagation());
        outsideEl.click();
        outsideEl.remove();

        expect(contextMenuComp.componentInstance.open()).toBe(false);
    });

    it('should NOT close when clicking inside the portal', async () => {
        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(contextMenuComp.componentInstance.open()).toBe(true);

        const portal = document.querySelector<HTMLElement>('[data-context-menu-portal]');
        expect(portal).toBeTruthy();

        const menuContent = portal!.querySelector<HTMLElement>('[data-slot="context-menu-content"]');
        expect(menuContent).toBeTruthy();
        menuContent!.click();

        expect(contextMenuComp.componentInstance.open()).toBe(true);
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
        await new Promise(resolve => setTimeout(resolve, 50));
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

    it('marks the row with data-disabled and aria-disabled', () => {
        expect(triggerRow().hasAttribute('data-disabled')).toBe(true);
        expect(triggerRow().getAttribute('aria-disabled')).toBe('true');
    });

    it('does not open the flyout on hover', () => {
        triggerRow().dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        fixture.detectChanges();
        expect(sub().isOpen()).toBe(false);
    });

    it('does not open the flyout from the keyboard', () => {
        triggerRow().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        expect(sub().isOpen()).toBe(false);
        triggerRow().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        fixture.detectChanges();
        expect(sub().isOpen()).toBe(false);
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
        await new Promise(resolve => setTimeout(resolve, 50));
    });

    afterEach(() => {
        document.querySelectorAll('[data-context-menu-portal]').forEach(el => el.remove());
    });

    it('cancels a pending close when the sub is destroyed inside the grace period', async () => {
        const sub = fixture.debugElement.query(By.directive(ContextMenuSubComponent)).componentInstance as ContextMenuSubComponent;
        sub.enter();
        fixture.detectChanges();
        sub.leave();
        fixture.destroy();
        await new Promise(resolve => setTimeout(resolve, 150));
        expect(sub.isOpen()).toBe(true);
    });
});
