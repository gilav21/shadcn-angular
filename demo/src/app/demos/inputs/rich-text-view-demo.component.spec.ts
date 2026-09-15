import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RichTextViewDemoComponent } from './rich-text-view-demo.component';

describe('RichTextViewDemoComponent', () => {
    beforeEach(() => TestBed.configureTestingModule({ imports: [RichTextViewDemoComponent] }));

    it('renders the policy pair: the tracker loads unrestricted and is blocked under a policy', () => {
        // The demo's whole claim is the side-by-side difference. Asserting the
        // section exists would pass even if both halves rendered identically,
        // which is the one way the demo can be wrong while still compiling.
        const fixture = TestBed.createComponent(RichTextViewDemoComponent);
        fixture.detectChanges();

        const views = Array.from(
            (fixture.nativeElement as HTMLElement).querySelectorAll('ui-rich-text-view'),
        ) as HTMLElement[];

        const withTracker = views.filter((v) =>
            v.querySelector('img[src*="pixel.tracker.example"]'),
        );
        const withBlocked = views.filter((v) =>
            v.querySelector('img[data-blocked-src*="pixel.tracker.example"]'),
        );

        expect(withTracker).toHaveLength(1);
        expect(withBlocked).toHaveLength(1);

        // The allowlisted host loads in BOTH halves -- a policy that blocked
        // everything would satisfy the assertions above.
        const logo = withBlocked[0].querySelector(
            'img[src="https://cdn.trusted.com/logo.png"]',
        );
        expect(logo).not.toBeNull();
    });
});
