import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    MenubarComponent,
    MenubarService,
    MenubarMenuComponent,
    MenubarTriggerComponent,
    MenubarContentComponent,
    MenubarItemComponent,
    MenubarSeparatorComponent,
    MenubarShortcutComponent,
    MenubarSubComponent,
    MenubarSubTriggerComponent,
    MenubarSubContentComponent,
} from './';
import { Component, signal, Type } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type ProtoWithPopover = { showPopover?: () => void; hidePopover?: () => void };

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
const proto = HTMLElement.prototype as unknown as ProtoWithPopover;

/**
 * Whether THIS suite added the Popover API, decided at install time.
 *
 * It must not be captured at module load. `HTMLElement.prototype` is shared
 * with every other spec file in the run, and module evaluation can happen while
 * another suite has the API temporarily removed — recording "it was absent" and
 * then `delete`-ing on teardown, which destroys the native implementation for
 * everything that follows. Only ever remove what this suite itself added.
 */
let addedShowPopover = false;
let addedHidePopover = false;

function stubMatchMedia(coarse: boolean): void {
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('coarse') ? coarse : false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
    }));
}

function installStubs(): void {
    stubMatchMedia(false);
    Element.prototype.getBoundingClientRect = () =>
        ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    // Only fill the API in when the engine genuinely lacks it. Overwriting a
    // working native `showPopover` with a no-op replaces it on the SHARED
    // HTMLElement.prototype: this suite does not run in its own realm, so for
    // the whole window between install and restore any other spec file that
    // promotes an element to the top layer silently gets nothing, and fails on
    // an assertion that has nothing to do with it.
    addedShowPopover = !('showPopover' in proto);
    addedHidePopover = !('hidePopover' in proto);
    proto.showPopover ??= () => undefined;
    proto.hidePopover ??= () => undefined;
}

function restoreStubs(): void {
    vi.unstubAllGlobals();
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    if (addedShowPopover) {
        delete proto.showPopover;
        addedShowPopover = false;
    }
    if (addedHidePopover) {
        delete proto.hidePopover;
        addedHidePopover = false;
    }
}

function keydown(el: Element, key: string): void {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function fireClick(el: Element): void {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function fireMouse(el: Element, type: 'mouseenter' | 'mouseleave'): void {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true }));
}

@Component({
    template: `
        <ui-menubar>
            <ui-menubar-menu>
                <ui-menubar-trigger>File</ui-menubar-trigger>
                <ui-menubar-content>
                    <ui-menubar-item>New</ui-menubar-item>
                    <ui-menubar-item shortcut="⌘O">Open</ui-menubar-item>
                    <ui-menubar-separator />
                    <ui-menubar-item [disabled]="true">Save</ui-menubar-item>
                    <ui-menubar-shortcut>⌘S</ui-menubar-shortcut>
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
    imports: [MenubarComponent, MenubarMenuComponent, MenubarTriggerComponent, MenubarContentComponent, MenubarItemComponent, MenubarSeparatorComponent, MenubarShortcutComponent],
})
class TestHostComponent { }

@Component({
    template: `
        <ui-menubar-item [disabled]="true">Disabled</ui-menubar-item>
        <ui-menubar-item shortcut="⌘X" inset>Loose</ui-menubar-item>
    `,
    imports: [MenubarItemComponent],
})
class LooseItemHostComponent { }

@Component({
    template: `
        <ui-menubar>
            <ui-menubar-menu>
                <ui-menubar-trigger>File</ui-menubar-trigger>
                <ui-menubar-content>
                    <ui-menubar-item>New File</ui-menubar-item>
                    <ui-menubar-sub>
                        <ui-menubar-sub-trigger inset>Share</ui-menubar-sub-trigger>
                        <ui-menubar-sub-content>
                            <ui-menubar-item>Email</ui-menubar-item>
                            <ui-menubar-item>Link</ui-menubar-item>
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
    imports: [MenubarComponent, MenubarMenuComponent, MenubarTriggerComponent, MenubarContentComponent, MenubarItemComponent, MenubarSubComponent, MenubarSubTriggerComponent, MenubarSubContentComponent],
})
class SubmenuTestHostComponent { }

@Component({
    template: `
        <ui-menubar>
            <ui-menubar-menu>
                <ui-menubar-trigger>File</ui-menubar-trigger>
                <ui-menubar-content>
                    <ui-menubar-item [disabled]="true">Disabled First</ui-menubar-item>
                    <ui-menubar-item>Enabled</ui-menubar-item>
                    <ui-menubar-sub>
                        <ui-menubar-sub-trigger [disabled]="true">Share</ui-menubar-sub-trigger>
                        <ui-menubar-sub-content>
                            <ui-menubar-item>Email</ui-menubar-item>
                        </ui-menubar-sub-content>
                    </ui-menubar-sub>
                </ui-menubar-content>
            </ui-menubar-menu>
        </ui-menubar>
    `,
    imports: [MenubarComponent, MenubarMenuComponent, MenubarTriggerComponent, MenubarContentComponent, MenubarItemComponent, MenubarSubComponent, MenubarSubTriggerComponent, MenubarSubContentComponent],
})
class DisabledMenubarHostComponent { }

@Component({
    template: `
        <ui-menubar>
            <ui-menubar-menu>
                <ui-menubar-trigger>A1</ui-menubar-trigger>
                <ui-menubar-content><ui-menubar-item>a1</ui-menubar-item></ui-menubar-content>
            </ui-menubar-menu>
            <ui-menubar-menu>
                <ui-menubar-trigger>A2</ui-menubar-trigger>
                <ui-menubar-content><ui-menubar-item>a2</ui-menubar-item></ui-menubar-content>
            </ui-menubar-menu>
        </ui-menubar>
        <ui-menubar>
            <ui-menubar-menu>
                <ui-menubar-trigger>B1</ui-menubar-trigger>
                <ui-menubar-content><ui-menubar-item>b1</ui-menubar-item></ui-menubar-content>
            </ui-menubar-menu>
        </ui-menubar>
    `,
    imports: [MenubarComponent, MenubarMenuComponent, MenubarTriggerComponent, MenubarContentComponent, MenubarItemComponent],
})
class TwoMenubarsHostComponent { }

@Component({
    template: `
        <ui-menubar>
            <ui-menubar-menu>
                <ui-menubar-trigger>One</ui-menubar-trigger>
                <ui-menubar-content><ui-menubar-item>one</ui-menubar-item></ui-menubar-content>
            </ui-menubar-menu>
            @if (showSecond()) {
                <ui-menubar-menu>
                    <ui-menubar-trigger>Two</ui-menubar-trigger>
                    <ui-menubar-content><ui-menubar-item>two</ui-menubar-item></ui-menubar-content>
                </ui-menubar-menu>
            }
        </ui-menubar>
    `,
    imports: [MenubarComponent, MenubarMenuComponent, MenubarTriggerComponent, MenubarContentComponent, MenubarItemComponent],
})
class RemovableMenuHostComponent {
    readonly showSecond = signal(true);
}

function createFixture<T>(type: Type<T>): ComponentFixture<T> {
    TestBed.configureTestingModule({ imports: [type] });
    const fixture = TestBed.createComponent(type);
    fixture.detectChanges();
    return fixture;
}

function menuInstance(fixture: ComponentFixture<unknown>): MenubarMenuComponent {
    return fixture.debugElement.query(By.directive(MenubarMenuComponent)).componentInstance as MenubarMenuComponent;
}

function serviceInstance(fixture: ComponentFixture<unknown>): MenubarService {
    return (fixture.debugElement.query(By.directive(MenubarComponent)).componentInstance as MenubarComponent).service;
}

function openFirstMenu(fixture: ComponentFixture<unknown>): MenubarMenuComponent {
    const menu = menuInstance(fixture);
    menu.open();
    fixture.detectChanges();
    return menu;
}

describe('MenubarService', () => {
    it('returns false for isRtl when no root is registered', () => {
        const svc = new MenubarService();
        expect(svc.isRtl()).toBe(false);
    });

    it('evaluates the root element direction once a root is registered', () => {
        const svc = new MenubarService();
        svc.registerRoot(document.createElement('div'));
        expect(svc.isRtl()).toBe(false);
    });

    it('registers, activates and unregisters menus', () => {
        const svc = new MenubarService();
        const fakeTrigger = {} as MenubarTriggerComponent;
        svc.register('m1', fakeTrigger);
        expect(svc.menus.has('m1')).toBe(true);
        svc.setActive('m1');
        expect(svc.isActive('m1')).toBe(true);
        svc.unregister('m1');
        expect(svc.menus.has('m1')).toBe(false);
    });
});

describe('MenubarComponent', () => {
    let fixture: ComponentFixture<MenubarComponent>;

    beforeEach(() => {
        installStubs();
        TestBed.configureTestingModule({ imports: [MenubarComponent] });
        fixture = TestBed.createComponent(MenubarComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        restoreStubs();
    });

    it('renders a role="menubar" container with a data-slot', () => {
        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('[role="menubar"]')).toBeTruthy();
        expect(el.querySelector('[data-slot="menubar"]')).toBeTruthy();
    });

    it('applies the custom class input', () => {
        fixture.componentRef.setInput('class', 'custom-menubar');
        fixture.detectChanges();
        const el = fixture.nativeElement.querySelector('[data-slot="menubar"]') as HTMLElement;
        expect(el.className).toContain('custom-menubar');
    });

    it('ignores document clicks when no menu is active', () => {
        const component = fixture.componentInstance;
        component.onClick({ target: document.body } as unknown as MouseEvent);
        expect(component.service.activeMenuId()).toBeNull();
    });

    it('closes the active menu on an outside document click', () => {
        const component = fixture.componentInstance;
        component.service.setActive('menu-x');
        component.onClick({ target: document.body } as unknown as MouseEvent);
        expect(component.service.activeMenuId()).toBeNull();
    });

    it('keeps the active menu open when the click is inside the menubar', () => {
        const component = fixture.componentInstance;
        component.service.setActive('menu-x');
        component.onClick({ target: component.el.nativeElement } as unknown as MouseEvent);
        expect(component.service.activeMenuId()).toBe('menu-x');
    });
});

describe('Menubar rendering and menu open/close', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(() => {
        installStubs();
        fixture = createFixture(TestHostComponent);
    });

    afterEach(() => {
        fixture.destroy();
        restoreStubs();
    });

    it('renders both triggers and hides content while closed', () => {
        expect(fixture.debugElement.queryAll(By.css('[data-slot="menubar-trigger"]'))).toHaveLength(2);
        expect(fixture.debugElement.query(By.css('[data-slot="menubar-content"]'))).toBeNull();
    });

    it('opens a menu on trigger click and toggles it closed again', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="menubar-trigger"]')).nativeElement as HTMLElement;
        fireClick(trigger);
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.css('[data-slot="menubar-content"]'))).toBeTruthy();
        fireClick(trigger);
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.css('[data-slot="menubar-content"]'))).toBeNull();
    });

    it('renders items, separator, shortcut input and shortcut component when open', () => {
        openFirstMenu(fixture);
        expect(fixture.debugElement.queryAll(By.css('[data-slot="menubar-item"]'))).toHaveLength(3);
        expect(fixture.debugElement.query(By.css('[data-slot="menubar-separator"]'))).toBeTruthy();
        expect(fixture.debugElement.query(By.css('[data-slot="menubar-shortcut"]'))).toBeTruthy();
        const inlineShortcut = fixture.nativeElement.querySelector('.ms-auto') as HTMLElement;
        expect(inlineShortcut.textContent).toContain('⌘O');
    });

    it('marks disabled items with data-disabled', () => {
        openFirstMenu(fixture);
        expect(fixture.debugElement.query(By.css('[data-disabled]'))).toBeTruthy();
    });

    it('closes the menu when a non-disabled item is clicked', () => {
        const menu = openFirstMenu(fixture);
        const item = fixture.debugElement.query(By.css('[data-slot="menubar-item"]:not([data-disabled])')).nativeElement as HTMLElement;
        fireClick(item);
        fixture.detectChanges();
        expect(menu.isOpen()).toBe(false);
    });

    it('menu.toggle() closes an already open menu', () => {
        const menu = openFirstMenu(fixture);
        expect(menu.isOpen()).toBe(true);
        menu.toggle();
        fixture.detectChanges();
        expect(menu.isOpen()).toBe(false);
    });

    it('menu.close() is a no-op when the menu is already closed', () => {
        const menu = menuInstance(fixture);
        menu.close();
        expect(menu.isOpen()).toBe(false);
    });
});

describe('Menubar item edge cases', () => {
    let fixture: ComponentFixture<LooseItemHostComponent>;

    beforeEach(() => {
        installStubs();
        fixture = createFixture(LooseItemHostComponent);
    });

    afterEach(() => {
        fixture.destroy();
        restoreStubs();
    });

    it('does not emit selected for a disabled item', () => {
        const items = fixture.debugElement.queryAll(By.directive(MenubarItemComponent));
        const disabled = items[0].componentInstance as MenubarItemComponent;
        const spy = vi.fn();
        disabled.selected.subscribe(spy);
        disabled.onClick();
        expect(spy).not.toHaveBeenCalled();
    });

    it('emits selected and tolerates a missing parent menu', () => {
        const items = fixture.debugElement.queryAll(By.directive(MenubarItemComponent));
        const loose = items[1].componentInstance as MenubarItemComponent;
        const spy = vi.fn();
        loose.selected.subscribe(spy);
        loose.onClick();
        expect(spy).toHaveBeenCalledTimes(1);
        const el = items[1].nativeElement.querySelector('[data-slot="menubar-item"]') as HTMLElement;
        expect(el.className).toContain('rtl:pr-8');
        expect((items[1].nativeElement.querySelector('.ms-auto') as HTMLElement).textContent).toContain('⌘X');
    });
});

describe('Menubar trigger interactions', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(() => {
        vi.useFakeTimers();
        installStubs();
        fixture = createFixture(TestHostComponent);
    });

    afterEach(() => {
        fixture.destroy();
        vi.clearAllTimers();
        restoreStubs();
    });

    it('opens the menu with Enter and focuses the first item', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="menubar-trigger"]')).nativeElement as HTMLElement;
        keydown(trigger, 'Enter');
        fixture.detectChanges();
        vi.advanceTimersByTime(1);
        expect(menuInstance(fixture).isOpen()).toBe(true);
        const firstItem = fixture.nativeElement.querySelector('[data-menubar-content] [role="menuitem"]') as HTMLElement;
        expect(document.activeElement).toBe(firstItem);
    });

    it('opens the menu with ArrowDown', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="menubar-trigger"]')).nativeElement as HTMLElement;
        keydown(trigger, 'ArrowDown');
        fixture.detectChanges();
        vi.advanceTimersByTime(1);
        expect(menuInstance(fixture).isOpen()).toBe(true);
    });

    it('moves focus to the next trigger with ArrowRight (LTR, closed)', () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="menubar-trigger"]'));
        triggers[0].nativeElement.focus();
        keydown(triggers[0].nativeElement, 'ArrowRight');
        expect(document.activeElement).toBe(triggers[1].nativeElement);
    });

    it('moves focus to the previous trigger with ArrowLeft (LTR, closed)', () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="menubar-trigger"]'));
        triggers[1].nativeElement.focus();
        keydown(triggers[1].nativeElement, 'ArrowLeft');
        expect(document.activeElement).toBe(triggers[0].nativeElement);
    });

    it('reverses ArrowRight/ArrowLeft direction in RTL', () => {
        vi.spyOn(serviceInstance(fixture), 'isRtl').mockReturnValue(true);
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="menubar-trigger"]'));
        triggers[0].nativeElement.focus();
        keydown(triggers[0].nativeElement, 'ArrowRight');
        expect(document.activeElement).toBe(triggers[1].nativeElement);
        keydown(triggers[1].nativeElement, 'ArrowLeft');
        expect(document.activeElement).toBe(triggers[0].nativeElement);
    });

    it('activates the adjacent menu when navigating with a menu already open', () => {
        openFirstMenu(fixture);
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="menubar-trigger"]'));
        keydown(triggers[0].nativeElement, 'ArrowRight');
        fixture.detectChanges();
        expect(document.activeElement).toBe(triggers[1].nativeElement);
        expect(serviceInstance(fixture).activeMenuId()).toBeTruthy();
    });

    it('opens the hovered trigger only while another menu is active on a non-touch device', () => {
        const triggerDe = fixture.debugElement.queryAll(By.directive(MenubarTriggerComponent))[1];
        const triggerComp = triggerDe.componentInstance as MenubarTriggerComponent;
        triggerComp.onMouseEnter();
        expect(triggerComp.menu.isOpen()).toBe(false);
        serviceInstance(fixture).setActive('menubar-menu-0');
        triggerComp.onMouseEnter();
        expect(serviceInstance(fixture).activeMenuId()).toBe(triggerComp.menu.id);
    });

    it('ignores hover on touch devices', () => {
        stubMatchMedia(true);
        const triggerComp = fixture.debugElement.queryAll(By.directive(MenubarTriggerComponent))[1].componentInstance as MenubarTriggerComponent;
        serviceInstance(fixture).setActive('menubar-menu-0');
        triggerComp.onMouseEnter();
        expect(triggerComp.menu.isOpen()).toBe(false);
    });
});

describe('Menubar content keyboard navigation', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let content: MenubarContentComponent;

    beforeEach(() => {
        installStubs();
        fixture = createFixture(TestHostComponent);
        openFirstMenu(fixture);
        content = fixture.debugElement.query(By.directive(MenubarContentComponent)).componentInstance as MenubarContentComponent;
    });

    afterEach(() => {
        fixture.destroy();
        restoreStubs();
    });

    it('cycles items with ArrowDown and ArrowUp', () => {
        const items = fixture.debugElement.queryAll(By.css('[data-slot="menubar-item"]:not([data-disabled])'));
        items[0].nativeElement.focus();
        keydown(items[0].nativeElement, 'ArrowDown');
        expect(document.activeElement).toBe(items[1].nativeElement);
        keydown(items[1].nativeElement, 'ArrowUp');
        expect(document.activeElement).toBe(items[0].nativeElement);
    });

    it('closes the menu and refocuses the trigger on Escape', () => {
        const menu = menuInstance(fixture);
        const contentEl = fixture.debugElement.query(By.css('[data-slot="menubar-content"]')).nativeElement as HTMLElement;
        keydown(contentEl, 'Escape');
        fixture.detectChanges();
        expect(menu.isOpen()).toBe(false);
        const trigger = fixture.debugElement.query(By.css('[data-slot="menubar-trigger"]')).nativeElement as HTMLElement;
        expect(document.activeElement).toBe(trigger);
    });

    it('moves between menus with ArrowRight/ArrowLeft from content (LTR)', () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="menubar-trigger"]'));
        const contentEl = fixture.debugElement.query(By.css('[data-slot="menubar-content"]')).nativeElement as HTMLElement;
        keydown(contentEl, 'ArrowRight');
        fixture.detectChanges();
        expect(document.activeElement).toBe(triggers[1].nativeElement);
        keydown(fixture.debugElement.query(By.css('[data-slot="menubar-content"]')).nativeElement, 'ArrowLeft');
        fixture.detectChanges();
        expect(document.activeElement).toBe(triggers[0].nativeElement);
    });

    it('reverses ArrowRight/ArrowLeft from content in RTL', () => {
        vi.spyOn(serviceInstance(fixture), 'isRtl').mockReturnValue(true);
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="menubar-trigger"]'));
        const contentEl = fixture.debugElement.query(By.css('[data-slot="menubar-content"]')).nativeElement as HTMLElement;
        keydown(contentEl, 'ArrowLeft');
        fixture.detectChanges();
        expect(document.activeElement).toBe(triggers[1].nativeElement);
        keydown(fixture.debugElement.query(By.css('[data-slot="menubar-content"]')).nativeElement, 'ArrowRight');
        fixture.detectChanges();
        expect(document.activeElement).toBe(triggers[0].nativeElement);
    });

    it('returns an empty list of focusable items when the menu is closed', () => {
        menuInstance(fixture).close();
        fixture.detectChanges();
        expect(content.getFocusableItems()).toHaveLength(0);
    });
});

describe('Menubar submenu', () => {
    let fixture: ComponentFixture<SubmenuTestHostComponent>;
    let sub: MenubarSubComponent;
    let subTrigger: MenubarSubTriggerComponent;
    let subContent: MenubarSubContentComponent;

    beforeEach(() => {
        vi.useFakeTimers();
        installStubs();
        fixture = createFixture(SubmenuTestHostComponent);
        openFirstMenu(fixture);
        sub = fixture.debugElement.query(By.directive(MenubarSubComponent)).componentInstance as MenubarSubComponent;
        subTrigger = fixture.debugElement.query(By.directive(MenubarSubTriggerComponent)).componentInstance as MenubarSubTriggerComponent;
        subContent = fixture.debugElement.query(By.directive(MenubarSubContentComponent)).componentInstance as MenubarSubContentComponent;
    });

    afterEach(() => {
        fixture.destroy();
        vi.clearAllTimers();
        restoreStubs();
    });

    it('opens on hover and closes after the leave delay (non-touch)', () => {
        subTrigger.onMouseEnter();
        fixture.detectChanges();
        expect(sub.isOpen()).toBe(true);
        subTrigger.onMouseLeave();
        vi.advanceTimersByTime(100);
        fixture.detectChanges();
        expect(sub.isOpen()).toBe(false);
    });

    it('ignores hover interactions on touch devices', () => {
        stubMatchMedia(true);
        subTrigger.onMouseEnter();
        expect(sub.isOpen()).toBe(false);
        sub.enter();
        subTrigger.onMouseLeave();
        vi.advanceTimersByTime(100);
        expect(sub.isOpen()).toBe(true);
    });

    it('toggles the submenu on tap for touch devices', () => {
        stubMatchMedia(true);
        subTrigger.onClick();
        expect(sub.isOpen()).toBe(true);
        subTrigger.onClick();
        vi.advanceTimersByTime(100);
        expect(sub.isOpen()).toBe(false);
    });

    it('ignores tap clicks on non-touch devices', () => {
        subTrigger.onClick();
        expect(sub.isOpen()).toBe(false);
    });

    it('opens the submenu and focuses its content with ArrowRight (LTR)', () => {
        const triggerEl = fixture.debugElement.query(By.directive(MenubarSubTriggerComponent)).nativeElement.querySelector('[role="menuitem"]') as HTMLElement;
        keydown(triggerEl, 'ArrowRight');
        fixture.detectChanges();
        vi.advanceTimersByTime(1);
        expect(sub.isOpen()).toBe(true);
        const firstSubItem = subContent.el.nativeElement.querySelector('[role="menuitem"]:not([data-disabled])') as HTMLElement;
        expect(document.activeElement).toBe(firstSubItem);
    });

    it('opens the submenu with Enter', () => {
        const triggerEl = fixture.debugElement.query(By.directive(MenubarSubTriggerComponent)).nativeElement.querySelector('[role="menuitem"]') as HTMLElement;
        keydown(triggerEl, 'Enter');
        fixture.detectChanges();
        vi.advanceTimersByTime(1);
        expect(sub.isOpen()).toBe(true);
    });

    it('does not open the submenu with ArrowRight in RTL and opens with ArrowLeft', () => {
        vi.spyOn(serviceInstance(fixture), 'isRtl').mockReturnValue(true);
        const triggerEl = fixture.debugElement.query(By.directive(MenubarSubTriggerComponent)).nativeElement.querySelector('[role="menuitem"]') as HTMLElement;
        keydown(triggerEl, 'ArrowRight');
        expect(sub.isOpen()).toBe(false);
        keydown(triggerEl, 'ArrowLeft');
        fixture.detectChanges();
        expect(sub.isOpen()).toBe(true);
    });

    it('leaves the submenu closed for ArrowLeft on the trigger in LTR', () => {
        const triggerEl = fixture.debugElement.query(By.directive(MenubarSubTriggerComponent)).nativeElement.querySelector('[role="menuitem"]') as HTMLElement;
        keydown(triggerEl, 'ArrowLeft');
        expect(sub.isOpen()).toBe(false);
    });

    it('navigates submenu items with ArrowDown/ArrowUp', () => {
        sub.enter();
        fixture.detectChanges();
        const menuEl = subContent.el.nativeElement.querySelector('[role="menu"]') as HTMLElement;
        const items = Array.from(menuEl.querySelectorAll('[role="menuitem"]:not([data-disabled])')) as HTMLElement[];
        items[0].focus();
        keydown(items[0], 'ArrowDown');
        expect(document.activeElement).toBe(items[1]);
        keydown(items[1], 'ArrowUp');
        expect(document.activeElement).toBe(items[0]);
    });

    it('closes the submenu and refocuses the trigger with ArrowLeft from content (LTR)', () => {
        sub.enter();
        fixture.detectChanges();
        const menuEl = subContent.el.nativeElement.querySelector('[role="menu"]') as HTMLElement;
        keydown(menuEl, 'ArrowLeft');
        vi.advanceTimersByTime(100);
        fixture.detectChanges();
        expect(sub.isOpen()).toBe(false);
    });

    it('closes the submenu with ArrowRight from content in RTL', () => {
        vi.spyOn(serviceInstance(fixture), 'isRtl').mockReturnValue(true);
        sub.enter();
        fixture.detectChanges();
        const menuEl = subContent.el.nativeElement.querySelector('[role="menu"]') as HTMLElement;
        keydown(menuEl, 'ArrowRight');
        vi.advanceTimersByTime(100);
        fixture.detectChanges();
        expect(sub.isOpen()).toBe(false);
    });

    it('keeps the submenu open for ArrowLeft from content in RTL', () => {
        vi.spyOn(serviceInstance(fixture), 'isRtl').mockReturnValue(true);
        sub.enter();
        fixture.detectChanges();
        const menuEl = subContent.el.nativeElement.querySelector('[role="menu"]') as HTMLElement;
        keydown(menuEl, 'ArrowLeft');
        vi.advanceTimersByTime(100);
        expect(sub.isOpen()).toBe(true);
    });

    it('opens the sub-content on hover and closes it after the leave delay', () => {
        sub.enter();
        fixture.detectChanges();
        const menuEl = subContent.el.nativeElement.querySelector('[role="menu"]') as HTMLElement;
        fireMouse(menuEl, 'mouseleave');
        vi.advanceTimersByTime(100);
        expect(sub.isOpen()).toBe(false);
        fireMouse(menuEl, 'mouseenter');
        vi.advanceTimersByTime(100);
        expect(sub.isOpen()).toBe(true);
    });

    it('ignores sub-content hover on touch devices', () => {
        stubMatchMedia(true);
        sub.enter();
        subContent.onMouseLeave();
        vi.advanceTimersByTime(100);
        expect(sub.isOpen()).toBe(true);
        subContent.onMouseEnter();
        expect(sub.isOpen()).toBe(true);
    });

    it('exposes focus helpers that refocus the trigger and first content item', () => {
        sub.enter();
        fixture.detectChanges();
        sub.focusContent();
        vi.advanceTimersByTime(1);
        const firstSubItem = subContent.el.nativeElement.querySelector('[role="menuitem"]:not([data-disabled])') as HTMLElement;
        expect(document.activeElement).toBe(firstSubItem);
        sub.focusTrigger();
        vi.advanceTimersByTime(1);
        expect(document.activeElement).toBe(subTrigger.triggerEl.nativeElement);
    });

    it('renders the submenu trigger with an open state class when open', () => {
        sub.enter();
        fixture.detectChanges();
        const triggerEl = fixture.debugElement.query(By.directive(MenubarSubTriggerComponent)).nativeElement.querySelector('[data-slot="menubar-sub-trigger"]') as HTMLElement;
        expect(triggerEl.className).toContain('bg-accent');
        expect(triggerEl.className).toContain('rtl:pr-8');
    });
});

describe('Menubar disabled sub-trigger', () => {
    let fixture: ComponentFixture<DisabledMenubarHostComponent>;
    let sub: MenubarSubComponent;
    let subTrigger: MenubarSubTriggerComponent;

    beforeEach(() => {
        vi.useFakeTimers();
        installStubs();
        fixture = createFixture(DisabledMenubarHostComponent);
        openFirstMenu(fixture);
        sub = fixture.debugElement.query(By.directive(MenubarSubComponent)).componentInstance as MenubarSubComponent;
        subTrigger = fixture.debugElement.query(By.directive(MenubarSubTriggerComponent)).componentInstance as MenubarSubTriggerComponent;
    });

    afterEach(() => {
        fixture.destroy();
        vi.clearAllTimers();
        vi.useRealTimers();
        restoreStubs();
    });

    function subTriggerRow(): HTMLElement {
        return fixture.debugElement.query(By.directive(MenubarSubTriggerComponent)).nativeElement.querySelector('[data-slot="menubar-sub-trigger"]') as HTMLElement;
    }

    it('marks the disabled sub-trigger with data-disabled and drops it from the ring', () => {
        expect(subTriggerRow().hasAttribute('data-disabled')).toBe(true);
        expect(subTriggerRow().getAttribute('aria-disabled')).toBe('true');
        const content = fixture.debugElement.query(By.directive(MenubarContentComponent)).componentInstance as MenubarContentComponent;
        expect(content.getFocusableItems()).toHaveLength(1);
    });

    it('does not open the submenu on hover, tap or keyboard while disabled', () => {
        subTrigger.onMouseEnter();
        expect(sub.isOpen()).toBe(false);

        stubMatchMedia(true);
        subTrigger.onClick();
        expect(sub.isOpen()).toBe(false);
        stubMatchMedia(false);

        keydown(subTriggerRow(), 'Enter');
        expect(sub.isOpen()).toBe(false);
        keydown(subTriggerRow(), 'ArrowRight');
        expect(sub.isOpen()).toBe(false);
    });

    it('skips a disabled first item when the menu is opened from the trigger', () => {
        menuInstance(fixture).close();
        fixture.detectChanges();
        const trigger = fixture.debugElement.query(By.css('[data-slot="menubar-trigger"]')).nativeElement as HTMLElement;
        keydown(trigger, 'Enter');
        fixture.detectChanges();
        vi.advanceTimersByTime(1);
        const enabledItem = fixture.nativeElement.querySelector('[data-menubar-content] [role="menuitem"]:not([data-disabled])') as HTMLElement;
        expect(document.activeElement).toBe(enabledItem);
        expect((document.activeElement as HTMLElement).textContent).toContain('Enabled');
    });
});

describe('Menubar trigger ring scoping and teardown', () => {
    afterEach(() => {
        restoreStubs();
    });

    it('wraps around within the owning menubar only', () => {
        installStubs();
        const fixture = createFixture(TwoMenubarsHostComponent);
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="menubar-trigger"]'));
        expect(triggers).toHaveLength(3);
        triggers[1].nativeElement.focus();
        keydown(triggers[1].nativeElement, 'ArrowRight');
        expect(document.activeElement).toBe(triggers[0].nativeElement);
        fixture.destroy();
    });

    it('unregisters a menu from the service when its trigger is destroyed', () => {
        installStubs();
        const fixture = createFixture(RemovableMenuHostComponent);
        const service = serviceInstance(fixture);
        expect(service.menus.size).toBe(2);
        fixture.componentInstance.showSecond.set(false);
        fixture.detectChanges();
        expect(service.menus.size).toBe(1);
        fixture.destroy();
    });
});

describe('Menubar submenu timer teardown', () => {
    let fixture: ComponentFixture<SubmenuTestHostComponent>;

    beforeEach(() => {
        vi.useFakeTimers();
        installStubs();
        fixture = createFixture(SubmenuTestHostComponent);
        openFirstMenu(fixture);
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        restoreStubs();
    });

    it('cancels a pending close when the submenu is destroyed inside the grace period', () => {
        const sub = fixture.debugElement.query(By.directive(MenubarSubComponent)).componentInstance as MenubarSubComponent;
        sub.enter();
        fixture.detectChanges();
        sub.leave();
        fixture.destroy();
        vi.advanceTimersByTime(200);
        expect(sub.isOpen()).toBe(true);
    });
});
