import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { PaginationComponent } from '@/components/ui/pagination';

@Component({
    selector: 'app-pagination-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PaginationComponent],
    template: `
        <main class="p-8">
            <ui-pagination
                [currentPage]="page()"
                [totalPages]="5"
                (pageChange)="page.set($event)"
            />
            <p data-testid="page">{{ page() }}</p>
        </main>
    `,
})
export class PaginationDemoComponent {
    protected readonly page = signal(1);
}
