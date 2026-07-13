import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ScrollAreaComponent } from '@/components/ui/scroll-area';

/** Harness for the `scroll-area` component. */
@Component({
    selector: 'app-scroll-area-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ScrollAreaComponent],
    template: `
        <main class="p-8">
            <div data-testid="root" class="h-48 w-72 rounded-md border">
                <ui-scroll-area class="h-48">
                    @for (row of rows; track row) {
                        <div class="h-10 px-3 leading-10" [attr.data-row]="row">Row {{ row }}</div>
                    }
                </ui-scroll-area>
            </div>
        </main>
    `,
})
export class ScrollAreaDemoComponent {
    readonly rows = Array.from({ length: 30 }, (_, i) => i);
}
