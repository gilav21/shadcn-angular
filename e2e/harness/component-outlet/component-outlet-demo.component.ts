import { ChangeDetectionStrategy, Component, Type, input, signal } from '@angular/core';
import { UiComponentOutletDirective } from '@/components/ui/component-outlet.directive';

@Component({
    selector: 'app-red-tile',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<div data-testid="red">Red: {{ label() }}</div>`,
})
export class RedTileComponent {
    readonly label = input('none');
}

@Component({
    selector: 'app-blue-tile',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<div data-testid="blue">Blue</div>`,
})
export class BlueTileComponent {}

/** Harness for the `component-outlet` directive (dynamic component host). */
@Component({
    selector: 'app-component-outlet-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [UiComponentOutletDirective],
    template: `
        <main class="p-8">
            <div data-testid="root">
                <ng-container [uiComponentOutlet]="current()" [inputs]="{ label: 'from outlet' }" />
            </div>
            <button type="button" data-testid="swap" (click)="swap()">Swap</button>
        </main>
    `,
})
export class ComponentOutletDemoComponent {
    readonly current = signal<Type<unknown>>(RedTileComponent);

    swap(): void {
        this.current.set(BlueTileComponent);
    }
}
