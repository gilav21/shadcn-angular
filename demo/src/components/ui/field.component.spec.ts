import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import {
    FieldComponent,
    FieldGroupComponent,
    FieldSetComponent,
    FieldLabelComponent,
    FieldLegendComponent,
    FieldDescriptionComponent,
    FieldErrorComponent,
    FieldSeparatorComponent
} from './field.component';

@Component({
    template: `
    <ui-field-group>
      <ui-field-set>
        <ui-field-legend>Personal Info</ui-field-legend>
        
        <ui-field [orientation]="orientation">
          <ui-field-label for="name">Name</ui-field-label>
          <input id="name" type="text" />
          <ui-field-description>Your full name</ui-field-description>
          <ui-field-error>Name is required</ui-field-error>
        </ui-field>

        <ui-field-separator></ui-field-separator>

      </ui-field-set>
    </ui-field-group>
  `,
    imports: [
        FieldComponent,
        FieldGroupComponent,
        FieldSetComponent,
        FieldLabelComponent,
        FieldLegendComponent,
        FieldDescriptionComponent,
        FieldErrorComponent,
        FieldSeparatorComponent
    ]
})
class TestHostComponent {
    orientation: 'vertical' | 'horizontal' = 'vertical';
}

describe('FieldComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                TestHostComponent,
                FieldComponent,
                FieldGroupComponent,
                FieldSetComponent,
                FieldLabelComponent,
                FieldLegendComponent,
                FieldDescriptionComponent,
                FieldErrorComponent,
                FieldSeparatorComponent
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        // Manual detectChanges management
    });

    it('should create all parts', () => {
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.directive(FieldComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(FieldGroupComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(FieldSetComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(FieldLabelComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(FieldLegendComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(FieldDescriptionComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(FieldErrorComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(FieldSeparatorComponent))).toBeTruthy();
    });

    it('should render correct html structure', () => {
        fixture.detectChanges();
        const fieldset = fixture.debugElement.query(By.css('fieldset'));
        expect(fieldset).toBeTruthy();
        const legend = fixture.debugElement.query(By.css('legend'));
        expect(legend).toBeTruthy();
        const label = fixture.debugElement.query(By.css('label'));
        expect(label).toBeTruthy();
        const hr = fixture.debugElement.query(By.css('hr'));
        expect(hr).toBeTruthy();
    });

    it('should handle orientation prop', () => {
        host.orientation = 'horizontal';
        fixture.detectChanges();
        const field = fixture.debugElement.query(By.css('[data-slot="field"]'));
        expect(field.nativeElement.classList.contains('flex')).toBe(true);
        expect(field.nativeElement.getAttribute('data-orientation')).toBe('horizontal');
    });

    it('should apply label attributes', () => {
        fixture.detectChanges();
        const label = fixture.debugElement.query(By.css('label'));
        expect(label.nativeElement.getAttribute('for')).toBe('name');
    });

    it('should apply error role', () => {
        fixture.detectChanges();
        const error = fixture.debugElement.query(By.css('[data-slot="field-error"]'));
        expect(error.nativeElement.getAttribute('role')).toBe('alert');
        expect(error.nativeElement.classList.contains('text-destructive')).toBe(true);
    });
});
