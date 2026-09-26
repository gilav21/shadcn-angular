import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BannerComponent, type BannerVariant } from './banner.component';

/** Host that projects arbitrary content, exercising the projection override (T-4). */
@Component({
    template: `
        <ui-banner [variant]="variant()" [message]="message()">
            <span data-testid="projected">Trial ends in 3 days.</span>
        </ui-banner>
    `,
    imports: [BannerComponent],
})
class ProjectedHostComponent {
    readonly variant = signal<BannerVariant>('info');
    readonly message = signal('input message');
}

describe('BannerComponent', () => {
    let fixture: ComponentFixture<BannerComponent>;
    let host: HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BannerComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(BannerComponent);
        host = fixture.nativeElement as HTMLElement;
        fixture.componentRef.setInput('message', 'Scheduled maintenance at 02:00 UTC.');
        fixture.detectChanges();
    });

    // T-1 — UC-1
    describe('T-1: renders message and spans container', () => {
        it('renders the message text', () => {
            const message = host.querySelector('[data-slot="banner-message"]');
            expect(message?.textContent?.trim()).toBe('Scheduled maintenance at 02:00 UTC.');
        });

        it('exposes a data-slot hook', () => {
            expect(host.dataset['slot']).toBe('banner');
        });
    });

    // T-2 — UC-2
    describe('T-2: applies variant classes for each of the four variants', () => {
        const variants: readonly BannerVariant[] = ['info', 'warning', 'destructive', 'success'];

        it('paints each variant with its own background token', () => {
            const expected: Record<BannerVariant, string> = {
                info: 'bg-muted',
                warning: 'bg-amber-500/10',
                success: 'bg-green-500/10',
                destructive: 'bg-destructive/10',
            };
            for (const variant of variants) {
                fixture.componentRef.setInput('variant', variant);
                fixture.detectChanges();
                const backgrounds = host.className.split(/\s+/).filter(c => c.startsWith('bg-'));
                expect(backgrounds, variant).toEqual([expected[variant]]);
            }
        });

        it('merges the class input onto the host', () => {
            fixture.componentRef.setInput('class', 'custom-banner-class');
            fixture.detectChanges();
            expect(host.className).toContain('custom-banner-class');
        });
    });

    // T-3 — UC-3
    describe('T-3: dismiss button removes banner and emits dismissed', () => {
        it('renders no dismiss button unless dismissible', () => {
            expect(host.querySelector('[data-slot="banner-dismiss"]')).toBeNull();
        });

        it('removes the banner content and emits dismissed on click', () => {
            fixture.componentRef.setInput('dismissible', true);
            fixture.detectChanges();

            const spy = vi.fn();
            fixture.componentInstance.dismissed.subscribe(spy);

            const button = host.querySelector<HTMLButtonElement>('[data-slot="banner-dismiss"] button');
            expect(button).not.toBeNull();
            button?.click();
            fixture.detectChanges();

            expect(spy).toHaveBeenCalledTimes(1);
            expect(host.querySelector('[data-slot="banner-message"]')).toBeNull();
            expect(fixture.componentInstance.visible()).toBe(false);
        });

        it('stops being a live region once dismissed', () => {
            fixture.componentRef.setInput('dismissible', true);
            fixture.detectChanges();
            host.querySelector<HTMLButtonElement>('[data-slot="banner-dismiss"] button')?.click();
            fixture.detectChanges();

            expect(host.getAttribute('role')).toBeNull();
            expect(host.getAttribute('aria-live')).toBeNull();
        });

        it('is idempotent — a second dismiss emits nothing', () => {
            fixture.componentRef.setInput('dismissible', true);
            fixture.detectChanges();

            const spy = vi.fn();
            fixture.componentInstance.dismissed.subscribe(spy);
            fixture.componentInstance.dismiss();
            fixture.componentInstance.dismiss();

            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('gives the dismiss control a localised accessible name', () => {
            fixture.componentRef.setInput('dismissible', true);
            fixture.detectChanges();
            const label = (): string | null | undefined =>
                host.querySelector<HTMLButtonElement>('[data-slot="banner-dismiss"] button')?.getAttribute('aria-label');
            expect(label()).toBe('Close');

            fixture.componentRef.setInput('locale', 'he');
            fixture.detectChanges();
            expect(label()).toBe('סגור');
        });
    });

    // T-5 — UC-5
    describe('T-5: has correct role/aria-live per variant and does not take focus', () => {
        it('announces politely via role="status" for info', () => {
            expect(host.getAttribute('role')).toBe('status');
            expect(host.getAttribute('aria-live')).toBe('polite');
        });

        it('announces politely for warning and success', () => {
            for (const variant of ['warning', 'success'] as const) {
                fixture.componentRef.setInput('variant', variant);
                fixture.detectChanges();
                expect(host.getAttribute('role')).toBe('status');
                expect(host.getAttribute('aria-live')).toBe('polite');
            }
        });

        it('escalates to role="alert" only for destructive', () => {
            fixture.componentRef.setInput('variant', 'destructive');
            fixture.detectChanges();
            expect(host.getAttribute('role')).toBe('alert');
            expect(host.getAttribute('aria-live')).toBe('assertive');
        });

        it('never steals focus when rendered', () => {
            fixture.componentRef.setInput('dismissible', true);
            fixture.detectChanges();
            expect(document.activeElement).not.toBe(host);
            expect(host.contains(document.activeElement)).toBe(false);
            expect(host.hasAttribute('tabindex')).toBe(false);
        });
    });

    // Edge cases — 2.2
    describe('edge cases', () => {
        it('renders nothing meaningful for an empty message with no projection', () => {
            fixture.componentRef.setInput('message', '');
            fixture.detectChanges();
            expect(host.querySelector('[data-slot="banner-message"]')?.textContent?.trim()).toBe('');
        });

    });
});

/** Host using the bare-attribute form the docs advertise. */
@Component({
    template: `<ui-banner message="Scheduled maintenance." dismissible />`,
    imports: [BannerComponent],
})
class BareAttributeHostComponent {}

describe('BannerComponent bare-attribute inputs', () => {
    it('treats a valueless `dismissible` attribute as true', async () => {
        await TestBed.configureTestingModule({
            imports: [BareAttributeHostComponent],
        }).compileComponents();

        const fixture = TestBed.createComponent(BareAttributeHostComponent);
        fixture.detectChanges();

        const banner = fixture.nativeElement as HTMLElement;
        expect(banner.querySelector('[data-slot="banner-dismiss"] button')).not.toBeNull();
    });
});

// T-4 — UC-4
describe('BannerComponent projection (T-4)', () => {
    it('renders projected content instead of the message input', async () => {
        await TestBed.configureTestingModule({
            imports: [ProjectedHostComponent],
        }).compileComponents();

        const fixture = TestBed.createComponent(ProjectedHostComponent);
        fixture.detectChanges();

        const banner = fixture.debugElement.query(By.directive(BannerComponent)).nativeElement as HTMLElement;
        expect(banner.querySelector('[data-testid="projected"]')).not.toBeNull();
        expect(banner.textContent).toContain('Trial ends in 3 days.');
        expect(banner.textContent).not.toContain('input message');
    });
});
