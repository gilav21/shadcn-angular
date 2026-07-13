import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
    InjectionToken,
    forwardRef,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SPEED_DIAL } from '../speed-dial.component';
import { SpeedDialItemComponent } from './speed-dial-item.component';

export const SPEED_DIAL_MENU = new InjectionToken<SpeedDialMenuComponent>('SPEED_DIAL_MENU');

@Component({
    selector: 'ui-speed-dial-menu',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: SPEED_DIAL_MENU, useExisting: forwardRef(() => SpeedDialMenuComponent) }],
    template: `
      <div
        role="group"
        [class]="classes()"
        [style]="positionStyle()"
        [attr.data-slot]="'speed-dial-menu'"
        [attr.data-state]="speedDial?.open() ? 'open' : 'closed'"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-hidden]="!speedDial?.open()"
        [attr.inert]="speedDial?.open() ? null : ''"
      >
        <ng-content />
      </div>
  `,
    host: { class: 'contents' },
})
export class SpeedDialMenuComponent {
    readonly speedDial = inject(SPEED_DIAL, { optional: true });
    class = input('');
    ariaLabel = input<string | undefined>(undefined);

    private readonly registeredItems: SpeedDialItemComponent[] = [];

    registerItem(item: SpeedDialItemComponent): void {
        this.registeredItems.push(item);
        this.updateItemIndices();
    }

    unregisterItem(item: SpeedDialItemComponent): void {
        const index = this.registeredItems.indexOf(item);
        if (index > -1) {
            this.registeredItems.splice(index, 1);
            this.updateItemIndices();
        }
    }

    private updateItemIndices(): void {
        const total = this.registeredItems.length;
        this.registeredItems.forEach((item, index) => {
            item.itemIndex.set(index);
            item.totalItems.set(total);
        });
    }

    positionStyle = computed(() => {
        const contextPos = this.speedDial?.contextPosition();
        if (contextPos) {
            return {
                left: `${contextPos.x}px`,
                top: `${contextPos.y}px`,
            };
        }
        return {};
    });

    classes = computed(() => {
        const type = this.speedDial?.type() ?? 'linear';
        const direction = this.speedDial?.direction() ?? 'up';
        const contextPos = this.speedDial?.contextPosition();
        const isOpen = this.speedDial?.open();

        // When closed, disable pointer events so hidden items don't block clicks
        const pointerClass = isOpen ? '' : 'pointer-events-none';

        if (contextPos) {
            const contextTransforms: Record<string, string> = {
                up: '-translate-x-1/2 -translate-y-full mt-[-8px]',
                down: '-translate-x-1/2 mt-2',
                left: '-translate-x-full -translate-y-1/2 mr-2',
                right: '-translate-y-1/2 ml-2',
            };

            const directionClasses: Record<string, string> = {
                up: 'flex flex-col-reverse gap-2',
                down: 'flex flex-col gap-2',
                left: 'flex flex-row-reverse gap-2',
                right: 'flex flex-row gap-2',
            };

            const layoutClass = type === 'linear'
                ? cn(directionClasses[direction], contextTransforms[direction])
                : '';

            return cn('fixed z-50', pointerClass, layoutClass, this.class());
        }
        if (type === 'linear') {
            const directionClasses: Record<string, string> = {
                up: 'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-col-reverse gap-2',
                down: 'absolute top-full left-1/2 -translate-x-1/2 mt-2 flex flex-col gap-2',
                left: 'absolute right-full top-1/2 -translate-y-1/2 mr-2 flex flex-row-reverse gap-2',
                right: 'absolute left-full top-1/2 -translate-y-1/2 ml-2 flex flex-row gap-2',
            };
            return cn(directionClasses[direction] || directionClasses['up'], pointerClass, this.class());
        }

        return cn('absolute inset-0', pointerClass, this.class());
    });
}
