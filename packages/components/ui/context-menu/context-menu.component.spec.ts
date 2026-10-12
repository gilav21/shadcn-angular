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

    it('should have data-slot="context-menu"', () => {
        expect(fixture.nativeElement.dataset.slot).toBe('context-menu');
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

    it('should not show content when closed', () => {
        const content = document.querySelector('[data-slot="context-menu-content"]');
        expect(content).toBeNull();
    });

    it('should render menu items', async () => {
        const contextMenuComp = fixture.debugElement.query(By.directive(ContextMenuComponent));
        contextMenuComp.componentInstance.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const content = document.querySelector('[data-slot="context-menu-content"]')!;
        const items = Array.from(content.querySelectorAll('[data-slot="context-menu-item"]'));
        expect(items.map(i => i.textContent?.trim())).toEqual(['Copy', 'Paste', 'Delete']);
        expect(content.querySelector('[data-slot="context-menu-label"]')?.textContent?.trim()).toBe('Actions');
        expect(content.querySelector('[data-slot="context-menu-separator"]')).toBeTruthy();
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

@Component({
    template: `
        <ui-context-menu>
            <ui-context-menu-trigger>
                <div style="width: 200px; height: 60px">Right-click here</div>
            </ui-context-menu-trigger>
            <ui-context-menu-content>
                <ui-context-menu-item (click)="clicked.push('Cut')">Cut</ui-context-menu-item>
                <ui-context-menu-item (click)="clicked.push('Copy')">Copy</ui-context-menu-item>
                <ui-context-menu-item [disabled]="true" (click)="clicked.push('Paste')">Paste</ui-context-menu-item>
            </ui-context-menu-content>
        </ui-context-menu>
    `,
    imports: [ContextMenuComponent, ContextMenuTriggerComponent, ContextMenuContentComponent, ContextMenuItemComponent],
})
class EditMenuHostComponent {
    readonly clicked: string[] = [];
}

@Component({
    template: `<ui-context-menu [items]="items"><ui-context-menu-trigger><div>Right-click here</div></ui-context-menu-trigger></ui-context-menu>`,
    imports: [ContextMenuComponent, ContextMenuTriggerComponent],
})
class EditDataMenuHostComponent {
    readonly clicked: string[] = [];
    readonly items: ContextMenuItem[] = [
        { label: 'Cut', click: () => this.clicked.push('Cut') },
        { label: 'Paste', disabled: true, click: () => this.clicked.push('Paste') },
    ];
}

async function openEditMenu<T>(component: new () => T): Promise<ComponentFixture<T>> {
    await TestBed.configureTestingModule({ imports: [component] }).compileComponents();
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    fixture.debugElement.query(By.directive(ContextMenuComponent)).componentInstance.show(100, 100);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
}

function menuItemNamed(label: string): HTMLElement {
    const items = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="context-menu-item"]'));
    const item = items.find(el => el.textContent?.trim() === label);
    if (!item) throw new Error(`no menu item "${label}"`);
    return item;
}

function keyOn(element: HTMLElement, key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event;
}

describe('ContextMenu item activation is one action however it is made', () => {
    afterEach(() => {
        document.querySelectorAll('[data-context-menu-portal], [data-context-menu-sub-portal]').forEach(el => el.remove());
    });

    // UC-2. The items had no role, no tabindex and no key handling at all.
    it('Enter and Space run the item action exactly once and close the menu', async () => {
        const fixture = await openEditMenu(EditMenuHostComponent);
        const menu = fixture.debugElement.query(By.directive(ContextMenuComponent)).componentInstance as ContextMenuComponent;

        keyOn(menuItemNamed('Cut'), 'Enter');
        fixture.detectChanges();
        expect(fixture.componentInstance.clicked).toEqual(['Cut']);
        expect(menu.open()).toBe(false);

        menu.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        const space = keyOn(menuItemNamed('Copy'), ' ');
        fixture.detectChanges();
        expect(fixture.componentInstance.clicked).toEqual(['Cut', 'Copy']);
        expect(space.defaultPrevented).toBe(true);
        expect(menu.open()).toBe(false);
    });

    // UC-4. .click() stands in for an assistive-technology activation, which
    // bypasses pointer-events.
    it('a disabled item runs nothing by any route and says so', async () => {
        const fixture = await openEditMenu(EditMenuHostComponent);
        const menu = fixture.debugElement.query(By.directive(ContextMenuComponent)).componentInstance as ContextMenuComponent;
        const disabled = menuItemNamed('Paste');

        disabled.click();
        keyOn(disabled, 'Enter');
        keyOn(disabled, ' ');
        fixture.detectChanges();

        expect(fixture.componentInstance.clicked).toEqual([]);
        expect(menu.open()).toBe(true);
        expect(disabled.getAttribute('aria-disabled')).toBe('true');
        expect(disabled.getAttribute('role')).toBe('menuitem');
        expect(menuItemNamed('Cut').hasAttribute('aria-disabled')).toBe(false);
    });

    it('a disabled data-driven item runs nothing by any route and says so', async () => {
        const fixture = await openEditMenu(EditDataMenuHostComponent);
        const disabled = menuItemNamed('Paste');

        disabled.click();
        keyOn(disabled, 'Enter');
        keyOn(disabled, ' ');
        keyOn(menuItemNamed('Cut'), 'Enter');

        expect(fixture.componentInstance.clicked).toEqual(['Cut']);
        expect(disabled.getAttribute('aria-disabled')).toBe('true');
    });
});

@Component({
    template: `
        <input data-testid="outside" aria-label="Outside field" />
        <ui-context-menu>
            <ui-context-menu-trigger><button type="button" data-testid="target">Target</button></ui-context-menu-trigger>
            <ui-context-menu-content>
                <ui-context-menu-item>Cut</ui-context-menu-item>
                <ui-context-menu-item>Copy</ui-context-menu-item>
                <ui-context-menu-item [disabled]="true">Paste</ui-context-menu-item>
                <ui-context-menu-sub>
                    <ui-context-menu-sub-trigger>Share</ui-context-menu-sub-trigger>
                    <ui-context-menu-sub-content>
                        <ui-context-menu-item>Email</ui-context-menu-item>
                        <ui-context-menu-item>Link</ui-context-menu-item>
                    </ui-context-menu-sub-content>
                </ui-context-menu-sub>
            </ui-context-menu-content>
        </ui-context-menu>
    `,
    imports: [ContextMenuComponent, ContextMenuTriggerComponent, ContextMenuContentComponent, ContextMenuItemComponent, ContextMenuSubComponent, ContextMenuSubTriggerComponent, ContextMenuSubContentComponent],
})
class KeyboardMenuHostComponent { }

@Component({
    template: `
        <ui-context-menu>
            <ui-context-menu-trigger><button type="button" data-testid="target">Target</button></ui-context-menu-trigger>
            <ui-context-menu-content>
                <ui-context-menu-item [disabled]="true">Cut</ui-context-menu-item>
                <ui-context-menu-item [disabled]="true">Paste</ui-context-menu-item>
            </ui-context-menu-content>
        </ui-context-menu>
    `,
    imports: [ContextMenuComponent, ContextMenuTriggerComponent, ContextMenuContentComponent, ContextMenuItemComponent],
})
class DisabledOnlyMenuHostComponent { }

const settle = (ms = 80): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

describe('ContextMenu as a keyboard menu', () => {
    const target = (): HTMLButtonElement => document.querySelector<HTMLButtonElement>('[data-testid="target"]')!;
    const focused = (): string => (document.activeElement?.textContent ?? '').trim();
    const press = (key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
        document.activeElement!.dispatchEvent(event);
        return event;
    };

    /** The menu opened the way the context-menu key opens it: a contextmenu event on the focused target. */
    async function openOnTarget<T>(host: new () => T): Promise<ComponentFixture<T>> {
        await TestBed.configureTestingModule({ imports: [host] }).compileComponents();
        const fixture = TestBed.createComponent(host);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        target().focus();
        target().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 120 }));
        fixture.detectChanges();
        await fixture.whenStable();
        await settle();
        return fixture;
    }

    afterEach(() => {
        document.querySelectorAll('[data-context-menu-portal], [data-context-menu-sub-portal]').forEach(el => el.remove());
    });

    // UC-5: focus lands on the first enabled item; arrows wrap past the disabled one; Home and End jump.
    it('takes focus on its first enabled item and walks the ring, wrapping past disabled items', async () => {
        await openOnTarget(KeyboardMenuHostComponent);

        expect(document.querySelector('[data-slot="context-menu-content"]')?.getAttribute('role')).toBe('menu');
        expect(focused()).toBe('Cut');
        const steps: Array<[string, string]> = [
            ['ArrowDown', 'Copy'], ['ArrowDown', 'Share'], ['ArrowDown', 'Cut'],
            ['End', 'Share'], ['Home', 'Cut'], ['ArrowUp', 'Share'],
        ];
        for (const [key, expected] of steps) {
            press(key);
            expect(focused()).toBe(expected);
        }
        const chord = press('ArrowDown', { ctrlKey: true });
        expect(chord.defaultPrevented).toBe(false);
        expect(focused()).toBe('Share');
    });

    it('opens the flyout from the keyboard, walks it with the arrows, Home and End, and closes it back to its trigger', async () => {
        await openOnTarget(KeyboardMenuHostComponent);
        press('End');

        press('ArrowRight');
        await settle();
        expect(focused()).toBe('Email');
        press('ArrowDown');
        expect(focused()).toBe('Link');
        press('Home');
        expect(focused()).toBe('Email');
        press('End');
        expect(focused()).toBe('Link');
        press('ArrowUp');
        expect(focused()).toBe('Email');
        press('ArrowLeft');
        await settle();
        expect(focused()).toBe('Share');
    });

    // UC-6: however it closes, focus goes back to the element that had it before.
    it.each([
        { how: 'Enter on an item', close: () => press('Enter') },
        { how: 'a click outside', close: () => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true })) },
        { how: 'Tab', close: () => press('Tab') },
        {
            how: 'Tab inside the flyout',
            close: async () => {
                press('End');
                press('ArrowRight');
                await settle();
                press('Tab');
            },
        },
    ])('closing with $how hands focus back to the target', async ({ close }) => {
        const fixture = await openOnTarget(KeyboardMenuHostComponent);
        expect(document.activeElement).not.toBe(target());

        await close();
        fixture.detectChanges();
        await fixture.whenStable();
        await settle();

        expect(document.querySelector('[data-slot="context-menu-content"]')).toBeNull();
        expect(document.activeElement).toBe(target());
    });

    it('leaves focus alone when the user moved it elsewhere before the menu closed', async () => {
        const fixture = await openOnTarget(KeyboardMenuHostComponent);
        const outside = document.querySelector<HTMLInputElement>('[data-testid="outside"]')!;

        outside.focus();
        outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();
        await settle();

        expect(document.querySelector('[data-slot="context-menu-content"]')).toBeNull();
        expect(document.activeElement).toBe(outside);
    });

    it('hands focus back to the newest target when it is opened again from another focusable element', async () => {
        const fixture = await openOnTarget(KeyboardMenuHostComponent);
        const outside = document.querySelector<HTMLInputElement>('[data-testid="outside"]')!;
        const menu = fixture.debugElement.query(By.directive(ContextMenuComponent)).componentInstance as ContextMenuComponent;

        outside.focus();
        menu.show(30, 30);
        fixture.detectChanges();
        await fixture.whenStable();
        await settle();
        menu.close();
        fixture.detectChanges();
        await fixture.whenStable();
        await settle();

        expect(document.activeElement).toBe(outside);
    });

    it('takes focus on its panel when every item is disabled, and arrows do nothing', async () => {
        await openOnTarget(DisabledOnlyMenuHostComponent);
        const panel = document.querySelector<HTMLElement>('[data-slot="context-menu-content"]')!;

        expect(document.activeElement).toBe(panel);
        press('ArrowDown');
        press('End');

        expect(document.activeElement).toBe(panel);
    });
});
