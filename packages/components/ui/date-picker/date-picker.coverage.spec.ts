import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DatePickerComponent,
  DateRangePickerComponent,
  calculatePopupPosition,
  computePopupClasses,
  computePopupStyles,
  DEFAULT_POPUP_POSITION,
  PopupPosition,
} from './date-picker.component';
import { CalendarComponent, DateRange, TimeRange } from '../calendar';

/** Drain a captured requestAnimationFrame queue, running each callback once. */
function flushRaf(queue: FrameRequestCallback[]): void {
  while (queue.length) {
    const cb = queue.shift();
    cb?.(0);
  }
}

interface RectShape {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function makeRect(r: RectShape): DOMRect {
  return {
    x: r.left,
    y: r.top,
    left: r.left,
    right: r.right,
    top: r.top,
    bottom: r.bottom,
    width: r.right - r.left,
    height: r.bottom - r.top,
    toJSON: () => ({}),
  } as DOMRect;
}

/** Assigns an instance-level getBoundingClientRect (no prototype pollution). */
function setRect(el: HTMLElement, r: RectShape): void {
  el.getBoundingClientRect = () => makeRect(r);
}

describe('calculatePopupPosition', () => {
  const created: HTMLElement[] = [];

  afterEach(() => {
    for (const el of created) el.remove();
    created.length = 0;
  });

  function detachedEl(r: RectShape): HTMLElement {
    const el = document.createElement('div');
    setRect(el, r);
    return el;
  }

  function attachedEl(childRect: RectShape, parentRect: RectShape): HTMLElement {
    const parent = document.createElement('div');
    const child = document.createElement('div');
    setRect(parent, parentRect);
    setRect(child, childRect);
    parent.appendChild(child);
    document.body.appendChild(parent);
    created.push(parent);
    return child;
  }

  it('returns no offset and bottom side when fully inside the boundary', () => {
    const el = detachedEl({ left: 10, right: 200, top: 10, bottom: 300 });
    const pos = calculatePopupPosition(el);
    expect(pos.offsetX).toBe(0);
    expect(pos.actualSide).toBe('bottom');
  });

  it('shifts left with a negative offset when overflowing the right edge', () => {
    const el = detachedEl({ left: 10, right: 5000, top: 10, bottom: 100 });
    const pos = calculatePopupPosition(el);
    expect(pos.offsetX).toBeLessThan(0);
  });

  it('shifts right with a positive offset when overflowing the left edge', () => {
    const el = detachedEl({ left: -50, right: 200, top: 10, bottom: 100 });
    const pos = calculatePopupPosition(el);
    expect(pos.offsetX).toBe(58);
  });

  it('flips to the top side when there is more space above than below', () => {
    const el = attachedEl(
      { left: 10, right: 200, top: 700, bottom: 5000 },
      { left: 10, right: 200, top: 700, bottom: 760 }
    );
    const pos = calculatePopupPosition(el);
    expect(pos.actualSide).toBe('top');
  });

  it('stays on the bottom side when there is more space below than above', () => {
    const el = attachedEl(
      { left: 10, right: 200, top: 10, bottom: 5000 },
      { left: 10, right: 200, top: 10, bottom: 20 }
    );
    const pos = calculatePopupPosition(el);
    expect(pos.actualSide).toBe('bottom');
  });

  it('handles a detached element with no parent rect and vertical overflow', () => {
    const el = detachedEl({ left: 10, right: 200, top: 10, bottom: 5000 });
    const pos = calculatePopupPosition(el);
    expect(pos.actualSide).toBe('bottom');
    expect(pos.offsetX).toBe(0);
  });
});

describe('computePopupClasses', () => {
  it('adds bottom placement classes for the bottom side', () => {
    const classes = computePopupClasses({ offsetX: 0, actualSide: 'bottom' });
    expect(classes).toContain('top-full');
    expect(classes).toContain('mt-1');
  });

  it('adds top placement classes for the top side', () => {
    const classes = computePopupClasses({ offsetX: 0, actualSide: 'top' });
    expect(classes).toContain('bottom-full');
    expect(classes).toContain('mb-1');
  });
});

describe('computePopupStyles', () => {
  it('emits a translateX transform when there is a horizontal offset', () => {
    expect(computePopupStyles({ offsetX: 12, actualSide: 'bottom' })).toBe(
      'transform: translateX(12px);'
    );
  });

  it('emits an empty string when there is no horizontal offset', () => {
    expect(computePopupStyles({ offsetX: 0, actualSide: 'bottom' })).toBe('');
  });
});

describe('DEFAULT_POPUP_POSITION', () => {
  it('defaults to no offset on the bottom side', () => {
    const def: PopupPosition = DEFAULT_POPUP_POSITION;
    expect(def).toEqual({ offsetX: 0, actualSide: 'bottom' });
  });
});

describe('DatePickerComponent', () => {
  let fixture: ComponentFixture<DatePickerComponent>;
  let component: DatePickerComponent;
  let rafSpy: ReturnType<typeof vi.spyOn>;
  const rafQueue: FrameRequestCallback[] = [];


  beforeEach(async () => {
    rafQueue.length = 0;
    rafSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        rafQueue.push(cb);
        return rafQueue.length;
      });

    await TestBed.configureTestingModule({
      imports: [DatePickerComponent, CalendarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DatePickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mirrors the date input into the internal value via effect', () => {
    const d = new Date(2023, 5, 10);
    fixture.componentRef.setInput('date', d);
    fixture.detectChanges();
    expect(component.internalValue()).toBe(d);
  });

  it('clears the internal value when the date input is set to null', () => {
    const d = new Date(2023, 5, 10);
    fixture.componentRef.setInput('date', d);
    fixture.detectChanges();
    fixture.componentRef.setInput('date', null);
    fixture.detectChanges();
    expect(component.internalValue()).toBeNull();
  });

  it('leaves a form-written value alone when the date input keeps its null default', () => {
    const fresh = TestBed.createComponent(DatePickerComponent);
    const written = new Date(2024, 0, 15);
    fresh.componentInstance.writeValue(written);
    fresh.detectChanges();
    expect(fresh.componentInstance.internalValue()).toBe(written);
  });

  it('renders the placeholder when no value is selected', () => {
    fixture.componentRef.setInput('placeholder', 'Choose day');
    fixture.detectChanges();
    const span = fixture.debugElement.query(By.css('span.text-muted-foreground'));
    expect(span.nativeElement.textContent).toContain('Choose day');
  });

  it('toggles open only when enabled', () => {
    component.toggleOpen();
    expect(component.isOpen()).toBe(true);
    component.toggleOpen();
    expect(component.isOpen()).toBe(false);

    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    component.toggleOpen();
    expect(component.isOpen()).toBe(false);
  });

  it('positions the popup through the rAF effect once opened, without the top layer', () => {
    component.toggleOpen();
    fixture.detectChanges();
    expect(rafSpy).toHaveBeenCalled();
    const popup = fixture.debugElement.query(By.css('[tabindex="-1"]'))
      .nativeElement as HTMLElement;
    // Hide the Popover API from this element so the panel takes the
    // absolute-positioning fallback the offsetX transform belongs to.
    Object.defineProperty(popup, 'showPopover', { value: undefined });
    setRect(popup, { left: -100, right: 200, top: 10, bottom: 100 });
    flushRaf(rafQueue);
    expect(component.popupStyles()).toContain('translateX');
  });

  it('does nothing in positionPopup when the popup element is absent', () => {
    const internal = component as unknown as { positionPopup(): void };
    expect(() => internal.positionPopup()).not.toThrow();
    expect(component.popupStyles()).toBe('');
  });

  it('selects a date, emits, and closes when time is hidden', () => {
    const onChange = vi.fn();
    const onTouched = vi.fn();
    let emitted: Date | null = null;
    component.registerOnChange(onChange);
    component.registerOnTouched(onTouched);
    component.dateChange.subscribe((v) => (emitted = v));
    component.toggleOpen();

    const d = new Date(2024, 2, 3);
    component.onDateSelect(d);

    expect(component.internalValue()).toBe(d);
    expect(emitted).toBe(d);
    expect(onChange).toHaveBeenCalledWith(d);
    expect(onTouched).toHaveBeenCalled();
    expect(component.isOpen()).toBe(false);
  });

  it('keeps the popup open after selecting when time is shown', () => {
    fixture.componentRef.setInput('showTime', true);
    fixture.detectChanges();
    component.toggleOpen();
    component.onDateSelect(new Date(2024, 2, 3));
    expect(component.isOpen()).toBe(true);
  });

  it('treats a non-Date selection as null', () => {
    component.internalValue.set(new Date(2024, 2, 3));
    component.onDateSelect('not-a-date');
    expect(component.internalValue()).toBeNull();
  });

  it('closes on an outside document click and stays open for inside clicks', () => {
    component.toggleOpen();
    expect(component.isOpen()).toBe(true);

    const inside = document.createElement('div');
    inside.setAttribute('data-slot', 'date-picker');
    const child = document.createElement('span');
    inside.appendChild(child);
    component.onDocumentClick({ target: child } as unknown as MouseEvent);
    expect(component.isOpen()).toBe(true);

    const outside = document.createElement('div');
    component.onDocumentClick({ target: outside } as unknown as MouseEvent);
    expect(component.isOpen()).toBe(false);
  });

  it('formats a date without time by default', () => {
    expect(component.formatDate(new Date(2023, 0, 15))).toContain('January 15, 2023');
  });

  it('formats a date with time when showTime is enabled', () => {
    fixture.componentRef.setInput('showTime', true);
    fixture.detectChanges();
    const formatted = component.formatDate(new Date(2023, 0, 15, 13, 45));
    expect(formatted).toContain('2023');
    expect(formatted).toMatch(/\d{2}:\d{2}/);
  });

  it('writes an external value into the internal signal', () => {
    const d = new Date(2025, 6, 4);
    component.writeValue(d);
    expect(component.internalValue()).toBe(d);
    component.writeValue(null);
    expect(component.internalValue()).toBeNull();
  });

  it('exposes setDisabledState as a no-op', () => {
    expect(() => component.setDisabledState(true)).not.toThrow();
  });

  it('computes the button classes with the provided class input', () => {
    fixture.componentRef.setInput('class', 'my-custom');
    fixture.detectChanges();
    expect(component.buttonClasses()).toContain('inline-flex');
    expect(component.buttonClasses()).toContain('my-custom');
  });
});

@Component({
  template: `
    <ui-date-picker [formControl]="dateCtrl"></ui-date-picker>
    <ui-date-range-picker [formControl]="rangeCtrl"></ui-date-range-picker>
  `,
  imports: [DatePickerComponent, DateRangePickerComponent, ReactiveFormsModule],
})
class FormHost {
  readonly dateCtrl = new FormControl<Date | null>(null);
  readonly rangeCtrl = new FormControl<DateRange | null>(null);
}

describe('DatePickerComponent CVA registration through forms', () => {
  it('resolves the value accessors and reflects form control writes', async () => {
    await TestBed.configureTestingModule({
      imports: [FormHost, CalendarComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(FormHost);
    const host = fixture.componentInstance;
    fixture.detectChanges();

    const picker = fixture.debugElement.query(
      By.directive(DatePickerComponent)
    ).componentInstance as DatePickerComponent;
    const range = fixture.debugElement.query(
      By.directive(DateRangePickerComponent)
    ).componentInstance as DateRangePickerComponent;

    const d = new Date(2024, 3, 9);
    host.dateCtrl.setValue(d);
    host.rangeCtrl.setValue({ start: d, end: new Date(2024, 3, 12) });
    fixture.detectChanges();

    expect(picker.internalValue()).toBe(d);
    expect(range.rangeValue().start).toBe(d);
  });
});

describe('DateRangePickerComponent', () => {
  let fixture: ComponentFixture<DateRangePickerComponent>;
  let component: DateRangePickerComponent;
  const rafQueue: FrameRequestCallback[] = [];


  beforeEach(async () => {
    rafQueue.length = 0;
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(
      (cb: FrameRequestCallback) => {
        rafQueue.push(cb);
        return rafQueue.length;
      }
    );

    await TestBed.configureTestingModule({
      imports: [DateRangePickerComponent, CalendarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DateRangePickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('toggles open only when enabled', () => {
    component.toggleOpen();
    expect(component.isOpen()).toBe(true);
    component.toggleOpen();
    expect(component.isOpen()).toBe(false);

    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    component.toggleOpen();
    expect(component.isOpen()).toBe(false);
  });

  it('positions the popup through the rAF effect once opened, without the top layer', () => {
    component.toggleOpen();
    fixture.detectChanges();
    const popup = fixture.debugElement.query(By.css('[tabindex="-1"]'))
      .nativeElement as HTMLElement;
    // Hide the Popover API from this element so the panel takes the
    // absolute-positioning fallback the offsetX transform belongs to.
    Object.defineProperty(popup, 'showPopover', { value: undefined });
    setRect(popup, { left: -100, right: 200, top: 10, bottom: 100 });
    flushRaf(rafQueue);
    expect(component.popupStyles()).toContain('translateX');
  });

  it('does nothing in positionPopup when the popup element is absent', () => {
    const internal = component as unknown as { positionPopup(): void };
    expect(() => internal.positionPopup()).not.toThrow();
  });

  it('selects a full range, emits, and closes when time is hidden', () => {
    const onChange = vi.fn();
    const onTouched = vi.fn();
    let emitted: DateRange | null = null;
    component.registerOnChange(onChange);
    component.registerOnTouched(onTouched);
    component.rangeChange.subscribe((v) => (emitted = v));
    component.toggleOpen();

    const range: DateRange = {
      start: new Date(2024, 0, 1),
      end: new Date(2024, 0, 5),
    };
    component.onRangeSelect(range);

    expect(component.rangeValue()).toBe(range);
    expect(emitted).toBe(range);
    expect(onChange).toHaveBeenCalledWith(range);
    expect(onTouched).toHaveBeenCalled();
    expect(component.isOpen()).toBe(false);
  });

  it('keeps the popup open for a partial range', () => {
    component.toggleOpen();
    component.onRangeSelect({ start: new Date(2024, 0, 1), end: null });
    expect(component.isOpen()).toBe(true);
  });

  it('keeps the popup open for a full range when time is shown', () => {
    fixture.componentRef.setInput('showTime', true);
    fixture.detectChanges();
    component.toggleOpen();
    component.onRangeSelect({
      start: new Date(2024, 0, 1),
      end: new Date(2024, 0, 5),
    });
    expect(component.isOpen()).toBe(true);
  });

  it('ignores selections that are not a range object', () => {
    let emitted: DateRange | null = null;
    component.rangeChange.subscribe((v) => (emitted = v));
    component.onRangeSelect(null);
    component.onRangeSelect(42);
    component.onRangeSelect({ nope: true });
    expect(emitted).toBeNull();
  });

  it('propagates time range changes', () => {
    let emitted: TimeRange | null = null;
    component.timeRangeChange.subscribe((v) => (emitted = v));
    const range: TimeRange = { start: '09:00', end: '17:00' };
    component.onTimeRangeChange(range);
    expect(component.timeRange()).toBe(range);
    expect(emitted).toBe(range);
  });

  it('closes on an outside document click and stays open for inside clicks', () => {
    component.toggleOpen();
    const inside = document.createElement('div');
    inside.setAttribute('data-slot', 'date-range-picker');
    component.onDocumentClick({ target: inside } as unknown as MouseEvent);
    expect(component.isOpen()).toBe(true);

    const outside = document.createElement('div');
    component.onDocumentClick({ target: outside } as unknown as MouseEvent);
    expect(component.isOpen()).toBe(false);
  });

  it('formats a date without time by default', () => {
    expect(component.formatDate(new Date(2023, 0, 15))).toContain('2023');
  });

  it('formats a date with time when showTime is enabled', () => {
    fixture.componentRef.setInput('showTime', true);
    fixture.detectChanges();
    const formatted = component.formatDate(new Date(2023, 0, 15, 13, 45));
    expect(formatted).toMatch(/\d{2}:\d{2}/);
  });

  it('writes a range value and clears it when null', () => {
    const range: DateRange = {
      start: new Date(2024, 0, 1),
      end: new Date(2024, 0, 5),
    };
    component.writeValue(range);
    expect(component.rangeValue()).toBe(range);

    component.writeValue(null);
    expect(component.rangeValue()).toEqual({ start: null, end: null });
  });

  it('exposes setDisabledState as a no-op', () => {
    expect(() => component.setDisabledState(true)).not.toThrow();
  });

  it('renders the full range label in the button', () => {
    component.writeValue({
      start: new Date(2024, 0, 1),
      end: new Date(2024, 0, 5),
    });
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('button')).nativeElement;
    expect(btn.textContent).toContain('-');
    expect(btn.textContent).not.toContain('...');
  });

  it('renders the partial range label in the button', () => {
    component.writeValue({ start: new Date(2024, 0, 1), end: null });
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('button')).nativeElement;
    expect(btn.textContent).toContain('...');
  });

  it('computes the button classes', () => {
    expect(component.buttonClasses()).toContain('inline-flex');
  });
});
