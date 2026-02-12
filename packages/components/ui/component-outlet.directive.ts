import {
    Directive,
    ViewContainerRef,
    input,
    output,
    OnInit,
    OnChanges,
    OnDestroy,
    SimpleChanges,
    ComponentRef
} from '@angular/core';
import { Subscription } from 'rxjs';

@Directive({
    selector: '[uiComponentOutlet]',
    standalone: true
})
export class UiComponentOutletDirective implements OnInit, OnChanges, OnDestroy {
    component = input.required<any>({ alias: 'uiComponentOutlet' });
    inputs = input<Record<string, any>>({});
    outputs = input<Record<string, (event: any) => void>>({});
    initialized = output<ComponentRef<any>>();

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
        if (changes['component'] && !changes['component'].firstChange) {
            this.renderComponent();
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

        const componentType = this.component();
        if (!componentType) return;

        this.componentRef = this.viewContainerRef.createComponent(componentType);
        this.updateInputs();
        this.subscribeToOutputs();
        this.initialized.emit(this.componentRef);
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

        this.unsubscribeAll();

        const outputsObj = this.outputs();
        Object.keys(outputsObj).forEach(outputName => {
            const handler = outputsObj[outputName];

            try {
                const outputEmitter = this.componentRef!.instance[outputName];

                if (outputEmitter && typeof outputEmitter.subscribe === 'function') {
                    const subscription = outputEmitter.subscribe((event: any) => {
                        try {
                            handler(event);
                        } catch (err) {
                            console.error(`Error in output handler for '${outputName}':`, err);
                        }
                    });
                    this.subscriptions.push(subscription);
                } else if (outputEmitter !== undefined) {
                    console.warn(`Output '${outputName}' exists but is not subscribable`);
                }
            } catch (err) {
                console.error(`Failed to subscribe to output '${outputName}':`, err);
            }
        });
    }

    private unsubscribeAll() {
        this.subscriptions.forEach(sub => sub.unsubscribe());
        this.subscriptions = [];
    }
}
