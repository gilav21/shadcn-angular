/**
 * T-17 — axe clean for all four layout primitives.
 *
 * This is a DECLARED SUBSTITUTE for the Storybook axe pass, which cannot assert
 * anything from inside a git worktree: its jest `testMatch` is built from an
 * absolute `rootDir`, and the backslashes in `…\.claude\worktrees\…` are eaten
 * as glob escapes, so it matches zero of the repo's story files while reporting
 * thousands checked. See `packages/components/lib/testing/axe.ts` for the full
 * write-up. The assertion itself is the same `axe-core` that `axe-playwright`
 * wraps, at its DEFAULT ruleset — nothing disabled, no `runOnly` — scoped to the
 * component root the way the runner scopes to `#storybook-root`.
 *
 * Each component is audited in its meaningful configurations: populated, empty,
 * and RTL.
 */
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { findAxeViolations } from '../../lib/testing/axe';
import { BadgeComponent } from '../badge';
import { ButtonComponent } from '../button';
import { DataListComponent, DataListItemComponent } from '../data-list';
import { MasonryComponent } from '../masonry';
import { PageHeaderComponent } from '../page-header';
import { BannerComponent } from './banner.component';

@Component({
    template: `
        <div [attr.dir]="dir()">
            @if (populated()) {
                <ui-banner variant="warning" message="Scheduled maintenance at 02:00 UTC." dismissible />
                <ui-banner variant="destructive" message="Billing failed — update your card." />
                <ui-banner variant="info">
                    Trial ends in 3 days. <ui-button size="sm" label="Upgrade" />
                </ui-banner>

                <ui-page-header title="Invoices" description="Everything billed this quarter.">
                    <ui-button variant="outline" label="Export" />
                    <ui-button label="New invoice" />
                </ui-page-header>

                <ui-data-list orientation="horizontal" [items]="items">
                    <ui-data-list-item label="Owner">
                        <ui-badge label="Ada Lovelace" />
                    </ui-data-list-item>
                </ui-data-list>

                <ui-masonry [columns]="3">
                    @for (card of cards; track card.id) {
                        <div class="rounded-lg border p-4" [style.height.px]="card.height">
                            Card {{ card.id }}
                        </div>
                    }
                </ui-masonry>
            } @else {
                <ui-banner variant="info" />
                <ui-page-header />
                <ui-data-list />
                <ui-masonry />
            }
        </div>
    `,
    imports: [
        BannerComponent,
        PageHeaderComponent,
        DataListComponent,
        DataListItemComponent,
        MasonryComponent,
        ButtonComponent,
        BadgeComponent,
    ],
})
class AxeHostComponent {
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
    readonly populated = signal(true);

    readonly items = [
        { label: 'Status', value: 'Active' },
        { label: 'Plan', value: 'Enterprise' },
    ];

    readonly cards = [
        { id: 1, height: 120 },
        { id: 2, height: 60 },
        { id: 3, height: 200 },
    ];
}

describe('T-17: layout primitives are axe clean', () => {
    let cleanup: (() => void) | null = null;

    afterEach(() => {
        cleanup?.();
        cleanup = null;
    });

    /**
     * Mounts the host into the real document (axe needs real layout and computed
     * colour) and returns its root element.
     */
    async function mount(options: { dir?: 'ltr' | 'rtl'; populated?: boolean } = {}) {
        await TestBed.configureTestingModule({ imports: [AxeHostComponent] }).compileComponents();

        const fixture = TestBed.createComponent(AxeHostComponent);
        fixture.componentInstance.dir.set(options.dir ?? 'ltr');
        fixture.componentInstance.populated.set(options.populated ?? true);

        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        await fixture.whenStable();

        cleanup = () => {
            fixture.destroy();
            fixture.nativeElement.remove();
        };

        return fixture.nativeElement as HTMLElement;
    }

    it('reports no violations for the populated components', async () => {
        const root = await mount();
        await expect(findAxeViolations(root)).resolves.toEqual([]);
    });

    it('reports no violations when every component is empty', async () => {
        const root = await mount({ populated: false });
        await expect(findAxeViolations(root)).resolves.toEqual([]);
    });

    it('reports no violations in RTL', async () => {
        const root = await mount({ dir: 'rtl' });
        await expect(findAxeViolations(root)).resolves.toEqual([]);
    });

    it('reports no violations after the banner has been dismissed', async () => {
        const root = await mount();
        root.querySelector<HTMLButtonElement>('[data-slot="banner-dismiss"] button')?.click();
        await expect(findAxeViolations(root)).resolves.toEqual([]);
    });

    // Positive control: proves the harness can actually FAIL. Without it, a green
    // run is indistinguishable from an audit that never looked at anything —
    // which is exactly the failure mode of the Storybook runner this replaces.
    it('detects a real violation, so a green result means something', async () => {
        const root = await mount();

        const broken = document.createElement('img');
        broken.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
        root.appendChild(broken);

        const violations = await findAxeViolations(root);
        expect(violations.map((violation) => violation.id)).toContain('image-alt');
    });
});
