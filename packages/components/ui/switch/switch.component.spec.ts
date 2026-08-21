import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SwitchComponent } from './switch.component';
import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Reactive forms test host
@Component({
    template: `<ui-switch [formControl]="control" />`,
    imports: [SwitchComponent, ReactiveFormsModule]
})
class ReactiveFormTestHost {
    control = new FormControl(false);
}

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-switch />
        </div>
    `,
    imports: [SwitchComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('SwitchComponent', () => {
    let component: SwitchComponent;
    let fixture: ComponentFixture<SwitchComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SwitchComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SwitchComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="switch"', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.dataset.slot).toBe('switch');
    });

    it('should have role="switch"', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.getAttribute('role')).toBe('switch');
    });

    it('should render a skeleton instead of the switch when skeleton is true', () => {
        fixture.componentRef.setInput('skeleton', true);
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.css('ui-skeleton'))).toBeTruthy();
        expect(fixture.debugElement.query(By.css('button'))).toBeNull();
    });

    it('should render two skeletons when skeleton is true and a label is set', () => {
        fixture.componentRef.setInput('skeleton', true);
        fixture.componentRef.setInput('label', 'Notifications');
        fixture.detectChanges();
        expect(fixture.debugElement.queryAll(By.css('ui-skeleton'))).toHaveLength(2);
        expect(fixture.debugElement.query(By.css('button'))).toBeNull();
        expect(fixture.debugElement.query(By.css('label'))).toBeNull();
    });

    it('should have aria-checked="false" by default', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.getAttribute('aria-checked')).toBe('false');
    });

    it('should toggle on click', async () => {
        const button = fixture.debugElement.query(By.css('button'));
        button.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.checked()).toBe(true);
        expect(button.nativeElement.getAttribute('aria-checked')).toBe('true');
    });

    it('should not toggle when disabled', async () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        await fixture.whenStable();

        const button = fixture.debugElement.query(By.css('button'));
        button.nativeElement.click();
        fixture.detectChanges();

        expect(component.checked()).toBe(false);
    });

    it('should apply bg-primary when checked', async () => {
        component.checked.set(true);
        fixture.detectChanges();
        await fixture.whenStable();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.className).toContain('bg-primary');
    });

    it('should apply bg-input when unchecked', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.className).toContain('bg-input');
    });

    it('should set aria-label', () => {
        fixture.componentRef.setInput('ariaLabel', 'Toggle notifications');
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.getAttribute('aria-label')).toBe('Toggle notifications');
    });

    it('should early-return from toggle() when disabled without changing checked', () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();

        expect(component.isDisabled()).toBe(true);
        component.toggle();

        expect(component.checked()).toBe(false);
    });

    it('should early-return from toggle() when disabled via setDisabledState', () => {
        component.setDisabledState(true);
        fixture.detectChanges();

        expect(component.isDisabled()).toBe(true);
        component.toggle();

        expect(component.checked()).toBe(false);
    });

    it('should coerce a null value to false in writeValue', () => {
        component.checked.set(true);
        component.writeValue(null as unknown as boolean);
        expect(component.checked()).toBe(false);
    });

    it('should coerce an undefined value to false in writeValue', () => {
        component.checked.set(true);
        component.writeValue(undefined as unknown as boolean);
        expect(component.checked()).toBe(false);
    });

    it('should set checked from a truthy writeValue', () => {
        component.writeValue(true);
        expect(component.checked()).toBe(true);
    });

    it('should reflect checked state via toString()', () => {
        expect(component.toString()).toBe('false');
        component.checked.set(true);
        expect(component.toString()).toBe('true');
    });
});

describe('Switch ControlValueAccessor', () => {
    let fixture: ComponentFixture<ReactiveFormTestHost>;
    let component: ReactiveFormTestHost;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ReactiveFormTestHost]
        }).compileComponents();

        fixture = TestBed.createComponent(ReactiveFormTestHost);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should bind to FormControl', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(button).toBeTruthy();
    });

    it('should update FormControl on toggle', async () => {
        const button = fixture.debugElement.query(By.css('button'));
        button.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.control.value).toBe(true);
    });

    it('should reflect FormControl value', async () => {
        component.control.setValue(true);
        fixture.detectChanges();
        await fixture.whenStable();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.getAttribute('aria-checked')).toBe('true');
    });
});

describe('Switch RTL Support', () => {
    let fixture: ComponentFixture<RTLTestHostComponent>;
    let component: RTLTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RTLTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RTLTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
    });

    it('should render in LTR mode', () => {
        const container = fixture.debugElement.query(By.css('[dir="ltr"]'));
        expect(container).toBeTruthy();
    });

    it('should render in RTL mode', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
        expect(container).toBeTruthy();
    });

    it('should use RTL-aware thumb translation classes', () => {
        const switchComp = fixture.debugElement.query(By.directive(SwitchComponent));
        const thumb = switchComp.query(By.css('span'));

        // Component uses ltr: and rtl: prefixes for transforms
        expect(thumb.nativeElement.className).toContain('translate-x-0');
    });

    it('should toggle correctly in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const button = fixture.debugElement.query(By.css('button'));
        button.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(button.nativeElement.getAttribute('aria-checked')).toBe('true');
    });
});

describe('SwitchComponent with Label', () => {
    let component: SwitchComponent;
    let fixture: ComponentFixture<SwitchComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SwitchComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(SwitchComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('label', 'Enable notifications');
        fixture.detectChanges();
    });

    it('should render label when label input is provided', () => {
        const label = fixture.debugElement.query(By.css('label'));
        expect(label).toBeTruthy();
        expect(label.nativeElement.textContent).toContain('Enable notifications');
    });

    it('should render switch with label in flex container', () => {
        const container = fixture.debugElement.query(By.css('div.flex.items-center.gap-2'));
        expect(container).toBeTruthy();
    });

    it('should associate label with switch via for/id', () => {
        const label = fixture.debugElement.query(By.css('label'));
        const button = fixture.debugElement.query(By.css('button'));
        const buttonId = button.nativeElement.getAttribute('id');
        const labelFor = label.nativeElement.getAttribute('for');
        expect(buttonId).toBeTruthy();
        expect(labelFor).toBe(buttonId);
    });

    it('should toggle switch when clicking switch button', () => {
        expect(component.checked()).toBe(false);

        const button = fixture.debugElement.query(By.css('button'));
        button.nativeElement.click();
        fixture.detectChanges();

        expect(component.checked()).toBe(true);
    });

    it('should have role=switch on button', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.getAttribute('role')).toBe('switch');
    });
});

@Component({
    template: `<ui-switch [(checked)]="flag" (checkedChange)="emissions.push($event)" />`,
    imports: [SwitchComponent],
})
class TwoWaySwitchHost {
    readonly flag = signal(false);
    readonly emissions: boolean[] = [];
}

@Component({
    template: `<form [formGroup]="form"><ui-switch formControlName="enabled" /></form>`,
    imports: [SwitchComponent, ReactiveFormsModule],
})
class FormGroupSwitchHost {
    readonly form = new FormGroup({ enabled: new FormControl(false) });
}

/**
 * Reference harness for the signal-forms readiness spec. `checked` is already a
 * `model()`, so these pass unchanged — they exist to pin the behaviour every
 * converted control must reproduce.
 */
describe('SwitchComponent — signal-forms readiness', () => {
    const track = (fixture: ComponentFixture<unknown>): HTMLButtonElement =>
        fixture.debugElement.query(By.css('button[role="switch"]')).nativeElement;

    const clickTrack = (fixture: ComponentFixture<unknown>): void => {
        track(fixture).click();
        fixture.detectChanges();
    };

    it('T-1: two-way [(checked)] updates the model on user input', () => {
        const fixture = TestBed.createComponent(TwoWaySwitchHost);
        fixture.detectChanges();

        clickTrack(fixture);

        expect(fixture.componentInstance.flag()).toBe(true);
    });

    it('T-2: two-way [(checked)] updates the view when the model changes', () => {
        const fixture = TestBed.createComponent(TwoWaySwitchHost);
        fixture.detectChanges();

        fixture.componentInstance.flag.set(true);
        fixture.detectChanges();

        expect(track(fixture).getAttribute('aria-checked')).toBe('true');
    });

    it('T-3: works with formControlName and reports value to the form group', () => {
        const fixture = TestBed.createComponent(FormGroupSwitchHost);
        fixture.detectChanges();

        clickTrack(fixture);

        expect(fixture.componentInstance.form.value.enabled).toBe(true);
    });

    it('T-4: writeValue from the form updates the rendered value', () => {
        const fixture = TestBed.createComponent(FormGroupSwitchHost);
        fixture.detectChanges();

        fixture.componentInstance.form.setValue({ enabled: true });
        fixture.detectChanges();

        expect(track(fixture).getAttribute('aria-checked')).toBe('true');
    });

    it('T-9: emits checkedChange exactly once per user interaction', () => {
        const fixture = TestBed.createComponent(TwoWaySwitchHost);
        fixture.detectChanges();

        clickTrack(fixture);

        expect(fixture.componentInstance.emissions).toEqual([true]);
    });

    it('T-10: does not re-emit when writeValue is called with the current value', () => {
        const fixture = TestBed.createComponent(TwoWaySwitchHost);
        fixture.detectChanges();
        const switchComponent: SwitchComponent = fixture.debugElement
            .query(By.directive(SwitchComponent)).componentInstance;
        clickTrack(fixture);
        fixture.componentInstance.emissions.length = 0;

        switchComponent.writeValue(true);
        fixture.detectChanges();

        expect(fixture.componentInstance.emissions).toEqual([]);
    });
});
