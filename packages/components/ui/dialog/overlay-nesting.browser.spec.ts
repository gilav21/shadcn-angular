import { Component, Type, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { DialogComponent, DialogContentComponent, DialogTriggerComponent } from '../dialog';
import { SheetComponent, SheetContentComponent, SheetTriggerComponent } from '../sheet';
import { DrawerComponent, DrawerContentComponent, DrawerTriggerComponent } from '../drawer';
import {
    AlertDialogCancelComponent,
    AlertDialogComponent,
    AlertDialogContentComponent,
    AlertDialogFooterComponent,
    AlertDialogHeaderComponent,
    AlertDialogTitleComponent,
    AlertDialogTriggerComponent,
} from '../alert-dialog';
import {
    SelectComponent,
    SelectContentComponent,
    SelectItemComponent,
    SelectTriggerComponent,
    SelectValueComponent,
} from '../select';
import {
    DropdownMenuComponent,
    DropdownMenuContentComponent,
    DropdownMenuItemComponent,
    DropdownMenuSubComponent,
    DropdownMenuSubContentComponent,
    DropdownMenuSubTriggerComponent,
    DropdownMenuTriggerComponent,
} from '../dropdown-menu';
import {
    MenubarComponent,
    MenubarContentComponent,
    MenubarItemComponent,
    MenubarMenuComponent,
    MenubarTriggerComponent,
} from '../menubar';
import {
    ContextMenuComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuSubComponent,
    ContextMenuSubContentComponent,
    ContextMenuSubTriggerComponent,
    ContextMenuTriggerComponent,
} from '../context-menu';
import { PopoverComponent, PopoverContentComponent, PopoverTriggerComponent } from '../popover';
import { DatePickerComponent, DateRangePickerComponent } from '../date-picker';
import { SplitButtonComponent } from '../split-button';
import { EmojiPickerComponent, EmojiPickerContentComponent, EmojiPickerTriggerComponent } from '../emoji-picker';
import { EyedropperComponent } from '../eyedropper';
import { TabsComponent } from '../tabs';

/**
 * Overlays inside overlays, with real components and a real keyboard: the
 * scroll lock, Escape and focus invariants of
 * specs/overlay-stack-scroll-lock-and-escape-spec.md §3.1.
 */

const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
    await fixture.whenStable();
    await tick();
    await fixture.whenStable();
}

async function render<T>(host: Type<T>, configure?: (instance: T) => void): Promise<ComponentFixture<T>> {
    const fixture = TestBed.createComponent(host);
    configure?.(fixture.componentInstance);
    fixture.autoDetectChanges();
    await settle(fixture);
    return fixture;
}

function q<T extends Element = HTMLElement>(selector: string): T | null {
    return document.querySelector<T>(selector);
}

function must<T extends Element = HTMLElement>(selector: string): T {
    const el = q<T>(selector);
    if (!el) throw new Error(`no element matches ${selector}`);
    return el;
}

async function press(fixture: ComponentFixture<unknown>, keys: string): Promise<void> {
    await userEvent.keyboard(keys);
    await settle(fixture);
}

async function click(fixture: ComponentFixture<unknown>, el: Element): Promise<void> {
    await userEvent.click(el);
    await settle(fixture);
}

/** The body's own inline declarations, which consumers may set and the lock must hand back. */
function bodyInline(): string {
    return document.body.getAttribute('style') ?? '';
}

const originalBodyStyle = document.body.getAttribute('style');
afterEach(() => {
    // Hands back the consumer body styles a row sets as its input; never a lock leak.
    if (originalBodyStyle === null) document.body.removeAttribute('style');
    else document.body.setAttribute('style', originalBodyStyle);
    vi.unstubAllGlobals();
});

// ---------------------------------------------------------------- T-7

@Component({
    imports: [SheetComponent, SheetContentComponent, DialogComponent, DialogContentComponent],
    template: `
        <ui-sheet>
            <ui-sheet-content title="Edit customer"><input aria-label="Name" /></ui-sheet-content>
        </ui-sheet>
        @if (helpMounted()) {
            <ui-dialog><ui-dialog-content title="Keyboard shortcuts">Press ? for help.</ui-dialog-content></ui-dialog>
        }
    `,
})
class SheetThenClosedDialogHost {
    readonly sheet = viewChild.required(SheetComponent);
    readonly helpMounted = signal(false);
}

@Component({
    imports: [DialogComponent, DialogContentComponent],
    template: `
        <ui-dialog [(open)]="editOpen">
            <ui-dialog-content title="Edit customer">
                <input aria-label="Name" />
                <ui-dialog [(open)]="confirmOpen">
                    <ui-dialog-content title="Discard changes?">Your edits will be lost.</ui-dialog-content>
                </ui-dialog>
            </ui-dialog-content>
        </ui-dialog>
    `,
})
class NestedDialogsHost {
    readonly editOpen = signal(false);
    readonly confirmOpen = signal(false);
}

@Component({
    imports: [DialogComponent, DialogContentComponent, SheetComponent, SheetContentComponent],
    template: `
        <ui-dialog [(open)]="editOpen">
            <ui-dialog-content title="Edit customer"><input aria-label="Name" /></ui-dialog-content>
        </ui-dialog>
        @if (filtersMounted()) {
            <ui-sheet><ui-sheet-content title="Filters">Status</ui-sheet-content></ui-sheet>
        }
    `,
})
class DialogThenSheetDestroyedHost {
    readonly editOpen = signal(false);
    readonly filtersMounted = signal(true);
}

@Component({
    imports: [AlertDialogComponent, AlertDialogContentComponent],
    template: `
        <ui-alert-dialog [(open)]="open">
            <ui-alert-dialog-content title="Delete customer?" description="This cannot be undone." />
        </ui-alert-dialog>
    `,
})
class AlertAloneHost {
    readonly open = signal(false);
}

@Component({
    imports: [SheetComponent, SheetContentComponent, AlertDialogComponent, AlertDialogContentComponent],
    template: `
        <ui-sheet>
            <ui-sheet-content title="Edit customer">
                <input aria-label="Name" />
                <ui-alert-dialog [(open)]="confirmOpen">
                    <ui-alert-dialog-content title="Delete customer?" description="This cannot be undone." />
                </ui-alert-dialog>
            </ui-sheet-content>
        </ui-sheet>
    `,
})
class AlertInSheetHost {
    readonly sheet = viewChild.required(SheetComponent);
    readonly confirmOpen = signal(false);
}

@Component({
    imports: [DrawerComponent, DrawerContentComponent],
    template: `
        <ui-drawer [(open)]="open">
            <ui-drawer-content title="Order details">Two items</ui-drawer-content>
        </ui-drawer>
    `,
})
class DrawerHost {
    readonly open = signal(false);
}

@Component({
    imports: [DrawerComponent, DrawerContentComponent, SheetComponent, SheetContentComponent],
    template: `
        @if (mounted()) {
            <ui-drawer><ui-drawer-content title="Order details">Two items</ui-drawer-content></ui-drawer>
            <ui-sheet><ui-sheet-content title="Filters">Status</ui-sheet-content></ui-sheet>
        }
    `,
})
class ClosedModalsHost {
    readonly mounted = signal(true);
}

interface LockRow {
    readonly label: string;
    readonly run: () => Promise<void>;
}

const LOCK_ROWS: readonly LockRow[] = [
    {
        label: 'T-7 sheet open, closed dialog created',
        run: async () => {
            const fixture = await render(SheetThenClosedDialogHost);
            fixture.componentInstance.sheet().show();
            await settle(fixture);
            expect(document.body.style.overflow).toBe('hidden');

            fixture.componentInstance.helpMounted.set(true);
            await settle(fixture);
            expect(document.body.style.overflow).toBe('hidden');
        },
    },
    {
        label: 'T-7 dialog, nested dialog opened then closed',
        run: async () => {
            const fixture = await render(NestedDialogsHost);
            fixture.componentInstance.editOpen.set(true);
            await settle(fixture);
            fixture.componentInstance.confirmOpen.set(true);
            await settle(fixture);
            fixture.componentInstance.confirmOpen.set(false);
            await settle(fixture);
            expect(document.body.style.overflow).toBe('hidden');

            fixture.componentInstance.editOpen.set(false);
            await settle(fixture);
            expect(bodyInline()).toBe(originalBodyStyle ?? '');
        },
    },
    {
        label: 'T-7 dialog open, closed sheet destroyed',
        run: async () => {
            const fixture = await render(DialogThenSheetDestroyedHost);
            fixture.componentInstance.editOpen.set(true);
            await settle(fixture);
            fixture.componentInstance.filtersMounted.set(false);
            await settle(fixture);
            expect(document.body.style.overflow).toBe('hidden');
        },
    },
    {
        label: 'T-7 alert dialog in sheet, opened then closed',
        run: async () => {
            const fixture = await render(AlertInSheetHost);
            fixture.componentInstance.sheet().show();
            await settle(fixture);
            fixture.componentInstance.confirmOpen.set(true);
            await settle(fixture);
            fixture.componentInstance.confirmOpen.set(false);
            await settle(fixture);
            expect(document.body.style.overflow).toBe('hidden');
        },
    },
    {
        label: 'T-7 alert dialog alone',
        run: async () => {
            const fixture = await render(AlertAloneHost);
            fixture.componentInstance.open.set(true);
            await settle(fixture);
            expect(document.body.style.overflow).toBe('hidden');
            fixture.componentInstance.open.set(false);
            await settle(fixture);
            expect(bodyInline()).toBe(originalBodyStyle ?? '');
        },
    },
    {
        label: 'T-7 drawer closed over consumer overflow-y',
        run: async () => {
            document.body.setAttribute('style', 'overflow-y: scroll');
            const fixture = await render(DrawerHost);
            fixture.componentInstance.open.set(true);
            await settle(fixture);
            expect(document.body.style.overflow).toBe('hidden');
            fixture.componentInstance.open.set(false);
            await settle(fixture);
            expect(document.body.style.overflowY).toBe('scroll');
            expect(document.body.style.overflowX).toBe('');
        },
    },
    {
        label: 'T-7 closed drawer and sheet created',
        run: async () => {
            const consumerStyle = 'overflow-y: scroll; padding-right: 8px';
            document.body.setAttribute('style', consumerStyle);
            const fixture = await render(ClosedModalsHost);
            expect(bodyInline()).toBe(consumerStyle);
            fixture.componentInstance.mounted.set(false);
            await settle(fixture);
            expect(bodyInline()).toBe(consumerStyle);
        },
    },
];

describe('T-7 body scroll lock across modals', () => {
    for (const row of LOCK_ROWS) {
        it(`the body lock survives every way a second modal can come and go (${row.label})`, row.run);
    }
});

// ---------------------------------------------------------------- T-8

type ModalKind = 'dialog' | 'sheet' | 'drawer' | 'alert-dialog';
type PopupKind =
    | 'select'
    | 'select-projected'
    | 'dropdown-menu'
    | 'menubar'
    | 'context-menu'
    | 'popover'
    | 'date-picker'
    | 'date-range-picker'
    | 'split-button'
    | 'emoji-picker'
    | 'eyedropper'
    | 'alert-dialog';

const MODAL_PANEL: Record<ModalKind, string> = {
    dialog: '[data-slot="dialog-content"]',
    sheet: '[data-slot="sheet-content"]',
    drawer: '[data-slot="drawer-content"]',
    'alert-dialog': '[data-slot="alert-dialog-content"]',
};

@Component({
    imports: [
        NgTemplateOutlet,
        DialogComponent, DialogTriggerComponent, DialogContentComponent,
        SheetComponent, SheetTriggerComponent, SheetContentComponent,
        DrawerComponent, DrawerTriggerComponent, DrawerContentComponent,
        AlertDialogComponent, AlertDialogTriggerComponent, AlertDialogContentComponent,
        SelectComponent, SelectTriggerComponent, SelectValueComponent, SelectContentComponent, SelectItemComponent,
        DropdownMenuComponent, DropdownMenuTriggerComponent, DropdownMenuContentComponent, DropdownMenuItemComponent,
        MenubarComponent, MenubarMenuComponent, MenubarTriggerComponent, MenubarContentComponent, MenubarItemComponent,
        ContextMenuComponent, ContextMenuTriggerComponent, ContextMenuContentComponent, ContextMenuItemComponent,
        PopoverComponent, PopoverTriggerComponent, PopoverContentComponent,
        DatePickerComponent, DateRangePickerComponent,
        SplitButtonComponent,
        EmojiPickerComponent, EmojiPickerTriggerComponent, EmojiPickerContentComponent,
        EyedropperComponent,
    ],
    template: `
        <ng-template #form>
            <div class="grid gap-3">
                <input data-testid="name" aria-label="Name" />
                <input data-testid="email" type="email" aria-label="Email" />
                @switch (popup()) {
                    @case ('select') {
                        <ui-select [options]="countries" ariaLabel="Country" />
                    }
                    @case ('select-projected') {
                        <ui-select>
                            <ui-select-trigger><ui-select-value placeholder="Country" /></ui-select-trigger>
                            <ui-select-content>
                                @for (country of countries; track country) {
                                    <ui-select-item [value]="country">{{ country }}</ui-select-item>
                                }
                            </ui-select-content>
                        </ui-select>
                    }
                    @case ('dropdown-menu') {
                        <ui-dropdown-menu>
                            <ui-dropdown-menu-trigger>
                                <button type="button" data-testid="popup-trigger">More</button>
                            </ui-dropdown-menu-trigger>
                            <ui-dropdown-menu-content>
                                <ui-dropdown-menu-item>Duplicate</ui-dropdown-menu-item>
                                <ui-dropdown-menu-item>Archive</ui-dropdown-menu-item>
                            </ui-dropdown-menu-content>
                        </ui-dropdown-menu>
                    }
                    @case ('menubar') {
                        <ui-menubar>
                            <ui-menubar-menu>
                                <ui-menubar-trigger>Insert</ui-menubar-trigger>
                                <ui-menubar-content>
                                    <ui-menubar-item>Signature</ui-menubar-item>
                                    <ui-menubar-item>Date</ui-menubar-item>
                                </ui-menubar-content>
                            </ui-menubar-menu>
                        </ui-menubar>
                    }
                    @case ('context-menu') {
                        <ui-context-menu>
                            <ui-context-menu-trigger>
                                <div data-testid="popup-trigger" tabindex="0">Invoice #1042</div>
                            </ui-context-menu-trigger>
                            <ui-context-menu-content>
                                <ui-context-menu-item>Copy number</ui-context-menu-item>
                                <ui-context-menu-item>Open in new tab</ui-context-menu-item>
                            </ui-context-menu-content>
                        </ui-context-menu>
                    }
                    @case ('popover') {
                        <ui-popover>
                            <ui-popover-trigger>
                                <button type="button" data-testid="popup-trigger">Billing info</button>
                            </ui-popover-trigger>
                            <ui-popover-content>Invoices go to the account owner.</ui-popover-content>
                        </ui-popover>
                    }
                    @case ('date-picker') {
                        <ui-date-picker placeholder="Customer since" />
                    }
                    @case ('date-range-picker') {
                        <ui-date-range-picker placeholder="Contract period" />
                    }
                    @case ('split-button') {
                        <ui-split-button label="Save" [items]="saveOptions" />
                    }
                    @case ('emoji-picker') {
                        <ui-emoji-picker>
                            <ui-emoji-picker-trigger>
                                <button type="button" data-testid="popup-trigger">Add reaction</button>
                            </ui-emoji-picker-trigger>
                            <ui-emoji-picker-content />
                        </ui-emoji-picker>
                    }
                    @case ('eyedropper') {
                        <canvas #swatch data-testid="swatch" width="8" height="8"></canvas>
                        <ui-eyedropper [fallbackTarget]="swatch" />
                    }
                    @case ('alert-dialog') {
                        <ui-alert-dialog>
                            <ui-alert-dialog-trigger>
                                <button type="button" data-testid="popup-trigger">Delete customer</button>
                            </ui-alert-dialog-trigger>
                            <ui-alert-dialog-content title="Delete customer?" description="This cannot be undone." />
                        </ui-alert-dialog>
                    }
                }
                <div class="flex gap-2">
                    <button type="button" data-testid="cancel">Cancel</button>
                    <button type="submit" data-testid="save" disabled>Save</button>
                </div>
            </div>
        </ng-template>

        <div [attr.dir]="dir()">
            @switch (modal()) {
                @case ('dialog') {
                    <ui-dialog>
                        <ui-dialog-trigger><button type="button" data-testid="modal-trigger">Edit customer</button></ui-dialog-trigger>
                        <ui-dialog-content title="Edit customer"><ng-container [ngTemplateOutlet]="form" /></ui-dialog-content>
                    </ui-dialog>
                }
                @case ('sheet') {
                    <ui-sheet>
                        <ui-sheet-trigger><button type="button" data-testid="modal-trigger">Edit customer</button></ui-sheet-trigger>
                        <ui-sheet-content title="Edit customer"><ng-container [ngTemplateOutlet]="form" /></ui-sheet-content>
                    </ui-sheet>
                }
                @case ('drawer') {
                    <ui-drawer>
                        <ui-drawer-trigger><button type="button" data-testid="modal-trigger">Edit customer</button></ui-drawer-trigger>
                        <ui-drawer-content title="Edit customer"><ng-container [ngTemplateOutlet]="form" /></ui-drawer-content>
                    </ui-drawer>
                }
                @case ('alert-dialog') {
                    <ui-alert-dialog>
                        <ui-alert-dialog-trigger><button type="button" data-testid="modal-trigger">Void invoice</button></ui-alert-dialog-trigger>
                        <ui-alert-dialog-content title="Void invoice?" description="Say why it is voided.">
                            <ng-container [ngTemplateOutlet]="form" />
                        </ui-alert-dialog-content>
                    </ui-alert-dialog>
                }
            }
        </div>
    `,
})
class PopupInModalHost {
    readonly modal = signal<ModalKind>('dialog');
    readonly popup = signal<PopupKind>('select');
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
    readonly countries = ['Netherlands', 'Sweden', 'Japan'];
    readonly saveOptions = [{ label: 'Save as draft' }, { label: 'Save and close' }];
}

interface PopupRow {
    readonly label: string;
    readonly modal: ModalKind;
    readonly popup: PopupKind;
    readonly dir?: 'rtl';
    /** Where focus goes back to — the control the user opened the popup from. */
    readonly trigger: string;
    /** Present while the popup is open. */
    readonly openMarker: string;
    /** Opens the popup the way a user does, leaving focus where they would have it. */
    readonly open: (fixture: ComponentFixture<unknown>) => Promise<void>;
}

const clickTrigger = (selector: string) => async (fixture: ComponentFixture<unknown>): Promise<void> => {
    await click(fixture, must(selector));
};

const POPUP_ROWS: readonly PopupRow[] = [
    {
        label: 'T-8 select in sheet', modal: 'sheet', popup: 'select',
        trigger: 'button[role="combobox"]', openMarker: '[role="listbox"]',
        open: clickTrigger('button[role="combobox"]'),
    },
    {
        label: 'T-8 projected select in dialog', modal: 'dialog', popup: 'select-projected',
        trigger: '[data-slot="select-trigger"]', openMarker: '[data-slot="select-content"]',
        open: clickTrigger('[data-slot="select-trigger"]'),
    },
    {
        label: 'T-8 dropdown-menu in drawer', modal: 'drawer', popup: 'dropdown-menu',
        trigger: '[data-testid="popup-trigger"]', openMarker: '[data-slot="dropdown-content"]',
        open: clickTrigger('[data-testid="popup-trigger"]'),
    },
    {
        label: 'T-8 dropdown-menu in alert-dialog (rtl)', modal: 'alert-dialog', popup: 'dropdown-menu', dir: 'rtl',
        trigger: '[data-testid="popup-trigger"]', openMarker: '[data-slot="dropdown-content"]',
        open: clickTrigger('[data-testid="popup-trigger"]'),
    },
    {
        label: 'T-8 menubar in dialog', modal: 'dialog', popup: 'menubar',
        trigger: '[data-slot="menubar-trigger"]', openMarker: '[data-slot="menubar-content"]',
        open: clickTrigger('[data-slot="menubar-trigger"]'),
    },
    {
        label: 'T-8 context-menu in alert-dialog', modal: 'alert-dialog', popup: 'context-menu',
        trigger: '[data-testid="popup-trigger"]', openMarker: '[data-slot="context-menu-content"]',
        open: async fixture => {
            const target = must('[data-testid="popup-trigger"]');
            target.focus();
            await userEvent.click(target, { button: 'right' });
            await settle(fixture);
        },
    },
    {
        label: 'T-8 popover in sheet', modal: 'sheet', popup: 'popover',
        trigger: '[data-testid="popup-trigger"]', openMarker: '[data-slot="popover-content"]',
        open: clickTrigger('[data-testid="popup-trigger"]'),
    },
    {
        label: 'T-8 date-picker in dialog', modal: 'dialog', popup: 'date-picker',
        trigger: '[data-slot="date-picker"] > button', openMarker: '[data-slot="date-picker"] ui-calendar',
        open: async fixture => {
            await click(fixture, must('[data-slot="date-picker"] > button'));
            await userEvent.tab();
            await settle(fixture);
            expect(must('[data-slot="date-picker"] ui-calendar').contains(document.activeElement)).toBe(true);
        },
    },
    {
        label: 'T-8 date-range-picker in drawer', modal: 'drawer', popup: 'date-range-picker',
        trigger: '[data-slot="date-range-picker"] > button', openMarker: '[data-slot="date-range-picker"] ui-calendar',
        open: clickTrigger('[data-slot="date-range-picker"] > button'),
    },
    {
        label: 'T-8 split-button in dialog', modal: 'dialog', popup: 'split-button',
        trigger: 'button[aria-haspopup="menu"]', openMarker: '[data-slot="split-button"] [role="menu"]',
        open: async fixture => {
            must('button[aria-haspopup="menu"]').focus();
            await press(fixture, '{Enter}');
            expect(document.activeElement?.getAttribute('role')).toBe('menuitem');
        },
    },
    {
        label: 'T-8 emoji-picker in sheet', modal: 'sheet', popup: 'emoji-picker',
        trigger: '[data-testid="popup-trigger"]', openMarker: '[data-slot="emoji-picker-content"]',
        open: clickTrigger('[data-testid="popup-trigger"]'),
    },
    {
        label: 'T-8 eyedropper in dialog', modal: 'dialog', popup: 'eyedropper',
        trigger: '[data-slot="eyedropper-trigger"]', openMarker: '[data-slot="eyedropper-trigger"][aria-pressed="true"]',
        open: clickTrigger('[data-slot="eyedropper-trigger"]'),
    },
    {
        label: 'T-8 alert-dialog in dialog', modal: 'dialog', popup: 'alert-dialog',
        trigger: '[data-testid="popup-trigger"]', openMarker: '[data-slot="alert-dialog-content"]',
        open: clickTrigger('[data-testid="popup-trigger"]'),
    },
];

describe('T-8 Escape inside a popup in a modal', () => {
    for (const row of POPUP_ROWS) {
        it(`Escape inside a popup closes only that popup, never the modal around it (${row.label})`, async () => {
            if (row.popup === 'eyedropper') vi.stubGlobal('EyeDropper', undefined);
            const fixture = await render(PopupInModalHost, host => {
                host.modal.set(row.modal);
                host.popup.set(row.popup);
                host.dir.set(row.dir ?? 'ltr');
            });
            await click(fixture, must('[data-testid="modal-trigger"]'));
            await userEvent.fill(must('[data-testid="name"]'), 'Ada Lovelace');
            await row.open(fixture);
            expect(q(row.openMarker)).not.toBeNull();

            await press(fixture, '{Escape}');

            expect(q(row.openMarker)).toBeNull();
            const panel = must(MODAL_PANEL[row.modal]);
            expect(must<HTMLInputElement>('[data-testid="name"]').value).toBe('Ada Lovelace');
            expect(panel.contains(must('[data-testid="name"]'))).toBe(true);
            expect(document.activeElement).toBe(must(row.trigger));
        });
    }
});

// ---------------------------------------------------------------- T-9

@Component({
    imports: [
        DialogComponent, DialogTriggerComponent, DialogContentComponent,
        DropdownMenuComponent, DropdownMenuTriggerComponent, DropdownMenuContentComponent, DropdownMenuItemComponent,
        DropdownMenuSubComponent, DropdownMenuSubTriggerComponent, DropdownMenuSubContentComponent,
        ContextMenuComponent, ContextMenuTriggerComponent, ContextMenuContentComponent, ContextMenuItemComponent,
        ContextMenuSubComponent, ContextMenuSubTriggerComponent, ContextMenuSubContentComponent,
    ],
    template: `
        <ui-dialog>
            <ui-dialog-trigger><button type="button" data-testid="modal-trigger">Open report</button></ui-dialog-trigger>
            <ui-dialog-content title="Quarterly report">
                @if (kind() === 'dropdown-menu') {
                    <ui-dropdown-menu>
                        <ui-dropdown-menu-trigger><button type="button" data-testid="menu-trigger">Actions</button></ui-dropdown-menu-trigger>
                        <ui-dropdown-menu-content>
                            <ui-dropdown-menu-item>Rename</ui-dropdown-menu-item>
                            <ui-dropdown-menu-sub>
                                <ui-dropdown-menu-sub-trigger>Export as</ui-dropdown-menu-sub-trigger>
                                <ui-dropdown-menu-sub-content>
                                    <ui-dropdown-menu-item>CSV</ui-dropdown-menu-item>
                                    <ui-dropdown-menu-item>PDF</ui-dropdown-menu-item>
                                </ui-dropdown-menu-sub-content>
                            </ui-dropdown-menu-sub>
                        </ui-dropdown-menu-content>
                    </ui-dropdown-menu>
                } @else {
                    <ui-context-menu>
                        <ui-context-menu-trigger><div data-testid="menu-trigger" tabindex="0">Revenue chart</div></ui-context-menu-trigger>
                        <ui-context-menu-content>
                            <ui-context-menu-item>Copy</ui-context-menu-item>
                            <ui-context-menu-sub>
                                <ui-context-menu-sub-trigger>Export as</ui-context-menu-sub-trigger>
                                <ui-context-menu-sub-content>
                                    <ui-context-menu-item>PNG</ui-context-menu-item>
                                    <ui-context-menu-item>SVG</ui-context-menu-item>
                                </ui-context-menu-sub-content>
                            </ui-context-menu-sub>
                        </ui-context-menu-content>
                    </ui-context-menu>
                }
            </ui-dialog-content>
        </ui-dialog>
    `,
})
class SubmenuInDialogHost {
    readonly kind = signal<'dropdown-menu' | 'context-menu'>('dropdown-menu');
}

interface SubmenuRow {
    readonly label: string;
    readonly kind: 'dropdown-menu' | 'context-menu';
    readonly rootMenu: string;
    readonly subMenu: string;
    readonly openRoot: (fixture: ComponentFixture<unknown>) => Promise<void>;
    readonly subTrigger: string;
}

const SUBMENU_ROWS: readonly SubmenuRow[] = [
    {
        label: 'T-9 dropdown-menu submenu', kind: 'dropdown-menu',
        rootMenu: '[data-slot="dropdown-content"]', subMenu: 'ui-dropdown-menu-sub-content [role="menu"]',
        subTrigger: 'ui-dropdown-menu-sub-trigger [role="menuitem"]',
        openRoot: clickTrigger('[data-testid="menu-trigger"]'),
    },
    {
        label: 'T-9 context-menu submenu', kind: 'context-menu',
        rootMenu: '[data-slot="context-menu-content"]', subMenu: '[data-slot="context-menu-sub-content"]',
        subTrigger: '[data-slot="context-menu-sub-trigger"]',
        openRoot: async fixture => {
            const target = must('[data-testid="menu-trigger"]');
            target.focus();
            await userEvent.click(target, { button: 'right' });
            await settle(fixture);
        },
    },
];

describe('T-9 Escape in a submenu', () => {
    for (const row of SUBMENU_ROWS) {
        it(`Escape in a submenu closes only the submenu (${row.label})`, async () => {
            const fixture = await render(SubmenuInDialogHost, host => host.kind.set(row.kind));
            await click(fixture, must('[data-testid="modal-trigger"]'));
            await row.openRoot(fixture);
            must(row.subTrigger).focus();
            await press(fixture, '{ArrowRight}');
            // The submenu opens on a later tick and closes after a hover-intent grace period. Its
            // keyboard focus hand-off (and context-menu item roles) are the sibling keyboard spec's
            // concern, so focus is put inside the submenu here the way a user arrowing in leaves it.
            await vi.waitFor(() => expect(q(row.subMenu)).not.toBeNull());
            const submenu = must(row.subMenu);
            (submenu.querySelector<HTMLElement>('[role="menuitem"]') ?? submenu).focus();

            await press(fixture, '{Escape}');
            await vi.waitFor(() => expect(q(row.subMenu)).toBeNull());
            expect(q(row.rootMenu)).not.toBeNull();
            expect(q('[data-slot="dialog-content"]')).not.toBeNull();

            await press(fixture, '{Escape}');
            expect(q(row.rootMenu)).toBeNull();
            expect(q('[data-slot="dialog-content"]')).not.toBeNull();

            await press(fixture, '{Escape}');
            expect(q('[data-slot="dialog-content"]')).toBeNull();
        });
    }
});

// ---------------------------------------------------------------- T-10 / T-11

@Component({
    imports: [
        DialogComponent, DialogTriggerComponent, DialogContentComponent,
        SheetComponent, SheetTriggerComponent, SheetContentComponent,
        DrawerComponent, DrawerTriggerComponent, DrawerContentComponent,
        AlertDialogComponent, AlertDialogTriggerComponent, AlertDialogContentComponent,
        AlertDialogHeaderComponent, AlertDialogTitleComponent, AlertDialogFooterComponent, AlertDialogCancelComponent,
        TabsComponent,
    ],
    template: `
        <div [attr.dir]="dir()">
            @switch (fixtureName()) {
                @case ('alert-delete') {
                    <ui-alert-dialog>
                        <ui-alert-dialog-trigger><button type="button" data-testid="modal-trigger">Delete workspace</button></ui-alert-dialog-trigger>
                        <ui-alert-dialog-content>
                            <ui-alert-dialog-header><ui-alert-dialog-title>Delete workspace?</ui-alert-dialog-title></ui-alert-dialog-header>
                            <input data-testid="first-enabled" aria-label="Type DELETE to confirm" />
                            <ui-alert-dialog-footer>
                                <ui-alert-dialog-cancel>Cancel</ui-alert-dialog-cancel>
                                <button type="button" disabled>Delete</button>
                            </ui-alert-dialog-footer>
                        </ui-alert-dialog-content>
                    </ui-alert-dialog>
                }
                @case ('alert-first-disabled') {
                    <ui-alert-dialog>
                        <ui-alert-dialog-trigger><button type="button" data-testid="modal-trigger">Publish</button></ui-alert-dialog-trigger>
                        <ui-alert-dialog-content>
                            <ui-alert-dialog-header><ui-alert-dialog-title>Publish now?</ui-alert-dialog-title></ui-alert-dialog-header>
                            <button type="button" disabled>Schedule</button>
                            <ui-alert-dialog-footer>
                                <ui-alert-dialog-cancel data-testid="first-enabled">Cancel</ui-alert-dialog-cancel>
                            </ui-alert-dialog-footer>
                        </ui-alert-dialog-content>
                    </ui-alert-dialog>
                }
                @case ('drawer-submit') {
                    <ui-drawer>
                        <ui-drawer-trigger><button type="button" data-testid="modal-trigger">Checkout</button></ui-drawer-trigger>
                        <ui-drawer-content title="Shipping address">
                            <input data-testid="first-enabled" aria-label="Street" />
                            <input aria-label="City" />
                            <button type="button" disabled>Submit</button>
                        </ui-drawer-content>
                    </ui-drawer>
                }
                @case ('drawer-first-disabled') {
                    <ui-drawer>
                        <ui-drawer-trigger><button type="button" data-testid="modal-trigger">Checkout</button></ui-drawer-trigger>
                        <ui-drawer-content title="Shipping address">
                            <button type="button" disabled>Use saved address</button>
                            <input data-testid="first-enabled" aria-label="Street" />
                        </ui-drawer-content>
                    </ui-drawer>
                }
                @case ('drawer-all-disabled') {
                    <ui-drawer>
                        <ui-drawer-trigger><button type="button" data-testid="modal-trigger">Order status</button></ui-drawer-trigger>
                        <ui-drawer-content title="Order is being packed">
                            <button type="button" disabled>Cancel order</button>
                        </ui-drawer-content>
                    </ui-drawer>
                }
                @case ('drawer-hidden-tail') {
                    <ui-drawer>
                        <ui-drawer-trigger><button type="button" data-testid="modal-trigger">Checkout</button></ui-drawer-trigger>
                        <ui-drawer-content title="Shipping address">
                            <input data-testid="first-enabled" aria-label="Street" />
                            <button type="button">Save</button>
                            <section hidden><button type="button">Gift options</button></section>
                            <section style="display: none"><button type="button">Delivery notes</button></section>
                        </ui-drawer-content>
                    </ui-drawer>
                }
                @case ('dialog-tabs') {
                    <ui-dialog>
                        <ui-dialog-trigger><button type="button" data-testid="modal-trigger">Settings</button></ui-dialog-trigger>
                        <ui-dialog-content title="Settings">
                            <ui-tabs [tabs]="settingsTabs" defaultValue="shipping" />
                            <input data-testid="first-enabled" aria-label="Display name" />
                        </ui-dialog-content>
                    </ui-dialog>
                }
                @case ('dialog-plain') {
                    <ui-dialog>
                        <ui-dialog-trigger><button type="button" data-testid="modal-trigger">Rename</button></ui-dialog-trigger>
                        <ui-dialog-content title="Rename file">
                            <input data-testid="first-enabled" aria-label="File name" />
                            <button type="button">Save</button>
                        </ui-dialog-content>
                    </ui-dialog>
                }
                @case ('sheet-first-disabled') {
                    <ui-sheet>
                        <ui-sheet-trigger><button type="button" data-testid="modal-trigger">Edit customer</button></ui-sheet-trigger>
                        <ui-sheet-content title="Edit customer">
                            <button type="button" disabled>Archive</button>
                            <input data-testid="first-enabled" aria-label="Name" />
                            <button type="button">Save</button>
                        </ui-sheet-content>
                    </ui-sheet>
                }
                @case ('dialog-in-dialog') {
                    <ui-dialog>
                        <ui-dialog-trigger><button type="button" data-testid="modal-trigger">Edit customer</button></ui-dialog-trigger>
                        <ui-dialog-content title="Edit customer">
                            <input aria-label="Name" />
                            <ui-dialog>
                                <ui-dialog-trigger><button type="button" data-testid="inner-trigger">Change owner</button></ui-dialog-trigger>
                                <ui-dialog-content title="Change owner">
                                    <input data-testid="first-enabled" aria-label="New owner" />
                                </ui-dialog-content>
                            </ui-dialog>
                        </ui-dialog-content>
                    </ui-dialog>
                }
            }
        </div>
    `,
})
class FocusFixturesHost {
    readonly fixtureName = signal('dialog-plain');
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
    readonly settingsTabs = [
        { value: 'billing', label: 'Billing' },
        { value: 'shipping', label: 'Shipping' },
    ];
}

interface TrapRow {
    readonly label: string;
    readonly fixture: string;
    readonly panel: string;
    readonly dir?: 'rtl';
    /** The control the user is on when they press the key. */
    readonly start: string;
    readonly key: '{Tab}' | '{Shift>}{Tab}{/Shift}';
    /** Tab stops inside the panel. */
    readonly stops: number;
}

const TRAP_ROWS: readonly TrapRow[] = [
    {
        label: 'T-10 alert-dialog, disabled last control', fixture: 'alert-delete', panel: MODAL_PANEL['alert-dialog'],
        start: '[data-slot="alert-dialog-cancel"]', key: '{Tab}', stops: 2,
    },
    {
        label: 'T-10 alert-dialog, disabled last control (rtl)', fixture: 'alert-delete', panel: MODAL_PANEL['alert-dialog'], dir: 'rtl',
        start: '[data-slot="alert-dialog-cancel"]', key: '{Tab}', stops: 2,
    },
    {
        label: 'T-10 drawer, disabled last control', fixture: 'drawer-submit', panel: MODAL_PANEL.drawer,
        start: '[aria-label="City"]', key: '{Tab}', stops: 2,
    },
    {
        label: 'T-10 dialog, roving tabindex first', fixture: 'dialog-tabs', panel: MODAL_PANEL.dialog,
        start: '[role="tab"][aria-selected="true"]', key: '{Shift>}{Tab}{/Shift}', stops: 3,
    },
    {
        label: 'T-10 sheet, disabled first control', fixture: 'sheet-first-disabled', panel: MODAL_PANEL.sheet,
        start: '[data-testid="first-enabled"]', key: '{Shift>}{Tab}{/Shift}', stops: 3,
    },
    {
        label: 'T-10 drawer, hidden last section', fixture: 'drawer-hidden-tail', panel: MODAL_PANEL.drawer,
        start: '[data-slot="drawer-content"] button:not([data-testid])', key: '{Tab}', stops: 2,
    },
    {
        label: 'T-10 dialog, all controls enabled', fixture: 'dialog-plain', panel: MODAL_PANEL.dialog,
        start: '[data-slot="dialog-content"] button[aria-label]', key: '{Tab}', stops: 3,
    },
];

describe('T-10 focus trap with a real keyboard', () => {
    for (const row of TRAP_ROWS) {
        it(`Tab and Shift+Tab stay inside the modal whatever its edge controls are (${row.label})`, async () => {
            const fixture = await render(FocusFixturesHost, host => {
                host.fixtureName.set(row.fixture);
                host.dir.set(row.dir ?? 'ltr');
            });
            await click(fixture, must('[data-testid="modal-trigger"]'));
            const panel = must(row.panel);
            must(row.start).focus();

            // Every stop must be visited, so a trap that swallows Tab without moving focus fails too.
            const visited = new Set<Element | null>();
            for (let i = 0; i < row.stops + 2; i++) {
                await press(fixture, row.key);
                expect(panel.contains(document.activeElement)).toBe(true);
                visited.add(document.activeElement);
            }
            expect(visited.size).toBe(row.stops);
        });
    }
});

interface FirstFocusRow {
    readonly label: string;
    readonly fixture: string;
    readonly panel: string;
    /** Expected focus after opening; `null` means the panel itself. */
    readonly focus: string | null;
}

const FIRST_FOCUS_ROWS: readonly FirstFocusRow[] = [
    { label: 'T-11 alert-dialog, first control disabled', fixture: 'alert-first-disabled', panel: MODAL_PANEL['alert-dialog'], focus: '[data-testid="first-enabled"] button' },
    { label: 'T-11 sheet, first control disabled', fixture: 'sheet-first-disabled', panel: MODAL_PANEL.sheet, focus: '[data-testid="first-enabled"]' },
    { label: 'T-11 drawer, first control disabled', fixture: 'drawer-first-disabled', panel: MODAL_PANEL.drawer, focus: '[data-testid="first-enabled"]' },
    { label: 'T-11 drawer, only disabled controls', fixture: 'drawer-all-disabled', panel: MODAL_PANEL.drawer, focus: null },
];

describe('T-11 focus on open and close', () => {
    for (const row of FIRST_FOCUS_ROWS) {
        it(`opening a modal focuses its first enabled, visible control (${row.label})`, async () => {
            const fixture = await render(FocusFixturesHost, host => host.fixtureName.set(row.fixture));
            const trigger = must('[data-testid="modal-trigger"]');
            await click(fixture, trigger);

            expect(document.activeElement).toBe(row.focus === null ? must(row.panel) : must(row.focus));

            await press(fixture, '{Escape}');
            expect(q(row.panel)).toBeNull();
            expect(document.activeElement).toBe(trigger);
        });
    }

    it('closing a nested modal returns focus to the control inside the outer modal that opened it', async () => {
        const fixture = await render(FocusFixturesHost, host => host.fixtureName.set('dialog-in-dialog'));
        const outerTrigger = must('[data-testid="modal-trigger"]');
        await click(fixture, outerTrigger);
        const innerTrigger = must('[data-testid="inner-trigger"]');
        await click(fixture, innerTrigger);
        expect(document.activeElement).toBe(must('[data-testid="first-enabled"]'));

        await press(fixture, '{Escape}');
        expect(document.querySelectorAll(MODAL_PANEL.dialog)).toHaveLength(1);
        expect(document.activeElement).toBe(innerTrigger);

        await press(fixture, '{Escape}');
        expect(q(MODAL_PANEL.dialog)).toBeNull();
        expect(document.activeElement).toBe(outerTrigger);
    });
});

// ---------------------------------------------------------------- T-13

@Component({
    imports: [
        DialogComponent, DialogTriggerComponent, DialogContentComponent,
        SelectComponent,
        DropdownMenuComponent, DropdownMenuTriggerComponent, DropdownMenuContentComponent, DropdownMenuItemComponent,
        MenubarComponent, MenubarMenuComponent, MenubarTriggerComponent, MenubarContentComponent, MenubarItemComponent,
        SplitButtonComponent,
    ],
    template: `
        <ui-dialog>
            <ui-dialog-trigger><button type="button" data-testid="modal-trigger">New invoice</button></ui-dialog-trigger>
            <ui-dialog-content title="New invoice">
                <input aria-label="Customer" />
                @switch (popup()) {
                    @case ('select') {
                        <ui-select [options]="currencies" ariaLabel="Currency" />
                    }
                    @case ('dropdown-menu') {
                        <ui-dropdown-menu>
                            <ui-dropdown-menu-trigger><button type="button" data-testid="popup-trigger">Template</button></ui-dropdown-menu-trigger>
                            <ui-dropdown-menu-content>
                                <ui-dropdown-menu-item>Monthly retainer</ui-dropdown-menu-item>
                                <ui-dropdown-menu-item>One-off project</ui-dropdown-menu-item>
                            </ui-dropdown-menu-content>
                        </ui-dropdown-menu>
                    }
                    @case ('menubar') {
                        <ui-menubar>
                            <ui-menubar-menu>
                                <ui-menubar-trigger>Insert</ui-menubar-trigger>
                                <ui-menubar-content>
                                    <ui-menubar-item>Line item</ui-menubar-item>
                                    <ui-menubar-item>Discount</ui-menubar-item>
                                </ui-menubar-content>
                            </ui-menubar-menu>
                        </ui-menubar>
                    }
                    @case ('split-button') {
                        <ui-split-button label="Send" [items]="sendOptions" />
                    }
                }
            </ui-dialog-content>
        </ui-dialog>
    `,
})
class CommitInDialogHost {
    readonly popup = signal<'select' | 'dropdown-menu' | 'menubar' | 'split-button'>('select');
    readonly currencies = ['EUR', 'USD', 'JPY'];
    readonly sendOptions = [{ label: 'Send later' }, { label: 'Send a copy to me' }];
}

interface CommitRow {
    readonly label: string;
    readonly popup: 'select' | 'dropdown-menu' | 'menubar' | 'split-button';
    readonly trigger: string;
    readonly openMarker: string;
    /** Opens the popup and commits or dismisses it from the keyboard. */
    readonly act: (fixture: ComponentFixture<unknown>) => Promise<void>;
}

const COMMIT_ROWS: readonly CommitRow[] = [
    {
        label: 'T-13 select option committed with Enter', popup: 'select',
        trigger: 'button[role="combobox"]', openMarker: '[role="listbox"]',
        act: async fixture => {
            await click(fixture, must('button[role="combobox"]'));
            await press(fixture, '{ArrowDown}{Enter}');
            expect(must('button[role="combobox"]').textContent).toContain('USD');
        },
    },
    {
        label: 'T-13 dropdown item activated with Enter', popup: 'dropdown-menu',
        trigger: '[data-testid="popup-trigger"]', openMarker: '[data-slot="dropdown-content"]',
        act: async fixture => {
            await click(fixture, must('[data-testid="popup-trigger"]'));
            expect(document.activeElement?.getAttribute('role')).toBe('menuitem');
            await press(fixture, '{Enter}');
        },
    },
    {
        label: 'T-13 menubar item activated with Enter', popup: 'menubar',
        trigger: '[data-slot="menubar-trigger"]', openMarker: '[data-slot="menubar-content"]',
        act: async fixture => {
            must('[data-slot="menubar-trigger"]').focus();
            await press(fixture, '{Enter}');
            expect(document.activeElement?.getAttribute('role')).toBe('menuitem');
            await press(fixture, '{Enter}');
        },
    },
    {
        label: 'T-13 split-button menu closed with Escape', popup: 'split-button',
        trigger: 'button[aria-haspopup="menu"]', openMarker: '[data-slot="split-button"] [role="menu"]',
        act: async fixture => {
            must('button[aria-haspopup="menu"]').focus();
            await press(fixture, '{Enter}');
            expect(document.activeElement?.getAttribute('role')).toBe('menuitem');
            await press(fixture, '{Escape}');
        },
    },
];

describe('T-13 focus after a popup commits or dismisses', () => {
    for (const row of COMMIT_ROWS) {
        it(`a popup that held focus returns it to its trigger when committed or dismissed (${row.label})`, async () => {
            const fixture = await render(CommitInDialogHost, host => host.popup.set(row.popup));
            await click(fixture, must('[data-testid="modal-trigger"]'));

            await row.act(fixture);

            expect(q(row.openMarker)).toBeNull();
            expect(document.activeElement).toBe(must(row.trigger));
            await press(fixture, '{Escape}');
            expect(q(MODAL_PANEL.dialog)).toBeNull();
        });
    }
});
