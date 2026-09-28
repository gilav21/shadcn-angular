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
                <!-- A consumer's own button, placed directly in the group. -->
                <button type="button" class="rounded-lg border border-input px-3 text-sm">Second</button>
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

type Axis = 'horizontal' | 'vertical';
type Ends = 'round' | 'square' | 'mixed';

const AXIS = {
    horizontal: { pos: 'left', lead: ['top-left', 'bottom-left'], trail: ['top-right', 'bottom-right'], leadEdge: 'left', trailEdge: 'right' },
    vertical: { pos: 'top', lead: ['top-left', 'top-right'], trail: ['bottom-left', 'bottom-right'], leadEdge: 'top', trailEdge: 'bottom' },
} as const;

function ends(style: CSSStyleDeclaration, corners: readonly string[]): Ends {
    const radii = corners.map(corner => Number.parseFloat(style.getPropertyValue(`border-${corner}-radius`)));
    if (radii.every(r => r > 0)) return 'round';
    return radii.every(r => r === 0) ? 'square' : 'mixed';
}

/**
 * The group read in visual order along its axis: each button's leading/trailing
 * corner state, and the total border width drawn at every join.
 */
function joinProfile(fixture: ComponentFixture<unknown>, axis: Axis) {
    const { pos, lead, trail, leadEdge, trailEdge } = AXIS[axis];
    const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')]
        .sort((a, b) => a.getBoundingClientRect()[pos] - b.getBoundingClientRect()[pos])
        .map(el => getComputedStyle(el));
    const width = (style: CSSStyleDeclaration, edge: string) => Number.parseFloat(style.getPropertyValue(`border-${edge}-width`));
    return {
        corners: buttons.map(style => [ends(style, lead), ends(style, trail)]),
        joins: buttons.slice(1).map((style, i) => width(buttons[i], trailEdge) + width(style, leadEdge)),
    };
}

/** Only the group's outer corners are rounded, and each join draws one 1px border. */
const JOINED = {
    corners: [['round', 'square'], ['square', 'square'], ['square', 'round']],
    joins: [1, 1],
};

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
        expect(joinProfile(fixture, 'horizontal')).toEqual(JOINED);
    });

    it('runs the row from the right under dir="rtl"', () => {
        const fixture = render('horizontal', 'rtl');
        const [a, b, c] = rects(fixture);

        expect(a.left).toBeCloseTo(b.right, 0);
        expect(b.left).toBeCloseTo(c.right, 0);
        expect(joinProfile(fixture, 'horizontal')).toEqual(JOINED);
    });

    it('stacks vertical buttons with no gap', () => {
        const fixture = render('vertical', 'ltr');
        expect(orientationAttr(fixture)).toBe('vertical');
        const [a, b, c] = rects(fixture);

        expect(b.top).toBeCloseTo(a.bottom, 0);
        expect(c.top).toBeCloseTo(b.bottom, 0);
        expect([b.left, c.left]).toEqual([a.left, a.left]);
        expect(joinProfile(fixture, 'vertical')).toEqual(JOINED);
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
