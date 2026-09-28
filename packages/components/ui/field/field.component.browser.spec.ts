import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { FieldComponent } from './field.component';

/** Browser-only: asserts resolved style, which jsdom does not compute from classes. */
describe('FieldComponent layout (browser)', () => {
    it('lays a horizontal field out as a centred row', () => {
        const fixture = TestBed.createComponent(FieldComponent);
        fixture.componentRef.setInput('orientation', 'horizontal');
        fixture.detectChanges();
        const field = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-slot="field"]')!;
        const style = getComputedStyle(field);
        expect(style.display).toBe('flex');
        expect(style.alignItems).toBe('center');
    });
});
