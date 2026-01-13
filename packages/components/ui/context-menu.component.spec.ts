import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContextMenuComponent, ContextMenuTriggerComponent, ContextMenuContentComponent, ContextMenuItemComponent, ContextMenuSeparatorComponent, ContextMenuLabelComponent, ContextMenuShortcutComponent } from './context-menu.component';
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
        expect(fixture.nativeElement.getAttribute('data-slot')).toBe('context-menu');
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
        expect(items.length).toBe(3);
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
        const shortcutClass = shortcut?.className || '';
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
        expect(items.length).toBe(2);
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
        expect(shortcuts.length).toBe(2);
        // Verify shortcut text
        expect(shortcuts[0]?.textContent).toContain('⌘C');
        expect(shortcuts[1]?.textContent).toContain('⌘V');
    });
});
