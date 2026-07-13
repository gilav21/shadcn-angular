import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MorphingTextComponent } from '@/components/ui/morphing-text';

/** Harness for the `morphing-text` component. */
@Component({
    selector: 'app-morphing-text-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MorphingTextComponent],
    template: `
        <main class="p-8">
            <ui-morphing-text
                data-testid="root"
                class="block text-3xl"
                [texts]="texts"
                [interval]="300"
            />
        </main>
    `,
})
export class MorphingTextDemoComponent {
    readonly texts = ['Alpha', 'Beta'];
}
