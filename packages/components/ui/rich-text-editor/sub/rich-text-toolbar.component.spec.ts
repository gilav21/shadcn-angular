import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RichTextToolbarComponent } from './rich-text-toolbar.component';
import { RICH_TEXT_LOCALES } from '../rich-text-locales';
import type { RichTextCustomToolbarItem } from '../rich-text-editor.component';

function makeFileEvent(file: File | null): Event {
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
        value: file ? [file] : [],
        configurable: true,
    });
    return { target: input } as unknown as Event;
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

        it('falls back to the item id for an unknown button', () => {
            expect(component.getTooltip('nonexistent' as never)).toBe('nonexistent');
        });

        it('swaps align tooltips in RTL locale', () => {
            fixture.componentRef.setInput('locale', RICH_TEXT_LOCALES['he']);
            fixture.detectChanges();
            const leftTip = component.getTooltip('alignLeft');
            const heLocale = RICH_TEXT_LOCALES['he'];
            expect(leftTip).toBe(heLocale.toolbar.alignRight);
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
    });

    describe('insert handlers', () => {
        it('emits linkInsert with text and url', () => {
            let payload: { text: string; url: string } | undefined;
            component.linkInsert.subscribe((p) => (payload = p));
            component.onInsertLink('hello', 'https://x.com');
            expect(payload).toEqual({ text: 'hello', url: 'https://x.com' });
        });

        it('defaults link text to "Link" when blank', () => {
            let payload: { text: string; url: string } | undefined;
            component.linkInsert.subscribe((p) => (payload = p));
            component.onInsertLink('', 'https://x.com');
            expect(payload).toEqual({ text: 'Link', url: 'https://x.com' });
        });

        it('does not emit linkInsert when url is empty', () => {
            let emitted = false;
            component.linkInsert.subscribe(() => (emitted = true));
            component.onInsertLink('text', '');
            expect(emitted).toBe(false);
        });

        it('emits imageInsert with alt and src, defaulting alt to "Image"', () => {
            let payload: { alt: string; src: string } | undefined;
            component.imageInsert.subscribe((p) => (payload = p));
            component.onInsertImage('https://x.com/a.png', '');
            expect(payload).toEqual({ alt: 'Image', src: 'https://x.com/a.png' });
        });

        it('does not emit imageInsert when src is empty', () => {
            let emitted = false;
            component.imageInsert.subscribe(() => (emitted = true));
            component.onInsertImage('', 'alt');
            expect(emitted).toBe(false);
        });

        it('emits emojiInsert', () => {
            let emoji: string | undefined;
            component.emojiInsert.subscribe((e) => (emoji = e));
            component.onEmojiSelect('😀');
            expect(emoji).toBe('😀');
        });

        it('emits colorSelect with type and color', () => {
            let payload: { type: string; color: string } | undefined;
            component.colorSelect.subscribe((p) => (payload = p));
            component.onColorSelect('fontColor', '#ff0000');
            expect(payload).toEqual({ type: 'fontColor', color: '#ff0000' });
        });

        it('emits fontSizeSelect', () => {
            let size: string | undefined;
            component.fontSizeSelect.subscribe((s) => (size = s));
            component.onFontSizeSelect('18');
            expect(size).toBe('18');
        });

        it('renders a ui-color-picker with the text palette as presets in the fontColor popover', async () => {
            fixture.componentRef.setInput('items', ['fontColor']);
            fixture.detectChanges();
            component.openPopoverPanel('fontColor');
            fixture.detectChanges();
            await fixture.whenStable();
            const picker = fixture.nativeElement.querySelector('ui-color-picker');
            expect(picker).not.toBeNull();
        });

        it('renders a ui-color-picker with alpha enabled in the backgroundColor popover', async () => {
            fixture.componentRef.setInput('items', ['backgroundColor']);
            fixture.detectChanges();
            component.openPopoverPanel('backgroundColor');
            fixture.detectChanges();
            await fixture.whenStable();
            const picker = fixture.nativeElement.querySelector('ui-color-picker');
            expect(picker).not.toBeNull();
        });

        it('emits colorSelect when the color-picker changes color', () => {
            fixture.componentRef.setInput('items', ['fontColor']);
            fixture.detectChanges();
            let emitted: { type: string; color: string } | undefined;
            component.colorSelect.subscribe((e) => (emitted = e));
            component.onColorSelect('fontColor', '#123456');
            expect(emitted).toEqual({ type: 'fontColor', color: '#123456' });
        });

        it('guards insert handlers when disabled', () => {
            fixture.componentRef.setInput('disabled', true);
            fixture.detectChanges();
            let count = 0;
            component.linkInsert.subscribe(() => count++);
            component.imageInsert.subscribe(() => count++);
            component.emojiInsert.subscribe(() => count++);
            component.colorSelect.subscribe(() => count++);
            component.onInsertLink('a', 'https://x.com');
            component.onInsertImage('https://x.com/a.png', 'a');
            component.onEmojiSelect('x');
            component.onColorSelect('fontColor', '#000');
            expect(count).toBe(0);
        });
    });

    describe('table grid', () => {
        it('emits tableInsert and resets hover state on select', () => {
            let payload: { rows: number; cols: number } | undefined;
            component.tableInsert.subscribe((p) => (payload = p));
            component.tableGridHoverRows.set(3);
            component.tableGridHoverCols.set(4);

            component.onTableGridSelect(3, 4);

            expect(payload).toEqual({ rows: 3, cols: 4 });
            expect(component.tableGridHoverRows()).toBe(0);
            expect(component.tableGridHoverCols()).toBe(0);
            expect(component.openPopover()).toBeNull();
        });

        it('does not emit tableInsert when disabled', () => {
            fixture.componentRef.setInput('disabled', true);
            fixture.detectChanges();
            let emitted = false;
            component.tableInsert.subscribe(() => (emitted = true));
            component.onTableGridSelect(2, 2);
            expect(emitted).toBe(false);
        });
    });

    describe('popover panels', () => {
        it('opens a popover panel by id', () => {
            component.openPopoverPanel('link');
            expect(component.openPopover()).toBe('link');
        });

        it('seeds selected font size from current font size', () => {
            fixture.componentRef.setInput('currentFontSize', '20');
            fixture.detectChanges();
            component.openPopoverPanel('fontSize');
            expect(component.selectedFontSize()).toBe('20px');
        });

        it('seeds selected font family from current font family', () => {
            fixture.componentRef.setInput('currentFontFamily', 'Georgia');
            fixture.detectChanges();
            component.openPopoverPanel('fontFamily');
            expect(component.selectedFontFamily()).toBe('Georgia');
        });

        it('closes only the matching popover panel', () => {
            component.openPopoverPanel('table');
            component.closePopoverPanel('link');
            expect(component.openPopover()).toBe('table');
            component.closePopoverPanel('table');
            expect(component.openPopover()).toBeNull();
        });
    });

    describe('autocomplete change handlers', () => {
        it('strips non-digits and emits font size, closing the popover', () => {
            component.openPopover.set('fontSize');
            let size: string | undefined;
            component.fontSizeSelect.subscribe((s) => (size = s));
            component.onFontSizeAutocompleteChange('24px');
            expect(size).toBe('24');
            expect(component.openPopover()).toBeNull();
        });

        it('ignores font size change with no digits', () => {
            let emitted = false;
            component.fontSizeSelect.subscribe(() => (emitted = true));
            component.onFontSizeAutocompleteChange('abc');
            expect(emitted).toBe(false);
        });

        it('emits font family and closes the popover', () => {
            component.openPopover.set('fontFamily');
            let family: string | undefined;
            component.fontFamilySelect.subscribe((f) => (family = f));
            component.onFontFamilyAutocompleteChange('Verdana');
            expect(family).toBe('Verdana');
            expect(component.openPopover()).toBeNull();
        });

        it('ignores empty font family change', () => {
            let emitted = false;
            component.fontFamilySelect.subscribe(() => (emitted = true));
            component.onFontFamilyAutocompleteChange('');
            expect(emitted).toBe(false);
        });

        it('guards autocomplete handlers when disabled', () => {
            fixture.componentRef.setInput('disabled', true);
            fixture.detectChanges();
            let count = 0;
            component.fontSizeSelect.subscribe(() => count++);
            component.fontFamilySelect.subscribe(() => count++);
            component.onFontSizeAutocompleteChange('12');
            component.onFontFamilyAutocompleteChange('Arial');
            expect(count).toBe(0);
        });
    });

    describe('file import', () => {
        it('emits fileImport with the selected file and resets the input', () => {
            const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
            let emitted: File | undefined;
            component.fileImport.subscribe((f) => (emitted = f));

            const event = makeFileEvent(file);
            component.onFileSelect(event);

            expect(emitted).toBe(file);
            expect((event.target as HTMLInputElement).value).toBe('');
        });

        it('does not emit when no file is selected', () => {
            let emitted = false;
            component.fileImport.subscribe(() => (emitted = true));
            component.onFileSelect(makeFileEvent(null));
            expect(emitted).toBe(false);
        });

        it('does not emit fileImport when disabled', () => {
            fixture.componentRef.setInput('disabled', true);
            fixture.detectChanges();
            let emitted = false;
            component.fileImport.subscribe(() => (emitted = true));
            const file = new File(['x'], 'doc.pdf');
            component.onFileSelect(makeFileEvent(file));
            expect(emitted).toBe(false);
        });
    });

    describe('custom items', () => {
        const customItem: RichTextCustomToolbarItem = {
            id: 'custom1',
            icon: '<svg></svg>',
            tooltip: 'Custom',
            isActive: (formats) => formats.has('bold'),
        };

        it('renders custom item buttons', () => {
            fixture.componentRef.setInput('items', []);
            fixture.componentRef.setInput('customItems', [customItem]);
            fixture.detectChanges();
            const buttons = fixture.nativeElement.querySelectorAll('button');
            expect(buttons).toHaveLength(1);
            expect(buttons[0].getAttribute('title')).toBe('Custom');
        });

        it('emits customItemClick with the item id', () => {
            let id: string | undefined;
            component.customItemClick.subscribe((v) => (id = v));
            component.onCustomItemClick('custom1');
            expect(id).toBe('custom1');
        });

        it('does not emit customItemClick when disabled', () => {
            fixture.componentRef.setInput('disabled', true);
            fixture.detectChanges();
            let emitted = false;
            component.customItemClick.subscribe(() => (emitted = true));
            component.onCustomItemClick('custom1');
            expect(emitted).toBe(false);
        });

        it('marks a custom button active when its isActive returns true', () => {
            fixture.componentRef.setInput('activeFormats', new Set(['bold']));
            fixture.detectChanges();
            const cls = component.customButtonClasses(customItem);
            expect(cls).toContain('bg-accent text-accent-foreground');
        });

        it('does not mark a custom button active when isActive is undefined', () => {
            const cls = component.customButtonClasses({ id: 'c', icon: '', tooltip: '' });
            expect(cls).not.toContain('bg-accent text-accent-foreground');
        });

        it('returns a SafeHtml for a custom icon', () => {
            expect(component.getSafeIcon('<svg></svg>')).toBeTruthy();
        });
    });

    describe('computed config', () => {
        it('exposes font size options suffixed with px', () => {
            const opts = component.fontSizeOptionsWithPx();
            expect(opts[0]).toBe('8px');
            expect(opts.at(-1)).toBe('72px');
        });

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
});
