import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { HeroBlockComponent } from '@/blocks/hero';

/** Harness for the `hero` block — records which CTA fired. */
@Component({
    selector: 'app-hero-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [HeroBlockComponent],
    template: `
        <main class="p-8">
            <ui-hero-block
                data-testid="root"
                (primaryClick)="clicks.set('primary')"
                (secondaryClick)="clicks.set('secondary')" />
            <p data-testid="clicked">{{ clicks() }}</p>

            <ui-hero-block
                data-testid="custom"
                headline="Custom headline"
                primaryCta="Buy now"
                secondaryCta="Read docs"
                eyebrow="" />
        </main>
    `,
})
export class HeroDemoComponent {
    protected readonly clicks = signal('none');
}
