import { Component, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    RichTextToolbarComponent,
    TOOLBAR_BUTTONS,
    type ToolbarButton,
    type ToolbarButtonItem,
    type ToolbarItem,
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
        it('renders a separator element for the separator item', () => {
            fixture.componentRef.setInput('items', ['bold', 'separator', 'italic']);
            fixture.detectChanges();
            const sep = fixture.nativeElement.querySelector('ui-separator');
            expect(sep).not.toBeNull();
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

    describe('getTooltip', () => {
        // `toolbarItems` is consumer input: a name outside the union reaches
        // these lookups at runtime even though tsc rejects it. Before the typed
        // TOOLBAR_BUTTONS record this returned the raw name; afterwards it threw
        // "Cannot read properties of undefined (reading 'localeKey')", which
        // took out the whole toolbar render.
        it('falls back to the raw name for an item outside the union', () => {
            const unknown = 'link' as ToolbarItem;
            expect(component.getTooltip(unknown)).toBe('link');
            expect(() => component.getIcon(unknown)).not.toThrow();
        });
    });

    describe('getIcon', () => {
        it('returns the same SafeHtml object for the same glyph, so change detection keeps the SVG nodes', () => {
            // A fresh wrapper per call re-rendered every glyph on every change
            // detection; the SVG under the pointer was replaced between
            // mousedown and mouseup and Chrome dropped the click, so every
            // button needed two clicks from inside the editor.
            expect(component.getIcon('bold')).toBe(component.getIcon('bold'));
            expect(component.getSafeIcon('<svg data-x="1"></svg>')).toBe(component.getSafeIcon('<svg data-x="1"></svg>'));

            const svgBefore = (fixture.nativeElement as HTMLElement).querySelector('button[data-toolbar-item="bold"] svg');
            fixture.componentRef.setInput('activeFormats', new Set(['bold']));
            fixture.detectChanges();
            fixture.detectChanges();
            const svgAfter = (fixture.nativeElement as HTMLElement).querySelector('button[data-toolbar-item="bold"] svg');
            expect(svgBefore).not.toBeNull();
            expect(svgAfter).toBe(svgBefore);
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

    // T-5 — one table, keyed by the button union. A new `ToolbarItem` member
    // without its row is a `tsc` error (the `Record` below), not a button that
    // renders blank with its raw id as the tooltip.

    // T-29 — the pressed-state vocabulary. Every block, list and alignment item
    // reflects `activeFormats`; the momentary actions never announce themselves
    // as toggles, because `aria-pressed` on a non-toggle is an a11y defect.
    describe('pressed state', () => {
        const pressable = [
            'bold', 'italic', 'underline', 'strikethrough', 'code', 'taskList',
            'bulletList', 'orderedList', 'paragraph', 'heading1', 'heading2', 'heading3',
            'blockquote', 'codeBlock', 'alignLeft', 'alignCenter', 'alignRight',
        ] as const;

        it.each(pressable)('renders %s pressed when activeFormats reports it', (item) => {
            fixture.componentRef.setInput('items', [item]);
            fixture.componentRef.setInput('activeFormats', new Set([item]));
            fixture.detectChanges();

            const button = fixture.nativeElement.querySelector('button');
            expect(button.getAttribute('aria-pressed')).toBe('true');
            expect(button.getAttribute('data-state')).toBe('on');
        });

        it.each(pressable)('renders %s unpressed when activeFormats omits it', (item) => {
            fixture.componentRef.setInput('items', [item]);
            fixture.componentRef.setInput('activeFormats', new Set<string>());
            fixture.detectChanges();

            const button = fixture.nativeElement.querySelector('button');
            expect(button.getAttribute('aria-pressed')).toBe('false');
            expect(button.getAttribute('data-state')).toBe('off');
        });

        // A momentary action is not a toggle: WAI-ARIA's button pattern puts
        // `aria-pressed` only on toggle buttons, so these must OMIT the
        // attribute rather than report false — a screen reader announcing
        // "Undo, not pressed" is wrong, not merely noisy.
        const momentary = ['undo', 'redo', 'clear', 'horizontalRule', 'indent', 'outdent'] as const;

        it.each(momentary)('never puts aria-pressed on %s', (item) => {
            fixture.componentRef.setInput('items', [item]);
            fixture.componentRef.setInput('activeFormats', new Set([item]));
            fixture.detectChanges();

            const button = fixture.nativeElement.querySelector('button');
            expect(button.hasAttribute('aria-pressed')).toBe(false);
        });

        it('leaves a momentary button out of the pressed styling even when named in activeFormats', () => {
            fixture.componentRef.setInput('items', ['indent']);
            fixture.componentRef.setInput('activeFormats', new Set(['indent']));
            fixture.detectChanges();

            const button = fixture.nativeElement.querySelector('button');
            expect(button.getAttribute('data-state')).toBe('off');
        });
    });


    // T-30…T-34, T-36 — the Text style select. It replaces the four block
    // buttons in the default toolbar, reclaiming roughly three buttons of width
    // on a phone, and both reflects and sets the caret's block type.
    describe('text style select', () => {
        const selectEl = (): HTMLSelectElement =>
            fixture.nativeElement.querySelector('[data-slot="rich-text-toolbar-text-style"]');

        const showSelect = (formats: string[] = []): HTMLSelectElement => {
            fixture.componentRef.setInput('items', ['textStyle']);
            fixture.componentRef.setInput('activeFormats', new Set(formats));
            fixture.detectChanges();
            return selectEl();
        };

        it('renders a select rather than a button', () => {
            const select = showSelect();
            expect(select).not.toBeNull();
            expect(fixture.nativeElement.querySelector('button')).toBeNull();
        });

        it('offers exactly the four block types, localized', () => {
            const options = Array.from(showSelect().options);
            expect(options.map((o) => o.value)).toEqual([
                'paragraph', 'heading1', 'heading2', 'heading3',
            ]);
            expect(options.map((o) => o.textContent?.trim())).toEqual([
                'Normal Text', 'Heading 1', 'Heading 2', 'Heading 3',
            ]);
        });

        it('tracks the caret block through activeFormats', () => {
            expect(showSelect(['heading2']).value).toBe('heading2');
            expect(showSelect(['heading1']).value).toBe('heading1');
            expect(showSelect(['paragraph']).value).toBe('paragraph');
        });

        it('falls back to paragraph for a block with no text-style option', () => {
            expect(showSelect(['blockquote']).value).toBe('paragraph');
            expect(showSelect([]).value).toBe('paragraph');
        });

        // A heading wins over a stray `paragraph`. The host does not report both
        // today, but `paragraph` is the fallback rather than a peer, so a set
        // carrying both must still read as the heading rather than resolving by
        // whichever happens to come first in the option list.
        it('prefers a heading over paragraph when both are reported', () => {
            expect(showSelect(['paragraph', 'heading3']).value).toBe('heading3');
        });

        it('emits formatCommand with the chosen option id', () => {
            const select = showSelect(['paragraph']);
            const emitted: string[] = [];
            component.formatCommand.subscribe((command: string) => emitted.push(command));

            select.value = 'heading2';
            select.dispatchEvent(new Event('change', { bubbles: true }));
            fixture.detectChanges();

            expect(emitted).toEqual(['heading2']);
        });

        it('is disabled, and emits nothing, where the caret line takes no text style', () => {
            fixture.componentRef.setInput('items', ['textStyle']);
            fixture.componentRef.setInput('textStyleAvailable', false);
            fixture.detectChanges();
            const select = selectEl();
            expect(select.disabled).toBe(true);

            const emitted: string[] = [];
            component.formatCommand.subscribe((command: string) => emitted.push(command));
            select.value = 'heading1';
            select.dispatchEvent(new Event('change', { bubbles: true }));
            fixture.detectChanges();

            expect(emitted).toEqual([]);
            expect(select.value).toBe('paragraph');
        });

        it('goes back to the caret block when the editor does not apply the pick', async () => {
            // The browser moves the select before anything else runs, and no
            // binding moves it back while the caret's block is unchanged, so a
            // refused pick left a heading showing over normal text.
            const select = showSelect(['paragraph']);
            select.value = 'heading1';
            select.dispatchEvent(new Event('change', { bubbles: true }));
            fixture.detectChanges();
            await Promise.resolve();

            expect(select.value).toBe('paragraph');
        });

        it('moves forward to the block a pick applied', async () => {
            // A fix that puts the select back later than the pick, from a value
            // read before it, would undo a heading the editor did apply.
            const select = showSelect(['paragraph']);
            select.value = 'heading2';
            select.dispatchEvent(new Event('change', { bubbles: true }));
            fixture.componentRef.setInput('activeFormats', new Set(['heading2']));
            fixture.detectChanges();
            await Promise.resolve();

            expect(select.value).toBe('heading2');
        });

        it('is disabled and silent while the toolbar is disabled', () => {
            fixture.componentRef.setInput('items', ['textStyle']);
            fixture.componentRef.setInput('disabled', true);
            fixture.detectChanges();

            const select = selectEl();
            expect(select.disabled).toBe(true);

            const emitted: string[] = [];
            component.formatCommand.subscribe((command: string) => emitted.push(command));
            select.value = 'heading1';
            select.dispatchEvent(new Event('change', { bubbles: true }));
            fixture.detectChanges();

            expect(emitted).toEqual([]);
        });

        it('is disabled while the toolbar is readonly', () => {
            fixture.componentRef.setInput('items', ['textStyle']);
            fixture.componentRef.setInput('readonly', true);
            fixture.detectChanges();

            expect(selectEl().disabled).toBe(true);
        });

        it('ignores a change carrying a value outside the option set', () => {
            showSelect(['paragraph']);
            const emitted: string[] = [];
            component.formatCommand.subscribe((command: string) => emitted.push(command));

            component.onTextStyleChange({ target: { value: 'heading9' } } as unknown as Event);
            fixture.detectChanges();

            expect(emitted).toEqual([]);
        });

        it('carries an accessible name from the locale', () => {
            const select = showSelect();
            expect(select.getAttribute('aria-label')).toBe(
                RICH_TEXT_LOCALES['en'].toolbar.textStyle
            );
        });

        it('is never announced as a pressed toggle', () => {
            expect(showSelect(['heading1']).hasAttribute('aria-pressed')).toBe(false);
            expect(component.isPressable('textStyle')).toBe(false);
        });

        it('takes the arrow, Home and End keys as roving moves, leaving its value and the focus alone', () => {
            // The select is a roving stop like any button. Left to the native
            // control, an arrow would change the block type instead.
            const select = showSelect(['heading2']);
            select.focus();
            expect(document.activeElement).toBe(select);

            for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
                const press = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
                select.dispatchEvent(press);
                expect(press.defaultPrevented, key).toBe(true);
            }
            expect(document.activeElement).toBe(select);
            expect(select.value).toBe('heading2');
            expect(select.tabIndex).toBe(0);

            const typed = new KeyboardEvent('keydown', { key: 'p', bubbles: true, cancelable: true });
            select.dispatchEvent(typed);
            expect(typed.defaultPrevented).toBe(false);
        });
    });

    // T-34 — the table and the locales stay complete.
    describe('textStyle in the shared tables', () => {
        it('has a non-empty toolbar.textStyle in every locale', () => {
            const locales = Object.keys(RICH_TEXT_LOCALES);
            expect(locales.length).toBeGreaterThanOrEqual(10);
            for (const code of locales) {
                expect(RICH_TEXT_LOCALES[code].toolbar.textStyle.length).toBeGreaterThan(0);
            }
        });
    });

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
