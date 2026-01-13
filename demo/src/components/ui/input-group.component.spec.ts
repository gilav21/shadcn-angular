import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import {
    InputGroupComponent,
    InputGroupInputComponent,
    InputGroupAddonComponent,
    InputGroupTextComponent
} from './input-group.component';

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
    let host: TestHostComponent;

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
        host = fixture.componentInstance;
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
        expect(group.nativeElement.role).toBe('group');
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
    });
});
