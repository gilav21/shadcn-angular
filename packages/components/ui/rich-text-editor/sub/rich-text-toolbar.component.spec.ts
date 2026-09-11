import { Component, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    RichTextToolbarComponent,
    TEXT_STYLE_OPTIONS,
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

    describe('keyboard navigation (WAI-ARIA toolbar pattern)', () => {
        const buttonsOf = () =>
            Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];

        // A real arrow press comes FROM the focused control, so the handler can
        // read `event.target`. Dispatching on the container instead would test a
        // path the user never takes.
        const pressOnToolbar = (key: string) => {
            const toolbar = fixture.nativeElement.querySelector('[role="toolbar"]') as HTMLElement;
            const focused = Array.from(
                toolbar.querySelectorAll<HTMLElement>('button, select'),
            ).find(el => el.tabIndex === 0) ?? toolbar;
            focused.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
            fixture.detectChanges();
        };

        beforeEach(() => {
            fixture.componentRef.setInput('items', ['bold', 'italic', 'separator', 'underline']);
            fixture.detectChanges();
        });

        it('gives the text-style select and addon buttons a roving tabindex too', async () => {
            // A roving toolbar has ONE tab stop. Managing only the built-in
            // buttons left the select, every addon button and the file input as
            // extra tab stops, so Tab jumped into the middle of the toolbar and
            // the arrows — which index over every button — moved somewhere else
            // again.
            fixture.componentRef.setInput('items', ['bold', 'textStyle', 'italic']);
            fixture.detectChanges();
            // Stops added by a re-render are managed from a MutationObserver,
            // which the browser delivers one microtask later.
            await Promise.resolve();
            const toolbar = fixture.nativeElement.querySelector('[role="toolbar"]') as HTMLElement;
            const focusables = Array.from(
                toolbar.querySelectorAll<HTMLElement>('button, select, input, [tabindex]'),
            );
            const stops = focusables.filter(el => el.tabIndex === 0);
            expect(focusables.length).toBeGreaterThan(1);
            expect(stops).toHaveLength(1);
        });

        it('walks the select as one stop in the arrow order', () => {
            fixture.componentRef.setInput('items', ['bold', 'textStyle', 'italic']);
            fixture.detectChanges();
            const toolbar = fixture.nativeElement.querySelector('[role="toolbar"]') as HTMLElement;
            const stops = () => Array.from(
                toolbar.querySelectorAll<HTMLElement>('button, select, input, [tabindex]'),
            );
            const focused = () => stops().findIndex(el => el.tabIndex === 0);

            expect(focused()).toBe(0);
            toolbar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
            fixture.detectChanges();
            expect(stops()[focused()].tagName.toLowerCase()).toBe('select');
        });

        it('does not trap the tab stop on the text-style select', () => {
            // Skipping the select in the key handler let the arrows move INTO it
            // and never out — a keyboard trap, which is worse than the extra
            // tab stops it was meant to avoid.
            fixture.componentRef.setInput('items', ['bold', 'textStyle', 'italic']);
            fixture.detectChanges();
            const toolbar = fixture.nativeElement.querySelector('[role="toolbar"]') as HTMLElement;
            const stopsOf = () => Array.from(
                toolbar.querySelectorAll<HTMLElement>('button, select'),
            );
            const activeIndex = () => stopsOf().findIndex(el => el.tabIndex === 0);

            pressOnToolbar('ArrowRight');
            expect(stopsOf()[activeIndex()].tagName.toLowerCase()).toBe('select');

            pressOnToolbar('ArrowRight');
            expect(stopsOf()[activeIndex()].tagName.toLowerCase()).toBe('button');
        });

        it('exposes exactly one tab stop, not one per button', () => {
            const tabbable = buttonsOf().filter(b => b.tabIndex === 0);
            expect(buttonsOf()).toHaveLength(3);
            expect(tabbable).toHaveLength(1);
            expect(tabbable[0]).toBe(buttonsOf()[0]);
        });

        it('moves the tab stop with ArrowRight and wraps at the end', () => {
            pressOnToolbar('ArrowRight');
            expect(buttonsOf()[1].tabIndex).toBe(0);
            expect(buttonsOf()[0].tabIndex).toBe(-1);

            pressOnToolbar('ArrowRight');
            pressOnToolbar('ArrowRight');
            expect(buttonsOf()[0].tabIndex).toBe(0);
        });

        it('moves the tab stop with ArrowLeft and wraps at the start', () => {
            pressOnToolbar('ArrowLeft');
            expect(buttonsOf()[2].tabIndex).toBe(0);
        });

        it('jumps to the first and last button with Home and End', () => {
            pressOnToolbar('End');
            expect(buttonsOf()[2].tabIndex).toBe(0);
            pressOnToolbar('Home');
            expect(buttonsOf()[0].tabIndex).toBe(0);
        });
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

        it('maps block items to active formats too', () => {
            fixture.componentRef.setInput('activeFormats', new Set(['heading1']));
            fixture.detectChanges();
            expect(component.isActive('heading1')).toBe(true);
            expect(component.isActive('heading2')).toBe(false);
        });

        // A momentary action can appear in `activeFormats` as data — `indent`
        // carries list-nesting depth — without ever rendering pressed.
        it('returns false for a momentary action even when activeFormats names it', () => {
            fixture.componentRef.setInput('activeFormats', new Set(['indent', 'undo']));
            fixture.detectChanges();
            expect(component.isActive('indent')).toBe(false);
            expect(component.isActive('undo')).toBe(false);
        });
    });

    describe('getTooltip', () => {
        it('includes the keyboard shortcut when present', () => {
            expect(component.getTooltip('bold')).toBe('Bold (Ctrl+B)');
        });

        it('returns the label without a shortcut when none exists', () => {
            expect(component.getTooltip('strikethrough')).toBe('Strikethrough');
        });

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
        it('exposes no customItems input, so a binding logs NG0303 instead of rendering', () => {
            // Angular reports an unknown input through the console rather than
            // by throwing, so the property surface is the assertable evidence.
            const surface = component as unknown as Record<string, unknown>;
            expect('customItems' in surface).toBe(false);

            fixture.componentRef.setInput('items', []);
            fixture.detectChanges();
            expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(0);
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

        // T-36 — a native control still has to meet the 44px touch target the
        // library guarantees; the coarse-pointer rule covers `select` as well
        // as `button`.
        it('meets the 44px touch minimum under a coarse pointer', () => {
            expect(showSelect()).not.toBeNull();

            const rule = Array.from(document.styleSheets)
                .flatMap((sheet) => {
                    try {
                        return Array.from(sheet.cssRules);
                    } catch {
                        return [];
                    }
                })
                .filter((r): r is CSSMediaRule => r instanceof CSSMediaRule)
                .filter((r) => r.conditionText.includes('pointer: coarse'))
                .flatMap((r) => Array.from(r.cssRules))
                .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule)
                .find((r) => r.selectorText.includes('select'));

            // 44, not 40: WCAG 2.5.8 and the library's own touch rule.
            expect(rule?.style.minHeight).toBe('44px');
        });
    });

    // T-34 — the table and the locales stay complete.
    describe('textStyle in the shared tables', () => {
        it('has a TOOLBAR_BUTTONS row whose id matches its key', () => {
            expect(TOOLBAR_BUTTONS.textStyle).toBeDefined();
            expect(TOOLBAR_BUTTONS.textStyle.id).toBe('textStyle');
            expect(TOOLBAR_BUTTONS.textStyle.localeKey).toBe('textStyle');
        });

        it('has a non-empty toolbar.textStyle in every locale', () => {
            const locales = Object.keys(RICH_TEXT_LOCALES);
            expect(locales.length).toBeGreaterThanOrEqual(10);
            for (const code of locales) {
                expect(RICH_TEXT_LOCALES[code].toolbar.textStyle.length).toBeGreaterThan(0);
            }
        });

        it('lists the four options in TEXT_STYLE_OPTIONS', () => {
            expect([...TEXT_STYLE_OPTIONS]).toEqual([
                'paragraph', 'heading1', 'heading2', 'heading3',
            ]);
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
