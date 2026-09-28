import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    TimelineComponent,
    TimelineItemComponent,
    TimelineConnectorComponent,
    TimelineDotComponent,
    TimelineHeaderComponent,
    TimelineContentComponent,
    TimelineTitleComponent,
    TimelineDescriptionComponent,
    TimelineTimeComponent,
} from '../timeline';

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-timeline>
                <ui-timeline-item>
                    <ui-timeline-header>
                        <ui-timeline-dot [variant]="variant()" />
                        <ui-timeline-connector />
                    </ui-timeline-header>
                    <ui-timeline-content>
                        <ui-timeline-title>Test Event</ui-timeline-title>
                        <ui-timeline-description>Test description</ui-timeline-description>
                        <ui-timeline-time>2024-01-01</ui-timeline-time>
                    </ui-timeline-content>
                </ui-timeline-item>
            </ui-timeline>
        </div>
    `,
    imports: [
        TimelineComponent,
        TimelineItemComponent,
        TimelineConnectorComponent,
        TimelineDotComponent,
        TimelineHeaderComponent,
        TimelineContentComponent,
        TimelineTitleComponent,
        TimelineDescriptionComponent,
        TimelineTimeComponent,
    ]
})
class TimelineTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
    variant = signal<'default' | 'filled' | 'success' | 'error' | 'warning'>('default');
}

describe('TimelineComponent', () => {
    let fixture: ComponentFixture<TimelineTestHostComponent>;
    let component: TimelineTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TimelineTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TimelineTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
    });

    describe('Basic Rendering', () => {
        it('exposes a data-slot on every timeline part', () => {
            expect(fixture.debugElement.query(By.css('[data-slot="timeline"]'))).toBeTruthy();
            expect(fixture.debugElement.query(By.css('[data-slot="timeline-item"]'))).toBeTruthy();
            expect(fixture.debugElement.query(By.css('[data-slot="timeline-connector"]'))).toBeTruthy();

            const title = fixture.debugElement.query(By.css('[data-slot="timeline-title"]'));
            const description = fixture.debugElement.query(By.css('[data-slot="timeline-description"]'));
            const time = fixture.debugElement.query(By.css('[data-slot="timeline-time"]'));

            expect(title).toBeTruthy();
            expect(description).toBeTruthy();
            expect(time).toBeTruthy();
        });
    });

    describe('Dot Variants', () => {
        it('should apply default variant styles', () => {
            const dot = fixture.debugElement.query(By.css('[data-slot="timeline-dot"]'));
            expect(dot.nativeElement.className).toContain('border-border');
        });

        it('should apply filled variant styles', async () => {
            component.variant.set('filled');
            fixture.detectChanges();
            await fixture.whenStable();

            const dot = fixture.debugElement.query(By.css('[data-slot="timeline-dot"]'));
            expect(dot.nativeElement.className).toContain('bg-primary');
        });

        it('should apply success variant styles', async () => {
            component.variant.set('success');
            fixture.detectChanges();
            await fixture.whenStable();

            const dot = fixture.debugElement.query(By.css('[data-slot="timeline-dot"]'));
            expect(dot.nativeElement.className).toContain('bg-green-500');
        });

        it('should apply error variant styles', async () => {
            component.variant.set('error');
            fixture.detectChanges();
            await fixture.whenStable();

            const dot = fixture.debugElement.query(By.css('[data-slot="timeline-dot"]'));
            expect(dot.nativeElement.className).toContain('bg-destructive');
        });

        it('should apply warning variant styles', async () => {
            component.variant.set('warning');
            fixture.detectChanges();
            await fixture.whenStable();

            const dot = fixture.debugElement.query(By.css('[data-slot="timeline-dot"]'));
            expect(dot.nativeElement.className).toContain('bg-yellow-500');
        });
    });

    describe('Accessibility', () => {
        it('should use semantic heading element for title', () => {
            const title = fixture.debugElement.query(By.css('[data-slot="timeline-title"]'));
            expect(title.nativeElement.tagName.toLowerCase()).toBe('h4');
        });

        it('should use semantic time element', () => {
            const time = fixture.debugElement.query(By.css('[data-slot="timeline-time"]'));
            expect(time.nativeElement.tagName.toLowerCase()).toBe('time');
        });

        it('should use semantic paragraph for description', () => {
            const desc = fixture.debugElement.query(By.css('[data-slot="timeline-description"]'));
            expect(desc.nativeElement.tagName.toLowerCase()).toBe('p');
        });
    });
});
