import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import {
  StepperComponent,
  StepperItemComponent,
  StepperTriggerComponent,
  StepperTitleComponent,
  StepperSeparatorComponent,
} from './index';

/** Real-browser layout checks: orientation is geometry, which jsdom cannot lay out. */
@Component({
  template: `<ui-stepper [steps]="steps" [orientation]="orientation()" />`,
  imports: [StepperComponent],
})
class SimpleHost {
  readonly steps = [
    { value: 'a', title: 'Account', description: 'Create account' },
    { value: 'b', title: 'Profile' },
    { value: 'c', title: 'Complete' },
  ];
  readonly orientation = signal<'horizontal' | 'vertical'>('horizontal');
}

@Component({
  template: `
    <ui-stepper [activeStep]="1" [orientation]="orientation()">
      <ui-stepper-item value="one">
        <ui-stepper-trigger><ui-stepper-title>One</ui-stepper-title></ui-stepper-trigger>
        <ui-stepper-separator />
      </ui-stepper-item>
      <ui-stepper-item value="two">
        <ui-stepper-trigger><ui-stepper-title>Two</ui-stepper-title></ui-stepper-trigger>
      </ui-stepper-item>
    </ui-stepper>
  `,
  imports: [
    StepperComponent,
    StepperItemComponent,
    StepperTriggerComponent,
    StepperTitleComponent,
    StepperSeparatorComponent,
  ],
})
class SeparatorHost {
  readonly orientation = signal<'horizontal' | 'vertical'>('horizontal');
}

@Component({
  template: `
    <ui-stepper [orientation]="orientation()">
      <ui-stepper-item value="a"><ui-stepper-trigger><ui-stepper-title>One</ui-stepper-title></ui-stepper-trigger></ui-stepper-item>
      <ui-stepper-item value="b"><ui-stepper-trigger><ui-stepper-title>Two</ui-stepper-title></ui-stepper-trigger></ui-stepper-item>
    </ui-stepper>
  `,
  imports: [StepperComponent, StepperItemComponent, StepperTriggerComponent, StepperTitleComponent],
})
class ProjectedHost {
  readonly orientation = signal<'horizontal' | 'vertical'>('horizontal');
}

function itemRects(root: HTMLElement): DOMRect[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-slot="stepper-item"]'))
    .map(item => item.getBoundingClientRect());
}

describe('StepperComponent layout (browser)', () => {
  it('lays steps out side by side when horizontal and stacked when vertical', () => {
    TestBed.configureTestingModule({ imports: [SimpleHost] });
    const fixture = TestBed.createComponent(SimpleHost);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const [h0, h1] = itemRects(root);
    expect(h1.left).toBeGreaterThanOrEqual(h0.right);
    expect(Math.abs(h1.top - h0.top)).toBeLessThan(1);

    fixture.componentInstance.orientation.set('vertical');
    fixture.detectChanges();

    const stepper = root.querySelector<HTMLElement>('[data-slot="stepper"]');
    expect(stepper?.dataset['orientation']).toBe('vertical');
    const [v0, v1] = itemRects(root);
    expect(v1.top).toBeGreaterThanOrEqual(v0.bottom);
    expect(Math.abs(v1.left - v0.left)).toBeLessThan(1);
  });

  it('draws the separator as a thin horizontal bar, or a 2x32px vertical bar', () => {
    TestBed.configureTestingModule({ imports: [SeparatorHost] });
    const fixture = TestBed.createComponent(SeparatorHost);
    fixture.detectChanges();
    const separator = () =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-slot="stepper-separator"]')!
        .getBoundingClientRect();

    const horizontal = separator();
    expect(horizontal.width).toBeGreaterThan(horizontal.height);

    fixture.componentInstance.orientation.set('vertical');
    fixture.detectChanges();

    const vertical = separator();
    expect(vertical.width).toBeCloseTo(2, 0);
    expect(vertical.height).toBeCloseTo(32, 0);
  });

  it('joins steps with a connector that leaves room on both sides, in both orientations', () => {
    TestBed.configureTestingModule({ imports: [SimpleHost] });
    const fixture = TestBed.createComponent(SimpleHost);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const measure = () => {
      const items = itemRects(root);
      const connector = root.querySelector<HTMLElement>('[data-slot="stepper-connector"]')!.getBoundingClientRect();
      return { items, connector };
    };

    const h = measure();
    expect(h.connector.left - h.items[0].right).toBeCloseTo(8, 0);
    expect(h.items[1].left - h.connector.right).toBeCloseTo(8, 0);

    fixture.componentInstance.orientation.set('vertical');
    fixture.detectChanges();
    const v = measure();
    expect(v.connector.width).toBeCloseTo(2, 0);
    expect(v.connector.height).toBeCloseTo(32, 0);
    expect(v.connector.top - v.items[0].bottom).toBeCloseTo(8, 0);
    expect(v.items[1].top - v.connector.bottom).toBeCloseTo(8, 0);
  });

  it('projected items get the same connector spacing as simple mode', () => {
    TestBed.configureTestingModule({ imports: [ProjectedHost] });
    const fixture = TestBed.createComponent(ProjectedHost);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const connector = () => root.querySelector<HTMLElement>('[data-slot="stepper-connector"]')!.getBoundingClientRect();

    expect(connector().left - itemRects(root)[0].right).toBeCloseTo(8, 0);
    expect(itemRects(root)[1].left - connector().right).toBeCloseTo(8, 0);

    fixture.componentInstance.orientation.set('vertical');
    fixture.detectChanges();
    expect(connector().height).toBeCloseTo(32, 0);
    expect(connector().top - itemRects(root)[0].bottom).toBeCloseTo(8, 0);
  });
});
