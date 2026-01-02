import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    inject,
} from '@angular/core';
import { cn } from '../lib/utils';

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
        if (this.defaultOpen()) {
            this.open.set(true);
        }
    }

    classes = computed(() =>
        cn(this.class())
    );

    toggle() {
        if (!this.disabled()) {
            const newState = !this.open();
            this.open.set(newState);
            this.openChange.emit(newState);
        }
    }

    show() {
        if (!this.disabled()) {
            this.open.set(true);
            this.openChange.emit(true);
        }
    }

    hide() {
        this.open.set(false);
        this.openChange.emit(false);
    }
}

@Component({
    selector: 'ui-collapsible-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
      (click)="onClick()"
      [attr.data-state]="collapsible?.open() ? 'open' : 'closed'"
      [attr.data-slot]="'collapsible-trigger'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class CollapsibleTriggerComponent {
    collapsible = inject(CollapsibleComponent, { optional: true });

    onClick() {
        this.collapsible?.toggle();
    }
}

@Component({
    selector: 'ui-collapsible-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (collapsible?.open()) {
      <div
        [class]="classes()"
        [attr.data-state]="collapsible?.open() ? 'open' : 'closed'"
        [attr.data-slot]="'collapsible-content'"
      >
        <ng-content />
      </div>
    }
  `,
    host: { class: 'contents' },
})
export class CollapsibleContentComponent {
    collapsible = inject(CollapsibleComponent, { optional: true });
    class = input('');

    classes = computed(() =>
        cn('overflow-hidden', this.class())
    );
}
