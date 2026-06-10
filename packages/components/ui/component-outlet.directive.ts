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
    ComponentRef,
    Renderer2,
    ElementRef,
    ApplicationRef,
    createComponent,
    EnvironmentInjector,
    Injector
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
    private currentComponentType: any = null;
    private subscriptions: Subscription[] = [];
    private managedExternally = false;
    private readonly viewContainerRef = inject(ViewContainerRef);
    private readonly pool = inject(ComponentPoolService, { optional: true });
    private readonly renderer = inject(Renderer2);
    private readonly elementRef = inject(ElementRef);
    private readonly appRef = inject(ApplicationRef);
    private readonly envInjector = inject(EnvironmentInjector);
    private readonly injector = inject(Injector);

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
        if (this.recycle() && this.pool && this.componentRef && this.managedExternally) {
            this.removeFromDom(this.componentRef);
            this.appRef.detachView(this.componentRef.hostView);
            this.pool.release(this.currentComponentType, this.componentRef);
            this.componentRef = null;
            this.currentComponentType = null;
            return;
        }
        if (this.componentRef && this.managedExternally) {
            this.removeFromDom(this.componentRef);
            this.appRef.detachView(this.componentRef.hostView);
            this.componentRef.destroy();
            this.componentRef = null;
        }
    }

    private renderComponent() {
        if (this.componentRef) {
            if (this.recycle() && this.pool && this.managedExternally) {
                this.removeFromDom(this.componentRef);
                this.appRef.detachView(this.componentRef.hostView);
                this.pool.release(this.currentComponentType, this.componentRef);
            } else if (this.managedExternally) {
                this.removeFromDom(this.componentRef);
                this.appRef.detachView(this.componentRef.hostView);
                this.componentRef.destroy();
            }
            this.componentRef = null;
            this.currentComponentType = null;
            this.managedExternally = false;
        }
        this.viewContainerRef.clear();

        const componentType = this.component();
        if (!componentType) return;

        if (this.recycle() && this.pool) {
            const recycled = this.pool.acquire(componentType);
            if (recycled) {
                this.appRef.attachView(recycled.hostView);
                this.appendToDom(recycled);
                this.componentRef = recycled;
                this.currentComponentType = componentType;
                this.managedExternally = true;
                this.updateInputs();
                this.subscribeToOutputs();
                recycled.changeDetectorRef.detectChanges();
                this.initialized.emit(this.componentRef);
                return;
            }

            const ref = createComponent(componentType, {
                environmentInjector: this.envInjector,
                elementInjector: this.injector,
            });
            this.appRef.attachView(ref.hostView);
            this.appendToDom(ref);
            this.componentRef = ref;
            this.currentComponentType = componentType;
            this.managedExternally = true;
            this.pool.trackCreation();
            this.updateInputs();
            this.subscribeToOutputs();
            ref.changeDetectorRef.detectChanges();
            this.initialized.emit(this.componentRef);
            return;
        }

        this.componentRef = this.viewContainerRef.createComponent(componentType);
        this.currentComponentType = componentType;
        this.managedExternally = false;
        this.updateInputs();
        this.subscribeToOutputs();
        this.initialized.emit(this.componentRef);
    }

    private appendToDom(ref: ComponentRef<unknown>): void {
        const hostEl = this.elementRef.nativeElement;
        const compEl = ref.location.nativeElement;
        this.renderer.appendChild(hostEl, compEl);
    }

    private removeFromDom(ref: ComponentRef<unknown>): void {
        const compEl = ref.location.nativeElement;
        if (compEl.parentNode) {
            this.renderer.removeChild(compEl.parentNode, compEl);
        }
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

    private unsubscribeAll() {
        for (const sub of this.subscriptions) {
            sub.unsubscribe();
        }
        this.subscriptions = [];
    }
}
