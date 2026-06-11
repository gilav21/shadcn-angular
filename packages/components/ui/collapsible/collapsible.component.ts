import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    effect,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
    selector: 'ui-collapsible',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-state]': 'open() ? "open" : "closed"',
        '[attr.data-slot]': '"collapsible"',
    },
})
export class CollapsibleComponent {
    disabled = input(false);
    defaultOpen = input(false);
    class = input('');
    openChange = output<boolean>();

    open = signal(false);

    constructor() {
        effect(() => {
            if (this.defaultOpen()) {
                this.open.set(true);
            }
        }, { allowSignalWrites: true });
    }

    classes = computed(() =>
        cn(this.class())
    );

    toggle(): void {
        if (!this.disabled()) {
            const newState = !this.open();
            this.open.set(newState);
            this.openChange.emit(newState);
        }
    }

    show(): void {
        if (!this.disabled()) {
            this.open.set(true);
            this.openChange.emit(true);
        }
    }

    hide(): void {
        this.open.set(false);
        this.openChange.emit(false);
    }
}
