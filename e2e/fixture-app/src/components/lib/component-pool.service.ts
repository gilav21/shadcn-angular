import { Injectable, ComponentRef, Type, OnDestroy } from '@angular/core';

@Injectable()
export class ComponentPoolService implements OnDestroy {
    private readonly pool = new Map<Type<unknown>, ComponentRef<unknown>[]>();
    private readonly maxPoolSize = 200;

    private _recycleCount = 0;
    private _createCount = 0;

    get recycleCount(): number { return this._recycleCount; }
    get createCount(): number { return this._createCount; }

    acquire<T>(componentType: Type<T>): ComponentRef<T> | null {
        const instances = this.pool.get(componentType);
        if (!instances) return null;
        while (instances.length > 0) {
            const ref = instances.pop() as ComponentRef<T>;
            if (!ref.hostView.destroyed) {
                this._recycleCount++;
                return ref;
            }
        }
        return null;
    }

    trackCreation(): void {
        this._createCount++;
    }

    release(componentType: Type<unknown>, ref: ComponentRef<unknown>): void {
        if (ref.hostView.destroyed) return;
        let instances = this.pool.get(componentType);
        if (!instances) {
            instances = [];
            this.pool.set(componentType, instances);
        }
        if (instances.length < this.maxPoolSize) {
            instances.push(ref);
        } else {
            ref.destroy();
        }
    }

    get poolSize(): number {
        let total = 0;
        this.pool.forEach(instances => { total += instances.length; });
        return total;
    }

    clear(): void {
        this.pool.forEach(instances => {
            for (const ref of instances) {
                if (!ref.hostView.destroyed) {
                    ref.destroy();
                }
            }
        });
        this.pool.clear();
    }

    ngOnDestroy(): void {
        this.clear();
    }
}
