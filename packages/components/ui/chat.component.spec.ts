import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatMessageComponent, ChatListComponent, ChatInputComponent } from './chat.component';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('Chat Components', () => {
    describe('ChatMessageComponent', () => {
        let component: ChatMessageComponent;
        let fixture: ComponentFixture<ChatMessageComponent>;

        beforeEach(async () => {
            await TestBed.configureTestingModule({
                imports: [ChatMessageComponent]
            }).compileComponents();

            fixture = TestBed.createComponent(ChatMessageComponent);
            component = fixture.componentInstance;
            fixture.detectChanges();
        });

        it('should create', () => {
            expect(component).toBeTruthy();
        });

        it('should render correct role styles', () => {
            // Default is user
            fixture.componentRef.setInput('role', 'user');
            fixture.detectChanges();
            const element = fixture.nativeElement as HTMLElement;
            expect(element.querySelector('.justify-end')).toBeTruthy();

            fixture.componentRef.setInput('role', 'assistant');
            fixture.detectChanges();
            expect(element.querySelector('.justify-start')).toBeTruthy();
        });
    });

    describe('ChatInputComponent', () => {
        let component: ChatInputComponent;
        let fixture: ComponentFixture<ChatInputComponent>;

        beforeEach(async () => {
            await TestBed.configureTestingModule({
                imports: [ChatInputComponent],
                providers: [provideNoopAnimations()]
            }).compileComponents();

            fixture = TestBed.createComponent(ChatInputComponent);
            component = fixture.componentInstance;
            fixture.detectChanges();
        });

        it('should emit send event on submit', () => {
            let emittedMessage = '';
            component.send.subscribe((msg: string) => emittedMessage = msg);

            // Set input value
            component.inputValue.set('Hello AI');

            // Trigger submit
            component.onSubmit();

            expect(emittedMessage).toBe('Hello AI');
            expect(component.inputValue()).toBe(''); // Should clear input
        });
    });
});
