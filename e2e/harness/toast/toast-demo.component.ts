import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService, ToasterComponent } from '@/components/ui/toast';

@Component({
    selector: 'app-toast-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ToasterComponent],
    template: `
        <main class="p-8 space-y-4">
            <ui-toaster />
            <button type="button" data-testid="fire" (click)="fire()"
                class="border px-3 py-1">
                Show toast
            </button>
        </main>
    `,
})
export class ToastDemoComponent {
    private readonly svc = inject(ToastService);
    protected fire(): void {
        this.svc.toast({
            title: 'Saved',
            description: 'Your changes have been saved.',
            duration: 60_000, // long enough that the spec sees it
        });
    }
}
