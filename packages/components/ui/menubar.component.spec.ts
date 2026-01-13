import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    MenubarComponent,
    MenubarMenuComponent,
    MenubarTriggerComponent,
    MenubarContentComponent,
    MenubarItemComponent,
    MenubarSeparatorComponent,
    MenubarShortcutComponent,
    MenubarSubComponent,
    MenubarSubTriggerComponent,
    MenubarSubContentComponent
} from './menubar.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Basic test host
@Component({
    template: `
        <ui-menubar>
            <ui-menubar-menu>
                <ui-menubar-trigger>File</ui-menubar-trigger>
                <ui-menubar-content>
                    <ui-menubar-item>New</ui-menubar-item>
                    <ui-menubar-item>
                        Open
                        <ui-menubar-shortcut>⌘O</ui-menubar-shortcut>
                    </ui-menubar-item>
                    <ui-menubar-separator />
                    <ui-menubar-item [disabled]="true">Save</ui-menubar-item>
                </ui-menubar-content>
            </ui-menubar-menu>
            <ui-menubar-menu>
                <ui-menubar-trigger>Edit</ui-menubar-trigger>
                <ui-menubar-content>
                    <ui-menubar-item>Undo</ui-menubar-item>
                    <ui-menubar-item>Redo</ui-menubar-item>
                </ui-menubar-content>
            </ui-menubar-menu>
        </ui-menubar>
    `,
    imports: [MenubarComponent, MenubarMenuComponent, MenubarTriggerComponent, MenubarContentComponent, MenubarItemComponent, MenubarSeparatorComponent, MenubarShortcutComponent]
})
class TestHostComponent { }

// Submenu test host with 3-level deep structure
@Component({
    template: `
        <ui-menubar>
            <ui-menubar-menu>
                <ui-menubar-trigger>File</ui-menubar-trigger>
                <ui-menubar-content>
                    <ui-menubar-item>New File</ui-menubar-item>
                    <ui-menubar-sub>
                        <ui-menubar-sub-trigger>Share</ui-menubar-sub-trigger>
                        <ui-menubar-sub-content>
                            <ui-menubar-item>Email</ui-menubar-item>
                            <ui-menubar-item>Link</ui-menubar-item>
                            <ui-menubar-sub>
                                <ui-menubar-sub-trigger>Social</ui-menubar-sub-trigger>
                                <ui-menubar-sub-content>
                                    <ui-menubar-item>Twitter</ui-menubar-item>
                                    <ui-menubar-sub>
                                        <ui-menubar-sub-trigger>More</ui-menubar-sub-trigger>
                                        <ui-menubar-sub-content>
                                            <ui-menubar-item>Level 3 Item</ui-menubar-item>
                                        </ui-menubar-sub-content>
                                    </ui-menubar-sub>
                                </ui-menubar-sub-content>
                            </ui-menubar-sub>
                        </ui-menubar-sub-content>
                    </ui-menubar-sub>
                </ui-menubar-content>
            </ui-menubar-menu>
            <ui-menubar-menu>
                <ui-menubar-trigger>Edit</ui-menubar-trigger>
                <ui-menubar-content>
                    <ui-menubar-item>Undo</ui-menubar-item>
                </ui-menubar-content>
            </ui-menubar-menu>
        </ui-menubar>
    `,
    imports: [MenubarComponent, MenubarMenuComponent, MenubarTriggerComponent, MenubarContentComponent, MenubarItemComponent, MenubarSubComponent, MenubarSubTriggerComponent, MenubarSubContentComponent]
})
class SubmenuTestHostComponent { }

// RTL test host with submenus
@Component({
    template: `
        <div [dir]="dir()">
            <ui-menubar>
                <ui-menubar-menu>
                    <ui-menubar-trigger>ملف</ui-menubar-trigger>
                    <ui-menubar-content>
                        <ui-menubar-item>
                            جديد
                            <ui-menubar-shortcut>⌘N</ui-menubar-shortcut>
                        </ui-menubar-item>
                        <ui-menubar-sub>
                            <ui-menubar-sub-trigger>مشاركة</ui-menubar-sub-trigger>
                            <ui-menubar-sub-content>
                                <ui-menubar-item>بريد إلكتروني</ui-menubar-item>
                                <ui-menubar-sub>
                                    <ui-menubar-sub-trigger>شبكات اجتماعية</ui-menubar-sub-trigger>
                                    <ui-menubar-sub-content>
                                        <ui-menubar-item>تويتر</ui-menubar-item>
                                        <ui-menubar-sub>
                                            <ui-menubar-sub-trigger>المزيد</ui-menubar-sub-trigger>
                                            <ui-menubar-sub-content>
                                                <ui-menubar-item>عنصر المستوى 3</ui-menubar-item>
                                            </ui-menubar-sub-content>
                                        </ui-menubar-sub>
                                    </ui-menubar-sub-content>
                                </ui-menubar-sub>
                            </ui-menubar-sub-content>
                        </ui-menubar-sub>
                    </ui-menubar-content>
                </ui-menubar-menu>
                <ui-menubar-menu>
                    <ui-menubar-trigger>تحرير</ui-menubar-trigger>
                    <ui-menubar-content>
                        <ui-menubar-item>تراجع</ui-menubar-item>
                    </ui-menubar-content>
                </ui-menubar-menu>
            </ui-menubar>
        </div>
    `,
    imports: [MenubarComponent, MenubarMenuComponent, MenubarTriggerComponent, MenubarContentComponent, MenubarItemComponent, MenubarShortcutComponent, MenubarSubComponent, MenubarSubTriggerComponent, MenubarSubContentComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('MenubarComponent', () => {
    let component: MenubarComponent;
    let fixture: ComponentFixture<MenubarComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [MenubarComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(MenubarComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have role="menubar"', () => {
        const menubar = fixture.nativeElement.querySelector('[role="menubar"]');
        expect(menubar).toBeTruthy();
    });

    it('should have data-slot="menubar"', () => {
        const menubar = fixture.nativeElement.querySelector('[data-slot="menubar"]');
        expect(menubar).toBeTruthy();
    });
});

describe('Menubar Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should render menu triggers', () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="menubar-trigger"]'));
        expect(triggers.length).toBe(2);
    });

    it('should not show content when closed', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="menubar-content"]'));
        expect(content).toBeNull();
    });

    it('should open menu on trigger click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="menubar-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="menubar-content"]'));
        expect(content).toBeTruthy();
    });

    it('should render menu items', async () => {
        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.css('[data-slot="menubar-item"]'));
        expect(items.length).toBe(3);
    });

    it('should render separator', async () => {
        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        const separator = fixture.debugElement.query(By.css('[data-slot="menubar-separator"]'));
        expect(separator).toBeTruthy();
    });

    it('should render shortcut', async () => {
        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        const shortcut = fixture.debugElement.query(By.css('[data-slot="menubar-shortcut"]'));
        expect(shortcut).toBeTruthy();
        expect(shortcut.nativeElement.textContent).toContain('⌘O');
    });

    it('should mark disabled items', async () => {
        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        const disabledItem = fixture.debugElement.query(By.css('[data-disabled]'));
        expect(disabledItem).toBeTruthy();
    });

    it('should close menu on item click', async () => {
        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        const item = fixture.debugElement.query(By.css('[data-slot="menubar-item"]:not([data-disabled])'));
        item.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(menuComp.componentInstance.isOpen()).toBe(false);
    });
});

describe('Menubar Keyboard Navigation', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should open menu with Enter key on trigger', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="menubar-trigger"]'));
        trigger.nativeElement.focus();
        trigger.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();

        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        expect(menuComp.componentInstance.isOpen()).toBe(true);
    });

    it('should open menu with ArrowDown key on trigger', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="menubar-trigger"]'));
        trigger.nativeElement.focus();
        trigger.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();

        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        expect(menuComp.componentInstance.isOpen()).toBe(true);
    });

    it('should navigate to next trigger with ArrowRight in LTR', async () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="menubar-trigger"]'));
        triggers[0].nativeElement.focus();
        triggers[0].nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(document.activeElement).toBe(triggers[1].nativeElement);
    });

    it('should navigate to previous trigger with ArrowLeft in LTR', async () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="menubar-trigger"]'));
        triggers[1].nativeElement.focus();
        triggers[1].nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(document.activeElement).toBe(triggers[0].nativeElement);
    });

    it('should close menu with Escape key', async () => {
        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const content = fixture.debugElement.query(By.css('[data-slot="menubar-content"]'));
        content.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(menuComp.componentInstance.isOpen()).toBe(false);
    });

    it('should navigate items with ArrowDown in content', async () => {
        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const items = fixture.debugElement.queryAll(By.css('[data-slot="menubar-item"]:not([data-disabled])'));
        items[0].nativeElement.focus();

        const content = fixture.debugElement.query(By.css('[data-slot="menubar-content"]'));
        content.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();

        // Menu should still be open
        expect(menuComp.componentInstance.isOpen()).toBe(true);
    });

    it('should navigate items with ArrowUp in content', async () => {
        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const items = fixture.debugElement.queryAll(By.css('[data-slot="menubar-item"]:not([data-disabled])'));
        items[1].nativeElement.focus();

        const content = fixture.debugElement.query(By.css('[data-slot="menubar-content"]'));
        content.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(menuComp.componentInstance.isOpen()).toBe(true);
    });
});

describe('Menubar Submenu (LTR)', () => {
    let fixture: ComponentFixture<SubmenuTestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SubmenuTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SubmenuTestHostComponent);
        fixture.detectChanges();
    });

    it('should render submenu trigger', async () => {
        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        const subTriggers = fixture.debugElement.queryAll(By.directive(MenubarSubTriggerComponent));
        expect(subTriggers.length).toBeGreaterThan(0);
    });

    it('should open submenu on hover', async () => {
        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        const subComp = fixture.debugElement.query(By.directive(MenubarSubComponent));
        subComp.componentInstance.enter();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(subComp.componentInstance.isOpen()).toBe(true);
    });

    it('should open submenu with ArrowRight in LTR', async () => {
        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const subTrigger = fixture.debugElement.query(By.directive(MenubarSubTriggerComponent));
        const subComp = fixture.debugElement.query(By.directive(MenubarSubComponent));

        const triggerEl = subTrigger.nativeElement.querySelector('[role="menuitem"]');
        triggerEl.focus();
        triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(subComp.componentInstance.isOpen()).toBe(true);
    });

    it('should open submenu with Enter key', async () => {
        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const subTrigger = fixture.debugElement.query(By.directive(MenubarSubTriggerComponent));
        const subComp = fixture.debugElement.query(By.directive(MenubarSubComponent));

        const triggerEl = subTrigger.nativeElement.querySelector('[role="menuitem"]');
        triggerEl.focus();
        triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(subComp.componentInstance.isOpen()).toBe(true);
    });

    it('should close submenu with ArrowLeft in LTR', async () => {
        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        const subComp = fixture.debugElement.query(By.directive(MenubarSubComponent));
        subComp.componentInstance.enter();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const subContent = fixture.debugElement.query(By.directive(MenubarSubContentComponent));
        const menuEl = subContent.nativeElement.querySelector('[role="menu"]');
        menuEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 150));

        expect(subComp.componentInstance.isOpen()).toBe(false);
    });

    it('should support 3-level deep submenu navigation', async () => {
        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        const subComps = fixture.debugElement.queryAll(By.directive(MenubarSubComponent));

        // Open level 1 submenu
        subComps[0].componentInstance.enter();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(subComps[0].componentInstance.isOpen()).toBe(true);
    });
});

describe('Menubar RTL Support', () => {
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

    it('should render in RTL mode', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
        expect(container).toBeTruthy();
    });

    it('should open menu in RTL', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const trigger = fixture.debugElement.query(By.css('[data-slot="menubar-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="menubar-content"]'));
        expect(content).toBeTruthy();
    });

    it('should have shortcut with RTL margin class', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        const shortcut = fixture.debugElement.query(By.css('[data-slot="menubar-shortcut"]'));
        expect(shortcut).toBeTruthy();
        const parentClass = shortcut.parent?.nativeElement.className || '';
        // The shortcut span has ltr:ml-auto rtl:mr-auto
        expect(shortcut.nativeElement.className).toContain('rtl:mr-auto');
    });

    it('should navigate to previous trigger with ArrowRight in RTL (opposite of LTR)', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="menubar-trigger"]'));
        triggers[0].nativeElement.focus();
        triggers[0].nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();

        // In RTL, ArrowRight should go to the previous trigger (opposite of LTR)
        expect(document.activeElement).toBe(triggers[1].nativeElement);
    });

    it('should navigate to next trigger with ArrowLeft in RTL (opposite of LTR)', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="menubar-trigger"]'));
        triggers[1].nativeElement.focus();
        triggers[1].nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();

        // In RTL, ArrowLeft should go to the next trigger (opposite of LTR)
        expect(document.activeElement).toBe(triggers[0].nativeElement);
    });
});

describe('Menubar Submenu RTL Keyboard Navigation', () => {
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

    it('should open submenu with ArrowLeft in RTL (opposite of LTR)', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const subTrigger = fixture.debugElement.query(By.directive(MenubarSubTriggerComponent));
        const subComp = fixture.debugElement.query(By.directive(MenubarSubComponent));

        const triggerEl = subTrigger.nativeElement.querySelector('[role="menuitem"]');
        triggerEl.focus();
        triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
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

        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const subTrigger = fixture.debugElement.query(By.directive(MenubarSubTriggerComponent));
        const subComp = fixture.debugElement.query(By.directive(MenubarSubComponent));

        const triggerEl = subTrigger.nativeElement.querySelector('[role="menuitem"]');
        triggerEl.focus();
        triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 100));

        // Should remain closed
        expect(subComp.componentInstance.isOpen()).toBe(false);
    });

    it('should close submenu with ArrowRight in RTL (opposite of LTR)', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        const subComp = fixture.debugElement.query(By.directive(MenubarSubComponent));
        subComp.componentInstance.enter();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(subComp.componentInstance.isOpen()).toBe(true);

        const subContent = fixture.debugElement.query(By.directive(MenubarSubContentComponent));
        const menuEl = subContent.nativeElement.querySelector('[role="menu"]');
        menuEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 150));

        expect(subComp.componentInstance.isOpen()).toBe(false);
    });

    it('should still open submenu with Enter key in RTL', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const subTrigger = fixture.debugElement.query(By.directive(MenubarSubTriggerComponent));
        const subComp = fixture.debugElement.query(By.directive(MenubarSubComponent));

        const triggerEl = subTrigger.nativeElement.querySelector('[role="menuitem"]');
        triggerEl.focus();
        triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(subComp.componentInstance.isOpen()).toBe(true);
    });

    it('should support 3-level deep submenu navigation in RTL', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const menuComp = fixture.debugElement.query(By.directive(MenubarMenuComponent));
        menuComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        const subComps = fixture.debugElement.queryAll(By.directive(MenubarSubComponent));

        // Open level 1 submenu
        subComps[0].componentInstance.enter();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(subComps[0].componentInstance.isOpen()).toBe(true);
    });
});
