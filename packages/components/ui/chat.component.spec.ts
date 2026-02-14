import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ChatMessageComponent, ChatInputComponent } from './chat.component';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

@Component({
    imports: [ChatMessageComponent],
    template: `<ui-chat-message [role]="role" [content]="content" [avatarSrc]="avatarSrc" [avatarFallback]="avatarFallback">
        @if (projected) {
            <p class="custom-projected">Custom HTML content</p>
        }
    </ui-chat-message>`,
})
class TestHostComponent {
    role: 'user' | 'assistant' | 'system' = 'user';
    content: string | undefined;
    avatarSrc: string | undefined;
    avatarFallback = '?';
    projected = false;
}

describe('Chat Components', () => {
    describe('ChatMessageComponent', () => {
        describe('simple mode (input-driven)', () => {
            let fixture: ComponentFixture<TestHostComponent>;
            let host: TestHostComponent;

            beforeEach(async () => {
                await TestBed.configureTestingModule({
                    imports: [TestHostComponent]
                }).compileComponents();

                fixture = TestBed.createComponent(TestHostComponent);
                host = fixture.componentInstance;
            });

            it('should render content from input when no projected content', () => {
                host.content = 'Hello from input';
                fixture.detectChanges();

                const bubble = fixture.debugElement.query(By.css('[data-slot="chat-bubble"]'));
                expect(bubble.nativeElement.textContent).toContain('Hello from input');
            });

            it('should apply user role styles', () => {
                host.role = 'user';
                host.content = 'User message';
                fixture.detectChanges();

                const root = fixture.debugElement.query(By.css('[data-slot="chat-message"]'));
                expect(root.nativeElement.className).toContain('justify-end');
            });

            it('should apply assistant role styles', () => {
                host.role = 'assistant';
                host.content = 'Assistant message';
                fixture.detectChanges();

                const root = fixture.debugElement.query(By.css('[data-slot="chat-message"]'));
                expect(root.nativeElement.className).toContain('justify-start');
            });

            it('should apply system role styles and hide avatar', () => {
                host.role = 'system';
                host.content = 'System message';
                fixture.detectChanges();

                const root = fixture.debugElement.query(By.css('[data-slot="chat-message"]'));
                expect(root.nativeElement.className).toContain('justify-center');
                const avatar = fixture.debugElement.query(By.css('ui-avatar'));
                expect(avatar).toBeFalsy();
            });

            it('should show avatar for user and assistant roles', () => {
                host.role = 'user';
                host.content = 'Hello';
                fixture.detectChanges();

                const avatar = fixture.debugElement.query(By.css('ui-avatar'));
                expect(avatar).toBeTruthy();
            });
        });

        describe('custom mode (content projection)', () => {
            let fixture: ComponentFixture<TestHostComponent>;
            let host: TestHostComponent;

            beforeEach(async () => {
                await TestBed.configureTestingModule({
                    imports: [TestHostComponent]
                }).compileComponents();

                fixture = TestBed.createComponent(TestHostComponent);
                host = fixture.componentInstance;
            });

            it('should render projected content instead of content input', () => {
                host.content = 'Input content';
                host.projected = true;
                fixture.detectChanges();

                const bubble = fixture.debugElement.query(By.css('[data-slot="chat-bubble"]'));
                expect(bubble.nativeElement.textContent).toContain('Custom HTML content');
            });

            it('should contain custom projected element', () => {
                host.projected = true;
                fixture.detectChanges();

                const custom = fixture.debugElement.query(By.css('.custom-projected'));
                expect(custom).toBeTruthy();
            });
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

        it('should have data-slot attribute', () => {
            const el = fixture.debugElement.query(By.css('[data-slot="chat-input"]'));
            expect(el).toBeTruthy();
        });

        it('should emit send event on submit', () => {
            let emittedMessage = '';
            component.send.subscribe((msg: string) => emittedMessage = msg);

            component.inputValue.set('Hello AI');
            component.onSubmit();

            expect(emittedMessage).toBe('Hello AI');
            expect(component.inputValue()).toBe('');
        });

        it('should not emit when input is empty', () => {
            let emitted = false;
            component.send.subscribe(() => emitted = true);

            component.inputValue.set('   ');
            component.onSubmit();

            expect(emitted).toBe(false);
        });

        it('should not emit when disabled', () => {
            let emitted = false;
            component.send.subscribe(() => emitted = true);

            component.inputValue.set('Hello');
            fixture.componentRef.setInput('disabled', true);
            fixture.detectChanges();
            component.onSubmit();

            expect(emitted).toBe(false);
        });
    });
});
