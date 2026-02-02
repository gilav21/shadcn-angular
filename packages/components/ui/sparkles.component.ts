import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    OnInit,
    OnDestroy,
} from '@angular/core';
import { cn } from '../lib/utils';
import { ButtonComponent } from './button.component';

interface Sparkle {
    id: string;
    x: string;
    y: string;
    size: string;
    style: any;
}

@Component({
    selector: 'ui-sparkles',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <svg 
     [class]="classes()"
     viewBox="0 0 160 160" 
     fill="none" 
     xmlns="http://www.w3.org/2000/svg"
     >
      <path 
        d="M80 0C80 0 84.2846 41.2925 101.496 58.504C118.707 75.7154 160 80 160 80C160 80 118.707 84.2846 101.496 101.496C84.2846 118.707 80 160 80 160C80 160 75.7154 118.707 58.504 101.496C41.2925 84.2846 0 80 0 80C0 80 41.2925 75.7154 58.504 58.504C75.7154 41.2925 80 0 80 0Z" 
        class="origin-center animate-ping-slow"
        fill="currentColor"
    />
    </svg>
  `,
    styles: [`
    .animate-ping-slow {
      animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
    }
    @keyframes ping {
       75%, 100% {
        transform: scale(2);
        opacity: 0;
      }
    }
  `]
})
export class SparklesComponent {
    class = input('');
    classes = computed(() => cn('pointer-events-none absolute', this.class()));
}

@Component({
    selector: 'ui-sparkles-button',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent, SparklesComponent],
    template: `
    <ui-button 
        [class]="classes()" 
        (mouseenter)="startSparkles()" 
        (mouseleave)="stopSparkles()"
        [variant]="variant()"
        [size]="size()"
    >
      <ng-content />
      @if (hovering()) {
        <ui-sparkles class="top-[-20%] right-[-10%] w-6 h-6 text-yellow-400" />
        <ui-sparkles class="bottom-[-10%] left-[-5%] w-4 h-4 text-cyan-400 delay-75" />
        <ui-sparkles class="top-[10%] left-[40%] w-3 h-3 text-purple-400 delay-150" />
      }
    </ui-button>
  `,
})
export class SparklesButtonComponent {
    class = input('');
    variant = input<"default" | "destructive" | "outline" | "secondary" | "ghost" | "link">('default');
    size = input<"default" | "sm" | "lg" | "icon">('default');

    hovering = signal(false);
    classes = computed(() => cn('relative overflow-visible group gap-2', this.class()));

    startSparkles() {
        this.hovering.set(true);
    }

    stopSparkles() {
        this.hovering.set(false);
    }
}
