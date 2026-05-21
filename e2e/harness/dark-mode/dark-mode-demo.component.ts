import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonComponent } from '@/components/ui/button';

/**
 * Toggle the `.dark` class on the harness root and assert the
 * `--background` / `--foreground` CSS variables resolve to different
 * values than in the light state. Catches regressions where the
 * dark-mode rule was removed or where a component used a hard-coded
 * color instead of `var(--foreground)`.
 */
@Component({
    selector: 'app-dark-mode-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent],
    template: `
        <main [class.dark]="dark()" data-testid="root" class="bg-background text-foreground p-8 space-y-4">
            <ui-button data-testid="toggle" (click)="toggle()">
                Toggle dark mode
            </ui-button>
            <p data-testid="state">{{ dark() ? 'dark' : 'light' }}</p>
        </main>
    `,
})
export class DarkModeDemoComponent {
    protected readonly dark = signal(false);
    protected toggle(): void {
        this.dark.update(v => !v);
    }
}
