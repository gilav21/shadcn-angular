import { Component, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RichTextToolbarComponent } from './rich-text-toolbar.component';
import { RichTextToolbarViewContext } from '../rich-text-editor.host';
import { RICH_TEXT_LOCALES } from '../rich-text-locales';
import type { RichTextCustomToolbarItem } from '../rich-text-editor.component';

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
});
