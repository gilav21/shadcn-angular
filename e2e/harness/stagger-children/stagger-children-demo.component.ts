import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StaggerChildrenComponent } from '@/components/ui/stagger-children';

/** Harness for the `stagger-children` component. */
@Component({
    selector: 'app-stagger-children-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [StaggerChildrenComponent],
    template: `
        <main class="p-8">
            <ui-stagger-children data-testid="root" class="block" [staggerDelay]="10" [duration]="50">
                @for (item of items; track item) {
                    <div class="p-2" [attr.data-item]="item">{{ item }}</div>
                }
            </ui-stagger-children>
        </main>
    `,
})
export class StaggerChildrenDemoComponent {
    readonly items = ['One', 'Two', 'Three'];
}
