import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RichTextImageResizerComponent } from './rich-text-image-resizer.component';
import { describe, it, expect, beforeEach } from 'vitest';

describe('RichTextImageResizerComponent', () => {
    let component: RichTextImageResizerComponent;
    let fixture: ComponentFixture<RichTextImageResizerComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextImageResizerComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RichTextImageResizerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should default target to null', () => {
        expect(component.target()).toBeNull();
    });

    it('should default container to null', () => {
        expect(component.container()).toBeNull();
    });

    it('should not be visible when target is null', () => {
        expect(component.visible()).toBe(false);
    });

    it('should have alignment options', () => {
        expect(component.alignments).toEqual(['inline', 'left', 'center', 'right']);
    });

    it('should default currentAlignment to inline when no target', () => {
        expect(component.currentAlignment()).toBe('inline');
    });
});
