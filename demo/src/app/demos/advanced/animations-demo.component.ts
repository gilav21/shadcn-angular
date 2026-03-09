import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
import {
  ButtonComponent,
  SeparatorComponent,
  GradientTextComponent,
  FlipTextComponent,
  MeteorsComponent,
  ShineBorderComponent,
  ScrollProgressComponent,
  BlurFadeComponent,
  UiRippleDirective,
  MarqueeComponent,
  WordRotateComponent,
  MorphingTextComponent,
  TypingAnimationComponent,
  WobbleCardComponent,
  UiMagneticDirective,
  OrbitComponent,
  StaggerChildrenComponent,
  ParticlesComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-animations-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    SeparatorComponent,
    GradientTextComponent,
    FlipTextComponent,
    MeteorsComponent,
    ShineBorderComponent,
    ScrollProgressComponent,
    BlurFadeComponent,
    UiRippleDirective,
    MarqueeComponent,
    WordRotateComponent,
    MorphingTextComponent,
    TypingAnimationComponent,
    WobbleCardComponent,
    UiMagneticDirective,
    OrbitComponent,
    StaggerChildrenComponent,
    ParticlesComponent,
  ],
  template: `
    <ui-scroll-progress [height]="3" />
    <section class="space-y-12">
      <div>
        <h2 id="animations" class="text-2xl font-semibold scroll-m-20">Animations</h2>
        <p class="text-muted-foreground mt-1">A collection of animation components for landing pages,
          micro-interactions, and text effects.</p>
      </div>

      <div class="space-y-4">
        <h3 class="text-lg font-medium">Gradient Text</h3>
        <p class="text-muted-foreground text-sm">Animated gradient background on text.</p>
        <ui-gradient-text class="text-4xl font-bold">
          Build beautiful interfaces
        </ui-gradient-text>
        <div class="mt-4">
          <ui-gradient-text class="text-2xl font-semibold" [colors]="['#ec4899', '#8b5cf6', '#3b82f6']" [speed]="5">
            Pink to Blue Gradient
          </ui-gradient-text>
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-medium">Flip Text</h3>
            <p class="text-muted-foreground text-sm">Characters flip in one by one with a staggered delay.</p>
          </div>
          <ui-button variant="outline" size="sm" (clicked)="replayFlipText()" label="Replay" />
        </div>
        <div class="text-3xl font-bold">
          <ui-flip-text #flipTextRef text="Hello World!" [delay]="60" [duration]="600" />
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-medium">Blur Fade</h3>
            <p class="text-muted-foreground text-sm">Elements blur and fade in when they enter the viewport.</p>
          </div>
          <ui-button variant="outline" size="sm" (clicked)="replayBlurFade()" label="Replay" />
        </div>
        <div class="space-y-4">
          <ui-blur-fade #blurFadeRef1 [delay]="0" direction="up">
            <div class="p-6 rounded-xl border bg-card">First item fades up</div>
          </ui-blur-fade>
          <ui-blur-fade #blurFadeRef2 [delay]="200" direction="up">
            <div class="p-6 rounded-xl border bg-card">Second item with 200ms delay</div>
          </ui-blur-fade>
          <ui-blur-fade #blurFadeRef3 [delay]="400" direction="left">
            <div class="p-6 rounded-xl border bg-card">Third item fades from the left</div>
          </ui-blur-fade>
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">Typing Animation</h3>
        <p class="text-muted-foreground text-sm">A typewriter effect that types, pauses, deletes, and cycles through
          strings.</p>
        <div class="text-2xl font-mono">
          <span>I am a </span>
          <ui-typing-animation [strings]="['Developer', 'Designer', 'Creator', 'Problem Solver']" [typeSpeed]="60"
            [deleteSpeed]="40" [pauseDuration]="2000" />
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">Morphing Text</h3>
        <p class="text-muted-foreground text-sm">Text morphs between words with a blur cross-fade transition.</p>
        <div class="text-4xl font-bold h-16 flex items-center">
          <ui-morphing-text [texts]="['Innovation', 'Technology', 'Future', 'Design']" [interval]="3000" />
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">Word Rotate</h3>
        <p class="text-muted-foreground text-sm">Words slide up and rotate through a list on an interval.</p>
        <div class="text-2xl font-semibold flex items-center gap-2">
          <span>We build</span>
          <ui-word-rotate class="text-primary h-[1.2em] w-32" [words]="['websites', 'apps', 'tools', 'products']"
            [duration]="2000" />
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">Marquee</h3>
        <p class="text-muted-foreground text-sm">Infinite scrolling content loop.</p>
        <ui-marquee [speed]="25" [pauseOnHover]="true" [gap]="24">
          @for (item of ['Angular', 'React', 'Vue', 'Svelte', 'Next.js', 'Nuxt', 'Remix', 'Astro']; track item) {
          <div class="flex items-center gap-2 px-4 py-2 rounded-full border bg-card">
            <span class="font-medium">{{ item }}</span>
          </div>
          }
        </ui-marquee>
        <ui-marquee [speed]="30" direction="right" [pauseOnHover]="true" [gap]="24" class="mt-4">
          @for (item of ['TypeScript', 'Tailwind', 'Sass', 'PostCSS', 'Vite', 'Webpack', 'ESBuild', 'SWC']; track
          item) {
          <div class="flex items-center gap-2 px-4 py-2 rounded-full border bg-card">
            <span class="font-medium">{{ item }}</span>
          </div>
          }
        </ui-marquee>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">Shine Border</h3>
        <p class="text-muted-foreground text-sm">A rotating gradient border that shines around an element.</p>
        <div class="flex gap-6 flex-wrap">
          <ui-shine-border [borderRadius]="12" [duration]="3">
            <div class="p-6 text-center">
              <h4 class="font-semibold">Shine Card</h4>
              <p class="text-sm text-muted-foreground mt-1">Hover to admire the glow</p>
            </div>
          </ui-shine-border>
          <ui-shine-border [colors]="['#ec4899', '#8b5cf6', '#06b6d4']" [borderWidth]="3" [borderRadius]="16">
            <div class="p-6 text-center">
              <h4 class="font-semibold">Custom Colors</h4>
              <p class="text-sm text-muted-foreground mt-1">Pink, purple, and cyan</p>
            </div>
          </ui-shine-border>
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">Meteors</h3>
        <p class="text-muted-foreground text-sm">Diagonal meteor shower animation overlay.</p>
        <div class="relative h-64 rounded-xl border bg-slate-950 overflow-hidden flex items-center justify-center">
          <ui-meteors [count]="20" speed="fast" color="white" />
          <div class="relative z-10 text-center text-white">
            <h4 class="text-2xl font-bold">Meteor Shower</h4>
            <p class="text-slate-400 mt-2">Watch them fall</p>
          </div>
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">Orbit</h3>
        <p class="text-muted-foreground text-sm">Elements orbit around a center point.</p>
        <div class="flex justify-center py-12">
          <div class="relative" style="width:280px;height:280px">
            <div class="absolute inset-0 flex items-center justify-center">
              <div
                class="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                A</div>
            </div>
            <ui-orbit [radius]="120" [duration]="8">
              <div
                class="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                1</div>
            </ui-orbit>
            <ui-orbit [radius]="120" [duration]="8" [delay]="-2.7">
              <div
                class="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">
                2</div>
            </ui-orbit>
            <ui-orbit [radius]="120" [duration]="8" [delay]="-5.3">
              <div
                class="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold">
                3</div>
            </ui-orbit>
          </div>
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">Wobble Card</h3>
        <p class="text-muted-foreground text-sm">Cards that tilt toward the mouse cursor with a 3D perspective
          effect.</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ui-wobble-card class="p-8 border bg-card rounded-xl">
            <h4 class="text-lg font-semibold">Hover Me</h4>
            <p class="text-sm text-muted-foreground mt-2">This card tilts toward your cursor with a perspective
              transform.</p>
          </ui-wobble-card>
          <ui-wobble-card class="p-8 border bg-primary text-primary-foreground rounded-xl" [intensity]="20">
            <h4 class="text-lg font-semibold">High Intensity</h4>
            <p class="text-sm opacity-80 mt-2">More dramatic tilt effect on this one.</p>
          </ui-wobble-card>
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-medium">Stagger Children</h3>
            <p class="text-muted-foreground text-sm">Children animate in one by one with a staggered delay when they
              enter the viewport.</p>
          </div>
          <ui-button variant="outline" size="sm" (clicked)="replayStagger()" label="Replay" />
        </div>
        <ui-stagger-children #staggerRef [staggerDelay]="100" [duration]="500" direction="up"
          class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          @for (i of [1,2,3,4,5,6,7,8]; track i) {
          <div class="p-6 rounded-xl border bg-card text-center">
            <div class="text-2xl font-bold text-primary">{{ i }}</div>
            <p class="text-sm text-muted-foreground mt-1">Card {{ i }}</p>
          </div>
          }
        </ui-stagger-children>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">Ripple</h3>
        <p class="text-muted-foreground text-sm">A click ripple effect directive that can be applied to any element.
        </p>
        <div class="flex gap-4 flex-wrap">
          <button uiRipple class="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium">
            Click for Ripple
          </button>
          <button uiRipple uiRippleColor="rgba(59,130,246,0.4)"
            class="px-6 py-3 rounded-lg border bg-card font-medium">
            Blue Ripple
          </button>
          <div uiRipple class="p-6 rounded-xl border bg-card cursor-pointer">
            <p class="font-medium">Ripple on a card</p>
            <p class="text-sm text-muted-foreground">Click anywhere</p>
          </div>
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">Magnetic</h3>
        <p class="text-muted-foreground text-sm">Elements that are magnetically pulled toward the mouse cursor.</p>
        <div class="flex gap-8 items-center justify-center py-8">
          <button uiMagnetic class="px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium">
            Hover Near Me
          </button>
          <button uiMagnetic [uiMagneticStrength]="0.5"
            class="h-16 w-16 rounded-full border-2 flex items-center justify-center text-2xl">
            +
          </button>
          <button uiMagnetic [uiMagneticStrength]="0.6" [uiMagneticRadius]="150"
            class="px-6 py-3 rounded-lg border font-medium">
            Strong Pull
          </button>
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">Particles</h3>
        <p class="text-muted-foreground text-sm">Interactive particle network rendered on canvas with mouse
          repulsion.</p>
        <div class="relative h-72 rounded-xl border overflow-hidden">
          <ui-particles [count]="60" [connectDistance]="100" [speed]="0.4" />
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="text-center">
              <h4 class="text-2xl font-bold">Particle Network</h4>
              <p class="text-muted-foreground mt-1">Move your mouse to interact</p>
            </div>
          </div>
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">Scroll Progress</h3>
        <p class="text-muted-foreground text-sm">A fixed progress bar that tracks scroll position.</p>
        <div class="p-4 rounded-xl border bg-primary/10 text-sm font-medium">
          Look at the very top of the browser window — there is a thin colored bar. Scroll this page up and down to
          see it grow and shrink.
        </div>
      </div>
    </section>
  `,
})
export class AnimationsDemoComponent {
  readonly flipTextRef = viewChild<FlipTextComponent>('flipTextRef');
  readonly blurFadeRef1 = viewChild<BlurFadeComponent>('blurFadeRef1');
  readonly blurFadeRef2 = viewChild<BlurFadeComponent>('blurFadeRef2');
  readonly blurFadeRef3 = viewChild<BlurFadeComponent>('blurFadeRef3');
  readonly staggerRef = viewChild<StaggerChildrenComponent>('staggerRef');

  replayFlipText() {
    this.flipTextRef()?.playAnimation();
  }

  replayBlurFade() {
    this.blurFadeRef1()?.playAnimation();
    this.blurFadeRef2()?.playAnimation();
    this.blurFadeRef3()?.playAnimation();
  }

  replayStagger() {
    this.staggerRef()?.playAnimation();
  }
}
