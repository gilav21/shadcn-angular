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
    booleanAttribute,
    InjectionToken,
    forwardRef,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn } from '../../lib/utils';

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

export const SPEED_DIAL = new InjectionToken<SpeedDialComponent>('SPEED_DIAL');

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
    providers: [{ provide: SPEED_DIAL, useExisting: forwardRef(() => SpeedDialComponent) }],
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

        const container = this.el.nativeElement.closest('[uiSpeedDialContextTrigger]') as HTMLElement | null
            ?? this.el.nativeElement.parentElement;

        if (container) {
            const clamped = this.clampToContainer(x, y, container);
            x = clamped.x;
            y = clamped.y;
        }

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

    private clampToContainer(x: number, y: number, container: HTMLElement): { x: number; y: number } {
        const r = this.radius() + 24;
        const type = this.type();
        const containerRect = container.getBoundingClientRect();
        const vw = globalThis.innerWidth;
        const vh = globalThis.innerHeight;

        const absX = containerRect.left + x;
        const absY = containerRect.top + y;

        let clampedAbsX = absX;
        let clampedAbsY = absY;

        if (type === 'circle' || type === 'semi-circle' || type === 'quarter-circle') {
            clampedAbsX = Math.max(r + 8, Math.min(clampedAbsX, vw - r - 8));
            clampedAbsY = Math.max(r + 8, Math.min(clampedAbsY, vh - r - 8));
        } else {
            const dir = this.direction();
            if (dir.includes('right')) clampedAbsX = Math.min(clampedAbsX, vw - r - 8);
            if (dir.includes('left')) clampedAbsX = Math.max(clampedAbsX, r + 8);
            if (dir.includes('down')) clampedAbsY = Math.min(clampedAbsY, vh - r - 8);
            if (dir.includes('up')) clampedAbsY = Math.max(clampedAbsY, r + 8);
        }

        return {
            x: x + (clampedAbsX - absX),
            y: y + (clampedAbsY - absY),
        };
    }

    hide() {
        this.open.set(false);
        this.visibleChange.emit(false);
        this.onHide.emit();
    }
}
