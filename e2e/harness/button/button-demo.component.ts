import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonComponent } from '@/components/ui/button';

@Component({
    selector: 'app-button-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent],
    template: `
        <main class="p-8 space-y-4">
            <ui-button data-testid="primary" (click)="bump()">Click me</ui-button>
            <p data-testid="count">{{ count() }}</p>
        </main>
    `,
})
export class ButtonDemoComponent {
    protected readonly count = signal(0);
    protected bump(): void {
        this.count.update(n => n + 1);
    }
}
