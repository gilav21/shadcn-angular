import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { StaggerChildrenComponent } from './stagger-children.component';

// A host template, so the component sits on its own <ui-stagger-children> tag rather than
// TestBed's root <div>, which is a block already.
@Component({
    template: `<ui-stagger-children><div>Child</div></ui-stagger-children>`,
    imports: [StaggerChildrenComponent],
})
class HostComponent {}

/** Browser-only: asserts resolved style, which jsdom does not compute from classes. */
describe('StaggerChildrenComponent layout (browser)', () => {
    it('should render the host as a block, not the inline default of a custom element', () => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        const host = (fixture.nativeElement as HTMLElement).querySelector('ui-stagger-children')!;
        expect(getComputedStyle(host).display).toBe('block');
    });
});
