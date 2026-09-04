import { Component, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    RichTextToolbarComponent,
    TOOLBAR_BUTTONS,
    type ToolbarButton,
    type ToolbarButtonItem,
} from './rich-text-toolbar.component';
import { RichTextToolbarViewContext } from '../rich-text-editor.host';
import { RICH_TEXT_LOCALES } from '../rich-text-locales';

@Component({
    standalone: true,
    template: `<span data-testid="slot-probe">probe</span>`,
})
class SlotProbeComponent {}

@Component({
    standalone: true,
    template: `<span data-testid="compact-probe">compact:{{ view?.compact() }}</span>`,
})
class CompactProbeComponent {
    protected readonly view = inject(RichTextToolbarViewContext, { optional: true });
}

describe('RichTextToolbarComponent', () => {
    let component: RichTextToolbarComponent;
    let fixture: ComponentFixture<RichTextToolbarComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextToolbarComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(RichTextToolbarComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    describe('rendering', () => {
        it('renders one button per non-separator item', () => {
            fixture.componentRef.setInput('items', ['bold', 'italic', 'separator', 'underline']);
            fixture.detectChanges();
            const buttons = fixture.nativeElement.querySelectorAll('button');
            expect(buttons).toHaveLength(3);
        });

        it('renders a separator element for the separator item', () => {
            fixture.componentRef.setInput('items', ['bold', 'separator', 'italic']);
            fixture.detectChanges();
            const sep = fixture.nativeElement.querySelector('ui-separator');
            expect(sep).not.toBeNull();
        });

        it('sets aria-pressed=true on an active format button', () => {
            fixture.componentRef.setInput('items', ['bold']);
            fixture.componentRef.setInput('activeFormats', new Set(['bold']));
            fixture.detectChanges();
            const btn = fixture.nativeElement.querySelector('button');
            expect(btn.getAttribute('aria-pressed')).toBe('true');
            expect(btn.getAttribute('data-state')).toBe('on');
        });

        it('sets aria-pressed=false on an inactive format button', () => {
            fixture.componentRef.setInput('items', ['bold']);
            fixture.componentRef.setInput('activeFormats', new Set<string>());
            fixture.detectChanges();
            const btn = fixture.nativeElement.querySelector('button');
            expect(btn.getAttribute('aria-pressed')).toBe('false');
            expect(btn.getAttribute('data-state')).toBe('off');
        });

        it('renders a toolbar with role=toolbar', () => {
            const toolbar = fixture.nativeElement.querySelector('[role="toolbar"]');
            expect(toolbar).not.toBeNull();
        });
    });

    describe('format button click', () => {
        it('emits formatCommand with the item id when a button is clicked', () => {
            fixture.componentRef.setInput('items', ['bold']);
            fixture.detectChanges();
            let emitted: string | undefined;
            component.formatCommand.subscribe((v) => (emitted = v));

            const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
            btn.click();

            expect(emitted).toBe('bold');
        });

        it('does not emit when interaction is disabled', () => {
            fixture.componentRef.setInput('disabled', true);
            fixture.detectChanges();
            let emitted = false;
            component.formatCommand.subscribe(() => (emitted = true));

            component.onFormatClick('italic');
            expect(emitted).toBe(false);
        });

        it('does not emit when readonly', () => {
            fixture.componentRef.setInput('readonly', true);
            fixture.detectChanges();
            let emitted = false;
            component.formatCommand.subscribe(() => (emitted = true));

            component.onFormatClick('italic');
            expect(emitted).toBe(false);
            expect(component.interactionDisabled()).toBe(true);
        });
    });

    describe('isActive', () => {
        it('maps formattable items to active formats', () => {
            fixture.componentRef.setInput('activeFormats', new Set(['bold', 'code']));
            fixture.detectChanges();
            expect(component.isActive('bold')).toBe(true);
            expect(component.isActive('code')).toBe(true);
            expect(component.isActive('italic')).toBe(false);
        });

        it('returns false for non-formattable items', () => {
            fixture.componentRef.setInput('activeFormats', new Set(['heading1']));
            fixture.detectChanges();
            expect(component.isActive('heading1')).toBe(false);
        });
    });

    describe('getTooltip', () => {
        it('includes the keyboard shortcut when present', () => {
            expect(component.getTooltip('bold')).toBe('Bold (Ctrl+B)');
        });

        it('returns the label without a shortcut when none exists', () => {
            expect(component.getTooltip('strikethrough')).toBe('Strikethrough');
        });

        it('swaps align tooltips in RTL locale', () => {
            fixture.componentRef.setInput('locale', RICH_TEXT_LOCALES['he']);
            fixture.detectChanges();
            const leftTip = component.getTooltip('alignLeft');
            const heLocale = RICH_TEXT_LOCALES['he'];
            expect(leftTip).toBe(heLocale.toolbar.alignRight);
        });

        it('swaps the alignRight tooltip to alignLeft in RTL locale', () => {
            fixture.componentRef.setInput('locale', RICH_TEXT_LOCALES['he']);
            fixture.detectChanges();
            const heLocale = RICH_TEXT_LOCALES['he'];
            expect(component.getTooltip('alignRight')).toBe(heLocale.toolbar.alignLeft);
        });
    });

    describe('getIcon', () => {
        it('returns sanitized svg for a known item', () => {
            const icon = component.getIcon('bold');
            expect(icon).toBeTruthy();
        });

        it('swaps alignLeft/alignRight icons in RTL', () => {
            const ltr = component.getIcon('alignLeft');
            fixture.componentRef.setInput('locale', RICH_TEXT_LOCALES['he']);
            fixture.detectChanges();
            const rtl = component.getIcon('alignLeft');
            // In RTL the alignLeft button renders the alignRight icon, so the
            // sanitized SafeHtml objects differ from the LTR rendering.
            expect(String(rtl)).not.toBe(String(ltr));
        });

        it('swaps indent/outdent icons in RTL', () => {
            fixture.componentRef.setInput('locale', RICH_TEXT_LOCALES['he']);
            fixture.detectChanges();
            const indentRtl = component.getIcon('indent');
            const outdentLtr = (() => {
                fixture.componentRef.setInput('locale', RICH_TEXT_LOCALES['en']);
                fixture.detectChanges();
                return component.getIcon('outdent');
            })();
            expect(String(indentRtl)).toBe(String(outdentLtr));
        });

        it('swaps the alignRight icon to alignLeft and outdent to indent in RTL', () => {
            const alignRightLtr = component.getIcon('alignRight');
            const outdentLtr = component.getIcon('outdent');
            fixture.componentRef.setInput('locale', RICH_TEXT_LOCALES['he']);
            fixture.detectChanges();
            expect(String(component.getIcon('alignRight'))).not.toBe(String(alignRightLtr));
            expect(String(component.getIcon('outdent'))).not.toBe(String(outdentLtr));
        });
    });

    // T-9 — the dead third extension path is gone. `customToolbarItems` /
    // `customItems` looked like the simplest way to add a toolbar button but
    // recorded no undo entry; addon toolbar slots are now the only path.
    describe('removed custom-items API', () => {
        it('exposes no customItems input', () => {
            expect(() => fixture.componentRef.setInput('customItems', [])).toThrow();
        });

        it('exposes no customItemClick output and no custom-item helpers', () => {
            const surface = component as unknown as Record<string, unknown>;
            expect('customItemClick' in surface).toBe(false);
            expect('onCustomItemClick' in surface).toBe(false);
            expect('customButtonClasses' in surface).toBe(false);
        });
    });

    describe('addon slots', () => {
        it('renders a button slot with its icon, tooltip, and data-addon-slot id', () => {
            fixture.componentRef.setInput('items', []);
            fixture.componentRef.setInput('addonSlots', [
                { id: 'a.button', icon: '<svg></svg>', tooltip: 'Addon', onClick: () => void 0 },
            ]);
            fixture.detectChanges();
            const btn = fixture.nativeElement.querySelector('[data-addon-slot="a.button"]') as HTMLButtonElement;
            expect(btn.tagName).toBe('BUTTON');
            expect(btn.title).toBe('Addon');
        });

        it('renders a component slot through the outlet instead of a button', () => {
            fixture.componentRef.setInput('items', []);
            fixture.componentRef.setInput('addonSlots', [
                { id: 'a.component', component: SlotProbeComponent },
            ]);
            fixture.detectChanges();
            const slot = fixture.nativeElement.querySelector('[data-addon-slot="a.component"]') as HTMLElement;
            expect(slot.tagName).toBe('SPAN');
            expect(slot.querySelector('[data-testid="slot-probe"]')).not.toBeNull();
            expect(slot.querySelector('button')).toBeNull();
        });

        it('renders nothing for a malformed slot with neither component nor icon', () => {
            fixture.componentRef.setInput('items', []);
            fixture.componentRef.setInput('addonSlots', [
                { id: 'a.broken', tooltip: 'broken', onClick: () => void 0 },
            ]);
            fixture.detectChanges();
            expect(fixture.nativeElement.querySelector('[data-addon-slot="a.broken"]')).toBeNull();
        });

        it('provides the toolbar view context (compact) to component slots', () => {
            fixture.componentRef.setInput('items', []);
            fixture.componentRef.setInput('compact', true);
            fixture.componentRef.setInput('addonSlots', [
                { id: 'a.ctx', component: CompactProbeComponent },
            ]);
            fixture.detectChanges();
            const probe = fixture.nativeElement.querySelector('[data-testid="compact-probe"]') as HTMLElement;
            expect(probe.textContent).toBe('compact:true');
        });

        it('orders slots by their order value, lowest first', () => {
            fixture.componentRef.setInput('items', []);
            fixture.componentRef.setInput('addonSlots', [
                { id: 'late', icon: '<svg></svg>', tooltip: 'late', order: 900, onClick: () => void 0 },
                { id: 'early', component: SlotProbeComponent, order: 10 },
            ]);
            fixture.detectChanges();
            const slots = [...fixture.nativeElement.querySelectorAll('[data-addon-slot]')] as HTMLElement[];
            expect(slots.map((s) => s.getAttribute('data-addon-slot'))).toEqual(['early', 'late']);
        });
    });

    describe('computed config', () => {
        it('adds compact classes when compact is set', () => {
            fixture.componentRef.setInput('compact', true);
            fixture.detectChanges();
            expect(component.containerClasses()).toContain('bg-transparent');
        });

        it('applies the active style in buttonClasses for an active item', () => {
            fixture.componentRef.setInput('activeFormats', new Set(['bold']));
            fixture.detectChanges();
            expect(component.buttonClasses('bold')).toContain('bg-accent text-accent-foreground');
            expect(component.buttonClasses('italic')).not.toContain('bg-accent text-accent-foreground');
        });
    });

    // T-5 — one table, keyed by the button union. A new `ToolbarItem` member
    // without its row is a `tsc` error (the `Record` below), not a button that
    // renders blank with its raw id as the tooltip.
    describe('TOOLBAR_BUTTONS table', () => {
        /**
         * Type-level completeness: this annotation stops compiling the moment
         * a `ToolbarItem` member has no row — the blank-button failure mode
         * becomes a `tsc` error instead.
         */
        const complete: Record<ToolbarButtonItem, ToolbarButton> = TOOLBAR_BUTTONS;

        /** Every non-separator item the toolbar can be asked to render. */
        const buttonItems = Object.keys(complete) as ToolbarButtonItem[];

        it('has no separator row and every row keyed by its own id', () => {
            expect(buttonItems).not.toContain('separator');
            for (const key of buttonItems) {
                expect(TOOLBAR_BUTTONS[key].id).toBe(key);
            }
        });

        it('gives every row a non-empty inline SVG icon and a locale key', () => {
            for (const key of buttonItems) {
                const row = TOOLBAR_BUTTONS[key];
                expect(row.icon, `${key} icon`).toMatch(/^<svg/);
                expect(row.localeKey, `${key} localeKey`).toBeTruthy();
                expect(row.label, `${key} label`).toBeTruthy();
            }
        });

        it('covers every item the default toolbar renders', () => {
            const defaults = component.items().filter((i) => i !== 'separator');
            for (const item of defaults) {
                expect(buttonItems).toContain(item);
            }
        });
    });

    // T-6 — the table is the single source for both the glyph and the tooltip.
    describe('table-driven icon and tooltip', () => {
        const buttonItems = Object.keys(TOOLBAR_BUTTONS) as ToolbarButtonItem[];

        it('renders the table icon for every button item', () => {
            for (const item of buttonItems) {
                expect(String(component.getIcon(item)), item).toContain(
                    TOOLBAR_BUTTONS[item].icon,
                );
            }
        });

        it('renders the localized label (plus shortcut) for every button item', () => {
            const locale = component.locale();
            for (const item of buttonItems) {
                const row = TOOLBAR_BUTTONS[item];
                const label = locale.toolbar[row.localeKey];
                const expected = row.shortcut ? `${label} (${row.shortcut})` : label;
                expect(component.getTooltip(item), item).toBe(expected);
            }
        });

        it('renders nothing for the separator item', () => {
            expect(String(component.getIcon('separator'))).not.toContain('<svg');
            expect(component.getTooltip('separator')).toBe('');
        });
    });

    // T-7 — RTL contract: alignment mirrors icon AND label; indent/outdent
    // mirror the icon only, because the label already names the direction the
    // text moves rather than a side of the page.
    describe('RTL mirroring', () => {
        beforeEach(() => {
            fixture.componentRef.setInput('locale', RICH_TEXT_LOCALES['he']);
            fixture.detectChanges();
        });

        it('mirrors both the icon and the tooltip for the alignment items', () => {
            const he = RICH_TEXT_LOCALES['he'];
            expect(String(component.getIcon('alignLeft'))).toContain(
                TOOLBAR_BUTTONS.alignRight.icon,
            );
            expect(String(component.getIcon('alignRight'))).toContain(
                TOOLBAR_BUTTONS.alignLeft.icon,
            );
            expect(component.getTooltip('alignLeft')).toBe(he.toolbar.alignRight);
            expect(component.getTooltip('alignRight')).toBe(he.toolbar.alignLeft);
        });

        it('mirrors the icon but NOT the tooltip for indent/outdent', () => {
            const he = RICH_TEXT_LOCALES['he'];
            expect(String(component.getIcon('indent'))).toContain(TOOLBAR_BUTTONS.outdent.icon);
            expect(String(component.getIcon('outdent'))).toContain(TOOLBAR_BUTTONS.indent.icon);
            expect(component.getTooltip('indent')).toBe(he.toolbar.indent);
            expect(component.getTooltip('outdent')).toBe(he.toolbar.outdent);
        });

        it('leaves a non-directional item untouched', () => {
            expect(String(component.getIcon('bold'))).toContain(TOOLBAR_BUTTONS.bold.icon);
            expect(component.getTooltip('bold')).toContain(RICH_TEXT_LOCALES['he'].toolbar.bold);
        });
    });

    // T-8 — built-in and addon buttons must look identical; only the source of
    // the "active" flag differs.
    describe('shared button classes', () => {
        const slot = { id: 'a.b', icon: '<svg></svg>', tooltip: 'A', onClick: () => void 0 };

        it('gives an inactive built-in and an inactive addon slot the same classes', () => {
            expect(component.addonButtonClasses(slot)).toBe(component.buttonClasses('heading1'));
        });

        it('adds the same active classes to both', () => {
            fixture.componentRef.setInput('activeFormats', new Set(['bold']));
            fixture.detectChanges();
            const activeBuiltIn = component.buttonClasses('bold');
            const activeAddon = component.addonButtonClasses({ ...slot, isActive: () => true });
            expect(activeBuiltIn).toContain('bg-accent text-accent-foreground');
            expect(activeAddon).toBe(activeBuiltIn);
        });

        it('applies the compact padding to both', () => {
            fixture.componentRef.setInput('compact', true);
            fixture.detectChanges();
            expect(component.buttonClasses('heading1')).toContain('p-1');
            expect(component.addonButtonClasses(slot)).toBe(component.buttonClasses('heading1'));
        });
    });

});
