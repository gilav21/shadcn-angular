import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    SpeedDialComponent,
    SpeedDialTriggerComponent,
    SpeedDialMenuComponent,
    SpeedDialItemComponent,
    SpeedDialMaskComponent,
    SpeedDialContextTriggerComponent
} from './speed-dial.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

@Component({
    template: `
    <div [dir]="dir()">
      <ui-speed-dial>
        <ui-speed-dial-trigger>
          <button data-test="trigger">Trigger</button>
        </ui-speed-dial-trigger>
        <ui-speed-dial-mask></ui-speed-dial-mask>
        <ui-speed-dial-menu>
          <ui-speed-dial-item>
            <button data-test="item-1">Item 1</button>
          </ui-speed-dial-item>
        </ui-speed-dial-menu>
      </ui-speed-dial>
    </div>
  `,
    imports: [
        SpeedDialComponent,
        SpeedDialTriggerComponent,
        SpeedDialMenuComponent,
        SpeedDialItemComponent,
        SpeedDialMaskComponent
    ]
})
class TestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('SpeedDialComponent', () => {
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

    it('should create', () => {
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should be closed by default', () => {
        const menu = fixture.debugElement.query(By.css('[data-slot="speed-dial-menu"]'));
        expect(menu).toBeFalsy();
    });

    it('should open when trigger is clicked', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="speed-dial-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();

        const menu = fixture.debugElement.query(By.css('[data-slot="speed-dial-menu"]'));
        expect(menu).toBeTruthy();
    });

    it('should close when triggered again', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="speed-dial-trigger"]'));
        trigger.nativeElement.click(); // open
        fixture.detectChanges();

        trigger.nativeElement.click(); // close
        fixture.detectChanges();

        const menu = fixture.debugElement.query(By.css('[data-slot="speed-dial-menu"]'));
        expect(menu).toBeFalsy();
    });

    it('should close when mask is clicked', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="speed-dial-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();

        const mask = fixture.debugElement.query(By.css('[data-slot="speed-dial-mask"]'));
        mask.nativeElement.click();
        fixture.detectChanges();

        const menu = fixture.debugElement.query(By.css('[data-slot="speed-dial-menu"]'));
        expect(menu).toBeFalsy();
    });

    it('should close on click outside', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="speed-dial-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();

        document.dispatchEvent(new MouseEvent('click'));
        fixture.detectChanges();

        const menu = fixture.debugElement.query(By.css('[data-slot="speed-dial-menu"]'));
        expect(menu).toBeFalsy();
    });

    it('should rotate trigger when open', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="speed-dial-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();

        expect(trigger.nativeElement.className).toContain('rotate-45');
    });
});

describe('SpeedDial RTL Support', () => {
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

    it('should apply correct absolute positioning for linear up in LTR', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="speed-dial-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();

        const menu = fixture.debugElement.query(By.css('[data-slot="speed-dial-menu"]'));
        // Linear up: 'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-col-reverse gap-2'
        expect(menu.nativeElement.className).toContain('bottom-full');
        expect(menu.nativeElement.className).toContain('left-1/2');
    });

    it('should render in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
        expect(container).toBeTruthy();
    });
});
