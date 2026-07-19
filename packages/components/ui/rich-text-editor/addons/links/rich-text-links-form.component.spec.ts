import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RichTextLinksFormComponent, type RichTextLinkSubmit } from './rich-text-links-form.component';
import { RICH_TEXT_LINKS_LOCALES } from './rich-text-links.locales';

describe('RichTextLinksFormComponent', () => {
    let fixture: ComponentFixture<RichTextLinksFormComponent>;
    let component: RichTextLinksFormComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextLinksFormComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextLinksFormComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
    });

    function inputs(): { text: HTMLInputElement; url: HTMLInputElement } {
        const root = fixture.nativeElement as HTMLElement;
        return {
            text: root.querySelector('input[type="text"]') as HTMLInputElement,
            url: root.querySelector('input[type="url"]') as HTMLInputElement,
        };
    }

    function confirmButton(): HTMLElement {
        const buttons = Array.from(
            (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
        );
        return buttons[buttons.length - 1];
    }

    it('emits the trimmed text and url on confirm', () => {
        const submitted: RichTextLinkSubmit[] = [];
        component.submitLink.subscribe((p) => submitted.push(p));
        const { text, url } = inputs();
        text.value = '  Docs  ';
        url.value = '  https://example.com/docs  ';

        confirmButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(submitted).toEqual([{ text: 'Docs', url: 'https://example.com/docs' }]);
    });

    it('does not emit when the url is blank after trimming', () => {
        const spy = vi.fn();
        component.submitLink.subscribe(spy);
        const { text, url } = inputs();
        text.value = 'label';
        url.value = '   ';

        confirmButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(spy).not.toHaveBeenCalled();
    });

    it('confirms with Enter from the url field', () => {
        const submitted: RichTextLinkSubmit[] = [];
        component.submitLink.subscribe((p) => submitted.push(p));
        const { url } = inputs();
        url.value = 'https://enter.test';
        url.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(submitted).toEqual([{ text: '', url: 'https://enter.test' }]);
    });

    it('renders the remove button and update label only in edit mode', () => {
        fixture.componentRef.setInput('showRemove', true);
        fixture.componentRef.setInput('url', 'https://old.test');
        fixture.detectChanges();

        const removed = vi.fn();
        const cancelled = vi.fn();
        component.removeLink.subscribe(removed);
        component.cancelLink.subscribe(cancelled);
        const buttons = Array.from(
            (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
        );
        expect(buttons).toHaveLength(3);
        expect(confirmButton().textContent?.trim()).toBe(RICH_TEXT_LINKS_LOCALES['en'].update);

        buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        buttons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(removed).toHaveBeenCalledOnce();
        expect(cancelled).toHaveBeenCalledOnce();
    });

    it('reflects the RTL direction from the locale', () => {
        fixture.componentRef.setInput('locale', RICH_TEXT_LINKS_LOCALES['he']);
        fixture.detectChanges();
        const container = (fixture.nativeElement as HTMLElement)
            .querySelector('[data-slot="rich-text-links-form"]');
        expect(container?.getAttribute('dir')).toBe('rtl');
    });
});
