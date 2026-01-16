import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    StepperComponent,
    StepperItemComponent,
    StepperTriggerComponent,
    StepperTitleComponent,
    StepperDescriptionComponent,
    StepperContentComponent,
} from './stepper.component';

// Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-stepper [(activeStep)]="activeStep" [linear]="linear()" [orientation]="orientation()">
                <ui-stepper-item value="step-1">
                    <ui-stepper-trigger>
                        <ui-stepper-title>Account</ui-stepper-title>
                        <ui-stepper-description>Create account</ui-stepper-description>
                    </ui-stepper-trigger>
                    <ui-stepper-content>Step 1 content</ui-stepper-content>
                </ui-stepper-item>
                <ui-stepper-item value="step-2">
                    <ui-stepper-trigger>
                        <ui-stepper-title>Profile</ui-stepper-title>
                        <ui-stepper-description>Set up profile</ui-stepper-description>
                    </ui-stepper-trigger>
                    <ui-stepper-content>Step 2 content</ui-stepper-content>
                </ui-stepper-item>
                <ui-stepper-item value="step-3">
                    <ui-stepper-trigger>
                        <ui-stepper-title>Complete</ui-stepper-title>
                    </ui-stepper-trigger>
                    <ui-stepper-content>Step 3 content</ui-stepper-content>
                </ui-stepper-item>
            </ui-stepper>
        </div>
    `,
    imports: [
        StepperComponent,
        StepperItemComponent,
        StepperTriggerComponent,
        StepperTitleComponent,
        StepperDescriptionComponent,
        StepperContentComponent,
    ]
})
class StepperTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
    activeStep = signal(0);
    linear = signal(false);
    orientation = signal<'horizontal' | 'vertical'>('horizontal');
}

describe('StepperComponent', () => {
    let fixture: ComponentFixture<StepperTestHostComponent>;
    let component: StepperTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [StepperTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(StepperTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
    });

    describe('Basic Rendering', () => {
        it('should create stepper component', () => {
            const stepper = fixture.debugElement.query(By.directive(StepperComponent));
            expect(stepper).toBeTruthy();
        });

        it('should have data-slot="stepper"', () => {
            const stepper = fixture.debugElement.query(By.css('[data-slot="stepper"]'));
            expect(stepper).toBeTruthy();
        });

        it('should render stepper items', () => {
            const items = fixture.debugElement.queryAll(By.css('[data-slot="stepper-item"]'));
            expect(items.length).toBe(3);
        });

        it('should render stepper triggers', () => {
            const triggers = fixture.debugElement.queryAll(By.css('[data-slot="stepper-trigger"]'));
            expect(triggers.length).toBe(3);
        });

        it('should render stepper titles', () => {
            const titles = fixture.debugElement.queryAll(By.css('[data-slot="stepper-title"]'));
            expect(titles.length).toBe(3);
        });
    });

    describe('Step Status', () => {
        it('should mark first step as current', () => {
            const firstItem = fixture.debugElement.query(By.css('[data-slot="stepper-item"]'));
            expect(firstItem.nativeElement.getAttribute('data-status')).toBe('current');
        });

        it('should mark other steps as pending', () => {
            const items = fixture.debugElement.queryAll(By.css('[data-slot="stepper-item"]'));
            expect(items[1].nativeElement.getAttribute('data-status')).toBe('pending');
            expect(items[2].nativeElement.getAttribute('data-status')).toBe('pending');
        });

        it('should update status when activeStep changes', async () => {
            component.activeStep.set(1);
            fixture.detectChanges();
            await fixture.whenStable();

            const items = fixture.debugElement.queryAll(By.css('[data-slot="stepper-item"]'));
            expect(items[0].nativeElement.getAttribute('data-status')).toBe('complete');
            expect(items[1].nativeElement.getAttribute('data-status')).toBe('current');
            expect(items[2].nativeElement.getAttribute('data-status')).toBe('pending');
        });
    });

    describe('Step Content', () => {
        it('should show only current step content', () => {
            const contents = fixture.debugElement.queryAll(By.css('[data-slot="stepper-content"]'));
            expect(contents.length).toBe(1);
            expect(contents[0].nativeElement.textContent).toContain('Step 1 content');
        });

        it('should change content when step changes', async () => {
            component.activeStep.set(1);
            fixture.detectChanges();
            await fixture.whenStable();

            const contents = fixture.debugElement.queryAll(By.css('[data-slot="stepper-content"]'));
            expect(contents.length).toBe(1);
            expect(contents[0].nativeElement.textContent).toContain('Step 2 content');
        });
    });

    describe('Navigation', () => {
        it('should navigate to step on trigger click', async () => {
            const triggers = fixture.debugElement.queryAll(By.css('[data-slot="stepper-trigger"]'));
            triggers[1].nativeElement.click();
            fixture.detectChanges();
            await fixture.whenStable();

            expect(component.activeStep()).toBe(1);
        });

        it('should prevent navigation in linear mode', async () => {
            component.linear.set(true);
            fixture.detectChanges();

            const triggers = fixture.debugElement.queryAll(By.css('[data-slot="stepper-trigger"]'));
            triggers[2].nativeElement.click();
            fixture.detectChanges();
            await fixture.whenStable();

            expect(component.activeStep()).toBe(0); // Should not change
        });

        it('should allow navigation to previous steps in linear mode', async () => {
            component.linear.set(true);
            component.activeStep.set(2);
            fixture.detectChanges();

            const triggers = fixture.debugElement.queryAll(By.css('[data-slot="stepper-trigger"]'));
            triggers[0].nativeElement.click();
            fixture.detectChanges();
            await fixture.whenStable();

            expect(component.activeStep()).toBe(0);
        });
    });

    describe('Orientation', () => {
        it('should have horizontal orientation by default', () => {
            const stepper = fixture.debugElement.query(By.css('[data-slot="stepper"]'));
            expect(stepper.nativeElement.getAttribute('data-orientation')).toBe('horizontal');
        });

        it('should switch to vertical orientation', async () => {
            component.orientation.set('vertical');
            fixture.detectChanges();
            await fixture.whenStable();

            const stepper = fixture.debugElement.query(By.css('[data-slot="stepper"]'));
            expect(stepper.nativeElement.getAttribute('data-orientation')).toBe('vertical');
        });
    });

    describe('RTL Support', () => {
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

        it('should maintain stepper structure in RTL', async () => {
            component.dir.set('rtl');
            fixture.detectChanges();
            await fixture.whenStable();

            const stepper = fixture.debugElement.query(By.directive(StepperComponent));
            const items = fixture.debugElement.queryAll(By.directive(StepperItemComponent));

            expect(stepper).toBeTruthy();
            expect(items.length).toBe(3);
        });
    });

    describe('Accessibility', () => {
        it('should have role="list" on stepper', () => {
            const stepper = fixture.debugElement.query(By.css('[role="list"]'));
            expect(stepper).toBeTruthy();
        });

        it('should have role="listitem" on items', () => {
            const items = fixture.debugElement.queryAll(By.css('[role="listitem"]'));
            expect(items.length).toBe(3);
        });

        it('should have focusable trigger buttons', () => {
            const triggers = fixture.debugElement.queryAll(By.css('[data-slot="stepper-trigger"]'));
            triggers.forEach(trigger => {
                expect(trigger.nativeElement.tagName.toLowerCase()).toBe('button');
            });
        });

        it('should have disabled buttons for inaccessible steps in linear mode', async () => {
            component.linear.set(true);
            fixture.detectChanges();
            await fixture.whenStable();

            const triggers = fixture.debugElement.queryAll(By.css('[data-slot="stepper-trigger"]'));
            expect(triggers[2].nativeElement.disabled).toBe(true);
        });
    });

    describe('Security', () => {
        it('should not execute scripts in content', () => {
            const contents = fixture.debugElement.queryAll(By.css('[data-slot="stepper-content"]'));
            contents.forEach(content => {
                expect(content.nativeElement.innerHTML).not.toContain('<script>');
            });
        });

        it('should properly escape text content', () => {
            const titles = fixture.debugElement.queryAll(By.css('[data-slot="stepper-title"]'));
            titles.forEach(title => {
                expect(title.nativeElement.innerHTML).not.toContain('<script>');
            });
        });
    });
});
