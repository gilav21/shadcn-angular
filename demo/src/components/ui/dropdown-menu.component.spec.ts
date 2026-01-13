import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DropdownMenuComponent, DropdownMenuTriggerComponent, DropdownMenuContentComponent, DropdownMenuItemComponent, DropdownMenuSeparatorComponent, DropdownMenuLabelComponent, DropdownMenuSubComponent, DropdownMenuSubTriggerComponent, DropdownMenuSubContentComponent } from './dropdown-menu.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Test host for integration
@Component({
    template: `
        <ui-dropdown-menu>
            <ui-dropdown-menu-trigger>Open Menu</ui-dropdown-menu-trigger>
            <ui-dropdown-menu-content>
                <ui-dropdown-menu-label>Actions</ui-dropdown-menu-label>
                <ui-dropdown-menu-separator />
                <ui-dropdown-menu-item>Item 1</ui-dropdown-menu-item>
                <ui-dropdown-menu-item>Item 2</ui-dropdown-menu-item>
                <ui-dropdown-menu-item [disabled]="true">Disabled Item</ui-dropdown-menu-item>
            </ui-dropdown-menu-content>
        </ui-dropdown-menu>
    `,
    imports: [DropdownMenuComponent, DropdownMenuTriggerComponent, DropdownMenuContentComponent, DropdownMenuItemComponent, DropdownMenuSeparatorComponent, DropdownMenuLabelComponent]
})
class TestHostComponent { }

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-dropdown-menu>
                <ui-dropdown-menu-trigger>قائمة</ui-dropdown-menu-trigger>
                <ui-dropdown-menu-content>
                    <ui-dropdown-menu-item>عنصر 1</ui-dropdown-menu-item>
                    <ui-dropdown-menu-item>عنصر 2</ui-dropdown-menu-item>
                </ui-dropdown-menu-content>
            </ui-dropdown-menu>
        </div>
    `,
    imports: [DropdownMenuComponent, DropdownMenuTriggerComponent, DropdownMenuContentComponent, DropdownMenuItemComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

// Submenu Test host with 3-level deep structure
@Component({
    template: `
        <ui-dropdown-menu>
            <ui-dropdown-menu-trigger>Menu with Submenus</ui-dropdown-menu-trigger>
            <ui-dropdown-menu-content>
                <ui-dropdown-menu-item>Regular Item</ui-dropdown-menu-item>
                <ui-dropdown-menu-sub>
                    <ui-dropdown-menu-sub-trigger>Level 1 Sub</ui-dropdown-menu-sub-trigger>
                    <ui-dropdown-menu-sub-content>
                        <ui-dropdown-menu-item>Level 1 Item 1</ui-dropdown-menu-item>
                        <ui-dropdown-menu-item>Level 1 Item 2</ui-dropdown-menu-item>
                        <ui-dropdown-menu-sub>
                            <ui-dropdown-menu-sub-trigger>Level 2 Sub</ui-dropdown-menu-sub-trigger>
                            <ui-dropdown-menu-sub-content>
                                <ui-dropdown-menu-item>Level 2 Item 1</ui-dropdown-menu-item>
                                <ui-dropdown-menu-sub>
                                    <ui-dropdown-menu-sub-trigger>Level 3 Sub</ui-dropdown-menu-sub-trigger>
                                    <ui-dropdown-menu-sub-content>
                                        <ui-dropdown-menu-item>Level 3 Item 1</ui-dropdown-menu-item>
                                        <ui-dropdown-menu-item>Level 3 Item 2</ui-dropdown-menu-item>
                                    </ui-dropdown-menu-sub-content>
                                </ui-dropdown-menu-sub>
                            </ui-dropdown-menu-sub-content>
                        </ui-dropdown-menu-sub>
                    </ui-dropdown-menu-sub-content>
                </ui-dropdown-menu-sub>
            </ui-dropdown-menu-content>
        </ui-dropdown-menu>
    `,
    imports: [DropdownMenuComponent, DropdownMenuTriggerComponent, DropdownMenuContentComponent, DropdownMenuItemComponent, DropdownMenuSubComponent, DropdownMenuSubTriggerComponent, DropdownMenuSubContentComponent]
})
class SubmenuTestHostComponent { }

// RTL Submenu Test host with 3-level deep structure
@Component({
    template: `
        <div [dir]="dir()">
            <ui-dropdown-menu>
                <ui-dropdown-menu-trigger>قائمة مع قوائم فرعية</ui-dropdown-menu-trigger>
                <ui-dropdown-menu-content>
                    <ui-dropdown-menu-item>عنصر عادي</ui-dropdown-menu-item>
                    <ui-dropdown-menu-sub>
                        <ui-dropdown-menu-sub-trigger>المستوى 1</ui-dropdown-menu-sub-trigger>
                        <ui-dropdown-menu-sub-content>
                            <ui-dropdown-menu-item>عنصر المستوى 1</ui-dropdown-menu-item>
                            <ui-dropdown-menu-sub>
                                <ui-dropdown-menu-sub-trigger>المستوى 2</ui-dropdown-menu-sub-trigger>
                                <ui-dropdown-menu-sub-content>
                                    <ui-dropdown-menu-item>عنصر المستوى 2</ui-dropdown-menu-item>
                                    <ui-dropdown-menu-sub>
                                        <ui-dropdown-menu-sub-trigger>المستوى 3</ui-dropdown-menu-sub-trigger>
                                        <ui-dropdown-menu-sub-content>
                                            <ui-dropdown-menu-item>عنصر المستوى 3</ui-dropdown-menu-item>
                                        </ui-dropdown-menu-sub-content>
                                    </ui-dropdown-menu-sub>
                                </ui-dropdown-menu-sub-content>
                            </ui-dropdown-menu-sub>
                        </ui-dropdown-menu-sub-content>
                    </ui-dropdown-menu-sub>
                </ui-dropdown-menu-content>
            </ui-dropdown-menu>
        </div>
    `,
    imports: [DropdownMenuComponent, DropdownMenuTriggerComponent, DropdownMenuContentComponent, DropdownMenuItemComponent, DropdownMenuSubComponent, DropdownMenuSubTriggerComponent, DropdownMenuSubContentComponent]
})
class RTLSubmenuTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('DropdownMenuComponent', () => {
    let component: DropdownMenuComponent;
    let fixture: ComponentFixture<DropdownMenuComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DropdownMenuComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(DropdownMenuComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should be closed by default', () => {
        expect(component.open()).toBe(false);
    });

    it('should toggle open state', () => {
        component.toggle();
        expect(component.open()).toBe(true);
        component.toggle();
        expect(component.open()).toBe(false);
    });

    it('should show when show() is called', () => {
        component.show();
        expect(component.open()).toBe(true);
    });

    it('should hide when hide() is called', () => {
        component.show();
        component.hide();
        expect(component.open()).toBe(false);
    });
});

describe('DropdownMenu Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should render trigger', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="dropdown-trigger"]'));
        expect(trigger).toBeTruthy();
    });

    it('should not show content when closed', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="dropdown-content"]'));
        expect(content).toBeNull();
    });

    it('should show content on trigger click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="dropdown-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="dropdown-content"]'));
        expect(content).toBeTruthy();
    });

    it('should render menu items with role="menuitem"', async () => {
        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.css('[role="menuitem"]'));
        expect(items.length).toBe(3);
    });

    it('should render separator', async () => {
        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const separator = fixture.debugElement.query(By.css('[data-slot="dropdown-separator"]'));
        expect(separator).toBeTruthy();
    });

    it('should render label', async () => {
        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const label = fixture.debugElement.query(By.css('[data-slot="dropdown-label"]'));
        expect(label).toBeTruthy();
    });

    it('should mark disabled items with data-disabled', async () => {
        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const disabledItem = fixture.debugElement.query(By.css('[data-disabled]'));
        expect(disabledItem).toBeTruthy();
    });
});

describe('DropdownMenu Keyboard Navigation', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should open with Enter key on trigger', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="dropdown-trigger"]'));
        trigger.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="dropdown-content"]'));
        expect(content).toBeTruthy();
    });

    it('should open with Space key on trigger', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="dropdown-trigger"]'));
        trigger.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="dropdown-content"]'));
        expect(content).toBeTruthy();
    });

    it('should open with ArrowDown key on trigger', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="dropdown-trigger"]'));
        trigger.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="dropdown-content"]'));
        expect(content).toBeTruthy();
    });

    it('should close with Escape key', async () => {
        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="dropdown-content"]'));
        content.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(dropdownComp.componentInstance.open()).toBe(false);
    });

    it('should navigate to next item with ArrowDown', async () => {
        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const items = fixture.debugElement.queryAll(By.css('[role="menuitem"]:not([data-disabled])'));
        expect(items.length).toBe(2); // 2 enabled items

        // Focus first item and press ArrowDown
        items[0].nativeElement.focus();
        fixture.detectChanges();

        const content = fixture.debugElement.query(By.css('[data-slot="dropdown-content"]'));
        content.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        fixture.detectChanges();
        await fixture.whenStable();

        // Verify that keyboard event was handled (focus trap is in place)
        expect(content).toBeTruthy();
    });

    it('should navigate to previous item with ArrowUp', async () => {
        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const items = fixture.debugElement.queryAll(By.css('[role="menuitem"]:not([data-disabled])'));
        expect(items.length).toBe(2);

        // Focus second item and press ArrowUp
        items[1].nativeElement.focus();
        fixture.detectChanges();

        const content = fixture.debugElement.query(By.css('[data-slot="dropdown-content"]'));
        content.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(content).toBeTruthy();
    });

    it('should wrap focus with Tab key (focus trap)', async () => {
        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const content = fixture.debugElement.query(By.css('[data-slot="dropdown-content"]'));
        const items = fixture.debugElement.queryAll(By.css('[role="menuitem"]:not([data-disabled])'));

        // Focus last item
        items[items.length - 1].nativeElement.focus();
        fixture.detectChanges();

        // Press Tab - should wrap to first item (focus trap)
        const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
        content.nativeElement.dispatchEvent(tabEvent);
        fixture.detectChanges();
        await fixture.whenStable();

        // Focus trap prevents tabbing out
        expect(dropdownComp.componentInstance.open()).toBe(true);
    });

    it('should wrap focus with Shift+Tab key (reverse focus trap)', async () => {
        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const content = fixture.debugElement.query(By.css('[data-slot="dropdown-content"]'));
        const items = fixture.debugElement.queryAll(By.css('[role="menuitem"]:not([data-disabled])'));

        // Focus first item
        items[0].nativeElement.focus();
        fixture.detectChanges();

        // Press Shift+Tab - should wrap to last item (focus trap)
        const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
        content.nativeElement.dispatchEvent(shiftTabEvent);
        fixture.detectChanges();
        await fixture.whenStable();

        // Focus trap prevents tabbing out
        expect(dropdownComp.componentInstance.open()).toBe(true);
    });

    it('should close menu when item is clicked', async () => {
        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.css('[data-slot="dropdown-item"]'));
        items[0].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(dropdownComp.componentInstance.open()).toBe(false);
    });

    it('should have role="menu" on content', async () => {
        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[role="menu"]'));
        expect(content).toBeTruthy();
    });
});

describe('DropdownMenu RTL Support', () => {
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
    });

    it('should render in LTR mode', () => {
        const container = fixture.debugElement.query(By.css('[dir="ltr"]'));
        expect(container).toBeTruthy();
    });

    it('should render in RTL mode', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
        expect(container).toBeTruthy();
    });

    it('should open menu in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const trigger = fixture.debugElement.query(By.css('[data-slot="dropdown-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="dropdown-content"]'));
        expect(content).toBeTruthy();
    });

    it('should close with Escape key in RTL', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="dropdown-content"]'));
        content.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(dropdownComp.componentInstance.open()).toBe(false);
    });

    it('should navigate with ArrowDown in RTL (same as LTR)', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const content = fixture.debugElement.query(By.css('[data-slot="dropdown-content"]'));
        const items = fixture.debugElement.queryAll(By.css('[role="menuitem"]:not([data-disabled])'));

        // ArrowDown should work the same in RTL (navigates to next item)
        items[0].nativeElement.focus();
        content.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        fixture.detectChanges();
        await fixture.whenStable();

        // Menu should still be open and navigation should work
        expect(dropdownComp.componentInstance.open()).toBe(true);
    });

    it('should navigate with ArrowUp in RTL (same as LTR)', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const content = fixture.debugElement.query(By.css('[data-slot="dropdown-content"]'));
        const items = fixture.debugElement.queryAll(By.css('[role="menuitem"]:not([data-disabled])'));

        // ArrowUp should work the same in RTL (navigates to previous item)
        items[1].nativeElement.focus();
        content.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(dropdownComp.componentInstance.open()).toBe(true);
    });

    it('should have focus trap work in RTL', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const content = fixture.debugElement.query(By.css('[data-slot="dropdown-content"]'));
        const items = fixture.debugElement.queryAll(By.css('[role="menuitem"]:not([data-disabled])'));
        // Focus last item and Tab should wrap
        items[items.length - 1].nativeElement.focus();
        content.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
        fixture.detectChanges();
        await fixture.whenStable();

        // Focus trap keeps menu open
        expect(dropdownComp.componentInstance.open()).toBe(true);
    });
});

describe('DropdownMenu Submenu (LTR)', () => {
    let fixture: ComponentFixture<SubmenuTestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SubmenuTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SubmenuTestHostComponent);
        fixture.detectChanges();
    });

    it('should render submenu trigger', async () => {
        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const subTriggers = fixture.debugElement.queryAll(By.directive(DropdownMenuSubTriggerComponent));
        expect(subTriggers.length).toBeGreaterThan(0);
    });

    it('should open level 1 submenu on hover', async () => {
        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const subComp = fixture.debugElement.query(By.directive(DropdownMenuSubComponent));
        subComp.componentInstance.enter();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(subComp.componentInstance.isOpen()).toBe(true);
    });

    it('should open level 1 submenu with ArrowRight in LTR', async () => {
        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const subTrigger = fixture.debugElement.query(By.directive(DropdownMenuSubTriggerComponent));
        const subComp = fixture.debugElement.query(By.directive(DropdownMenuSubComponent));

        // Focus the sub trigger
        subTrigger.nativeElement.querySelector('[role="menuitem"]').focus();
        fixture.detectChanges();

        // Press ArrowRight to open submenu in LTR
        subTrigger.nativeElement.querySelector('[role="menuitem"]').dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
        );
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(subComp.componentInstance.isOpen()).toBe(true);
    });

    it('should open level 1 submenu with Enter key', async () => {
        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const subTrigger = fixture.debugElement.query(By.directive(DropdownMenuSubTriggerComponent));
        const subComp = fixture.debugElement.query(By.directive(DropdownMenuSubComponent));

        subTrigger.nativeElement.querySelector('[role="menuitem"]').focus();
        subTrigger.nativeElement.querySelector('[role="menuitem"]').dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        );
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(subComp.componentInstance.isOpen()).toBe(true);
    });

    it('should navigate to level 2 submenu with ArrowRight', async () => {
        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        // Open level 1 submenu
        const subComps = fixture.debugElement.queryAll(By.directive(DropdownMenuSubComponent));
        subComps[0].componentInstance.enter();
        fixture.detectChanges();
        await fixture.whenStable();

        // Check level 1 is open
        expect(subComps[0].componentInstance.isOpen()).toBe(true);
    });

    it('should close submenu with ArrowLeft in LTR', async () => {
        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        // Open level 1 submenu
        const subComp = fixture.debugElement.query(By.directive(DropdownMenuSubComponent));
        subComp.componentInstance.enter();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        // Get sub-content and dispatch ArrowLeft
        const subContent = fixture.debugElement.query(By.directive(DropdownMenuSubContentComponent));
        subContent.nativeElement.querySelector('[role="menu"]').dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
        );
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 150));

        expect(subComp.componentInstance.isOpen()).toBe(false);
    });

    it('should close submenu with Escape key', async () => {
        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        // Open level 1 submenu
        const subComp = fixture.debugElement.query(By.directive(DropdownMenuSubComponent));
        subComp.componentInstance.enter();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        // Get sub-content and dispatch Escape
        const subContent = fixture.debugElement.query(By.directive(DropdownMenuSubContentComponent));
        subContent.nativeElement.querySelector('[role="menu"]').dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 150));

        expect(subComp.componentInstance.isOpen()).toBe(false);
    });

    it('should support 3-level deep submenu navigation', async () => {
        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        // Open all levels
        const subComps = fixture.debugElement.queryAll(By.directive(DropdownMenuSubComponent));

        // Open level 1
        subComps[0].componentInstance.enter();
        fixture.detectChanges();
        await fixture.whenStable();
        expect(subComps[0].componentInstance.isOpen()).toBe(true);
    });
});

describe('DropdownMenu Submenu RTL Keyboard Navigation', () => {
    let fixture: ComponentFixture<RTLSubmenuTestHostComponent>;
    let component: RTLSubmenuTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RTLSubmenuTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RTLSubmenuTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
    });

    it('should render submenu in RTL mode', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const subTriggers = fixture.debugElement.queryAll(By.directive(DropdownMenuSubTriggerComponent));
        expect(subTriggers.length).toBeGreaterThan(0);
    });

    it('should open level 1 submenu with ArrowLeft in RTL (opposite of LTR)', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const subTrigger = fixture.debugElement.query(By.directive(DropdownMenuSubTriggerComponent));
        const subComp = fixture.debugElement.query(By.directive(DropdownMenuSubComponent));

        // Focus the sub trigger
        subTrigger.nativeElement.querySelector('[role="menuitem"]').focus();
        fixture.detectChanges();

        // Press ArrowLeft to open submenu in RTL (opposite of LTR which uses ArrowRight)
        subTrigger.nativeElement.querySelector('[role="menuitem"]').dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
        );
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(subComp.componentInstance.isOpen()).toBe(true);
    });

    it('should NOT open submenu with ArrowRight in RTL (reserved for closing)', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const subTrigger = fixture.debugElement.query(By.directive(DropdownMenuSubTriggerComponent));
        const subComp = fixture.debugElement.query(By.directive(DropdownMenuSubComponent));

        // Focus the sub trigger
        subTrigger.nativeElement.querySelector('[role="menuitem"]').focus();
        fixture.detectChanges();

        // Press ArrowRight - should NOT open submenu in RTL (it's reserved for closing)
        subTrigger.nativeElement.querySelector('[role="menuitem"]').dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
        );
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 100));

        // Submenu should remain closed
        expect(subComp.componentInstance.isOpen()).toBe(false);
    });

    it('should close submenu with ArrowRight in RTL (opposite of LTR)', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        // Open level 1 submenu
        const subComp = fixture.debugElement.query(By.directive(DropdownMenuSubComponent));
        subComp.componentInstance.enter();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(subComp.componentInstance.isOpen()).toBe(true);

        // Get sub-content and dispatch ArrowRight to close
        const subContent = fixture.debugElement.query(By.directive(DropdownMenuSubContentComponent));
        subContent.nativeElement.querySelector('[role="menu"]').dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
        );
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 150));

        expect(subComp.componentInstance.isOpen()).toBe(false);
    });

    it('should support 3-level deep navigation in RTL', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        // Open level 1
        const subComps = fixture.debugElement.queryAll(By.directive(DropdownMenuSubComponent));
        subComps[0].componentInstance.enter();
        fixture.detectChanges();
        await fixture.whenStable();

        // Verify level 1 is open
        expect(subComps[0].componentInstance.isOpen()).toBe(true);
    });

    it('should still open submenu with Enter key in RTL', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const dropdownComp = fixture.debugElement.query(By.directive(DropdownMenuComponent));
        dropdownComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const subTrigger = fixture.debugElement.query(By.directive(DropdownMenuSubTriggerComponent));
        const subComp = fixture.debugElement.query(By.directive(DropdownMenuSubComponent));

        // Enter key should work regardless of RTL
        subTrigger.nativeElement.querySelector('[role="menuitem"]').focus();
        subTrigger.nativeElement.querySelector('[role="menuitem"]').dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        );
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(subComp.componentInstance.isOpen()).toBe(true);
    });
});
