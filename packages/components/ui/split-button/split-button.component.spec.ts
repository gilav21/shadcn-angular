import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { SplitButtonComponent } from './split-button.component';
import { SplitButtonPrimaryComponent } from './sub/split-button-primary.component';
import { SplitButtonMenuComponent } from './sub/split-button-menu.component';
import { SplitButtonItemComponent } from './sub/split-button-item.component';
import { ButtonComponent, ButtonVariant } from '../button';
import { describe, it, expect, beforeEach, vi } from 'vitest';

@Component({
    template: `
    <ui-split-button [variant]="variant()">
      <ui-split-button-primary>Custom Primary</ui-split-button-primary>
      <ui-split-button-menu>
        <ui-split-button-item (click)="onItemClick('item1')">Item 1</ui-split-button-item>
        <ui-split-button-item [disabled]="true">Disabled Item</ui-split-button-item>
      </ui-split-button-menu>
    </ui-split-button>
  `,
    imports: [SplitButtonComponent, SplitButtonPrimaryComponent, SplitButtonMenuComponent, SplitButtonItemComponent],
    standalone: true
})
class TestHostComponent {
    variant = signal<ButtonVariant>('default');
    onItemClick(_id: string): void { }
}

describe('SplitButtonComponent', () => {
    let component: SplitButtonComponent;
    let fixture: ComponentFixture<SplitButtonComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SplitButtonComponent, ButtonComponent, TestHostComponent]
        }).compileComponents();
    });

    describe('Data-Driven Mode', () => {
        beforeEach(() => {
            fixture = TestBed.createComponent(SplitButtonComponent);
            component = fixture.componentInstance;
            fixture.componentRef.setInput('label', 'Save');
            fixture.componentRef.setInput('items', [
                { label: 'Edit', value: 'edit' },
                { label: 'Delete', value: 'delete', disabled: true }
            ]);
            fixture.detectChanges();
        });

        it('should create', () => {
            expect(component).toBeTruthy();
        });

        it('should render primary label', () => {
            const primaryBtn = fixture.debugElement.query(By.css('ui-button:first-child'));
            expect(primaryBtn.nativeElement.textContent).toContain('Save');
        });

        it('should emit primaryClick event', () => {
            const spy = vi.spyOn(component.primaryClick, 'emit');
            const primaryBtn = fixture.debugElement.query(By.css('ui-button:first-child button'));
            primaryBtn.nativeElement.click();
            expect(spy).toHaveBeenCalled();
        });

        it('should toggle menu on dropdown trigger click', () => {
            const trigger = fixture.debugElement.query(By.css('ui-button:last-child button'));

            expect(component.isOpen()).toBe(false);
            expect(fixture.debugElement.query(By.css('[role="menu"]'))).toBeNull();

            trigger.nativeElement.click();
            fixture.detectChanges();

            expect(component.isOpen()).toBe(true);
            expect(fixture.debugElement.query(By.css('[role="menu"]'))).not.toBeNull();

            trigger.nativeElement.click();
            fixture.detectChanges();
            expect(component.isOpen()).toBe(false);
        });

        it('should render menu items when open', () => {
            component.isOpen.set(true);
            fixture.detectChanges();

            const items = fixture.debugElement.queryAll(By.css('[role="menuitem"]'));
            expect(items).toHaveLength(2);
            expect(items[0].nativeElement.textContent).toContain('Edit');
            expect(items[1].nativeElement.textContent).toContain('Delete');
        });

        it('should emit itemClick and call item callback when clicked', () => {
            const itemCallback = vi.fn();
            fixture.componentRef.setInput('items', [
                { label: 'Action', click: itemCallback }
            ]);
            component.isOpen.set(true);
            fixture.detectChanges();

            const spy = vi.spyOn(component.itemClick, 'emit');
            const item = fixture.debugElement.query(By.css('[role="menuitem"]'));

            item.nativeElement.click();

            expect(spy).toHaveBeenCalled();
            expect(itemCallback).toHaveBeenCalled();
            expect(component.isOpen()).toBe(false); // Should close after click
        });

        it('should NOT emit event for disabled items', () => {
            component.isOpen.set(true);
            fixture.detectChanges();

            const spy = vi.spyOn(component.itemClick, 'emit');
            const disabledItem = fixture.debugElement.queryAll(By.css('[role="menuitem"]'))[1];

            disabledItem.nativeElement.click();

            expect(spy).not.toHaveBeenCalled();
            expect(component.isOpen()).toBe(true);
        });

        it('should handle keyboard navigation (ArrowDown, ArrowUp)', () => {
            component.isOpen.set(true);
            fixture.detectChanges();

            const items = fixture.debugElement.queryAll(By.css('[role="menuitem"]'));
            const firstItem = items[0].nativeElement;

            firstItem.focus();
            expect(document.activeElement).toBe(firstItem);

            const menu = fixture.debugElement.query(By.css('[role="menu"]'));

            // Down arrow
            menu.triggerEventHandler('keydown', { key: 'ArrowDown', preventDefault: () => { } });
            // Should skip disabled item if implemented? Implementation logic:
            // const items = this.el.nativeElement.querySelectorAll('[role="menuitem"]:not([disabled])')
            // So logic skips disabled items.
            // But logic finds indices based on activeElement.
            // If we are on first item, next valid is?
            // "edit", "delete"(disabled).
            // Logic: items array only contains non-disabled. So activeElement must be in that array.
            // If activeElement is "Edit", it is index 0. Next is 0+1? If array length is 1 ("Edit"), next is 0.
            // Wait, logic test:
            // items = ["Edit"] (since Delete is disabled).
            // currentIndex = 0.
            // nextIndex = 0 < 0? No. -> 0.
            // So it loops to itself.

            // Let's add another enabled item to test navigation properly
            fixture.componentRef.setInput('items', [
                { label: '1' },
                { label: '2', disabled: true },
                { label: '3' }
            ]);
            fixture.detectChanges();

            const newItems = fixture.debugElement.queryAll(By.css('[role="menuitem"]')); // All 3 rendered
            // Logic query selects :not([disabled])
            // So implementation sees [1, 3]

            newItems[0].nativeElement.focus();
            menu.triggerEventHandler('keydown', { key: 'ArrowDown', preventDefault: () => { } });
            expect(document.activeElement).toBe(newItems[2].nativeElement); // Item 3

            menu.triggerEventHandler('keydown', { key: 'ArrowUp', preventDefault: () => { } });
            expect(document.activeElement).toBe(newItems[0].nativeElement); // Item 1
        });

        it('should close on Escape or Tab', () => {
            component.isOpen.set(true);
            fixture.detectChanges();

            const menu = fixture.debugElement.query(By.css('[role="menu"]'));

            menu.triggerEventHandler('keydown', { key: 'Escape', preventDefault: () => { } });
            expect(component.isOpen()).toBe(false);

            component.isOpen.set(true);
            fixture.detectChanges();
            const newMenu = fixture.debugElement.query(By.css('[role="menu"]'));

            newMenu.triggerEventHandler('keydown', { key: 'Tab' });
            expect(component.isOpen()).toBe(false);
        });
    });

    describe('Content Projection Mode', () => {
        let hostFixture: ComponentFixture<TestHostComponent>;
        let hostComponent: TestHostComponent;

        beforeEach(() => {
            hostFixture = TestBed.createComponent(TestHostComponent);
            hostComponent = hostFixture.componentInstance;
            hostFixture.detectChanges();
        });

        it('should render projected primary content', () => {
            const primaryBtn = hostFixture.debugElement.query(By.css('ui-split-button-primary ui-button'));
            expect(primaryBtn.nativeElement.textContent).toContain('Custom Primary');
        });

        it('should render projected menu items', () => {
            const splitButton = hostFixture.debugElement.query(By.directive(SplitButtonComponent)).componentInstance;
            splitButton.isOpen.set(true);
            hostFixture.detectChanges();

            const items = hostFixture.debugElement.queryAll(By.css('ui-split-button-item'));
            expect(items).toHaveLength(2);
            expect(items[0].nativeElement.textContent).toContain('Item 1');
        });

        it('should respond to inputs on host', () => {
            // Test variant propagation
            const primaryBtn = hostFixture.debugElement.query(By.css('ui-split-button-primary ui-button'));
            // Default variant
            expect(primaryBtn.componentInstance.variant()).toBe('default');

            hostComponent.variant.set('destructive');
            hostFixture.detectChanges();
            expect(primaryBtn.componentInstance.variant()).toBe('destructive');
        });
    });

    describe('Accessibility', () => {
        beforeEach(() => {
            fixture = TestBed.createComponent(SplitButtonComponent);
            component = fixture.componentInstance;
            fixture.componentRef.setInput('label', 'Test');
            fixture.detectChanges();
        });

        it('should set aria-expanded and aria-haspopup', () => {
            const trigger = fixture.debugElement.query(By.css('ui-button:last-child'));
            // aria-haspopup is static 'menu' on ui-button? No, passed as attr
            // The template has aria-haspopup="menu" on the ui-button component tag.
            // But ui-button might not reflect all attrs to its internal button unless specified.
            // Wait, ui-button uses host classes but maybe not attrs propagation?
            // Let's check ButtonComponent implementation if needed, but assuming standard behavior or attr binding on host.
            // Actually, in split-button template:
            // <ui-button ... aria-haspopup="menu" [attr.aria-expanded]="isOpen()">
            // If ui-button does not explicitly inputs for these, they fall through to the host element of ui-button?
            // UI Button selector is 'ui-button'. It normally wraps a <button>.
            // If attrs are on the component tag, they are on the component host.
            // The accessibility tools check the functional button.
            // If SplitButton uses ui-button, the trigger IS the ui-button host?
            // Let's assume correct checks involves seeing these attrs on the rendered DOM.

            expect(trigger.nativeElement.getAttribute('aria-haspopup')).toBe('menu');
            expect(trigger.nativeElement.getAttribute('aria-expanded')).toBe('false');

            component.isOpen.set(true);
            fixture.detectChanges();
            expect(trigger.nativeElement.getAttribute('aria-expanded')).toBe('true');
        });
    });
});
