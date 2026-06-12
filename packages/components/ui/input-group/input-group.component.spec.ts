import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { InputGroupComponent } from './input-group.component';
import { InputGroupInputComponent } from './sub/input-group-input.component';
import { InputGroupAddonComponent } from './sub/input-group-addon.component';
import { InputGroupTextComponent } from './sub/input-group-text.component';

@Component({
    template: `
    <ui-input-group>
      <ui-input-group-addon>$</ui-input-group-addon>
      <ui-input-group-input [formControl]="control" placeholder="Amount" />
      <ui-input-group-addon>USD</ui-input-group-addon>
    </ui-input-group>
  `,
    imports: [
        InputGroupComponent,
        InputGroupInputComponent,
        InputGroupAddonComponent,
        ReactiveFormsModule
    ]
})
class TestHostComponent {
    control = new FormControl('');
}

describe('InputGroupComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                TestHostComponent,
                InputGroupComponent,
                InputGroupInputComponent,
                InputGroupAddonComponent,
                InputGroupTextComponent
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
    });

    it('should create all parts', () => {
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.directive(InputGroupComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(InputGroupInputComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(InputGroupAddonComponent))).toBeTruthy();
    });

    it('should structure content correctly', () => {
        fixture.detectChanges();
        const group = fixture.debugElement.query(By.css('[data-slot="input-group"]'));
        expect(group.nativeElement.tagName).toBe('FIELDSET');
        expect(group.nativeElement.classList.contains('flex')).toBe(true);
        expect(group.nativeElement.classList.contains('items-center')).toBe(true);

        const addons = fixture.debugElement.queryAll(By.css('[data-slot="input-group-addon"]'));
        expect(addons.length).toBe(2);
    });

    it('should bind to FormControl (InputGroupInput)', async () => {
        fixture.detectChanges();
        await fixture.whenStable();

        const input = fixture.debugElement.query(By.css('input'));
        input.nativeElement.value = '100';
        input.nativeElement.dispatchEvent(new Event('input'));

        fixture.detectChanges();
        expect(fixture.componentInstance.control.value).toBe('100');
    });
});
