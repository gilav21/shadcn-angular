import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { ChatMessageComponent } from './index';
import { AvatarComponent } from '../avatar';
import chatTemplate from './chat.component.html?raw';

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
        <div dir="rtl" style="width: 600px">
            <ui-chat-message data-testid="user-rtl" role="user" content="אפשר סיכום של הדוח?" />
            <ui-chat-message data-testid="assistant-rtl" role="assistant" avatarFallback="AI" content="ההכנסות גדלו ב-12%." />
        </div>
    `,
})
class RolesHostComponent {}

const rectsOf = (root: HTMLElement, testId: string) => {
    const message = root.querySelector(`[data-testid="${testId}"]`)!;
    return {
        row: message.querySelector('[data-slot="chat-message"]')!.getBoundingClientRect(),
        bubble: message.querySelector('[data-slot="chat-bubble"]')!.getBoundingClientRect(),
        avatar: message.querySelector('[data-slot="avatar"]')?.getBoundingClientRect(),
    };
};

async function renderRoles(): Promise<HTMLElement> {
    await TestBed.configureTestingModule({ imports: [RolesHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(RolesHostComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
}

/** The avatar sits after the bubble in reading order: right of it in LTR, left of it in RTL. */
function expectAvatarAfterBubble(root: HTMLElement): void {
    const user = rectsOf(root, 'user');
    expect(user.avatar!.right).toBeCloseTo(user.row.right, 0);
    expect(user.avatar!.left).toBeGreaterThan(user.bubble.right);

    const userRtl = rectsOf(root, 'user-rtl');
    expect(userRtl.avatar!.left).toBeCloseTo(userRtl.row.left, 0);
    expect(userRtl.avatar!.right).toBeLessThan(userRtl.bubble.left);
}

describe('ChatMessageComponent layout (browser)', () => {
    it('aligns user messages to the end with the avatar after the bubble, assistant to the start, system centred', async () => {
        const root = await renderRoles();

        expectAvatarAfterBubble(root);

        const assistant = rectsOf(root, 'assistant');
        expect(assistant.avatar!.left).toBeCloseTo(assistant.row.left, 0);
        expect(assistant.bubble.left).toBeGreaterThan(assistant.avatar!.right);

        const assistantRtl = rectsOf(root, 'assistant-rtl');
        expect(assistantRtl.avatar!.right).toBeCloseTo(assistantRtl.row.right, 0);
        expect(assistantRtl.bubble.right).toBeLessThan(assistantRtl.avatar!.left);

        const system = rectsOf(root, 'system');
        expect(system.avatar).toBeUndefined();
        expect((system.bubble.left + system.bubble.right) / 2).toBeCloseTo((system.row.left + system.row.right) / 2, 0);
        expect(system.bubble.width).toBeLessThan(system.row.width - 100);
    });

    it('keeps the avatar after the bubble when the avatar is installed under another tag', async () => {
        // A CLI `--prefix acme` install renames the avatar's selector and its tag
        // in the chat template. Only the row's direct-child avatar matters to
        // `order-last`, so that is the one tag renamed here.
        TestBed.overrideComponent(AvatarComponent, { set: { selector: 'acme-avatar' } });
        TestBed.overrideComponent(ChatMessageComponent, {
            set: { templateUrl: undefined, template: chatTemplate.replaceAll(/(<\/?)ui-avatar(?=[\s/>])/g, '$1acme-avatar') },
        });
        const root = await renderRoles();

        expect(root.querySelector('[data-testid="user"] [data-slot="avatar"]')!.localName).toBe('acme-avatar');
        expectAvatarAfterBubble(root);
    });
});
