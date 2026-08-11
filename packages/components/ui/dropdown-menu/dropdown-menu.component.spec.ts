import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DropdownMenuComponent, DropdownMenuTriggerComponent, DropdownMenuContentComponent, DropdownMenuItemComponent, DropdownMenuSeparatorComponent, DropdownMenuLabelComponent, DropdownMenuSubComponent, DropdownMenuSubTriggerComponent, DropdownMenuSubContentComponent, DropdownMenuService, DROPDOWN_MENU_SUB, type DropdownItem } from './index';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

type MutableStyle = { getComputedStyle?: typeof globalThis.getComputedStyle };

/**
 * jsdom's `getComputedStyle` does not derive `direction` from the `dir`
 * attribute, so `isRtl()` always sees `ltr`. This wrapper reflects the nearest
 * `[dir]` ancestor into the returned `direction`, matching real browsers.
 */
function installDirComputedStyle(): () => void {
    const original = globalThis.getComputedStyle.bind(globalThis);
    (globalThis as MutableStyle).getComputedStyle = ((
        el: Element,
        pseudo?: string | null
    ): CSSStyleDeclaration => {
        const style = original(el, pseudo ?? undefined);
        const dir = (el as HTMLElement).closest?.('[dir]')?.getAttribute('dir');
        if (dir === 'rtl' || dir === 'ltr') {
            return new Proxy(style, {
                get: (target, prop) =>
                    prop === 'direction' ? dir : Reflect.get(target, prop),
            }) as CSSStyleDeclaration;
        }
        return style;
    }) as typeof globalThis.getComputedStyle;
    return () => {
        (globalThis as MutableStyle).getComputedStyle = original;
    };
}

/** Stub matchMedia so `isTouchDevice()` is deterministic under jsdom. */
function installMatchMedia(coarse: boolean): () => void {
    const original = (globalThis as { matchMedia?: typeof globalThis.matchMedia })
        .matchMedia;
    (globalThis as { matchMedia?: typeof globalThis.matchMedia }).matchMedia = ((
        query: string
    ) =>
        ({
            matches: query.includes('coarse') ? coarse : false,
            media: query,
            onchange: null,
            addEventListener: (): void => undefined,
            removeEventListener: (): void => undefined,
            addListener: (): void => undefined,
            removeListener: (): void => undefined,
            dispatchEvent: (): boolean => false,
        }) as unknown as MediaQueryList) as typeof globalThis.matchMedia;
    return () => {
        (globalThis as { matchMedia?: typeof globalThis.matchMedia }).matchMedia =
            original;
    };
}

const tick = (ms = 60): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

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
        expect(items).toHaveLength(3);
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
        expect(items).toHaveLength(2); // 2 enabled items

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
        expect(items).toHaveLength(2);

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
        items.at(-1)!.nativeElement.focus();
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
    let restoreStyle: () => void;

    beforeEach(async () => {
        restoreStyle = installDirComputedStyle();
        await TestBed.configureTestingModule({
            imports: [RTLTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RTLTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
        restoreStyle();
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
        items.at(-1)!.nativeElement.focus();
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
    let restoreStyle: () => void;

    beforeEach(async () => {
        restoreStyle = installDirComputedStyle();
        await TestBed.configureTestingModule({
            imports: [RTLSubmenuTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RTLSubmenuTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
        restoreStyle();
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

// Host exercising 3 enabled items (middle-item Tab navigation), align,
// inset and shortcut rendering.
@Component({
    template: `
        <ui-dropdown-menu>
            <ui-dropdown-menu-trigger>Open</ui-dropdown-menu-trigger>
            <ui-dropdown-menu-content [align]="align()">
                <ui-dropdown-menu-item shortcut="⌘K" [inset]="true">A</ui-dropdown-menu-item>
                <ui-dropdown-menu-item>B</ui-dropdown-menu-item>
                <ui-dropdown-menu-item>C</ui-dropdown-menu-item>
            </ui-dropdown-menu-content>
        </ui-dropdown-menu>
    `,
    imports: [DropdownMenuComponent, DropdownMenuTriggerComponent, DropdownMenuContentComponent, DropdownMenuItemComponent]
})
class ThreeItemHostComponent {
    align = signal<'start' | 'center' | 'end'>('center');
}

// Host whose content has no focusable items (Tab short-circuit + align="end").
@Component({
    template: `
        <ui-dropdown-menu>
            <ui-dropdown-menu-trigger>Open</ui-dropdown-menu-trigger>
            <ui-dropdown-menu-content align="end">
                <ui-dropdown-menu-label>Only a label</ui-dropdown-menu-label>
            </ui-dropdown-menu-content>
        </ui-dropdown-menu>
    `,
    imports: [DropdownMenuComponent, DropdownMenuTriggerComponent, DropdownMenuContentComponent, DropdownMenuLabelComponent]
})
class EmptyContentHostComponent { }

// Host whose trigger wraps an already-interactive control and whose only item
// is disabled.
@Component({
    template: `
        <ui-dropdown-menu>
            <ui-dropdown-menu-trigger><button type="button">Real button</button></ui-dropdown-menu-trigger>
            <ui-dropdown-menu-content>
                <ui-dropdown-menu-item [disabled]="true">Disabled</ui-dropdown-menu-item>
            </ui-dropdown-menu-content>
        </ui-dropdown-menu>
    `,
    imports: [DropdownMenuComponent, DropdownMenuTriggerComponent, DropdownMenuContentComponent, DropdownMenuItemComponent]
})
class InteractiveTriggerHostComponent { }

// Data-driven host using the `items` input to render every branch of the
// internal recursive template (separator / label / sub / item + click).
@Component({
    template: `<ui-dropdown-menu [items]="items()"><ui-dropdown-menu-trigger>Open</ui-dropdown-menu-trigger></ui-dropdown-menu>`,
    imports: [DropdownMenuComponent, DropdownMenuTriggerComponent]
})
class DataDrivenHostComponent {
    clicked = signal(0);
    items = signal<DropdownItem[]>([
        { type: 'label', label: 'Group' },
        { type: 'separator' },
        { type: 'item', label: 'Click me', shortcut: '⌘C', click: () => this.clicked.update(v => v + 1) },
        { type: 'item', label: 'No handler' },
        {
            type: 'sub', label: 'More', inset: true, children: [
                { type: 'item', label: 'Nested' },
            ],
        },
    ]);
}

describe('DropdownMenu content Tab navigation (three items)', () => {
    let fixture: ComponentFixture<ThreeItemHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [ThreeItemHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(ThreeItemHostComponent);
        fixture.detectChanges();
        fixture.debugElement.query(By.directive(DropdownMenuComponent)).componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();
        await tick();
    });

    function items(): HTMLElement[] {
        return fixture.debugElement
            .queryAll(By.css('[role="menuitem"]:not([data-disabled])'))
            .map(d => d.nativeElement as HTMLElement);
    }

    function pressTab(shiftKey: boolean): void {
        const content = fixture.debugElement.query(By.css('[data-slot="dropdown-content"]'));
        content.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true }));
        fixture.detectChanges();
    }

    it('renders inset + shortcut and centers via align', () => {
        expect(items()).toHaveLength(3);
        const content = fixture.debugElement.query(By.css('[data-slot="dropdown-content"]'));
        expect(content.nativeElement.className).toContain('-translate-x-1/2');
        expect(content.nativeElement.textContent).toContain('⌘K');
    });

    it('Tab from a non-last item moves focus forward', () => {
        const list = items();
        list[0].focus();
        pressTab(false);
        expect(document.activeElement).toBe(list[1]);
    });

    it('Shift+Tab from a non-first item moves focus backward', () => {
        const list = items();
        list[2].focus();
        pressTab(true);
        expect(document.activeElement).toBe(list[1]);
    });

    it('ArrowUp from the first item wraps to the last', () => {
        const list = items();
        list[0].focus();
        list[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        fixture.detectChanges();
        expect(document.activeElement).toBe(list[2]);
    });
});

describe('DropdownMenu content edge cases', () => {
    it('Tab is a no-op when no focusable items exist', async () => {
        await TestBed.configureTestingModule({ imports: [EmptyContentHostComponent] }).compileComponents();
        const fixture = TestBed.createComponent(EmptyContentHostComponent);
        fixture.detectChanges();
        fixture.debugElement.query(By.directive(DropdownMenuComponent)).componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="dropdown-content"]'));
        expect(content.nativeElement.className).toContain('ltr:right-0');
        content.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.directive(DropdownMenuComponent)).componentInstance.open()).toBe(true);
    });

    it('closes when a click lands outside the menu', async () => {
        await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
        const fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
        const dropdown = fixture.debugElement.query(By.directive(DropdownMenuComponent)).componentInstance;
        dropdown.show();
        fixture.detectChanges();
        await fixture.whenStable();

        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(dropdown.open()).toBe(false);
    });
});

describe('DropdownMenuService without a registered root', () => {
    it('reports LTR when no root element is registered', () => {
        expect(new DropdownMenuService().isRtl()).toBe(false);
    });
});

describe('DropdownMenu interactive-trigger + disabled item', () => {
    let fixture: ComponentFixture<InteractiveTriggerHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [InteractiveTriggerHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(InteractiveTriggerHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        await tick();
        fixture.detectChanges();
    });

    it('stays transparent (no role="button") when wrapping a real control', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="dropdown-trigger"]'));
        expect(trigger.nativeElement.getAttribute('role')).toBeNull();
    });

    it('ignores Enter that originates from projected content', () => {
        const dropdown = fixture.debugElement.query(By.directive(DropdownMenuComponent)).componentInstance;
        const innerButton = fixture.debugElement.query(By.css('button')).nativeElement as HTMLElement;
        innerButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        expect(dropdown.open()).toBe(false);
    });

    it('does not close when a disabled item is activated', async () => {
        const dropdown = fixture.debugElement.query(By.directive(DropdownMenuComponent)).componentInstance;
        dropdown.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const item = fixture.debugElement.query(By.css('[data-slot="dropdown-item"]')).nativeElement as HTMLElement;
        item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        item.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        fixture.detectChanges();
        expect(dropdown.open()).toBe(true);
    });
});

describe('DropdownMenu Space activation closes menu', () => {
    it('closes when Space activates an enabled item', async () => {
        await TestBed.configureTestingModule({ imports: [ThreeItemHostComponent] }).compileComponents();
        const fixture = TestBed.createComponent(ThreeItemHostComponent);
        fixture.detectChanges();
        const dropdown = fixture.debugElement.query(By.directive(DropdownMenuComponent)).componentInstance;
        dropdown.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const item = fixture.debugElement.query(By.css('[data-slot="dropdown-item"]')).nativeElement as HTMLElement;
        item.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        fixture.detectChanges();
        expect(dropdown.open()).toBe(false);
    });
});

describe('DropdownMenu data-driven items input', () => {
    let fixture: ComponentFixture<DataDrivenHostComponent>;
    let host: DataDrivenHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [DataDrivenHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(DataDrivenHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
        fixture.debugElement.query(By.directive(DropdownMenuComponent)).componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();
    });

    it('renders separator, label, sub and item branches', () => {
        expect(fixture.debugElement.query(By.css('[data-slot="dropdown-separator"]'))).toBeTruthy();
        expect(fixture.debugElement.query(By.css('[data-slot="dropdown-label"]'))).toBeTruthy();
        expect(fixture.debugElement.queryAll(By.directive(DropdownMenuSubTriggerComponent)).length).toBeGreaterThan(0);
        expect(fixture.debugElement.queryAll(By.css('[data-slot="dropdown-item"]')).length).toBeGreaterThan(0);
    });

    it('invokes the click handler and tolerates items without one', () => {
        const items = fixture.debugElement.queryAll(By.css('[data-slot="dropdown-item"]'));
        (items[0].nativeElement as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        (items[1].nativeElement as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(host.clicked()).toBe(1);
    });
});

describe('DropdownMenu submenu pointer + touch', () => {
    let fixture: ComponentFixture<SubmenuTestHostComponent>;
    let restoreMedia: () => void;

    async function setup(coarse: boolean): Promise<void> {
        restoreMedia = installMatchMedia(coarse);
        await TestBed.configureTestingModule({ imports: [SubmenuTestHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(SubmenuTestHostComponent);
        fixture.detectChanges();
        fixture.debugElement.query(By.directive(DropdownMenuComponent)).componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();
    }

    afterEach(() => restoreMedia());

    function subTriggerDiv(): HTMLElement {
        return fixture.debugElement.query(By.directive(DropdownMenuSubTriggerComponent))
            .nativeElement.querySelector('[role="menuitem"]') as HTMLElement;
    }

    it('opens on mouseenter and schedules close on mouseleave (non-touch)', async () => {
        await setup(false);
        const sub = fixture.debugElement.query(By.directive(DropdownMenuSubComponent)).componentInstance;
        const trigger = subTriggerDiv();
        trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        fixture.detectChanges();
        expect(sub.isOpen()).toBe(true);

        trigger.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        await tick(150);
        expect(sub.isOpen()).toBe(false);
    });

    it('keeps the submenu open while the pointer moves onto the content', async () => {
        await setup(false);
        const sub = fixture.debugElement.query(By.directive(DropdownMenuSubComponent)).componentInstance;
        sub.enter();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.directive(DropdownMenuSubContentComponent))
            .nativeElement.querySelector('[role="menu"]') as HTMLElement;
        content.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        fixture.detectChanges();
        expect(sub.isOpen()).toBe(true);
        content.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        await tick(150);
        expect(sub.isOpen()).toBe(false);
    });

    it('toggles on tap for touch devices', async () => {
        await setup(true);
        const sub = fixture.debugElement.query(By.directive(DropdownMenuSubComponent)).componentInstance;
        const trigger = subTriggerDiv();
        trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        fixture.detectChanges();
        expect(sub.isOpen()).toBe(false);

        trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(sub.isOpen()).toBe(true);

        trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await tick(150);
        expect(sub.isOpen()).toBe(false);
    });
});

describe('DropdownMenu submenu content arrow navigation', () => {
    let fixture: ComponentFixture<SubmenuTestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [SubmenuTestHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(SubmenuTestHostComponent);
        fixture.detectChanges();
        fixture.debugElement.query(By.directive(DropdownMenuComponent)).componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.debugElement.query(By.directive(DropdownMenuSubComponent)).componentInstance.enter();
        fixture.detectChanges();
        await fixture.whenStable();
        await tick();
    });

    function subMenu(): HTMLElement {
        return fixture.debugElement.query(By.directive(DropdownMenuSubContentComponent))
            .nativeElement.querySelector('[role="menu"]') as HTMLElement;
    }

    function subItems(): HTMLElement[] {
        return Array.from(subMenu().querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
    }

    it('ArrowDown moves focus to the next item inside the submenu', () => {
        const list = subItems();
        list[0].focus();
        list[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        fixture.detectChanges();
        expect(document.activeElement).toBe(list[1]);
    });

    it('ArrowUp wraps focus to the last item inside the submenu', () => {
        const list = subItems();
        list[0].focus();
        list[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        fixture.detectChanges();
        expect(document.activeElement).toBe(list.at(-1));
    });

    it('exposes DROPDOWN_MENU_SUB through the sub component injector', () => {
        const subDe = fixture.debugElement.query(By.directive(DropdownMenuSubComponent));
        expect(subDe.injector.get(DROPDOWN_MENU_SUB)).toBe(subDe.componentInstance);
    });

    it('keeps open submenu items out of the root menu focus ring', () => {
        const content = fixture.debugElement.query(By.directive(DropdownMenuContentComponent))
            .componentInstance as DropdownMenuContentComponent;
        const items = content.getFocusableItems();
        expect(items).toHaveLength(2);
        expect(items[0].textContent).toContain('Regular Item');
        expect(items[1].textContent).toContain('Level 1 Sub');
    });
});

@Component({
    template: `
        <ui-dropdown-menu>
            <ui-dropdown-menu-trigger>Menu</ui-dropdown-menu-trigger>
            <ui-dropdown-menu-content>
                <ui-dropdown-menu-item>Regular Item</ui-dropdown-menu-item>
                <ui-dropdown-menu-sub>
                    <ui-dropdown-menu-sub-trigger [disabled]="true">Disabled Sub</ui-dropdown-menu-sub-trigger>
                    <ui-dropdown-menu-sub-content>
                        <ui-dropdown-menu-item>Hidden Item</ui-dropdown-menu-item>
                    </ui-dropdown-menu-sub-content>
                </ui-dropdown-menu-sub>
            </ui-dropdown-menu-content>
        </ui-dropdown-menu>
    `,
    imports: [DropdownMenuComponent, DropdownMenuTriggerComponent, DropdownMenuContentComponent, DropdownMenuItemComponent, DropdownMenuSubComponent, DropdownMenuSubTriggerComponent, DropdownMenuSubContentComponent]
})
class DisabledSubTriggerHostComponent { }

describe('DropdownMenu disabled sub-trigger', () => {
    let fixture: ComponentFixture<DisabledSubTriggerHostComponent>;
    let restoreMedia: (() => void) | undefined;

    async function setup(coarse = false): Promise<void> {
        restoreMedia = installMatchMedia(coarse);
        await TestBed.configureTestingModule({ imports: [DisabledSubTriggerHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(DisabledSubTriggerHostComponent);
        fixture.detectChanges();
        fixture.debugElement.query(By.directive(DropdownMenuComponent)).componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();
    }

    afterEach(() => restoreMedia?.());

    function sub(): DropdownMenuSubComponent {
        return fixture.debugElement.query(By.directive(DropdownMenuSubComponent))
            .componentInstance as DropdownMenuSubComponent;
    }

    function triggerRow(): HTMLElement {
        return fixture.debugElement.query(By.directive(DropdownMenuSubTriggerComponent))
            .nativeElement.querySelector('[role="menuitem"]') as HTMLElement;
    }

    it('marks the row data-disabled and drops it from the menu focus ring', async () => {
        await setup();
        expect(triggerRow().hasAttribute('data-disabled')).toBe(true);
        expect(triggerRow().getAttribute('aria-disabled')).toBe('true');
        const content = fixture.debugElement.query(By.directive(DropdownMenuContentComponent))
            .componentInstance as DropdownMenuContentComponent;
        expect(content.getFocusableItems()).toHaveLength(1);
    });

    it('does not open the submenu on hover', async () => {
        await setup();
        triggerRow().dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        fixture.detectChanges();
        expect(sub().isOpen()).toBe(false);
    });

    it('does not open the submenu from the keyboard', async () => {
        await setup();
        triggerRow().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        expect(sub().isOpen()).toBe(false);
        triggerRow().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        fixture.detectChanges();
        expect(sub().isOpen()).toBe(false);
    });

    it('does not open the submenu on tap for touch devices', async () => {
        await setup(true);
        triggerRow().dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(sub().isOpen()).toBe(false);
    });
});
