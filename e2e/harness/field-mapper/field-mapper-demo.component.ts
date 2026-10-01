import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FieldMapperComponent, FieldMapperLinkLabelDirective, type FieldMapperLink } from '@/components/ui/field-mapper';

/**
 * Harness for the `field-mapper` component: two short column lists, wide
 * enough for the side-by-side layout, with the model echoed for assertions.
 */
@Component({
    selector: 'app-field-mapper-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [JsonPipe, FieldMapperComponent, FieldMapperLinkLabelDirective],
    template: `
        <main class="p-8" style="width: 720px">
            <ui-field-mapper
                data-testid="root"
                [start]="start"
                [end]="end"
                [(links)]="links"
                startHeading="Column in orders"
                endHeading="Column in customers"
            >
                <ng-template uiFieldMapperLinkLabel let-link>{{ link.startId }} = {{ link.endId }}</ng-template>
            </ui-field-mapper>
            <pre data-testid="links">{{ links() | json }}</pre>
        </main>
    `,
})
export class FieldMapperDemoComponent {
    readonly start = [
        { id: 'customer_id', label: 'customer_id' },
        { id: 'region', label: 'region' },
    ];
    readonly end = [
        { id: 'segment', label: 'segment' },
        { id: 'id', label: 'id' },
    ];
    readonly links = signal<readonly FieldMapperLink[]>([]);
}
