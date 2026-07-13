import { ChangeDetectionStrategy, Component } from '@angular/core';
import { VirtualScrollComponent, VirtualItemDirective } from '@/components/ui/virtual-scroll';

interface Row { readonly id: number; readonly label: string; }

/**
 * Harness for the `virtual-scroll` component.
 *
 * `$any(row)` is required: `VirtualItemDirective`'s template context guard
 * cannot infer `T` from the host `ui-virtual-scroll`, so under strict
 * templates `let-row` lands as `unknown`.
 */
@Component({
    selector: 'app-virtual-scroll-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [VirtualScrollComponent, VirtualItemDirective],
    template: `
        <main class="p-8">
            <div data-testid="root" class="h-64 w-80 overflow-hidden rounded-md border">
                <ui-virtual-scroll
                    class="block h-64"
                    [items]="rows"
                    [minItemHeight]="40"
                    [hasMore]="false"
                >
                    <ng-template uiVirtualItem let-row>
                        <div class="h-10 px-3 leading-10" [attr.data-row]="$any(row).id">
                            {{ $any(row).label }}
                        </div>
                    </ng-template>
                </ui-virtual-scroll>
            </div>
        </main>
    `,
})
export class VirtualScrollDemoComponent {
    readonly rows: Row[] = Array.from({ length: 500 }, (_, i) => ({ id: i, label: `Row ${i}` }));
}
