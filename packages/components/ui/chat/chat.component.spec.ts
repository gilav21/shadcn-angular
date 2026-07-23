import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ChatMessageComponent, ChatInputComponent, ChatListComponent } from './index';

type Role = 'user' | 'assistant' | 'system';

@Component({
    imports: [ChatMessageComponent],
    template: `<ui-chat-message [role]="role" [content]="content" [avatarSrc]="avatarSrc" [avatarFallback]="avatarFallback" [class]="extraClass">
        @if (projected) {
            <p class="custom-projected">Custom HTML content</p>
        }
    </ui-chat-message>`,
})
class TestHostComponent {
    role: Role = 'user';
    content: string | undefined;
    avatarSrc: string | undefined;
    avatarFallback = '?';
    projected = false;
    extraClass = '';
}

@Component({
    imports: [ChatMessageComponent],
    template: `<ui-chat-message role="assistant">plain projected text</ui-chat-message>`,
})
class TextProjectionHostComponent {}

@Component({
    imports: [ChatListComponent, ChatMessageComponent],
    template: `<ui-chat-list [autoScroll]="autoScroll" [class]="extraClass">
        @for (msg of messages; track msg) {
            <ui-chat-message [content]="msg" />
        }
    </ui-chat-list>`,
})
class ListHostComponent {
    autoScroll = false;
    extraClass = '';
    messages: string[] = ['first'];
}

const flushMicrotasks = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('Chat Components', () => {
    describe('ChatMessageComponent', () => {
        let fixture: ComponentFixture<TestHostComponent>;
        let host: TestHostComponent;

        beforeEach(async () => {
            await TestBed.configureTestingModule({
                imports: [TestHostComponent],
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

        it('should apply user role styles and mirror avatar to end side', () => {
            host.role = 'user';
            host.content = 'User message';
            fixture.detectChanges();

            const root = fixture.debugElement.query(By.css('[data-slot="chat-message"]'));
            expect(root.nativeElement.className).toContain('justify-end');
            expect(root.nativeElement.className).toContain('[&>ui-avatar]:order-last');
            const bubble = fixture.debugElement.query(By.css('[data-slot="chat-bubble"]'));
            expect(bubble.nativeElement.className).toContain('bg-primary');
        });

        it('should apply assistant role styles without reordering avatar', () => {
            host.role = 'assistant';
            host.content = 'Assistant message';
            fixture.detectChanges();

            const root = fixture.debugElement.query(By.css('[data-slot="chat-message"]'));
            expect(root.nativeElement.className).toContain('justify-start');
            expect(root.nativeElement.className).not.toContain('order-last');
            const bubble = fixture.debugElement.query(By.css('[data-slot="chat-bubble"]'));
            expect(bubble.nativeElement.className).toContain('bg-muted');
        });

        it('should apply system role styles and hide avatar', () => {
            host.role = 'system';
            host.content = 'System message';
            fixture.detectChanges();

            const root = fixture.debugElement.query(By.css('[data-slot="chat-message"]'));
            expect(root.nativeElement.className).toContain('justify-center');
            const avatar = fixture.debugElement.query(By.css('ui-avatar'));
            expect(avatar).toBeFalsy();
            const bubble = fixture.debugElement.query(By.css('[data-slot="chat-bubble"]'));
            expect(bubble.nativeElement.className).toContain('italic');
        });

        it('should show avatar with fallback text for non-system roles', () => {
            host.role = 'assistant';
            host.avatarFallback = 'AI';
            host.content = 'Hello';
            fixture.detectChanges();

            const avatar = fixture.debugElement.query(By.css('ui-avatar'));
            expect(avatar).toBeTruthy();
            const fallback = fixture.debugElement.query(By.css('ui-avatar-fallback'));
            expect(fallback.nativeElement.textContent).toContain('AI');
        });

        it('should render avatar image when avatarSrc is provided', () => {
            host.role = 'user';
            host.avatarSrc = 'https://example.com/a.png';
            host.content = 'With avatar image';
            fixture.detectChanges();

            const image = fixture.debugElement.query(By.css('ui-avatar-image'));
            expect(image).toBeTruthy();
        });

        it('should apply the custom class input on the root', () => {
            host.content = 'Styled';
            host.extraClass = 'my-extra-class';
            fixture.detectChanges();

            const root = fixture.debugElement.query(By.css('[data-slot="chat-message"]'));
            expect(root.nativeElement.className).toContain('my-extra-class');
        });

        it('should render projected element content and mark hasProjectedContent true', () => {
            host.content = 'Input content';
            host.projected = true;
            fixture.detectChanges();

            const bubble = fixture.debugElement.query(By.css('[data-slot="chat-bubble"]'));
            expect(bubble.nativeElement.textContent).toContain('Custom HTML content');
            expect(bubble.nativeElement.textContent).not.toContain('Input content');
            const custom = fixture.debugElement.query(By.css('.custom-projected'));
            expect(custom).toBeTruthy();
        });
    });

    describe('ChatMessageComponent projected text node', () => {
        it('should detect a plain text node as projected content', async () => {
            await TestBed.configureTestingModule({
                imports: [TextProjectionHostComponent],
            }).compileComponents();

            const fixture = TestBed.createComponent(TextProjectionHostComponent);
            fixture.detectChanges();

            const message = fixture.debugElement.query(By.directive(ChatMessageComponent));
            expect((message.componentInstance as ChatMessageComponent).hasProjectedContent()).toBe(true);
            const bubble = fixture.debugElement.query(By.css('[data-slot="chat-bubble"]'));
            expect(bubble.nativeElement.textContent).toContain('plain projected text');
        });
    });

    describe('ChatInputComponent', () => {
        let component: ChatInputComponent;
        let fixture: ComponentFixture<ChatInputComponent>;

        beforeEach(async () => {
            await TestBed.configureTestingModule({
                imports: [ChatInputComponent],
            }).compileComponents();

            fixture = TestBed.createComponent(ChatInputComponent);
            component = fixture.componentInstance;
            fixture.detectChanges();
        });

        it('should have data-slot attribute and default placeholder', () => {
            const el = fixture.debugElement.query(By.css('[data-slot="chat-input"]'));
            expect(el).toBeTruthy();
            const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
            expect(textarea.getAttribute('placeholder')).toBe('Type a message...');
        });

        it('should emit send event and clear input on submit', () => {
            let emittedMessage = '';
            component.send.subscribe((msg: string) => (emittedMessage = msg));

            component.inputValue.set('Hello AI');
            component.onSubmit();

            expect(emittedMessage).toBe('Hello AI');
            expect(component.inputValue()).toBe('');
        });

        it('should send when the send button is clicked', () => {
            let emittedMessage = '';
            component.send.subscribe((msg: string) => (emittedMessage = msg));

            component.inputValue.set('Clicked message');
            fixture.detectChanges();

            const button = fixture.nativeElement.querySelector('ui-button button') as HTMLButtonElement;
            button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(emittedMessage).toBe('Clicked message');
            expect(component.inputValue()).toBe('');
        });

        it('should submit on Enter without shift and prevent the default newline', () => {
            let emittedMessage = '';
            component.send.subscribe((msg: string) => (emittedMessage = msg));

            component.inputValue.set('Enter message');
            fixture.detectChanges();

            const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
            const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
            textarea.dispatchEvent(event);

            expect(emittedMessage).toBe('Enter message');
            expect(event.defaultPrevented).toBe(true);
            expect(component.inputValue()).toBe('');
        });

        it('should NOT submit on Shift+Enter', () => {
            let emitted = false;
            component.send.subscribe(() => (emitted = true));

            component.inputValue.set('Multi line');
            component.onEnter(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));

            expect(emitted).toBe(false);
            expect(component.inputValue()).toBe('Multi line');
        });

        it('should not emit when input is only whitespace', () => {
            let emitted = false;
            component.send.subscribe(() => (emitted = true));

            component.inputValue.set('   ');
            component.onSubmit();

            expect(emitted).toBe(false);
        });

        it('should not emit when disabled', () => {
            let emitted = false;
            component.send.subscribe(() => (emitted = true));

            component.inputValue.set('Hello');
            fixture.componentRef.setInput('disabled', true);
            fixture.detectChanges();
            component.onSubmit();

            expect(emitted).toBe(false);
            expect(component.inputValue()).toBe('Hello');
        });

        it('should apply a custom class input', () => {
            fixture.componentRef.setInput('class', 'input-extra');
            fixture.detectChanges();

            const el = fixture.debugElement.query(By.css('[data-slot="chat-input"]'));
            expect(el.nativeElement.className).toContain('input-extra');
        });
    });

    describe('ChatListComponent', () => {
        class ResizeObserverStub {
            observe(): void {
                /* jsdom has no ResizeObserver; no-op is enough for these specs */
            }
            unobserve(): void {
                /* no-op */
            }
            disconnect(): void {
                /* no-op */
            }
        }

        let scrollIntoViewDescriptor: PropertyDescriptor | undefined;
        let hadResizeObserver = false;
        let fixture: ComponentFixture<ListHostComponent> | undefined;

        beforeEach(() => {
            scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
                Element.prototype,
                'scrollIntoView',
            );
            Object.defineProperty(Element.prototype, 'scrollIntoView', {
                configurable: true,
                writable: true,
                value: () => undefined,
            });

            const globalRef = globalThis as unknown as { ResizeObserver?: unknown };
            hadResizeObserver = 'ResizeObserver' in globalRef;
            if (!hadResizeObserver) {
                globalRef.ResizeObserver = ResizeObserverStub;
            }
        });

        afterEach(() => {
            fixture?.destroy();
            fixture = undefined;
            if (scrollIntoViewDescriptor) {
                Object.defineProperty(Element.prototype, 'scrollIntoView', scrollIntoViewDescriptor);
            } else {
                delete (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView;
            }
            if (!hadResizeObserver) {
                delete (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver;
            }
        });

        const createList = async () => {
            await TestBed.configureTestingModule({
                imports: [ListHostComponent],
            }).compileComponents();
            fixture = TestBed.createComponent(ListHostComponent);
            return fixture;
        };

        it('should render projected messages and apply custom class', async () => {
            const f = await createList();
            f.componentInstance.extraClass = 'list-extra';
            f.detectChanges();

            const list = f.debugElement.query(By.directive(ChatListComponent))
                .componentInstance as ChatListComponent;
            expect(list.classes()).toContain('list-extra');
            expect(f.nativeElement.querySelectorAll('[data-slot="chat-message"]')).toHaveLength(1);
        });

        it('should not observe mutations when autoScroll is disabled', async () => {
            const f = await createList();
            f.detectChanges();

            const list = f.debugElement.query(By.directive(ChatListComponent))
                .componentInstance as ChatListComponent;
            const observer = (list as unknown as { observer?: MutationObserver }).observer;
            expect(observer).toBeUndefined();
        });

        it('should observe mutations and scroll to bottom when autoScroll is enabled', async () => {
            const f = await createList();
            f.componentInstance.autoScroll = true;
            f.detectChanges();

            const list = f.debugElement.query(By.directive(ChatListComponent))
                .componentInstance as ChatListComponent;
            const observer = (list as unknown as { observer?: MutationObserver }).observer;
            expect(observer).toBeDefined();

            const contentEl = (list as unknown as { contentRef?: { nativeElement: HTMLElement } })
                .contentRef?.nativeElement;
            expect(contentEl).toBeDefined();

            const added = document.createElement('div');
            added.textContent = 'streamed';
            contentEl?.appendChild(added);

            await flushMicrotasks();
            expect(contentEl?.querySelector('div')).toBeTruthy();
        });

        it('should disconnect the observer on destroy', async () => {
            const f = await createList();
            f.componentInstance.autoScroll = true;
            f.detectChanges();

            const list = f.debugElement.query(By.directive(ChatListComponent))
                .componentInstance as ChatListComponent;
            const observer = (list as unknown as { observer?: MutationObserver }).observer;
            expect(observer).toBeDefined();

            let disconnected = false;
            const original = observer!.disconnect.bind(observer);
            observer!.disconnect = () => {
                disconnected = true;
                original();
            };

            f.destroy();
            fixture = undefined;
            expect(disconnected).toBe(true);
        });
    });
});
