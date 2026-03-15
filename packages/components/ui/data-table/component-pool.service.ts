import { Injectable, ComponentRef, Type, OnDestroy } from '@angular/core';

@Injectable()
export class ComponentPoolService implements OnDestroy {
    private readonly pool = new Map<Type<unknown>, ComponentRef<unknown>[]>();
    private readonly maxPoolSize = 50;

    acquire<T>(componentType: Type<T>): ComponentRef<T> | null {
        const instances = this.pool.get(componentType);
        if (instances && instances.length > 0) {
            return instances.pop() as ComponentRef<T>;
        }
        return null;
    }

    release(componentType: Type<unknown>, ref: ComponentRef<unknown>): void {
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

    clear(): void {
        this.pool.forEach(instances => {
            for (const ref of instances) {
                ref.destroy();
            }
        });
        this.pool.clear();
    }

    ngOnDestroy(): void {
        this.clear();
    }
}
