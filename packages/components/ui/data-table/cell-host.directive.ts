import {
    Directive,
    ViewContainerRef,
    input,
    OnInit,
    OnChanges,
    OnDestroy,
    SimpleChanges,
    ComponentRef
} from '@angular/core';
import { Subscription } from 'rxjs';

@Directive({
    selector: '[uiCellHost]',
    standalone: true
})
export class CellHostDirective implements OnInit, OnChanges, OnDestroy {
    uiCellHost = input.required<any>();
    inputs = input<Record<string, any>>({});
    outputs = input<Record<string, (event: any) => void>>({});

    private componentRef: ComponentRef<any> | null = null;
    private subscriptions: Subscription[] = [];

    constructor(private viewContainerRef: ViewContainerRef) { }

    ngOnInit() {
        this.renderComponent();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['inputs'] && !changes['inputs'].firstChange) {
            this.updateInputs();
        }
        if (changes['outputs'] && !changes['outputs'].firstChange) {
            this.subscribeToOutputs();
        }
    }

    ngOnDestroy() {
        this.unsubscribeAll();
    }

    private renderComponent() {
        this.viewContainerRef.clear();

        const componentType = this.uiCellHost();
        if (!componentType) return;

        this.componentRef = this.viewContainerRef.createComponent(componentType);
        this.updateInputs();
        this.subscribeToOutputs();
    }

    private updateInputs() {
        if (!this.componentRef) return;

        const inputsObj = this.inputs();
        Object.keys(inputsObj).forEach(key => {
            this.componentRef!.setInput(key, inputsObj[key]);
        });
    }

    private subscribeToOutputs() {
        if (!this.componentRef) return;

        // Unsubscribe from previous subscriptions
        this.unsubscribeAll();

        const outputsObj = this.outputs();
        Object.keys(outputsObj).forEach(outputName => {
            const handler = outputsObj[outputName];
            const outputEmitter = this.componentRef!.instance[outputName];

            if (outputEmitter && typeof outputEmitter.subscribe === 'function') {
                const subscription = outputEmitter.subscribe((event: any) => {
                    handler(event);
                });
                this.subscriptions.push(subscription);
            }
        });
    }

    private unsubscribeAll() {
        this.subscriptions.forEach(sub => sub.unsubscribe());
        this.subscriptions = [];
    }
}
