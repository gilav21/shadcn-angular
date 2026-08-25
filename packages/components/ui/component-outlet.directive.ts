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
    Injector,
    Type
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ComponentPoolService } from '../lib/component-pool.service';

@Directive({
    selector: '[uiComponentOutlet]',
    standalone: true
})
export class UiComponentOutletDirective implements OnInit, OnChanges, OnDestroy {
    /** The component class to render. Bound through the `uiComponentOutlet` alias. */
    readonly component = input.required<Type<unknown>>({ alias: 'uiComponentOutlet' });
    /** Inputs to set on the rendered component, keyed by input name. */
    readonly inputs = input<Record<string, unknown>>({});
    /** Handlers for the rendered component's outputs, keyed by output name. */
    readonly outputs = input<Record<string, OutputHandler>>({});
    /** Reuse the existing instance when the class has not changed, instead of destroying and recreating it. */
    readonly recycle = input(false);
    /** Emits the `ComponentRef` once the component has been created. */
    readonly initialized = output<ComponentRef<unknown>>();

    private componentRef: ComponentRef<unknown> | null = null;
    private currentComponentType: Type<unknown> | null = null;
    private subscriptions: Subscription[] = [];
    private managedExternally = false;
    private readonly viewContainerRef = inject(ViewContainerRef);
    private readonly pool = inject(ComponentPoolService, { optional: true });
    private readonly renderer = inject(Renderer2);
    private readonly elementRef = inject(ElementRef);
    private readonly appRef = inject(ApplicationRef);
    private readonly envInjector = inject(EnvironmentInjector);
    private readonly injector = inject(Injector);

    ngOnInit(): void {
        this.renderComponent();
    }

    ngOnChanges(changes: SimpleChanges): void {
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

    ngOnDestroy(): void {
        this.unsubscribeAll();
        if (this.recycle() && this.pool && this.componentRef && this.managedExternally && this.currentComponentType) {
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

    private renderComponent(): void {
        this.teardownExisting();
        this.viewContainerRef.clear();

        const componentType = this.component();
        if (!componentType) return;

        if (this.recycle() && this.pool) {
            this.renderRecycled(componentType, this.pool);
            return;
        }

        this.componentRef = this.viewContainerRef.createComponent(componentType);
        this.currentComponentType = componentType;
        this.managedExternally = false;
        this.updateInputs();
        this.subscribeToOutputs();
        this.initialized.emit(this.componentRef);
    }

    private teardownExisting(): void {
        if (!this.componentRef) return;
        if (this.recycle() && this.pool && this.managedExternally && this.currentComponentType) {
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

    private renderRecycled(componentType: Type<unknown>, pool: ComponentPoolService): void {
        const recycled = pool.acquire(componentType);
        if (recycled) {
            this.appRef.attachView(recycled.hostView);
            this.appendToDom(recycled);
            this.componentRef = recycled;
        } else {
            const ref = createComponent(componentType, {
                environmentInjector: this.envInjector,
                elementInjector: this.injector,
            });
            this.appRef.attachView(ref.hostView);
            this.appendToDom(ref);
            this.componentRef = ref;
            pool.trackCreation();
        }
        this.currentComponentType = componentType;
        this.managedExternally = true;
        this.updateInputs();
        this.subscribeToOutputs();
        this.componentRef.changeDetectorRef.detectChanges();
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

    private updateInputs(): void {
        if (!this.componentRef) return;

        const inputsObj = this.inputs();
        for (const key of Object.keys(inputsObj)) {
            this.componentRef.setInput(key, inputsObj[key]);
        }
    }

    private subscribeToOutputs(): void {
        if (!this.componentRef) return;

        this.unsubscribeAll();

        const instance = this.componentRef.instance as Record<string, unknown>;
        const outputsObj = this.outputs();
        for (const outputName of Object.keys(outputsObj)) {
            const handler = outputsObj[outputName];

            try {
                const outputEmitter = instance[outputName];

                if (isSubscribable(outputEmitter)) {
                    const invoke = handler as (event: unknown) => void;
                    const subscription = outputEmitter.subscribe((event: unknown) => {
                        try {
                            invoke(event);
                        } catch (err) {
                            console.error(`Error in output handler for '${outputName}':`, err);
                        }
                    });
                    this.subscriptions.push(subscription);
                }
            } catch (err) {
                console.error(`Failed to subscribe to output '${outputName}':`, err);
            }
        }
    }

    private unsubscribeAll(): void {
        for (const sub of this.subscriptions) {
            sub.unsubscribe();
        }
        this.subscriptions = [];
    }
}

/**
 * A handler for a projected component's output. The `never` parameter
 * makes any single-argument callback assignable (e.g.
 * `(value: string) => void`), letting consumers type the event to match
 * the specific output they're wiring up.
 */
type OutputHandler = (event: never) => void;

interface Subscribable {
    subscribe(next: (event: unknown) => void): Subscription;
}

function isSubscribable(value: unknown): value is Subscribable {
    return (
        value !== null &&
        value !== undefined &&
        typeof (value as { subscribe?: unknown }).subscribe === 'function'
    );
}
