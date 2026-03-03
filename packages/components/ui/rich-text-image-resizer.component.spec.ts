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

    describe('applyAlignmentStyles', () => {
        let img: HTMLImageElement;

        beforeEach(() => {
            img = document.createElement('img');
        });

        it('should set display to inline for inline alignment', () => {
            component.applyAlignmentStyles(img, 'inline');

            expect(img.style.display).toBe('inline');
            expect(img.style.margin).toBe('0px');
        });

        it('should set float to left for left alignment', () => {
            component.applyAlignmentStyles(img, 'left');

            expect(img.style.display).toBe('block');
            expect(img.style.float).toBe('left');
            expect(img.style.marginRight).toBe('12px');
            expect(img.style.marginBottom).toBe('4px');
        });

        it('should set auto margins for center alignment', () => {
            component.applyAlignmentStyles(img, 'center');

            expect(img.style.display).toBe('block');
            expect(img.style.marginLeft).toBe('auto');
            expect(img.style.marginRight).toBe('auto');
        });

        it('should set float to right for right alignment', () => {
            component.applyAlignmentStyles(img, 'right');

            expect(img.style.display).toBe('block');
            expect(img.style.float).toBe('right');
            expect(img.style.marginLeft).toBe('12px');
            expect(img.style.marginBottom).toBe('4px');
        });

        it('should clear previous alignment styles when switching alignments', () => {
            component.applyAlignmentStyles(img, 'left');
            expect(img.style.float).toBe('left');

            component.applyAlignmentStyles(img, 'center');
            expect(img.style.float).toBe('');
            expect(img.style.marginLeft).toBe('auto');
            expect(img.style.marginRight).toBe('auto');
        });

        it('should clear float when switching from right to inline', () => {
            component.applyAlignmentStyles(img, 'right');
            expect(img.style.float).toBe('right');

            component.applyAlignmentStyles(img, 'inline');
            expect(img.style.float).toBe('');
            expect(img.style.display).toBe('inline');
        });
    });

    describe('onDeleteClick', () => {
        it('should emit imageRemove with the target element', () => {
            const img = document.createElement('img');
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            let emittedTarget: HTMLImageElement | undefined;
            component.imageRemove.subscribe((target) => {
                emittedTarget = target;
            });

            const mockEvent = { preventDefault: () => {}, stopPropagation: () => {} } as any;
            component.onDeleteClick(mockEvent);

            expect(emittedTarget).toBe(img);
        });

        it('should not emit imageRemove when target is null', () => {
            let emitted = false;
            component.imageRemove.subscribe(() => {
                emitted = true;
            });

            const mockEvent = { preventDefault: () => {}, stopPropagation: () => {} } as any;
            component.onDeleteClick(mockEvent);

            expect(emitted).toBe(false);
        });

        it('should call preventDefault and stopPropagation on the event', () => {
            const img = document.createElement('img');
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            let preventDefaultCalled = false;
            let stopPropagationCalled = false;
            const mockEvent = {
                preventDefault: () => { preventDefaultCalled = true; },
                stopPropagation: () => { stopPropagationCalled = true; },
            } as any;

            component.onDeleteClick(mockEvent);

            expect(preventDefaultCalled).toBe(true);
            expect(stopPropagationCalled).toBe(true);
        });
    });

    describe('onAlignClick', () => {
        it('should emit alignmentChange with the selected alignment', () => {
            const img = document.createElement('img');
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            let emittedAlignment: string | undefined;
            component.alignmentChange.subscribe((align) => {
                emittedAlignment = align;
            });

            const mockEvent = { preventDefault: () => {}, stopPropagation: () => {} } as any;
            component.onAlignClick(mockEvent, 'center');

            expect(emittedAlignment).toBe('center');
        });

        it('should set data-align attribute on the target image', () => {
            const img = document.createElement('img');
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            const mockEvent = { preventDefault: () => {}, stopPropagation: () => {} } as any;
            component.onAlignClick(mockEvent, 'right');

            expect(img.dataset['align']).toBe('right');
        });

        it('should apply alignment styles to the target image', () => {
            const img = document.createElement('img');
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            const mockEvent = { preventDefault: () => {}, stopPropagation: () => {} } as any;
            component.onAlignClick(mockEvent, 'left');

            expect(img.style.float).toBe('left');
            expect(img.style.display).toBe('block');
        });

        it('should not emit when target is null', () => {
            let emitted = false;
            component.alignmentChange.subscribe(() => {
                emitted = true;
            });

            const mockEvent = { preventDefault: () => {}, stopPropagation: () => {} } as any;
            component.onAlignClick(mockEvent, 'center');

            expect(emitted).toBe(false);
        });
    });

    describe('currentAlignment', () => {
        it('should read data-align attribute from target element', () => {
            const img = document.createElement('img');
            img.dataset['align'] = 'left';
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            expect(component.currentAlignment()).toBe('left');
        });

        it('should return inline when target has no data-align attribute', () => {
            const img = document.createElement('img');
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            expect(component.currentAlignment()).toBe('inline');
        });

        it('should return center when target has data-align set to center', () => {
            const img = document.createElement('img');
            img.dataset['align'] = 'center';
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            expect(component.currentAlignment()).toBe('center');
        });

        it('should return right when target has data-align set to right', () => {
            const img = document.createElement('img');
            img.dataset['align'] = 'right';
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            expect(component.currentAlignment()).toBe('right');
        });
    });
});
