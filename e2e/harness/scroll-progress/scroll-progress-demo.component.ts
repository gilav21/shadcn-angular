import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ScrollProgressComponent } from '@/components/ui/scroll-progress';

/** Harness for the `scroll-progress` component (a page-level progress bar). */
@Component({
    selector: 'app-scroll-progress-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ScrollProgressComponent],
    template: `
        <main>
            <ui-scroll-progress data-testid="root" [height]="6" />
            <div class="h-[4000px] p-8">Long page</div>
        </main>
    `,
})
export class ScrollProgressDemoComponent {}
