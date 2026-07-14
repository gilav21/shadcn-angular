import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach } from 'vitest';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { AutocompleteComponent } from '../../../autocomplete';
import {
    RichTextTypographyDirective,
    DEFAULT_FONT_FAMILIES,
} from './rich-text-typography.directive';
import { RichTextTypographyButtonComponent } from './rich-text-typography-button.component';
import type { RichTextTypographyButtonContext, RichTextTypographyKind } from './rich-text-typography.context';

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextTypographyDirective],
    template: `<ui-rich-text-editor mode="html" [disabled]="disabled()" uiRteTypography
        [uiRteTypographyLocale]="locale()"
        [uiRteTypographyFamilies]="families()"
        [uiRteTypographyFamiliesStrategy]="strategy()"
        (fontSizeSelect)="sizes.push($event)"
        (fontFamilySelect)="familiesSelected.push($event)"></ui-rich-text-editor>`,
})
class HostCmp {
    readonly disabled = signal(false);
    readonly locale = signal<string | undefined>(undefined);
    readonly families = signal<string[]>([]);
    readonly strategy = signal<'append' | 'replace'>('append');
    sizes: string[] = [];
    familiesSelected: string[] = [];
}

type ButtonProbe = {
    context: RichTextTypographyButtonContext;
    onValueChange(value: string): void;
    onOpenChange(next: boolean): void;
};

describe('RichTextTypographyDirective', () => {
    const openFixtures: ComponentFixture<HostCmp>[] = [];

    function createFixture(): ComponentFixture<HostCmp> {
        const fixture = TestBed.createComponent(HostCmp);
        openFixtures.push(fixture);
        fixture.detectChanges();
        return fixture;
    }

    function editorOf(fixture: ComponentFixture<HostCmp>): { el: HTMLElement; cmp: RichTextEditorComponent } {
        const cmp = fixture.debugElement.query(By.directive(RichTextEditorComponent))
            .componentInstance as RichTextEditorComponent;
        const el = fixture.nativeElement.querySelector('[contenteditable]') as HTMLElement;
        return { el, cmp };
    }

    function buttonByKind(fixture: ComponentFixture<HostCmp>, kind: RichTextTypographyKind): ButtonProbe {
        const probes = fixture.debugElement
            .queryAll(By.directive(RichTextTypographyButtonComponent))
            .map((d) => d.componentInstance as unknown as ButtonProbe);
        const match = probes.find((p) => p.context.kind === kind);
        if (!match) throw new Error(`No typography button for kind "${kind}"`);
        return match;
    }

    function selectContent(fixture: ComponentFixture<HostCmp>, html: string): { el: HTMLElement; cmp: RichTextEditorComponent } {
        const { el, cmp } = editorOf(fixture);
        el.innerHTML = html;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        const target = el.querySelector('span') ?? el.firstElementChild ?? el;
        const range = document.createRange();
        range.selectNodeContents(target);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        (cmp as unknown as { updateActiveFormats(): void }).updateActiveFormats();
        fixture.detectChanges();
        return { el, cmp };
    }

    /** Open the popover (seeds the autocomplete) and forward a picked value. */
    function pick(fixture: ComponentFixture<HostCmp>, kind: RichTextTypographyKind, value: string): void {
        const button = buttonByKind(fixture, kind);
        button.onOpenChange(true);
        fixture.detectChanges();
        button.onValueChange(value);
        fixture.detectChanges();
    }

    afterEach(() => {
        document.getSelection()?.removeAllRanges();
        while (openFixtures.length > 0) {
            const fixture = openFixtures.pop()!;
            if (!fixture.componentRef.hostView.destroyed) {
                fixture.destroy();
            }
        }
    });

    it('contributes font-size and font-family toolbar slots', () => {
        const fixture = createFixture();
        const size = fixture.nativeElement.querySelector('[data-addon-slot="typography.size"]');
        const family = fixture.nativeElement.querySelector('[data-addon-slot="typography.family"]');
        expect(size).toBeTruthy();
        expect(family).toBeTruthy();
        expect(size.querySelector('button[title="Font Size"]')).toBeTruthy();
        expect(family.querySelector('button[title="Font Family"]')).toBeTruthy();
    });

    it('applies a font size to the selection as a styled span and emits fontSizeSelect', () => {
        const fixture = createFixture();
        const { el } = selectContent(fixture, '<p>Resize me</p>');

        pick(fixture, 'size', '24px');

        expect(el.querySelectorAll('font[size="7"]')).toHaveLength(0);
        const span = Array.from(el.querySelectorAll('span')).find((s) => s.style.fontSize === '24px');
        expect(span).toBeTruthy();
        expect(fixture.componentInstance.sizes).toEqual(['24']);
    });

    it('applies a font family to the selection as a styled span and emits fontFamilySelect', () => {
        const fixture = createFixture();
        const { el } = selectContent(fixture, '<p>Restyle me</p>');

        pick(fixture, 'family', 'Georgia');

        expect(el.querySelectorAll('font[face]')).toHaveLength(0);
        const span = Array.from(el.querySelectorAll('span')).find((s) => s.style.fontFamily.includes('Georgia'));
        expect(span).toBeTruthy();
        expect(fixture.componentInstance.familiesSelected).toEqual(['Georgia']);
    });

    it('styles mention chips in the selection that execCommand skips', () => {
        const fixture = createFixture();
        const { el } = selectContent(
            fixture,
            '<p><span data-mention="1" contenteditable="false">@ada</span> hi</p>',
        );

        pick(fixture, 'size', '30px');

        const chip = el.querySelector<HTMLElement>('[data-mention]')!;
        expect(chip.style.fontSize).toBe('30px');
    });

    it('ignores a font size with no digits', () => {
        const fixture = createFixture();
        const { el } = selectContent(fixture, '<p>Keep me</p>');
        const before = el.innerHTML;

        pick(fixture, 'size', 'abc');

        expect(el.innerHTML).toBe(before);
        expect(fixture.componentInstance.sizes).toEqual([]);
    });

    it('seeds the font-size autocomplete from the current selection when the popover opens', () => {
        const fixture = createFixture();
        selectContent(fixture, '<p><span style="font-size:20px">Sized</span></p>');

        const size = buttonByKind(fixture, 'size');
        size.context.onOpen();
        fixture.detectChanges();

        expect(size.context.seededValue()).toBe('20px');
    });

    it('seeds the font-family autocomplete from the current selection when the popover opens', () => {
        const fixture = createFixture();
        selectContent(fixture, '<p><span style="font-family:Georgia">Styled</span></p>');

        const family = buttonByKind(fixture, 'family');
        family.context.onOpen();
        fixture.detectChanges();

        expect(family.context.seededValue()).toBe('Georgia');
    });

    it('renders the inline autocomplete when a popover opens', async () => {
        const fixture = createFixture();
        selectContent(fixture, '<p>Font</p>');

        const slotButton = fixture.nativeElement.querySelector(
            '[data-addon-slot="typography.size"] button',
        ) as HTMLButtonElement;
        slotButton.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(fixture.debugElement.query(By.directive(AutocompleteComponent))).toBeTruthy();
    });

    it('does not apply a font size while the editor is disabled', () => {
        const fixture = createFixture();
        const { el } = selectContent(fixture, '<p>Locked</p>');
        const before = el.innerHTML;
        fixture.componentInstance.disabled.set(true);
        fixture.detectChanges();

        const sizeButton = fixture.nativeElement.querySelector(
            '[data-addon-slot="typography.size"] button',
        ) as HTMLButtonElement;
        expect(sizeButton.disabled).toBe(true);

        pick(fixture, 'size', '24px');

        expect(el.innerHTML).toBe(before);
        expect(fixture.componentInstance.sizes).toEqual([]);
    });

    it('offers the built-in font families by default', () => {
        const fixture = createFixture();
        const family = buttonByKind(fixture, 'family');
        expect(family.context.options()).toEqual(DEFAULT_FONT_FAMILIES);
    });

    it('appends custom fonts to the defaults with the append strategy', () => {
        const fixture = createFixture();
        fixture.componentInstance.families.set(['Roboto', 'Open Sans']);
        fixture.componentInstance.strategy.set('append');
        fixture.detectChanges();

        const family = buttonByKind(fixture, 'family');
        expect(family.context.options()).toEqual([...DEFAULT_FONT_FAMILIES, 'Roboto', 'Open Sans']);
    });

    it('replaces the defaults with custom fonts using the replace strategy', () => {
        const fixture = createFixture();
        fixture.componentInstance.families.set(['Roboto', 'Open Sans']);
        fixture.componentInstance.strategy.set('replace');
        fixture.detectChanges();

        const family = buttonByKind(fixture, 'family');
        expect(family.context.options()).toEqual(['Roboto', 'Open Sans']);
    });

    it('keeps the defaults when an empty custom-fonts array is provided', () => {
        const fixture = createFixture();
        fixture.componentInstance.families.set([]);
        fixture.componentInstance.strategy.set('replace');
        fixture.detectChanges();

        const family = buttonByKind(fixture, 'family');
        expect(family.context.options()).toEqual(DEFAULT_FONT_FAMILIES);
    });

    it('exposes font-size options suffixed with px', () => {
        const fixture = createFixture();
        const size = buttonByKind(fixture, 'size');
        const options = size.context.options();
        expect(options[0]).toBe('8px');
        expect(options).toContain('24px');
        expect(options.every((o) => o.endsWith('px'))).toBe(true);
    });

    it('localizes the button tooltips (he)', () => {
        const fixture = createFixture();
        fixture.componentInstance.locale.set('he');
        fixture.detectChanges();

        const size = fixture.nativeElement.querySelector('[data-addon-slot="typography.size"] button') as HTMLButtonElement;
        const family = fixture.nativeElement.querySelector('[data-addon-slot="typography.family"] button') as HTMLButtonElement;
        expect(size.title).toBe('גודל גופן');
        expect(family.title).toBe('משפחת גופנים');
    });

    it('removes its toolbar slots when the host is destroyed', () => {
        const fixture = createFixture();
        const editor = fixture.debugElement.query(By.directive(RichTextEditorComponent))
            .componentInstance as RichTextEditorComponent;
        expect(editor.toolbarSlots.slots()).toHaveLength(2);

        fixture.destroy();
        openFixtures.pop();

        expect(editor.toolbarSlots.slots()).toHaveLength(0);
    });
});
