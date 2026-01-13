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
    private el = inject(ElementRef);
    private document = inject(DOCUMENT);

    // Inputs
    type = input<SpeedDialType>('linear');
    direction = input<SpeedDialDirection>('up');
    radius = input(80);
    transitionDelay = input(30);
    disabled = input(false, { transform: booleanAttribute });

    // State
    open = signal(false);

    // Position for context menu mode
    contextPosition = signal<{ x: number; y: number } | null>(null);

    // Outputs
    visibleChange = output<boolean>();
    onShow = output<void>();
    onHide = output<void>();

    // Host classes - add relative positioning only when in context mode
    hostClasses = computed(() =>
        cn(
            'inline-flex',
            this.contextPosition() && 'relative'
        )
    );

    private clickListener = (event: MouseEvent) => {
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
        this.open.set(true);
        this.visibleChange.emit(true);
        this.onShow.emit();
    }

    showAt(x: number, y: number) {
        if (this.disabled()) return;
        this.contextPosition.set({ x, y });
        this.open.set(true);
        this.visibleChange.emit(true);
        this.onShow.emit();
    }

    hide() {
        this.open.set(false);
        this.contextPosition.set(null);
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
    speedDial = inject(SpeedDialComponent, { optional: true });
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
    speedDial = inject(SpeedDialComponent, { optional: true });
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

        // Calculate position relative to the trigger container
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Show the speed dial at click position
        this.speedDial?.showAt(x, y);
    }

    onClick(event: MouseEvent) {
        // Left-click closes the menu if open
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

        // Use viewport coordinates directly for fixed positioning
        speedDial.showAt(event.clientX, event.clientY);
    }

    onClick(event: MouseEvent) {
        const speedDial = this.uiSpeedDialContextTrigger();
        // Left-click closes the menu if open
        if (speedDial?.open()) {
            speedDial.hide();
        }
    }
}

@Component({
    selector: 'ui-speed-dial-menu',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (speedDial?.open()) {
      <div [class]="classes()" [style]="positionStyle()" [attr.data-slot]="'speed-dial-menu'" [attr.aria-label]="ariaLabel()">
        <ng-content />
      </div>
    }
  `,
    host: { class: 'contents' },
})
export class SpeedDialMenuComponent {
    speedDial = inject(SpeedDialComponent, { optional: true });
    class = input('');
    ariaLabel = input<string | undefined>(undefined);

    // Track registered items
    private registeredItems: SpeedDialItemComponent[] = [];

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

        // If context position is set, use fixed positioning at viewport coordinates
        if (contextPos) {
            return cn('fixed z-50', this.class());
        }

        // For linear layout, use flex direction
        if (type === 'linear') {
            const directionClasses: Record<string, string> = {
                up: 'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-col-reverse gap-2',
                down: 'absolute top-full left-1/2 -translate-x-1/2 mt-2 flex flex-col gap-2',
                left: 'absolute right-full top-1/2 -translate-y-1/2 mr-2 flex flex-row-reverse gap-2',
                right: 'absolute left-full top-1/2 -translate-y-1/2 ml-2 flex flex-row gap-2',
            };
            return cn(directionClasses[direction] || directionClasses['up'], this.class());
        }

        // For circular layouts, items are positioned absolutely
        return cn('absolute inset-0', this.class());
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
    >
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class SpeedDialItemComponent implements OnInit, OnDestroy {
    private speedDial = inject(SpeedDialComponent, { optional: true });
    private menu = inject(SpeedDialMenuComponent, { optional: true });
    class = input('');

    // These will be set by the parent menu component
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

        return cn(
            'transition-all duration-200',
            isCircular && 'absolute',
            this.speedDial?.open()
                ? 'opacity-100 scale-100'
                : 'opacity-0 scale-50',
            this.class()
        );
    });

    positionStyle = computed(() => {
        const type = this.speedDial?.type() ?? 'linear';
        const direction = this.speedDial?.direction() ?? 'up';
        const radius = this.speedDial?.radius() ?? 80;
        const transitionDelay = this.speedDial?.transitionDelay() ?? 30;
        const idx = this.itemIndex();

        // Linear layout doesn't need absolute positioning
        if (type === 'linear') {
            return {
                'transition-delay': `${idx * transitionDelay}ms`,
            };
        }

        // Calculate position for circular layouts
        const pos = this.calculateCircularPosition(type, direction, radius, idx, this.totalItems());

        return {
            transform: `translate(${pos.x}px, ${pos.y}px)`,
            'transition-delay': `${idx * transitionDelay}ms`,
            left: '50%',
            top: '50%',
            'margin-left': '-1.125rem', // Half of typical icon button width
            'margin-top': '-1.125rem',
        };
    });

    private calculateCircularPosition(
        type: SpeedDialType,
        direction: SpeedDialDirection,
        radius: number,
        index: number,
        totalItems: number
    ): { x: number; y: number } {
        let startAngle = 0;
        let endAngle = 360;

        switch (type) {
            case 'circle':
                startAngle = 0;
                endAngle = 360;
                break;
            case 'semi-circle':
                switch (direction) {
                    case 'up':
                        startAngle = -180;
                        endAngle = 0;
                        break;
                    case 'down':
                        startAngle = 0;
                        endAngle = 180;
                        break;
                    case 'left':
                        startAngle = 90;
                        endAngle = 270;
                        break;
                    case 'right':
                        startAngle = -90;
                        endAngle = 90;
                        break;
                    default:
                        startAngle = 180;
                        endAngle = 360;
                }
                break;
            case 'quarter-circle':
                switch (direction) {
                    case 'up-right':
                        startAngle = 270;
                        endAngle = 360;
                        break;
                    case 'up-left':
                        startAngle = 180;
                        endAngle = 270;
                        break;
                    case 'down-right':
                        startAngle = 0;
                        endAngle = 90;
                        break;
                    case 'down-left':
                        startAngle = 90;
                        endAngle = 180;
                        break;
                    default:
                        startAngle = 270;
                        endAngle = 360;
                }
                break;
        }

        const angleRange = endAngle - startAngle;
        // For circle, don't overlap start/end. For others, distribute across endpoints
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
    speedDial = inject(SpeedDialComponent, { optional: true });
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
