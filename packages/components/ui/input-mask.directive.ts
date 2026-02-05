
import {
    Directive,
    ElementRef,
    Input,
    OnInit,
    OnDestroy,
    inject,
    HostListener,
    AfterViewInit,
    Renderer2
} from '@angular/core';
import { NgControl } from '@angular/forms';
import { InputComponent } from './input.component';

@Directive({
    selector: '[uiInputMask]',
    standalone: true
})
export class InputMaskDirective implements AfterViewInit, OnDestroy {
    @Input('uiInputMask') mask: string = '';
    @Input() slotChar: string = '_';
    @Input() showMaskTyped: boolean = false;

    private el = inject(ElementRef);
    private renderer = inject(Renderer2);
    private ngControl = inject(NgControl, { optional: true, self: true });
    private uiInput = inject(InputComponent, { optional: true, self: true });

    private inputElement!: HTMLInputElement;
    private destroyValues: (() => void)[] = [];

    // Map of mask definitions
    private definitions: { [key: string]: RegExp } = {
        '0': /\d/,
        '9': /\d/,
        'a': /[a-zA-Z]/,
        '*': /[a-zA-Z0-9]/
    };

    ngAfterViewInit() {
        if (this.uiInput) {
            // If used on ui-input component, get the inner input ref
            // Since ui-input uses signals and viewChild, we can access strict inputRef
            this.inputElement = this.uiInput.inputRef().nativeElement;
        } else {
            // If used on native input, assume host is the input
            this.inputElement = this.el.nativeElement;
        }

        this.setupListeners();
        // Initial formatting if value exists
        if (this.inputElement.value) {
            this.handleInput();
        }
    }

    ngOnDestroy() {
        this.destroyValues.forEach(fn => fn());
    }

    private setupListeners() {
        const onInput = this.renderer.listen(this.inputElement, 'input', (e) => this.handleInput(e));
        const onKeyDown = this.renderer.listen(this.inputElement, 'keydown', (e) => this.handleKeyDown(e));
        const onPaste = this.renderer.listen(this.inputElement, 'paste', (e) => this.handlePaste(e));
        const onBlur = this.renderer.listen(this.inputElement, 'blur', () => this.handleBlur());

        this.destroyValues.push(onInput, onKeyDown, onPaste, onBlur);
    }

    private handleInput(event?: Event) {
        const input = this.inputElement;
        let value = input.value;
        const oldCursorPos = input.selectionStart || 0;

        // Check if deletion happened (heuristic)
        // Actually, simple masking strategy:
        // 1. Strip all non-mask literals from value
        // 2. Re-apply mask to raw value
        // 3. Set value
        // 4. Reposition cursor

        const rawValue = this.unmask(value);
        const maskedValue = this.applyMask(rawValue);

        if (value !== maskedValue) {
            input.value = maskedValue;
            this.updateModel(maskedValue);

            const newCursorPos = this.calculateCursorPosition(oldCursorPos, value, maskedValue);
            input.setSelectionRange(newCursorPos, newCursorPos);
        } else {
            // Even if value matches, we might need to update model if it was just set programmatically
            // but typically input event means user interaction
            this.updateModel(maskedValue);
        }
    }

    private handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Backspace') {
            // Default backspace works, but we might want to handle jumping over literals
        }
    }

    private handlePaste(event: ClipboardEvent) {
        // Paste handled by input event usually, but ensuring clean data
    }

    private handleBlur() {
        this.updateTouched();
    }

    private updateModel(value: string) {
        if (this.ngControl) {
            this.ngControl.control?.setValue(value, { emitEvent: false, emitModelToViewChange: false, emitViewToModelChange: true });
        }
        if (this.uiInput) {
            // Provide the value to the ui-input manually if needed, 
            // to ensure its internal signal is in sync without triggering a rewrite
            this.uiInput.onValueChange(value);
        }
    }

    private updateTouched() {
        if (this.ngControl) {
            this.ngControl.control?.markAsTouched();
        }
        if (this.uiInput) {
            this.uiInput.onTouched();
        }
    }

    private unmask(value: string): string {
        let unmasked = '';
        // This is a naive unmask that just keeps alphanumerics if mask has them.
        // Better: walk through mask and value.

        // Simple approach: Strip literals defined in mask
        // We iterate over the mask and the value
        let valueIndex = 0;
        let maskIndex = 0;

        // Actually, just stripping anything that doesn't match the definitions? 
        // No, cause user might type literal chars.

        // Let's just strip 'known' literals from the mask pattern.
        // Collect all literals from mask
        const literals = this.getLiterals();

        // Remove literals from value
        return value.split('').filter(c => !literals.has(c)).join('');
    }

    private applyMask(rawValue: string): string {
        let masked = '';
        let rawIndex = 0;
        let maskIndex = 0;

        while (maskIndex < this.mask.length) {
            const maskChar = this.mask[maskIndex];
            const matcher = this.definitions[maskChar];

            if (matcher) {
                if (rawIndex < rawValue.length) {
                    const rawChar = rawValue[rawIndex];
                    if (matcher.test(rawChar)) {
                        masked += rawChar;
                        rawIndex++;
                        maskIndex++;
                    } else {
                        // Invalid char for this slot, skip it?
                        rawIndex++; // Skip the invalid char from input
                        // Stay on this mask slot
                    }
                } else {
                    // We ran out of raw values
                    if (this.slotChar && this.showMaskTyped) {
                        masked += this.slotChar;
                    }
                    maskIndex++;
                    break; // Stop if we just want to fill what we have
                    // Continue if we want to show full mask
                }
            } else {
                // Literal
                masked += maskChar;
                maskIndex++;
                // If the next char in rawValue is this literal, consume it too
                if (rawIndex < rawValue.length && rawValue[rawIndex] === maskChar) {
                    rawIndex++;
                }
            }
        }

        return masked;
    }

    private calculateCursorPosition(oldPos: number, oldValue: string, newValue: string): number {
        // If we're at the end, stay at the end
        if (oldPos >= oldValue.length) return newValue.length;

        // If deleting (newValue shorter), try to respect position
        if (newValue.length < oldValue.length) {
            return Math.max(0, oldPos); // Simple expectation
        }

        // If inserting, we generally want to follow the inserted characters.
        // However, jumping over literals is key.

        // Count how many "placeholder/slot" characters were before the cursor in the NEW value?
        // This is hard without full state tracking. 

        // Let's try to map the semantic content.
        // For now, let's do a smart scan:
        // If the character at oldPos was a literal, jump over it in the new string?

        // A simplified robust approach for "append only" or "simple edit":
        // Count how many non-literal characters are before the cursor in the OLD value.
        let nonLiteralCountBefore = 0;
        const literals = this.getLiterals();

        for (let i = 0; i < oldPos; i++) {
            const char = oldValue[i];
            if (!literals.has(char)) {
                nonLiteralCountBefore++;
            }
        }

        // Now find the position in NEW value that has the same number of non-literals before it.
        let newPos = 0;
        let currentNonLiterals = 0;
        for (let i = 0; i < newValue.length; i++) {
            const char = newValue[i];
            if (!literals.has(char)) {
                currentNonLiterals++;
            }

            if (currentNonLiterals > nonLiteralCountBefore) {
                // We passed our target number of non-literals.
                // The cursor should be right here.
                return i;
            }

            // If we matched exact count, we might be right *after* this char?
            // But the loop continues to find the *next* logical position?
            // Actually, if we are at the target count, we should continue until we see a non-literal again?
            // i.e., skip ensuing literals in the new string.
        }

        // If we finished the loop, maybe we are at the end?
        if (currentNonLiterals <= nonLiteralCountBefore) {
            return newValue.length;
        }

        return newValue.length;
    }

    private getLiterals(): Set<string> {
        const literals = new Set<string>();
        for (const char of this.mask) {
            if (!this.definitions[char]) {
                literals.add(char);
            }
        }
        return literals;
    }
}
