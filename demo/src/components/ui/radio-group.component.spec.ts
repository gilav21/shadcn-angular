import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RadioGroupComponent, RadioGroupItemComponent } from './radio-group.component';
import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Test host for integration
@Component({
    template: `
        <ui-radio-group (valueChange)="onValueChange($event)">
            <ui-radio-group-item value="option1" />
            <ui-radio-group-item value="option2" />
            <ui-radio-group-item value="option3" />
        </ui-radio-group>
    `,
    imports: [RadioGroupComponent, RadioGroupItemComponent]
})
class TestHostComponent {
    selectedValue = '';
    onValueChange(value: string) {
        this.selectedValue = value;
    }
}

// Reactive forms test host
@Component({
    template: `
        <ui-radio-group [formControl]="control">
            <ui-radio-group-item value="a" />
            <ui-radio-group-item value="b" />
        </ui-radio-group>
    `,
    imports: [RadioGroupComponent, RadioGroupItemComponent, ReactiveFormsModule]
})
class ReactiveFormTestHost {
    control = new FormControl('');
}

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-radio-group>
                <ui-radio-group-item value="opt1" aria-label="الخيار 1" />
                <ui-radio-group-item value="opt2" aria-label="الخيار 2" />
            </ui-radio-group>
        </div>
    `,
    imports: [RadioGroupComponent, RadioGroupItemComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('RadioGroupComponent', () => {
    let component: RadioGroupComponent;
    let fixture: ComponentFixture<RadioGroupComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RadioGroupComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RadioGroupComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="radio-group"', () => {
        const div = fixture.debugElement.query(By.css('[data-slot="radio-group"]'));
        expect(div).toBeTruthy();
    });

    it('should have role="radiogroup"', () => {
        const div = fixture.debugElement.query(By.css('[role="radiogroup"]'));
        expect(div).toBeTruthy();
    });

    it('should apply vertical orientation by default', () => {
        const div = fixture.debugElement.query(By.css('div'));
        expect(div.nativeElement.getAttribute('aria-orientation')).toBe('vertical');
        expect(div.nativeElement.className).toContain('grid-flow-row');
    });

    it('should apply horizontal orientation', () => {
        fixture.componentRef.setInput('orientation', 'horizontal');
        fixture.detectChanges();

        const div = fixture.debugElement.query(By.css('div'));
        expect(div.nativeElement.getAttribute('aria-orientation')).toBe('horizontal');
        expect(div.nativeElement.className).toContain('grid-flow-col');
    });

    it('should apply grid layout', () => {
        const div = fixture.debugElement.query(By.css('div'));
        expect(div.nativeElement.className).toContain('grid');
        expect(div.nativeElement.className).toContain('gap-2');
    });
});

describe('RadioGroup Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let component: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should render radio group with items', () => {
        const items = fixture.debugElement.queryAll(By.css('[data-slot="radio-group-item"]'));
        expect(items.length).toBe(3);
    });

    it('should have role="radio" on items', () => {
        const items = fixture.debugElement.queryAll(By.css('[role="radio"]'));
        expect(items.length).toBe(3);
    });

    it('should have aria-checked="false" by default', () => {
        const items = fixture.debugElement.queryAll(By.css('[role="radio"]'));
        items.forEach(item => {
            expect(item.nativeElement.getAttribute('aria-checked')).toBe('false');
        });
    });

    it('should select item on click', async () => {
        const items = fixture.debugElement.queryAll(By.css('[role="radio"]'));
        items[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(items[1].nativeElement.getAttribute('aria-checked')).toBe('true');
        expect(items[1].nativeElement.getAttribute('data-state')).toBe('checked');
    });

    it('should emit valueChange on selection', async () => {
        const items = fixture.debugElement.queryAll(By.css('[role="radio"]'));
        items[2].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.selectedValue).toBe('option3');
    });

    it('should deselect previous item when selecting new one', async () => {
        const items = fixture.debugElement.queryAll(By.css('[role="radio"]'));

        items[0].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        items[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(items[0].nativeElement.getAttribute('aria-checked')).toBe('false');
        expect(items[1].nativeElement.getAttribute('aria-checked')).toBe('true');
    });
});

describe('RadioGroup ControlValueAccessor', () => {
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
        const group = fixture.debugElement.query(By.directive(RadioGroupComponent));
        expect(group).toBeTruthy();
    });

    it('should update FormControl on selection', async () => {
        const items = fixture.debugElement.queryAll(By.css('[role="radio"]'));
        items[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.control.value).toBe('b');
    });

    it('should reflect FormControl value', async () => {
        component.control.setValue('a');
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.css('[role="radio"]'));
        expect(items[0].nativeElement.getAttribute('aria-checked')).toBe('true');
    });
});

describe('RadioGroup RTL Support', () => {
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

    it('should select items in RTL mode', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.css('[role="radio"]'));
        items[0].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(items[0].nativeElement.getAttribute('aria-checked')).toBe('true');
    });
});
