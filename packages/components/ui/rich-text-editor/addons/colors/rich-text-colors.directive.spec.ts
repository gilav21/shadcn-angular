import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { ColorPickerComponent } from '../../../color-picker';
import { RichTextColorsDirective, type RichTextColorChange } from './rich-text-colors.directive';
import { RichTextColorsButtonComponent } from './rich-text-colors-button.component';
import type { RichTextColorButtonContext, RichTextColorKind } from './rich-text-colors.context';
import { RichTextEditorComponent } from '../..';

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextColorsDirective],
    template: `<ui-rich-text-editor mode="html" [disabled]="disabled()" uiRteColors
        [uiRteColorsLocale]="locale()"
        (colorChange)="changes.push($event)"></ui-rich-text-editor>`,
})
class HostCmp {
    readonly disabled = signal(false);
    readonly locale = signal<string | undefined>(undefined);
    changes: RichTextColorChange[] = [];
}

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextColorsDirective],
    template: `<ui-rich-text-editor mode="html" [uiRteColors]="enabled()"></ui-rich-text-editor>`,
})
class ToggleHostCmp {
    readonly enabled = signal(true);
}

type ButtonProbe = {
    context: RichTextColorButtonContext;
    onColorChange(color: string): void;
    onOpenChange(next: boolean): void;
};

/**
 * jsdom has no editing engine: its `document.execCommand` is an inert stub and
 * `Selection.containsNode` always returns false. The colours addon applies
 * colour through `execCommand('foreColor'|'hiliteColor')` and styles mention
 * chips it finds via `containsNode`, so install faithful, functional stand-ins
 * (wrap the live range in a styled span; range-based node containment) for the
 * duration of each test and restore the originals afterwards.
 */
type ExecCommandFn = (id: string, showUI?: boolean, value?: string) => boolean;
type ContainsNodeFn = (node: Node, allowPartial?: boolean) => boolean;
const execDoc = document as Document & { execCommand: ExecCommandFn };
const selProto = Selection.prototype as Selection & { containsNode: ContainsNodeFn };
let originalExecCommand: ExecCommandFn;
let originalContainsNode: ContainsNodeFn;

const COLOR_COMMAND_PROP: Readonly<Record<string, 'color' | 'backgroundColor'>> = {
    foreColor: 'color',
    hiliteColor: 'backgroundColor',
    backColor: 'backgroundColor',
};

function functionalExecCommand(id: string, _showUI?: boolean, value?: string): boolean {
    const prop = COLOR_COMMAND_PROP[id];
    if (!prop || value === undefined) return false;
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return true;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return true;
    const span = document.createElement('span');
    span.style[prop] = value;
    span.appendChild(range.extractContents());
    range.insertNode(span);
    selection.removeAllRanges();
    const reselected = document.createRange();
    reselected.selectNodeContents(span);
    selection.addRange(reselected);
    return true;
}

function rangeContainsNode(this: Selection, node: Node): boolean {
    if (this.rangeCount === 0) return false;
    const container = this.getRangeAt(0).commonAncestorContainer;
    return container === node || container.contains(node) || node.contains(container);
}

describe('RichTextColorsDirective', () => {
    const openFixtures: ComponentFixture<unknown>[] = [];

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

    function buttonByKind(fixture: ComponentFixture<HostCmp>, kind: RichTextColorKind): ButtonProbe {
        const probes = fixture.debugElement
            .queryAll(By.directive(RichTextColorsButtonComponent))
            .map((d) => d.componentInstance as unknown as ButtonProbe);
        const match = probes.find((p) => p.context.kind === kind);
        if (!match) throw new Error(`No colour button for kind "${kind}"`);
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

    /** Open the colour popover (seeds the picker) and forward a picked colour, as the real picker would. */
    function pick(fixture: ComponentFixture<HostCmp>, kind: RichTextColorKind, color: string): void {
        const button = buttonByKind(fixture, kind);
        button.onOpenChange(true);
        fixture.detectChanges();
        button.onColorChange(color);
        fixture.detectChanges();
    }

    beforeEach(() => {
        originalExecCommand = execDoc.execCommand;
        originalContainsNode = selProto.containsNode;
        execDoc.execCommand = functionalExecCommand;
        selProto.containsNode = rangeContainsNode;
    });

    afterEach(() => {
        execDoc.execCommand = originalExecCommand;
        selProto.containsNode = originalContainsNode;
        document.getSelection()?.removeAllRanges();
        while (openFixtures.length > 0) {
            const fixture = openFixtures.pop()!;
            if (!fixture.componentRef.hostView.destroyed) {
                fixture.destroy();
            }
        }
    });

    it('removes both slots live when uiRteColors flips to false and restores on re-enable', () => {
        const fixture = TestBed.createComponent(ToggleHostCmp);
        openFixtures.push(fixture);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-addon-slot="colors.foreground"]')).toBeTruthy();
        expect(fixture.nativeElement.querySelector('[data-addon-slot="colors.background"]')).toBeTruthy();

        fixture.componentInstance.enabled.set(false);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-addon-slot="colors.foreground"]')).toBeFalsy();
        expect(fixture.nativeElement.querySelector('[data-addon-slot="colors.background"]')).toBeFalsy();

        fixture.componentInstance.enabled.set(true);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-addon-slot="colors.foreground"]')).toBeTruthy();
    });

    it('contributes text-colour and highlight-colour toolbar slots', () => {
        const fixture = createFixture();
        const fg = fixture.nativeElement.querySelector('[data-addon-slot="colors.foreground"]');
        const bg = fixture.nativeElement.querySelector('[data-addon-slot="colors.background"]');
        expect(fg).toBeTruthy();
        expect(bg).toBeTruthy();
        expect(fg.querySelector('button[title="Text Color"]')).toBeTruthy();
        expect(bg.querySelector('button[title="Background Color"]')).toBeTruthy();
    });

    it('applies a text colour to the selection as an inline style and emits colorChange', () => {
        const fixture = createFixture();
        const { el } = selectContent(fixture, '<p>Recolour me</p>');

        pick(fixture, 'foreground', '#ff0000');

        expect(el.innerHTML.toLowerCase()).not.toContain('<font');
        expect(el.innerHTML).toContain('rgb(255, 0, 0)');
        expect(fixture.componentInstance.changes).toEqual([{ type: 'fontColor', color: '#ff0000' }]);
    });

    it('applies a highlight colour to the selection and emits colorChange', () => {
        const fixture = createFixture();
        const { el } = selectContent(fixture, '<p>Highlight me</p>');

        pick(fixture, 'background', '#00ff00');

        expect(el.innerHTML.toLowerCase()).toMatch(/background|rgb\(0,\s*255/);
        expect(fixture.componentInstance.changes).toEqual([{ type: 'backgroundColor', color: '#00ff00' }]);
    });

    it('styles mention chips in the selection that execCommand skips', () => {
        const fixture = createFixture();
        const { el } = selectContent(
            fixture,
            '<p><span data-mention="1" contenteditable="false">@ada</span> hi</p>',
        );

        pick(fixture, 'foreground', '#123456');

        const chip = el.querySelector<HTMLElement>('[data-mention]')!;
        expect(chip.style.color).toMatch(/rgb\(18,\s*52,\s*86\)|#123456/);
    });

    it('ignores the picker echo of the already-reflected colour', () => {
        const fixture = createFixture();
        const { el } = selectContent(fixture, '<p><span style="color:#2563eb">Blue</span></p>');
        const before = el.innerHTML;

        // The color picker re-emits its programmatically-seeded value; the echo must not re-apply.
        pick(fixture, 'foreground', 'rgb(37, 99, 235)');

        expect(el.innerHTML).toBe(before);
        expect(fixture.componentInstance.changes).toEqual([]);
    });

    it('seeds the picker from the current selection colour when the popover opens', () => {
        const fixture = createFixture();
        selectContent(fixture, '<p><span style="color:#2563eb">Blue</span></p>');

        const fg = buttonByKind(fixture, 'foreground');
        fg.context.onOpen();
        fixture.detectChanges();

        expect(fg.context.seededColor()).toBe('#2563eb');
    });

    it('tracks the selection colour in the button indicator without opening the popover', () => {
        const fixture = createFixture();
        selectContent(fixture, '<p><span style="color:#2563eb">Blue</span></p>');
        fixture.detectChanges();

        const fg = buttonByKind(fixture, 'foreground');
        expect(fg.context.activeColor()).toBe('#2563eb');

        const bar = fixture.nativeElement.querySelector(
            '[data-addon-slot="colors.foreground"] [data-slot="rte-color-indicator"]',
        ) as HTMLElement;
        expect(bar.style.backgroundColor).toBe('rgb(37, 99, 235)');
    });

    it('reflects a just-applied colour immediately, with no further editor interaction', () => {
        const fixture = createFixture();
        selectContent(fixture, '<p>Plain</p>');
        const fg = buttonByKind(fixture, 'foreground');
        expect(fg.context.activeColor()).not.toBe('#ff0000');

        pick(fixture, 'foreground', '#ff0000');

        // No keyup/mouseup here on purpose: the toolbar must not lag a step
        // behind the colour the next typed character will actually take.
        expect(fg.context.activeColor()).toBe('#ff0000');
        const bar = fixture.nativeElement.querySelector(
            '[data-addon-slot="colors.foreground"] [data-slot="rte-color-indicator"]',
        ) as HTMLElement;
        expect(bar.style.backgroundColor).toBe('rgb(255, 0, 0)');
    });

    it('reflects a just-applied highlight colour immediately', () => {
        const fixture = createFixture();
        selectContent(fixture, '<p>Plain</p>');

        pick(fixture, 'background', '#00ff00');

        expect(buttonByKind(fixture, 'background').context.activeColor()).toBe('#00ff00');
    });

    it('renders the inline color picker when a popover opens', async () => {
        const fixture = createFixture();
        selectContent(fixture, '<p>Colour</p>');

        const slotButton = fixture.nativeElement.querySelector(
            '[data-addon-slot="colors.foreground"] button',
        ) as HTMLButtonElement;
        slotButton.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(fixture.debugElement.query(By.directive(ColorPickerComponent))).toBeTruthy();
    });

    it('does not apply a colour while the editor is disabled', () => {
        const fixture = createFixture();
        const { el } = selectContent(fixture, '<p>Locked</p>');
        const before = el.innerHTML;
        fixture.componentInstance.disabled.set(true);
        fixture.detectChanges();

        const fgButton = fixture.nativeElement.querySelector(
            '[data-addon-slot="colors.foreground"] button',
        ) as HTMLButtonElement;
        expect(fgButton.disabled).toBe(true);

        pick(fixture, 'foreground', '#ff0000');

        expect(el.innerHTML).toBe(before);
        expect(fixture.componentInstance.changes).toEqual([]);
    });

    it('localizes the button tooltips (he)', () => {
        const fixture = createFixture();
        fixture.componentInstance.locale.set('he');
        fixture.detectChanges();

        const fg = fixture.nativeElement.querySelector('[data-addon-slot="colors.foreground"] button') as HTMLButtonElement;
        const bg = fixture.nativeElement.querySelector('[data-addon-slot="colors.background"] button') as HTMLButtonElement;
        expect(fg.title).toBe('צבע טקסט');
        expect(bg.title).toBe('צבע רקע');
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
