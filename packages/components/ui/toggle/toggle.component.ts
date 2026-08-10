import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    OnInit,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const toggleVariants = cva(
    'inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] whitespace-nowrap',
    {
        variants: {
            variant: {
                default: 'bg-transparent',
                outline:
                    'border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground',
            },
            size: {
                default: '',
                sm: '',
                lg: '',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);

export type ToggleVariant = VariantProps<typeof toggleVariants>['variant'];
export type ToggleSize = VariantProps<typeof toggleVariants>['size'];

@Component({
    selector: 'ui-toggle',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './toggle.component.html',
    styleUrl: './toggle.component.css',
    host: { class: 'contents' },
})
export class ToggleComponent implements OnInit {
    /** `'default'` is a borderless button that only shows a background when pressed or hovered; `'outline'` keeps a visible border at rest. */
    variant = input<ToggleVariant>('default');
    /** Size preset. The variant table carries no utilities for it — the actual dimensions come from the component's density CSS, keyed on this value. */
    size = input<ToggleSize>('default');
    /** Blocks pointer interaction and dims the control. It does not freeze the state: {@link setPressed} still applies while disabled. */
    disabled = input(false);
    /**
     * Initial pressed state, applied once in `ngOnInit`. This is an
     * *uncontrolled* seed — later changes are ignored, and the component owns the
     * state from then on. Use {@link setPressed} to drive it externally.
     */
    defaultPressed = input(false);
    /** Extra classes merged onto the button. The pressed look is driven by `data-[state=on]:*` utilities, so restyle it through that selector. */
    class = input('');
    /** Emitted with the new state on every user toggle (click or tap). Not emitted when the state is changed programmatically via {@link setPressed}. */
    pressedChange = output<boolean>();

    pressed = signal(false);

    ngOnInit(): void {
        // Seed from the bound input — signal inputs hold no value in the
        // constructor, so reading defaultPressed there never pressed the toggle.
        if (this.defaultPressed()) {
            this.pressed.set(true);
        }
    }

    classes = computed(() =>
        cn(
            toggleVariants({ variant: this.variant(), size: this.size() }),
            this.class()
        )
    );

    private touchToggled = false;

    /**
     * Touch handler that toggles immediately on release, avoiding the ~300ms
     * delay before a synthesised click. The default is prevented and a flag set
     * so the click that follows the tap is swallowed by {@link onClick} rather
     * than toggling a second time.
     */
    onTouchEnd(event: TouchEvent): void {
        if (!this.disabled()) {
            event.preventDefault();
            this.touchToggled = true;
            const newState = !this.pressed();
            this.pressed.set(newState);
            this.pressedChange.emit(newState);
        }
    }

    /**
     * Click/keyboard-activation handler. Skips exactly one click after a touch
     * already toggled the control (see {@link onTouchEnd}), so mouse, keyboard
     * and touch all produce a single state change.
     */
    onClick(): void {
        if (this.touchToggled) {
            this.touchToggled = false;
            return;
        }
        if (!this.disabled()) {
            const newState = !this.pressed();
            this.pressed.set(newState);
            this.pressedChange.emit(newState);
        }
    }

    /**
     * Sets the pressed state from outside — the way to drive the toggle as a
     * controlled component, since {@link defaultPressed} is only read once.
     * Deliberately silent: it does not emit {@link pressedChange}, so writing
     * back from a `pressedChange` handler cannot loop. Ignores
     * {@link disabled}.
     */
    setPressed(value: boolean): void {
        this.pressed.set(value);
    }
}
