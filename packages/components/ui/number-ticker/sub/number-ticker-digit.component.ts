import {
    Component,
    ElementRef,
    ChangeDetectorRef,
    computed,
    effect,
    inject,
    input,
    signal,
} from '@angular/core';

const DIGIT = /^\d$/;

@Component({
    selector: 'ui-number-ticker-digit',
    templateUrl: './number-ticker-digit.component.html',
})
export class NumberTickerDigitComponent {
    /**
     * One character of the formatted number. A digit that replaces a digit
     * rolls over with a vertical slide from the previous one; every other
     * change (to a separator, decimal point or minus sign, or from one to a
     * digit) is swapped instantly. The first value sets the initial
     * state without animating.
     */
    digit = input.required<string>();

    private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly cdr = inject(ChangeDetectorRef);
    prevDigit = signal<string>('0');
    isDigit = computed(() => DIGIT.test(this.digit()));

    private _lastValue = '';
    private _initialized = false;
    private _currentAnimation: Animation | null = null;

    constructor() {
        effect(() => {
            const current = this.digit();

            if (!this._initialized) {
                this._lastValue = current;
                this.prevDigit.set(current);
                this._initialized = true;
                return;
            }

            if (current !== this._lastValue) {
                // Finish any ongoing animation immediately to update state
                if (this._currentAnimation) {
                    this._currentAnimation.finish();
                }

                const column = this.animatableColumn();
                if (column) {
                    this.prevDigit.set(this._lastValue);
                    this.rollTo(column, current);
                } else {
                    this.prevDigit.set(current);
                }
                this._lastValue = current;
            }
        });
    }

    /**
     * The rolling column to animate, or `null` when the change must be shown
     * directly. Only a digit replacing a digit rolls: a separator or sign has
     * no digit to roll from. The effect runs before the view re-renders, so the
     * column is looked up by its slot — a generic selector also matches a
     * separator span that is still on screen and would animate that instead.
     */
    private animatableColumn(): HTMLElement | null {
        if (!this.isDigit() || !DIGIT.test(this._lastValue)) return null;
        return this.el.nativeElement.querySelector<HTMLElement>('[data-slot="number-ticker-digit-column"]');
    }

    private rollTo(column: HTMLElement, current: string): void {
        const animation = column.animate(
            [
                { transform: 'translateY(0)' },
                { transform: 'translateY(-50%)' }
            ],
            {
                duration: 300,
                easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
                fill: 'forwards'
            }
        );
        this._currentAnimation = animation;

        animation.onfinish = () => {
            this.prevDigit.set(current);
            this.cdr.detectChanges();
            animation.cancel();
            if (this._currentAnimation === animation) {
                this._currentAnimation = null;
            }
        };
    }
}
