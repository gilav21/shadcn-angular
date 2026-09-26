import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { TextareaComponent } from './textarea.component';

@Component({
    template: `<div style="width: 300px"><ui-textarea /></div>`,
    imports: [TextareaComponent],
})
class OutlineHost { }

/** Real-layout case: computed border and width, which jsdom does not compute. */
describe('TextareaComponent — outline variant appearance', () => {
    it('draws a rounded border and fills its container', () => {
        const fixture = TestBed.createComponent(OutlineHost);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();

        const container = fixture.nativeElement.querySelector('div') as HTMLElement;
        const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
        const style = getComputedStyle(textarea);

        expect(Number.parseFloat(style.borderTopWidth)).toBeGreaterThan(0);
        expect(Number.parseFloat(style.borderTopLeftRadius)).toBeGreaterThan(0);
        expect(textarea.getBoundingClientRect().width).toBe(container.getBoundingClientRect().width);

        fixture.destroy();
        fixture.nativeElement.remove();
    });
});
