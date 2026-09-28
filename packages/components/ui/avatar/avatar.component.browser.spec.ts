import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { AvatarComponent, AvatarFallbackComponent } from './avatar.component';

/** Browser-only avatar cases: shape and size come from CSS, asserted as computed style and rects. */
@Component({
    template: `
        <div style="display: flex; width: 320px">
            <ui-avatar [class]="avatarClass()">
                <ui-avatar-fallback>JD</ui-avatar-fallback>
            </ui-avatar>
        </div>
    `,
    imports: [AvatarComponent, AvatarFallbackComponent],
})
class FallbackAvatarHostComponent {
    readonly avatarClass = signal('');
}

function render(avatarClass = ''): HTMLElement {
    const fixture = TestBed.createComponent(FallbackAvatarHostComponent);
    fixture.componentInstance.avatarClass.set(avatarClass);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
}

describe('Avatar layout (browser)', () => {
    it('renders a clipped circle that does not shrink in a flex row', () => {
        const avatar = render().querySelector<HTMLElement>('ui-avatar')!;
        const style = getComputedStyle(avatar);
        expect(style.display).toBe('flex');
        expect(style.overflow).toBe('hidden');
        expect(style.flexShrink).toBe('0');
        expect(Number.parseFloat(style.borderTopLeftRadius)).toBeGreaterThanOrEqual(avatar.getBoundingClientRect().width / 2);
    });

    it('sizes the avatar 40px square at density 1', () => {
        const rect = render().querySelector('ui-avatar')!.getBoundingClientRect();
        expect(rect.width).toBe(40);
        expect(rect.height).toBe(40);
    });

    it('lets a size utility override the default size', () => {
        const rect = render('size-12').querySelector('ui-avatar')!.getBoundingClientRect();
        expect(rect.width).toBe(48);
        expect(rect.height).toBe(48);
    });

    it('centres the fallback initials in the disc', () => {
        const disc = render().querySelector<HTMLElement>('[data-slot="avatar-fallback"]')!;
        const range = document.createRange();
        range.selectNodeContents(disc);
        const text = range.getBoundingClientRect();
        const box = disc.getBoundingClientRect();
        expect(disc.textContent?.trim()).toBe('JD');
        // Within a pixel: text boxes land on half-pixel line metrics.
        expect(Math.abs(text.left + text.width / 2 - (box.left + box.width / 2))).toBeLessThanOrEqual(1);
        expect(Math.abs(text.top + text.height / 2 - (box.top + box.height / 2))).toBeLessThanOrEqual(1);
    });
});
