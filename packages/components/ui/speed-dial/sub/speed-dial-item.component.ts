import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    inject,
    OnDestroy,
    OnInit,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SPEED_DIAL, SpeedDialType, SpeedDialDirection } from '../speed-dial.component';
import { SPEED_DIAL_MENU } from './speed-dial-menu.component';

@Component({
    selector: 'ui-speed-dial-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div
      [class]="classes()"
      [style]="positionStyle()"
      [attr.data-slot]="'speed-dial-item'"
      [attr.data-state]="speedDial?.open() ? 'open' : 'closed'"
    >
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class SpeedDialItemComponent implements OnInit, OnDestroy {
    protected readonly speedDial = inject(SPEED_DIAL, { optional: true });
    private readonly menu = inject(SPEED_DIAL_MENU, { optional: true });
    /**
     * Extra classes for the item wrapper, merged after the state classes — so it
     * can override the closed/open `opacity-0 scale-0` / `opacity-100 scale-100`
     * pair or the `absolute` positioning the circular layouts apply. Note the
     * inline `transform`, `transition` and `left`/`top` are set as styles and
     * cannot be overridden from here.
     */
    class = input('');

    itemIndex = signal(0);
    totalItems = signal(1);

    ngOnInit(): void {
        this.menu?.registerItem(this);
    }

    ngOnDestroy(): void {
        this.menu?.unregisterItem(this);
    }

    classes = computed(() => {
        const type = this.speedDial?.type() ?? 'linear';
        const isCircular = type !== 'linear';
        const isOpen = this.speedDial?.open();

        return cn(
            isCircular && 'absolute',
            isOpen
                ? 'opacity-100 scale-100'
                : 'opacity-0 scale-0',
            this.class()
        );
    });

    positionStyle = computed(() => {
        const params = this.resolvePositionParams();
        if (params.type === 'linear') {
            return this.buildLinearStyle(params.duration, params.easing, params.delay);
        }
        return this.buildCircularStyle(params);
    });

    private resolvePositionParams(): {
        type: SpeedDialType; direction: SpeedDialDirection; radius: number;
        idx: number; totalItems: number; isOpen: boolean | undefined;
        duration: string; easing: string; delay: number;
    } {
        const type = this.speedDial?.type() ?? 'linear';
        const direction = this.speedDial?.direction() ?? 'up';
        const radius = this.speedDial?.radius() ?? 80;
        const contextPos = this.speedDial?.contextPosition();
        const transitionDelay = contextPos ? 30 : (this.speedDial?.transitionDelay() ?? 80);
        const idx = this.itemIndex();
        const totalItems = this.totalItems();
        const isOpen = this.speedDial?.open();
        const closeIdx = totalItems - 1 - idx;
        const delay = isOpen ? idx * transitionDelay : closeIdx * transitionDelay;
        const easing = isOpen ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' : 'cubic-bezier(0.4, 0, 0.2, 1)';
        const duration = isOpen ? '300ms' : '200ms';
        return { type, direction, radius, idx, totalItems, isOpen, duration, easing, delay };
    }

    private buildLinearStyle(duration: string, easing: string, delay: number): Record<string, string> {
        const repositioning = this.speedDial?.isRepositioning();
        return {
            'transition': repositioning ? 'none' : `all ${duration} ${easing}`,
            'transition-delay': repositioning ? '0ms' : `${delay}ms`,
        };
    }

    private buildCircularStyle(opts: {
        type: SpeedDialType; direction: SpeedDialDirection; radius: number;
        idx: number; totalItems: number; isOpen: boolean | undefined;
        duration: string; easing: string; delay: number;
    }): Record<string, string> {
        const { type, direction, radius, idx, totalItems, isOpen, duration, easing, delay } = opts;
        const pos = this.calculateCircularPosition(type, direction, radius, idx, totalItems);
        const transform = isOpen ? `translate(${pos.x}px, ${pos.y}px)` : 'translate(0px, 0px)';
        const baseCircular = { 'left': '50%', 'top': '50%', 'margin-left': '-1.125rem', 'margin-top': '-1.125rem' };

        if (this.speedDial?.isRepositioning()) {
            return { 'transform': transform, 'transition': 'none', 'transition-delay': '0ms', ...baseCircular };
        }

        return {
            'transform': transform,
            'transition': `transform ${duration} ${easing}, opacity ${duration} ${easing}, scale ${duration} ${easing}`,
            'transition-delay': `${delay}ms`,
            ...baseCircular,
        };
    }

    private resolveAngles(type: SpeedDialType, direction: SpeedDialDirection): { start: number; end: number } {
        if (type === 'semi-circle') {
            return this.resolveSemiCircleAngles(direction);
        }
        if (type === 'quarter-circle') {
            return this.resolveQuarterCircleAngles(direction);
        }
        return { start: 0, end: 360 };
    }

    private resolveSemiCircleAngles(direction: SpeedDialDirection): { start: number; end: number } {
        switch (direction) {
            case 'up': return { start: -180, end: 0 };
            case 'down': return { start: 0, end: 180 };
            case 'left': return { start: 90, end: 270 };
            case 'right': return { start: -90, end: 90 };
            default: return { start: 180, end: 360 };
        }
    }

    private resolveQuarterCircleAngles(direction: SpeedDialDirection): { start: number; end: number } {
        switch (direction) {
            case 'up-right': return { start: 270, end: 360 };
            case 'up-left': return { start: 180, end: 270 };
            case 'down-right': return { start: 0, end: 90 };
            case 'down-left': return { start: 90, end: 180 };
            default: return { start: 270, end: 360 };
        }
    }

    private calculateCircularPosition(
        type: SpeedDialType,
        direction: SpeedDialDirection,
        radius: number,
        index: number,
        totalItems: number
    ): { x: number; y: number } {
        const angles = this.resolveAngles(type, direction);
        const startAngle = angles.start;
        const endAngle = angles.end;

        const angleRange = endAngle - startAngle;
        const itemCount = type === 'circle' ? totalItems : Math.max(totalItems - 1, 1);
        const angleStep = angleRange / itemCount;
        const angle = startAngle + index * angleStep;
        const radians = (angle * Math.PI) / 180;

        return {
            x: Math.cos(radians) * radius,
            y: Math.sin(radians) * radius,
        };
    }
}
