import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SkeletonComponent } from './skeleton.component';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SkeletonComponent', () => {
    let fixture: ComponentFixture<SkeletonComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SkeletonComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SkeletonComponent);
        fixture.detectChanges();
    });

    it('should have data-slot="skeleton"', () => {
        expect(fixture.nativeElement.dataset.slot).toBe('skeleton');
    });

    it('pulses by default and shimmers instead when variant="shimmer"', () => {
        const classes = (): string[] => [...(fixture.nativeElement as HTMLElement).classList];
        expect(classes()).toEqual(expect.arrayContaining(['animate-pulse', 'bg-primary/10']));

        fixture.componentRef.setInput('variant', 'shimmer');
        fixture.detectChanges();

        expect(classes()).toContain('animate-shimmer');
        expect(classes()).not.toContain('animate-pulse');
        expect(classes()).not.toContain('bg-primary/10');
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'h-10 w-full');
        fixture.detectChanges();

        expect(fixture.nativeElement.className).toContain('h-10');
        expect(fixture.nativeElement.className).toContain('w-full');
    });
});
