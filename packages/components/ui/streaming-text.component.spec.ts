import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { StreamingTextComponent } from './streaming-text.component';

describe('StreamingTextComponent', () => {
    let component: StreamingTextComponent;
    let fixture: ComponentFixture<StreamingTextComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [StreamingTextComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(StreamingTextComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should stream text correctly', async () => {
        const textToStream = 'Hello';
        fixture.componentRef.setInput('text', textToStream);
        fixture.componentRef.setInput('speed', 10);
        fixture.detectChanges();

        expect(component.displayedText()).toBe('');

        // Wait for typing
        await new Promise(resolve => setTimeout(resolve, 50));
        fixture.detectChanges();
        expect(component.displayedText().length).toBeGreaterThan(0);
        expect(component.isTyping()).toBe(true);

        // Wait for completion (speed 10 * 5 chars = 50ms + buffer)
        await new Promise(resolve => setTimeout(resolve, 150));
        fixture.detectChanges();

        expect(component.displayedText()).toBe(textToStream);
        expect(component.isTyping()).toBe(false);
    });
});
