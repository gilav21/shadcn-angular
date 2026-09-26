import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    SpeedDialComponent,
    SpeedDialTriggerComponent,
    SpeedDialMenuComponent,
    SpeedDialItemComponent,
    SpeedDialMaskComponent,
} from './index';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';

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

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should open when trigger is clicked', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="speed-dial-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();

        const menu = fixture.debugElement.query(By.css('[data-slot="speed-dial-menu"]'));
        expect(menu.nativeElement.dataset.state).toBe('open');
    });

    it('should close when triggered again', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="speed-dial-trigger"]'));
        trigger.nativeElement.click(); // open
        fixture.detectChanges();

        trigger.nativeElement.click(); // close
        fixture.detectChanges();

        const menu = fixture.debugElement.query(By.css('[data-slot="speed-dial-menu"]'));
        expect(menu.nativeElement.dataset.state).toBe('closed');
    });

    it('should close when mask is clicked', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="speed-dial-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();

        const mask = fixture.debugElement.query(By.css('[data-slot="speed-dial-mask"]'));
        mask.nativeElement.click();
        fixture.detectChanges();

        const menu = fixture.debugElement.query(By.css('[data-slot="speed-dial-menu"]'));
        expect(menu.nativeElement.dataset.state).toBe('closed');
    });

    it('should close on click outside', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="speed-dial-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();

        document.dispatchEvent(new MouseEvent('click'));
        fixture.detectChanges();

        const menu = fixture.debugElement.query(By.css('[data-slot="speed-dial-menu"]'));
        expect(menu.nativeElement.dataset.state).toBe('closed');
    });

    it('should rotate trigger when open', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="speed-dial-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();

        expect(trigger.nativeElement.className).toContain('rotate-45');
    });
});
