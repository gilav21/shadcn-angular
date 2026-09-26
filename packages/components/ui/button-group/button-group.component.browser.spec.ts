import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { ButtonComponent } from '../button';
import { ButtonGroupComponent, ButtonGroupSeparatorComponent } from './index';

@Component({
    template: `
        <div [dir]="dir()">
            <ui-button-group [orientation]="orientation()">
                <ui-button variant="outline">First</ui-button>
                <ui-button variant="outline">Second</ui-button>
                <ui-button variant="outline">Third</ui-button>
            </ui-button-group>
        </div>
    `,
    imports: [ButtonGroupComponent, ButtonComponent],
})
class GroupHost {
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
    readonly orientation = signal<'horizontal' | 'vertical'>('horizontal');
}

@Component({
    template: `
        <ui-button-group>
            <ui-button variant="outline">One</ui-button>
            <ui-button-group-separator />
            <ui-button variant="outline">Two</ui-button>
        </ui-button-group>
    `,
    imports: [ButtonGroupComponent, ButtonGroupSeparatorComponent, ButtonComponent],
})
class DefaultSeparatorHost {}

@Component({
    template: `
        <ui-button-group orientation="vertical">
            <ui-button variant="outline">One</ui-button>
            <ui-button-group-separator orientation="horizontal" />
            <ui-button variant="outline">Two</ui-button>
        </ui-button-group>
    `,
    imports: [ButtonGroupComponent, ButtonGroupSeparatorComponent, ButtonComponent],
})
class HorizontalSeparatorHost {}

function rects(fixture: ComponentFixture<unknown>): DOMRect[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].map(b => b.getBoundingClientRect());
}

// The group's corner/border stripping (`[&>*]:rounded-s-none`, `border-s-0`, …)
// lands on the `display: contents` <ui-button> hosts and never reaches the inner
// <button>, so squared corners are not asserted here: every button keeps its
// radius and full border today.
describe('ButtonGroupComponent layout (browser)', () => {
    function render(orientation: 'horizontal' | 'vertical', dir: 'ltr' | 'rtl') {
        const fixture = TestBed.createComponent(GroupHost);
        fixture.componentInstance.orientation.set(orientation);
        fixture.componentInstance.dir.set(dir);
        fixture.detectChanges();
        return fixture;
    }

    function orientationAttr(fixture: ComponentFixture<unknown>): string | null {
        return (fixture.nativeElement as HTMLElement).querySelector('[data-slot="button-group"]')!.getAttribute('data-orientation');
    }

    it('joins horizontal buttons side by side with no gap', () => {
        const fixture = render('horizontal', 'ltr');
        expect(orientationAttr(fixture)).toBe('horizontal');
        const [a, b, c] = rects(fixture);

        expect(b.left).toBeCloseTo(a.right, 0);
        expect(c.left).toBeCloseTo(b.right, 0);
        expect([b.top, c.top]).toEqual([a.top, a.top]);
    });

    it('runs the row from the right under dir="rtl"', () => {
        const [a, b, c] = rects(render('horizontal', 'rtl'));

        expect(a.left).toBeCloseTo(b.right, 0);
        expect(b.left).toBeCloseTo(c.right, 0);
    });

    it('stacks vertical buttons with no gap', () => {
        const fixture = render('vertical', 'ltr');
        expect(orientationAttr(fixture)).toBe('vertical');
        const [a, b, c] = rects(fixture);

        expect(b.top).toBeCloseTo(a.bottom, 0);
        expect(c.top).toBeCloseTo(b.bottom, 0);
        expect([b.left, c.left]).toEqual([a.left, a.left]);
    });
});

describe('ButtonGroupSeparatorComponent layout (browser)', () => {
    function measure(host: typeof DefaultSeparatorHost | typeof HorizontalSeparatorHost) {
        const fixture = TestBed.createComponent(host);
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;
        const rule = root.querySelector('[data-slot="button-group-separator"]')!;
        return {
            orientation: rule.getAttribute('data-orientation'),
            group: root.querySelector('[data-slot="button-group"]')!.getBoundingClientRect(),
            rule: rule.getBoundingClientRect(),
        };
    }

    it('is a vertical 1px column as tall as a horizontal group by default', () => {
        const { orientation, group, rule } = measure(DefaultSeparatorHost);
        expect(orientation).toBe('vertical');
        expect(rule.width).toBe(1);
        expect(rule.height).toBeCloseTo(group.height, 0);
    });

    it('is a 1px row as wide as a vertical group when horizontal', () => {
        const { group, rule } = measure(HorizontalSeparatorHost);
        expect(rule.height).toBe(1);
        expect(rule.width).toBeCloseTo(group.width, 0);
    });
});
