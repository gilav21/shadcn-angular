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

@Component({
    selector: 'ui-number-ticker-digit',
    templateUrl: './number-ticker-digit.component.html',
})
export class NumberTickerDigitComponent {
    digit = input.required<string>();

    private readonly el = inject(ElementRef);
    private readonly cdr = inject(ChangeDetectorRef);
    prevDigit = signal<string>('0');
    isDigit = computed(() => /^\d$/.test(this.digit()));

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

                if (this.isDigit()) {
                    const previous = this._lastValue;
                    this.prevDigit.set(previous);

                    // Animate
                    const container = this.el.nativeElement.querySelector('.flex');
                    if (container) {
                        const animation = container.animate(
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
                    } else {
                        // Fallback if element not found
                        this.prevDigit.set(current);
                    }
                } else {
                    this.prevDigit.set(current);
                }
                this._lastValue = current;
            }
        });
    }
}
