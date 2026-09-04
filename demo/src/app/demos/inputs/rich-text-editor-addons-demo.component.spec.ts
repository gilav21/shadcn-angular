import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RichTextEditorAddonsDemoComponent } from './rich-text-editor-addons-demo.component';

/**
 * T-15 — UC-13: "how do I write my own addon?" needs a live answer, not only a
 * doc. The addons page carries a working `uiRteInsertDate` editor plus its
 * copy-paste source, so a developer can click the button before committing to
 * reading the guide.
 */
describe('RichTextEditorAddonsDemoComponent — write your own addon', () => {
    let fixture: ComponentFixture<RichTextEditorAddonsDemoComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorAddonsDemoComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorAddonsDemoComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        window.getSelection()?.removeAllRanges();
        if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
    });

    function section(): HTMLElement | null {
        return fixture.nativeElement.querySelector('[data-testid="write-your-own-addon"]');
    }

    it('renders the section with a localized heading', () => {
        const el = section();
        expect(el).toBeTruthy();
        expect(el!.querySelector('h3')?.textContent?.trim()).toBeTruthy();
    });

    it('renders an editor carrying the insert-date addon button', () => {
        const button = section()!.querySelector('[data-addon-slot="insert-date"]');
        expect(button).toBeTruthy();
        expect(button!.innerHTML).toContain('<svg');
    });

    it('inserts today\'s date into that editor when the button is clicked', () => {
        const scope = section() as HTMLElement;
        const editable: HTMLElement = scope.querySelector('[contenteditable="true"]') as HTMLElement;
        editable.focus();
        (scope.querySelector('[data-addon-slot="insert-date"]') as HTMLButtonElement).click();
        fixture.detectChanges();
        expect(editable.textContent).toContain(
            new Intl.DateTimeFormat(undefined).format(new Date()),
        );
    });

    it('shows the copy-paste source of the directive', () => {
        const code = section()!.querySelector('pre')?.textContent ?? '';
        expect(code).toContain('@Directive');
        expect(code).toContain('toolbarSlots.register');
        expect(code).toContain('insertTextAtCaret');
    });
});
