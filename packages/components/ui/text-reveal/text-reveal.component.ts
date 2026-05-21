import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
    selector: 'ui-text-reveal',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './text-reveal.component.html',
    styleUrl: './text-reveal.component.css',
})
export class TextRevealComponent {
    text = input('');
    class = input('');
    delay = input(50); // ms per word

    classes = computed(() => cn('flex flex-wrap', this.class()));

    words = computed(() => this.text().split(' '));
}
