import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { GradientTextComponent } from './gradient-text.component';

/** Browser-only: the text mask and the inline box are host styles, visible only as computed style. */
@Component({
    template: `<ui-gradient-text>Hello</ui-gradient-text>`,
    imports: [GradientTextComponent],
})
class Host {}

function hostStyle(): CSSStyleDeclaration {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return getComputedStyle(fixture.nativeElement.querySelector('ui-gradient-text'));
}

describe('GradientText rendering', () => {
    it('masks the gradient to the glyphs with transparent text', () => {
        const style = hostStyle();
        expect(style.backgroundClip).toBe('text');
        expect(style.getPropertyValue('-webkit-text-fill-color')).toBe('rgba(0, 0, 0, 0)');
        expect(style.backgroundImage).toMatch(/^linear-gradient\(/);
    });

    it('renders as an inline block', () => {
        expect(hostStyle().display).toBe('inline-block');
    });
});
