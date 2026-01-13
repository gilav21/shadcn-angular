import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SkeletonComponent } from './skeleton.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-skeleton class="h-4 w-[200px]" />
        </div>
    `,
    imports: [SkeletonComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('SkeletonComponent', () => {
    let component: SkeletonComponent;
    let fixture: ComponentFixture<SkeletonComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SkeletonComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SkeletonComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="skeleton"', () => {
        expect(fixture.nativeElement.getAttribute('data-slot')).toBe('skeleton');
    });

    it('should apply animate-pulse class', () => {
        expect(fixture.nativeElement.className).toContain('animate-pulse');
    });

    it('should apply rounded-md class', () => {
        expect(fixture.nativeElement.className).toContain('rounded-md');
    });

    it('should apply bg-primary/10 class', () => {
        expect(fixture.nativeElement.className).toContain('bg-primary/10');
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'h-10 w-full');
        fixture.detectChanges();

        expect(fixture.nativeElement.className).toContain('h-10');
        expect(fixture.nativeElement.className).toContain('w-full');
    });
});

describe('Skeleton RTL Support', () => {
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

    it('should maintain animation in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const skeleton = fixture.debugElement.query(By.directive(SkeletonComponent));
        expect(skeleton.nativeElement.className).toContain('animate-pulse');
    });
});
