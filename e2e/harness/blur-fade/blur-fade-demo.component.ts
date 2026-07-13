import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BlurFadeComponent } from '@/components/ui/blur-fade';

/** Harness for the `blur-fade` component (animates its projected content in). */
@Component({
    selector: 'app-blur-fade-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BlurFadeComponent],
    template: `
        <main class="p-8">
            <ui-blur-fade data-testid="root" class="block" [duration]="50">
                <h1>Faded in</h1>
            </ui-blur-fade>
        </main>
    `,
})
export class BlurFadeDemoComponent {}
