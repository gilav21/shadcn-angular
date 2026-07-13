import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MarqueeComponent } from '@/components/ui/marquee';

/** Harness for the `marquee` component. */
@Component({
    selector: 'app-marquee-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MarqueeComponent],
    template: `
        <main class="w-[600px] p-8">
            <ui-marquee data-testid="root" class="block" [speed]="5">
                @for (item of items; track item) {
                    <span class="px-4" [attr.data-item]="item">{{ item }}</span>
                }
            </ui-marquee>
        </main>
    `,
})
export class MarqueeDemoComponent {
    readonly items = ['One', 'Two', 'Three', 'Four'];
}
