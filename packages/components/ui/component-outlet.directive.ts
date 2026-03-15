import {
    Directive,
    ViewContainerRef,
    input,
    output,
    inject,
    OnInit,
    OnChanges,
    OnDestroy,
    SimpleChanges,
    ComponentRef
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ComponentPoolService } from './data-table/component-pool.service';

@Directive({
    selector: '[uiComponentOutlet]',
    standalone: true
})
export class UiComponentOutletDirective implements OnInit, OnChanges, OnDestroy {
    readonly component = input.required<any>({ alias: 'uiComponentOutlet' });
    readonly inputs = input<Record<string, any>>({});
    readonly outputs = input<Record<string, (event: any) => void>>({});
    readonly recycle = input(false);
    readonly initialized = output<ComponentRef<any>>();

    private componentRef: ComponentRef<any> | null = null;
    private subscriptions: Subscription[] = [];
    private readonly viewContainerRef = inject(ViewContainerRef);
    private readonly pool = inject(ComponentPoolService, { optional: true });

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
        if (this.recycle() && this.pool && this.componentRef) {
            if (this.detachFromContainer(this.componentRef)) {
                this.pool.release(this.component(), this.componentRef);
            }
            this.componentRef = null;
        }
    }

    private renderComponent() {
        if (this.componentRef) {
            if (this.recycle() && this.pool) {
                if (this.detachFromContainer(this.componentRef)) {
                    this.pool.release(this.component(), this.componentRef);
                }
            }
            this.componentRef = null;
        }
        this.viewContainerRef.clear();

        const componentType = this.component();
        if (!componentType) return;

        if (this.recycle() && this.pool) {
            const recycled = this.pool.acquire(componentType);
            if (recycled) {
                this.viewContainerRef.insert(recycled.hostView);
                this.componentRef = recycled;
                this.updateInputs();
                this.subscribeToOutputs();
                recycled.changeDetectorRef.reattach();
                recycled.changeDetectorRef.detectChanges();
                this.initialized.emit(this.componentRef);
                return;
            }
        }

        this.componentRef = this.viewContainerRef.createComponent(componentType);
        if (this.recycle() && this.pool) {
            this.pool.trackCreation();
        }
        this.updateInputs();
        this.subscribeToOutputs();
        this.initialized.emit(this.componentRef);
    }

    private updateInputs() {
        if (!this.componentRef) return;

        const inputsObj = this.inputs();
        for (const key of Object.keys(inputsObj)) {
            this.componentRef.setInput(key, inputsObj[key]);
        }
    }

    private subscribeToOutputs() {
        if (!this.componentRef) return;

        this.unsubscribeAll();

        const outputsObj = this.outputs();
        for (const outputName of Object.keys(outputsObj)) {
            const handler = outputsObj[outputName];

            try {
                const outputEmitter = this.componentRef.instance[outputName];

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
        }
    }

    private detachFromContainer(ref: ComponentRef<unknown>): boolean {
        const idx = this.viewContainerRef.indexOf(ref.hostView);
        if (idx >= 0) {
            this.viewContainerRef.detach(idx);
            return true;
        }
        return false;
    }

    private unsubscribeAll() {
        for (const sub of this.subscriptions) {
            sub.unsubscribe();
        }
        this.subscriptions = [];
    }
}
