import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DropdownMenuComponent, DropdownMenuTriggerComponent, DropdownMenuContentComponent, DropdownMenuItemComponent, DropdownMenuSeparatorComponent, DropdownMenuLabelComponent, DropdownMenuSubComponent, DropdownMenuSubTriggerComponent, DropdownMenuSubContentComponent, DropdownMenuService, DROPDOWN_MENU_SUB, type DropdownItem } from './index';
import { Component, signal, type Type } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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


// Host exercising 3 enabled items (middle-item Tab navigation), align,
// inset and shortcut rendering.
@Component({
    template: `
        <ui-dropdown-menu>
            <ui-dropdown-menu-trigger>Open</ui-dropdown-menu-trigger>
            <ui-dropdown-menu-content>
                <ui-dropdown-menu-item shortcut="⌘K" [inset]="true">A</ui-dropdown-menu-item>
                <ui-dropdown-menu-item>B</ui-dropdown-menu-item>
                <ui-dropdown-menu-item>C</ui-dropdown-menu-item>
            </ui-dropdown-menu-content>
        </ui-dropdown-menu>
    `,
    imports: [DropdownMenuComponent, DropdownMenuTriggerComponent, DropdownMenuContentComponent, DropdownMenuItemComponent]
})
class ThreeItemHostComponent { }

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

// The menu defers focus and the submenu's 100 ms close grace period to
// timers, so a fake clock replaces real waits.
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Runs pending timers, then renders what they changed. */
function flush(fixture: ComponentFixture<unknown>, ms = 0): void {
    fixture.detectChanges();
    vi.advanceTimersByTime(ms);
    fixture.detectChanges();
}

async function mount<T>(host: Type<T>): Promise<ComponentFixture<T>> {
    await TestBed.configureTestingModule({ imports: [host] }).compileComponents();
    const fixture = TestBed.createComponent(host);
    flush(fixture);
    return fixture;
}

function rootMenu(fixture: ComponentFixture<unknown>): DropdownMenuComponent {
    return fixture.debugElement.query(By.directive(DropdownMenuComponent)).componentInstance;
}

function openRoot(fixture: ComponentFixture<unknown>): DropdownMenuComponent {
    const menu = rootMenu(fixture);
    menu.show();
    flush(fixture);
    return menu;
}

function key(el: Element, k: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
    el.dispatchEvent(event);
    return event;
}

function enabledItems(fixture: ComponentFixture<unknown>): HTMLElement[] {
    return fixture.debugElement
        .queryAll(By.css('[role="menuitem"]:not([data-disabled])'))
        .map(d => d.nativeElement as HTMLElement);
}

function menuContent(fixture: ComponentFixture<unknown>): HTMLElement {
    return fixture.debugElement.query(By.css('[data-slot="dropdown-content"]')).nativeElement;
}

function subTriggerRow(fixture: ComponentFixture<unknown>): HTMLElement {
    return fixture.debugElement.query(By.directive(DropdownMenuSubTriggerComponent))
        .nativeElement.querySelector('[role="menuitem"]') as HTMLElement;
}

function subOf(fixture: ComponentFixture<unknown>): DropdownMenuSubComponent {
    return fixture.debugElement.query(By.directive(DropdownMenuSubComponent)).componentInstance;
}

function subPanel(fixture: ComponentFixture<unknown>): HTMLElement {
    return fixture.debugElement.query(By.directive(DropdownMenuSubContentComponent))
        .nativeElement.querySelector('[role="menu"]') as HTMLElement;
}

describe('DropdownMenuComponent', () => {
    it('toggles, shows and hides', async () => {
        const fixture = await mount(TestHostComponent);
        const menu = rootMenu(fixture);
        menu.toggle();
        expect(menu.open()).toBe(true);
        menu.toggle();
        expect(menu.open()).toBe(false);
        menu.show();
        expect(menu.open()).toBe(true);
        menu.hide();
        expect(menu.open()).toBe(false);
    });
});

describe('DropdownMenu open and close', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        fixture = await mount(TestHostComponent);
    });

    it('renders nothing while closed, then a role="menu" with the three rows once the trigger is clicked', () => {
        expect(fixture.debugElement.query(By.css('[data-slot="dropdown-content"]'))).toBeNull();

        fixture.debugElement.query(By.css('[data-slot="dropdown-trigger"]')).nativeElement.click();
        flush(fixture);

        expect(fixture.debugElement.query(By.css('[role="menu"]'))).toBeTruthy();
        const rows = fixture.debugElement.queryAll(By.css('[role="menuitem"]'));
        expect(rows.map(r => r.nativeElement.hasAttribute('data-disabled'))).toEqual([false, false, true]);
    });

    it('opens from Enter, Space and ArrowDown on the trigger, and tolerates a close before the deferred first-item focus', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="dropdown-trigger"]')).nativeElement;
        const menu = rootMenu(fixture);
        for (const k of ['Enter', ' ', 'ArrowDown']) {
            key(trigger, k);
            flush(fixture);
            expect(menu.open(), k).toBe(true);
            menu.hide();
            flush(fixture);
        }

        menu.show();
        fixture.detectChanges();
        menu.hide();
        fixture.detectChanges();
        expect(() => vi.advanceTimersByTime(10)).not.toThrow();
        expect(document.querySelector('[data-slot="dropdown-content"]')).toBeNull();
    });

    it('closes on Escape, on activating an item by click or Space, and on an outside click', () => {
        const menu = openRoot(fixture);

        key(menuContent(fixture), 'Escape');
        flush(fixture);
        expect(menu.open()).toBe(false);

        openRoot(fixture);
        fixture.debugElement.query(By.css('[data-slot="dropdown-item"]')).nativeElement.click();
        flush(fixture);
        expect(menu.open()).toBe(false);

        openRoot(fixture);
        key(fixture.debugElement.query(By.css('[data-slot="dropdown-item"]')).nativeElement, ' ');
        flush(fixture);
        expect(menu.open()).toBe(false);

        openRoot(fixture);
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        flush(fixture);
        expect(menu.open()).toBe(false);
    });

    it('moves focus with ArrowDown, skipping the disabled row, and wraps with ArrowDown, Tab and Shift+Tab at the ends', () => {
        openRoot(fixture);
        vi.advanceTimersByTime(50);
        const items = enabledItems(fixture);
        expect(items.map(i => i.textContent?.trim())).toEqual(['Item 1', 'Item 2']);

        items[0].focus();
        key(items[0], 'ArrowDown');
        expect(document.activeElement).toBe(items[1]);
        key(items[1], 'ArrowDown');
        expect(document.activeElement).toBe(items[0]);

        items[1].focus();
        const tab = key(menuContent(fixture), 'Tab');
        expect(tab.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(items[0]);

        const shiftTab = key(menuContent(fixture), 'Tab', { shiftKey: true });
        expect(shiftTab.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(items[1]);
    });
});

describe('DropdownMenu with three enabled items', () => {
    it('Tab and Shift+Tab step between rows, and ArrowUp from the first row wraps to the last', async () => {
        const fixture = await mount(ThreeItemHostComponent);
        openRoot(fixture);
        vi.advanceTimersByTime(50);
        const list = enabledItems(fixture);

        list[0].focus();
        key(menuContent(fixture), 'Tab');
        expect(document.activeElement).toBe(list[1]);

        list[2].focus();
        key(menuContent(fixture), 'Tab', { shiftKey: true });
        expect(document.activeElement).toBe(list[1]);

        list[0].focus();
        key(list[0], 'ArrowUp');
        expect(document.activeElement).toBe(list[2]);
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
        fixture = await mount(InteractiveTriggerHostComponent);
        flush(fixture, 1);
    });

    it('stays transparent (no role="button") and ignores Enter from projected content when wrapping a real control', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="dropdown-trigger"]'));
        expect(trigger.nativeElement.getAttribute('role')).toBeNull();

        key(fixture.debugElement.query(By.css('button')).nativeElement, 'Enter');
        flush(fixture);
        expect(rootMenu(fixture).open()).toBe(false);
    });

    it('does not close when a disabled item is activated', () => {
        const dropdown = openRoot(fixture);

        const item = fixture.debugElement.query(By.css('[data-slot="dropdown-item"]')).nativeElement as HTMLElement;
        item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        key(item, ' ');
        flush(fixture);
        expect(dropdown.open()).toBe(true);
    });
});

describe('DropdownMenu data-driven items input', () => {
    it('renders separator, label, sub and item branches, and runs the click handler only when one is set', async () => {
        const fixture = await mount(DataDrivenHostComponent);
        const host = fixture.componentInstance;
        openRoot(fixture);

        const root = fixture.nativeElement as HTMLElement;
        const itemTexts = (): string[] => Array.from(root.querySelectorAll<HTMLElement>('[data-slot="dropdown-item"]'))
            .map(el => (el.textContent ?? '').split(/\s+/).filter(Boolean).join(' '));

        expect(root.querySelector('[data-slot="dropdown-separator"]')).not.toBeNull();
        expect(root.querySelector('[data-slot="dropdown-label"]')?.textContent?.trim()).toBe('Group');
        expect(itemTexts()).toEqual(['Click me ⌘C', 'No handler']);

        const items = fixture.debugElement.queryAll(By.css('[data-slot="dropdown-item"]'));
        items[0].nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        items[1].nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(host.clicked()).toBe(1);

        openRoot(fixture);
        const subRow = subTriggerRow(fixture);
        expect(subRow.textContent?.trim()).toBe('More');
        key(subRow, 'Enter');
        flush(fixture, 1);

        expect(itemTexts()).toEqual(['Click me ⌘C', 'No handler', 'Nested']);
    });
});

describe('DropdownMenu Submenu (LTR)', () => {
    let fixture: ComponentFixture<SubmenuTestHostComponent>;

    beforeEach(async () => {
        fixture = await mount(SubmenuTestHostComponent);
        openRoot(fixture);
        vi.advanceTimersByTime(50);
    });

    it('opens the level 1 submenu with ArrowRight or Enter on its trigger', () => {
        const sub = subOf(fixture);
        for (const k of ['ArrowRight', 'Enter']) {
            subTriggerRow(fixture).focus();
            key(subTriggerRow(fixture), k);
            flush(fixture, 100);
            expect(sub.isOpen(), k).toBe(true);
            sub.leave();
            flush(fixture, 100);
        }
    });

    it('closes the submenu with ArrowLeft or Escape', () => {
        const sub = subOf(fixture);
        for (const k of ['ArrowLeft', 'Escape']) {
            sub.enter();
            flush(fixture, 50);
            key(subPanel(fixture), k);
            flush(fixture, 150);
            expect(sub.isOpen(), k).toBe(false);
        }
    });

    it('supports 3-level deep submenu navigation', () => {
        const row = (text: string): HTMLElement =>
            Array.from(fixture.nativeElement.querySelectorAll('[role="menuitem"]') as NodeListOf<HTMLElement>)
                .find(el => el.textContent?.trim() === text)!;
        const pressOn = (el: HTMLElement, k: string): void => {
            key(el, k);
            flush(fixture, 60);
        };

        const level1Sub = row('Level 1 Sub');
        level1Sub.focus();
        pressOn(level1Sub, 'ArrowRight');
        expect(document.activeElement).toBe(row('Level 1 Item 1'));

        const level2Sub = row('Level 2 Sub');
        level2Sub.focus();
        pressOn(level2Sub, 'ArrowRight');
        const subComps = fixture.debugElement.queryAll(By.directive(DropdownMenuSubComponent));
        expect(subComps[1].componentInstance.isOpen()).toBe(true);
        expect(document.activeElement).toBe(row('Level 2 Item 1'));

        const level1Item2 = row('Level 1 Item 2');
        level1Item2.focus();
        pressOn(level1Item2, 'ArrowDown');
        expect(document.activeElement).toBe(level2Sub);

        // Level 2 is still open: the level-1 ring wraps over level 1's own rows, never into level 2's.
        expect(subComps[1].componentInstance.isOpen()).toBe(true);
        pressOn(level2Sub, 'ArrowDown');
        expect(document.activeElement).toBe(row('Level 1 Item 1'));
        pressOn(row('Level 1 Item 1'), 'ArrowUp');
        expect(document.activeElement).toBe(level2Sub);
    });
});

describe('DropdownMenu Submenu RTL Keyboard Navigation', () => {
    let restoreStyle: () => void;

    beforeEach(() => {
        restoreStyle = installDirComputedStyle();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
        restoreStyle();
    });

    it('swaps the arrows: ArrowLeft opens, ArrowRight does not open but closes', async () => {
        const fixture = await mount(RTLSubmenuTestHostComponent);
        fixture.componentInstance.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        flush(fixture);
        openRoot(fixture);
        vi.advanceTimersByTime(50);
        const sub = subOf(fixture);

        subTriggerRow(fixture).focus();
        key(subTriggerRow(fixture), 'ArrowRight');
        flush(fixture, 100);
        expect(sub.isOpen()).toBe(false);

        key(subTriggerRow(fixture), 'ArrowLeft');
        flush(fixture, 100);
        expect(sub.isOpen()).toBe(true);

        key(subPanel(fixture), 'ArrowRight');
        flush(fixture, 150);
        expect(sub.isOpen()).toBe(false);
    });
});

describe('DropdownMenu submenu pointer + touch', () => {
    let fixture: ComponentFixture<SubmenuTestHostComponent>;
    let restoreMedia: () => void;

    async function setup(coarse: boolean): Promise<void> {
        restoreMedia = installMatchMedia(coarse);
        fixture = await mount(SubmenuTestHostComponent);
        openRoot(fixture);
    }

    afterEach(() => restoreMedia());

    it('opens on mouseenter and schedules close on mouseleave (non-touch)', async () => {
        await setup(false);
        const sub = subOf(fixture);
        const trigger = subTriggerRow(fixture);
        trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        fixture.detectChanges();
        expect(sub.isOpen()).toBe(true);

        trigger.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        flush(fixture, 150);
        expect(sub.isOpen()).toBe(false);
    });

    it('keeps the submenu open while the pointer moves onto the content', async () => {
        await setup(false);
        const sub = subOf(fixture);
        sub.enter();
        flush(fixture);

        const content = subPanel(fixture);
        content.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        fixture.detectChanges();
        expect(sub.isOpen()).toBe(true);
        content.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        flush(fixture, 150);
        expect(sub.isOpen()).toBe(false);
    });

    it('toggles on tap for touch devices', async () => {
        await setup(true);
        const sub = subOf(fixture);
        const trigger = subTriggerRow(fixture);
        trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        fixture.detectChanges();
        expect(sub.isOpen()).toBe(false);

        trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(sub.isOpen()).toBe(true);

        trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        flush(fixture, 150);
        expect(sub.isOpen()).toBe(false);
    });
});

describe('DropdownMenu submenu content', () => {
    let fixture: ComponentFixture<SubmenuTestHostComponent>;

    beforeEach(async () => {
        fixture = await mount(SubmenuTestHostComponent);
        openRoot(fixture);
        subOf(fixture).enter();
        flush(fixture, 60);
    });

    it('moves focus with ArrowDown and wraps with ArrowUp inside the submenu', () => {
        const list = Array.from(subPanel(fixture).querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
        list[0].focus();
        key(list[0], 'ArrowDown');
        expect(document.activeElement).toBe(list[1]);

        list[0].focus();
        key(list[0], 'ArrowUp');
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

describe('DropdownMenu disabled sub-trigger', () => {
    let fixture: ComponentFixture<DisabledSubTriggerHostComponent>;
    let restoreMedia: (() => void) | undefined;

    async function setup(coarse = false): Promise<void> {
        restoreMedia = installMatchMedia(coarse);
        fixture = await mount(DisabledSubTriggerHostComponent);
        openRoot(fixture);
    }

    afterEach(() => restoreMedia?.());

    it('is marked data-disabled, dropped from the focus ring, and does not open on hover or from the keyboard', async () => {
        await setup();
        const row = subTriggerRow(fixture);
        expect(row.hasAttribute('data-disabled')).toBe(true);
        expect(row.getAttribute('aria-disabled')).toBe('true');
        const content = fixture.debugElement.query(By.directive(DropdownMenuContentComponent))
            .componentInstance as DropdownMenuContentComponent;
        expect(content.getFocusableItems()).toHaveLength(1);

        row.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        key(row, 'Enter');
        key(row, 'ArrowRight');
        flush(fixture);
        expect(subOf(fixture).isOpen()).toBe(false);
    });

    it('does not open the submenu on tap for touch devices', async () => {
        await setup(true);
        subTriggerRow(fixture).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(subOf(fixture).isOpen()).toBe(false);
    });
});
