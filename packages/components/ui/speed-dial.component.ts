import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    inject,
    ElementRef,
    OnDestroy,
    OnInit,
    booleanAttribute,
    Directive,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn } from '../lib/utils';

export type SpeedDialType = 'linear' | 'circle' | 'semi-circle' | 'quarter-circle';
export type SpeedDialDirection =
    | 'up'
    | 'down'
    | 'left'
    | 'right'
    | 'up-left'
    | 'up-right'
    | 'down-left'
    | 'down-right';

/**
 * SpeedDial - A floating action button with a popup menu of action items
 *
 * Usage:
 * <ui-speed-dial type="linear" direction="up">
 *   <ui-speed-dial-trigger>
 *     <ui-button size="icon" class="rounded-full">+</ui-button>
 *   </ui-speed-dial-trigger>
 *   <ui-speed-dial-menu>
 *     <ui-speed-dial-item>
 *       <ui-button size="icon" uiTooltip="Edit">✏️</ui-button>
 *     </ui-speed-dial-item>
 *     <ui-speed-dial-item>
 *       <ui-button size="icon" uiTooltip="Delete">🗑️</ui-button>
 *     </ui-speed-dial-item>
 *   </ui-speed-dial-menu>
 * </ui-speed-dial>
 */
@Component({
    selector: 'ui-speed-dial',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'hostClasses()',
        '[attr.data-slot]': '"speed-dial"',
        '[attr.data-state]': 'open() ? "open" : "closed"',
    },
})
export class SpeedDialComponent implements OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly document = inject(DOCUMENT);

    type = input<SpeedDialType>('linear');
    direction = input<SpeedDialDirection>('up');
    radius = input(80);
    transitionDelay = input(80);
    disabled = input(false, { transform: booleanAttribute });

    open = signal(false);
    contextPosition = signal<{ x: number; y: number } | null>(null);
    isRepositioning = signal(false);

    visibleChange = output<boolean>();
    onShow = output<void>();
    onHide = output<void>();

    hostClasses = computed(() =>
        cn(
            'inline-flex',
            this.contextPosition() && 'relative'
        )
    );

    private readonly clickListener = (event: MouseEvent) => {
        if (!this.el.nativeElement.contains(event.target)) {
            this.hide();
        }
    };

    constructor() {
        this.document.addEventListener('click', this.clickListener);
    }

    ngOnDestroy() {
        this.document.removeEventListener('click', this.clickListener);
    }

    toggle() {
        if (this.disabled()) return;
        if (this.open()) {
            this.hide();
        } else {
            this.show();
        }
    }

    show() {
        if (this.disabled()) return;
        this.contextPosition.set(null);
        this.open.set(true);
        this.visibleChange.emit(true);
        this.onShow.emit();
    }

    showAt(x: number, y: number) {
        if (this.disabled()) return;

        this.open.set(false);
        this.isRepositioning.set(true);
        this.contextPosition.set({ x, y });
        setTimeout(() => {
            this.isRepositioning.set(false);
            this.open.set(true);
            this.visibleChange.emit(true);
            this.onShow.emit();
        }, 0);
    }

    hide() {
        this.open.set(false);
        this.visibleChange.emit(false);
        this.onHide.emit();
    }
}

@Component({
    selector: 'ui-speed-dial-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
      (click)="onClick($event)"
      [class]="classes()"
      [attr.aria-label]="ariaLabel()"
      [attr.data-slot]="'speed-dial-trigger'"
      [attr.data-state]="speedDial?.open() ? 'open' : 'closed'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class SpeedDialTriggerComponent {
    readonly speedDial = inject(SpeedDialComponent, { optional: true });
    class = input('');
    ariaLabel = input('Toggle speed dial');

    classes = computed(() =>
        cn(
            'inline-flex transition-transform duration-200',
            this.speedDial?.open() && 'rotate-45',
            this.class()
        )
    );

    onClick(event: MouseEvent) {
        event.stopPropagation();
        this.speedDial?.toggle();
    }
}

/**
 * SpeedDialContextTrigger - Shows the speed dial at mouse position on right-click
 *
 * Usage:
 * <ui-speed-dial type="quarter-circle" direction="down-right">
 *   <ui-speed-dial-context-trigger class="w-full h-48 border rounded">
 *     Right-click anywhere here
 *   </ui-speed-dial-context-trigger>
 *   <ui-speed-dial-menu>
 *     <ui-speed-dial-item>...</ui-speed-dial-item>
 *   </ui-speed-dial-menu>
 * </ui-speed-dial>
 */
@Component({
    selector: 'ui-speed-dial-context-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'hostClasses()',
        '(contextmenu)': 'onContextMenu($event)',
        '(click)': 'onClick($event)',
        '[attr.data-slot]': '"speed-dial-context-trigger"',
    },
})
export class SpeedDialContextTriggerComponent {
    readonly speedDial = inject(SpeedDialComponent, { optional: true });
    class = input('');

    hostClasses = computed(() =>
        cn(
            'relative block',
            this.class()
        )
    );

    onContextMenu(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();

        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        this.speedDial?.showAt(x, y);
    }

    onClick(event: MouseEvent) {
        if (this.speedDial?.open()) {
            this.speedDial.hide();
        }
    }
}

/**
 * SpeedDialContextTriggerDirective - Directive version for use on any element
 *
 * Usage:
 * <ui-speed-dial #contextMenu type="quarter-circle" direction="down-right">
 *   <ui-speed-dial-menu>
 *     <ui-speed-dial-item>...</ui-speed-dial-item>
 *   </ui-speed-dial-menu>
 * </ui-speed-dial>
 *
 * <div [uiSpeedDialContextTrigger]="contextMenu">
 *   Right-click anywhere here
 * </div>
 */
@Directive({
    selector: '[uiSpeedDialContextTrigger]',
    host: {
        '(contextmenu)': 'onContextMenu($event)',
        '(click)': 'onClick($event)',
    },
})
export class SpeedDialContextTriggerDirective {
    uiSpeedDialContextTrigger = input.required<SpeedDialComponent>();

    onContextMenu(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();

        const speedDial = this.uiSpeedDialContextTrigger();
        if (!speedDial) return;

        speedDial.showAt(event.clientX, event.clientY);
    }

    onClick(event: MouseEvent) {
        const speedDial = this.uiSpeedDialContextTrigger();
        if (speedDial?.open()) {
            speedDial.hide();
        }
    }
}

@Component({
    selector: 'ui-speed-dial-menu',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
      <div 
        [class]="classes()" 
        [style]="positionStyle()" 
        [attr.data-slot]="'speed-dial-menu'" 
        [attr.data-state]="speedDial?.open() ? 'open' : 'closed'"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-hidden]="!speedDial?.open()"
      >
        <ng-content />
      </div>
  `,
    host: { class: 'contents' },
})
export class SpeedDialMenuComponent {
    readonly speedDial = inject(SpeedDialComponent, { optional: true });
    class = input('');
    ariaLabel = input<string | undefined>(undefined);

    private readonly registeredItems: SpeedDialItemComponent[] = [];

    registerItem(item: SpeedDialItemComponent) {
        this.registeredItems.push(item);
        this.updateItemIndices();
    }

    unregisterItem(item: SpeedDialItemComponent) {
        const index = this.registeredItems.indexOf(item);
        if (index > -1) {
            this.registeredItems.splice(index, 1);
            this.updateItemIndices();
        }
    }

    private updateItemIndices() {
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
    protected readonly speedDial = inject(SpeedDialComponent, { optional: true });
    private readonly menu = inject(SpeedDialMenuComponent, { optional: true });
    class = input('');

    itemIndex = signal(0);
    totalItems = signal(1);

    ngOnInit() {
        this.menu?.registerItem(this);
    }

    ngOnDestroy() {
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
        const type = this.speedDial?.type() ?? 'linear';
        const direction = this.speedDial?.direction() ?? 'up';
        const radius = this.speedDial?.radius() ?? 80;
        const contextPos = this.speedDial?.contextPosition();
        const transitionDelay = contextPos ? 30 : (this.speedDial?.transitionDelay() ?? 80);
        const idx = this.itemIndex();
        const totalItems = this.totalItems();
        const isOpen = this.speedDial?.open();

        // Calculate reverse index for closing animation (last item closes first)
        const closeIdx = totalItems - 1 - idx;
        const delay = isOpen ? idx * transitionDelay : closeIdx * transitionDelay;

        // Spring easing for open, smooth ease-out for close
        const easing = isOpen
            ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' // Spring/bounce effect
            : 'cubic-bezier(0.4, 0, 0.2, 1)';     // Smooth ease-out

        const duration = isOpen ? '300ms' : '200ms';

        if (type === 'linear') {
            return {
                'transition': this.speedDial?.isRepositioning() ? 'none' : `all ${duration} ${easing}`,
                'transition-delay': this.speedDial?.isRepositioning() ? '0ms' : `${delay}ms`,
            };
        }

        const pos = this.calculateCircularPosition(type, direction, radius, idx, totalItems);

        // When closed, items animate from/to center. When open, at calculated position.
        const transform = isOpen
            ? `translate(${pos.x}px, ${pos.y}px)`
            : 'translate(0px, 0px)';

        if (this.speedDial?.isRepositioning()) {
            return {
                'transform': transform,
                'transition': 'none',
                'transition-delay': '0ms',
                'left': '50%',
                'top': '50%',
                'margin-left': '-1.125rem',
                'margin-top': '-1.125rem',
            };
        }

        return {
            'transform': transform,
            'transition': `transform ${duration} ${easing}, opacity ${duration} ${easing}, scale ${duration} ${easing}`,
            'transition-delay': `${delay}ms`,
            'left': '50%',
            'top': '50%',
            'margin-left': '-1.125rem',
            'margin-top': '-1.125rem',
        };
    });

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

@Component({
    selector: 'ui-speed-dial-mask',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (speedDial?.open()) {
      <div
        [class]="classes()"
        (click)="onClick()"
        [attr.data-slot]="'speed-dial-mask'"
      ></div>
    }
  `,
    host: { class: 'contents' },
})
export class SpeedDialMaskComponent {
    readonly speedDial = inject(SpeedDialComponent, { optional: true });
    class = input('');

    classes = computed(() =>
        cn(
            'fixed inset-0 z-40 bg-background/80 backdrop-blur-sm',
            'animate-in fade-in-0',
            this.class()
        )
    );

    onClick() {
        this.speedDial?.hide();
    }
}
