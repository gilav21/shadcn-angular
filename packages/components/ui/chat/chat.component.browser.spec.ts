import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { ChatMessageComponent } from './index';

/**
 * Browser-only: row alignment per role is layout, so it is asserted on the
 * rendered rects, which jsdom cannot produce.
 */
@Component({
    imports: [ChatMessageComponent],
    template: `
        <div style="width: 600px">
            <ui-chat-message data-testid="user" role="user" content="Can you summarise the report?" />
            <ui-chat-message data-testid="assistant" role="assistant" avatarFallback="AI" content="Revenue grew 12%." />
            <ui-chat-message data-testid="system" role="system" content="Conversation archived" />
        </div>
    `,
})
class RolesHostComponent {}

const rectsOf = (root: HTMLElement, role: string) => {
    const message = root.querySelector(`[data-testid="${role}"]`)!;
    return {
        row: message.querySelector('[data-slot="chat-message"]')!.getBoundingClientRect(),
        bubble: message.querySelector('[data-slot="chat-bubble"]')!.getBoundingClientRect(),
        avatar: message.querySelector('ui-avatar')?.getBoundingClientRect(),
    };
};

describe('ChatMessageComponent layout (browser)', () => {
    it('aligns user messages to the end with the avatar after the bubble, assistant to the start, system centred', async () => {
        await TestBed.configureTestingModule({ imports: [RolesHostComponent] }).compileComponents();
        const fixture = TestBed.createComponent(RolesHostComponent);
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;

        const user = rectsOf(root, 'user');
        expect(user.avatar!.right).toBeCloseTo(user.row.right, 0);
        expect(user.avatar!.left).toBeGreaterThan(user.bubble.right);

        const assistant = rectsOf(root, 'assistant');
        expect(assistant.avatar!.left).toBeCloseTo(assistant.row.left, 0);
        expect(assistant.bubble.left).toBeGreaterThan(assistant.avatar!.right);

        const system = rectsOf(root, 'system');
        expect(system.avatar).toBeUndefined();
        expect((system.bubble.left + system.bubble.right) / 2).toBeCloseTo((system.row.left + system.row.right) / 2, 0);
        expect(system.bubble.width).toBeLessThan(system.row.width - 100);
    });
});
