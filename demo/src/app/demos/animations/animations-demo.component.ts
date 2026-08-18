import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { ANIMATIONS_DEMO_LOCALES } from './animations-demo.locales';
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
  StreamingTextComponent,
  TextRevealComponent,
  SparklesButtonComponent,
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
    StreamingTextComponent,
    TextRevealComponent,
    SparklesButtonComponent,
  ],
  template: `
    <ui-scroll-progress [height]="3" />
    <section class="space-y-12">
      <div>
        <h2 id="animations" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
        <p class="text-muted-foreground mt-1">{{ t().description }}</p>
      </div>

      <div class="space-y-4">
        <h3 class="text-lg font-medium">{{ t().gradientTextHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().gradientTextDescription }}</p>
        <ui-gradient-text class="text-4xl font-bold">
          {{ t().gradientTextContent }}
        </ui-gradient-text>
        <div class="mt-4">
          <ui-gradient-text class="text-2xl font-semibold" [colors]="['#ec4899', '#8b5cf6', '#3b82f6']" [speed]="5">
            {{ t().gradientTextPinkBlue }}
          </ui-gradient-text>
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-medium">{{ t().flipTextHeading }}</h3>
            <p class="text-muted-foreground text-sm">{{ t().flipTextDescription }}</p>
          </div>
          <ui-button variant="outline" size="sm" (clicked)="replayFlipText()" [label]="t().flipTextReplay" />
        </div>
        <div class="text-3xl font-bold">
          <ui-flip-text #flipTextRef [text]="t().flipTextContent" [delay]="60" [duration]="600" />
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-medium">{{ t().blurFadeHeading }}</h3>
            <p class="text-muted-foreground text-sm">{{ t().blurFadeDescription }}</p>
            <p class="text-muted-foreground text-sm">{{ t().blurFadeReplayCaption }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <code class="text-sm font-mono">{{ t().blurFadeReplayCount }} {{ blurFadeReplays() }}</code>
            <ui-button variant="outline" size="sm" (clicked)="replayBlurFade()" [label]="t().blurFadeReplay" />
          </div>
        </div>
        <div class="space-y-4">
          <ui-blur-fade #blurFadeRef1 [delay]="0" direction="up" (replay)="onBlurFadeReplay()">
            <div class="p-6 rounded-xl border bg-card">{{ t().blurFadeItem1 }}</div>
          </ui-blur-fade>
          <ui-blur-fade #blurFadeRef2 [delay]="200" direction="up">
            <div class="p-6 rounded-xl border bg-card">{{ t().blurFadeItem2 }}</div>
          </ui-blur-fade>
          <ui-blur-fade #blurFadeRef3 [delay]="400" direction="left">
            <div class="p-6 rounded-xl border bg-card">{{ t().blurFadeItem3 }}</div>
          </ui-blur-fade>
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">{{ t().typingHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().typingDescription }}</p>
        <div class="text-2xl font-mono">
          <span>{{ t().typingPrefix }}</span>
          <ui-typing-animation [strings]="t().typingStrings" [typeSpeed]="60"
            [deleteSpeed]="40" [pauseDuration]="2000" />
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">{{ t().morphingHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().morphingDescription }}</p>
        <div class="text-4xl font-bold h-16 flex items-center">
          <ui-morphing-text [texts]="t().morphingTexts" [interval]="3000" />
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">{{ t().wordRotateHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().wordRotateDescription }}</p>
        <div class="text-2xl font-semibold flex items-center gap-2">
          <span>{{ t().wordRotatePrefix }}</span>
          <ui-word-rotate class="text-primary h-[1.2em] w-32" [words]="t().wordRotateWords"
            [duration]="2000" />
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">{{ t().marqueeHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().marqueeDescription }}</p>
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
        <h3 class="text-lg font-medium">{{ t().shineHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().shineDescription }}</p>
        <div class="flex gap-6 flex-wrap">
          <ui-shine-border [borderRadius]="12" [duration]="3">
            <div class="p-6 text-center">
              <h4 class="font-semibold">{{ t().shineCard1Title }}</h4>
              <p class="text-sm text-muted-foreground mt-1">{{ t().shineCard1Desc }}</p>
            </div>
          </ui-shine-border>
          <ui-shine-border [colors]="['#ec4899', '#8b5cf6', '#06b6d4']" [borderWidth]="3" [borderRadius]="16">
            <div class="p-6 text-center">
              <h4 class="font-semibold">{{ t().shineCard2Title }}</h4>
              <p class="text-sm text-muted-foreground mt-1">{{ t().shineCard2Desc }}</p>
            </div>
          </ui-shine-border>
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">{{ t().meteorsHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().meteorsDescription }}</p>
        <div class="relative h-64 rounded-xl border bg-slate-950 overflow-hidden flex items-center justify-center">
          <ui-meteors [count]="20" speed="fast" color="white" />
          <div class="relative z-10 text-center text-white">
            <h4 class="text-2xl font-bold">{{ t().meteorsTitle }}</h4>
            <p class="text-slate-400 mt-2">{{ t().meteorsSubtitle }}</p>
          </div>
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">{{ t().orbitHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().orbitDescription }}</p>
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
        <h3 class="text-lg font-medium">{{ t().wobbleHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().wobbleDescription }}</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ui-wobble-card class="p-8 border bg-card rounded-xl">
            <h4 class="text-lg font-semibold">{{ t().wobbleCard1Title }}</h4>
            <p class="text-sm text-muted-foreground mt-2">{{ t().wobbleCard1Desc }}</p>
          </ui-wobble-card>
          <ui-wobble-card class="p-8 border bg-primary text-primary-foreground rounded-xl" [intensity]="20">
            <h4 class="text-lg font-semibold">{{ t().wobbleCard2Title }}</h4>
            <p class="text-sm opacity-80 mt-2">{{ t().wobbleCard2Desc }}</p>
          </ui-wobble-card>
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-medium">{{ t().staggerHeading }}</h3>
            <p class="text-muted-foreground text-sm">{{ t().staggerDescription }}</p>
          </div>
          <ui-button variant="outline" size="sm" (clicked)="replayStagger()" [label]="t().staggerReplay" />
        </div>
        <ui-stagger-children #staggerRef [staggerDelay]="100" [duration]="500" direction="up"
          class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          @for (i of [1,2,3,4,5,6,7,8]; track i) {
          <div class="p-6 rounded-xl border bg-card text-center">
            <div class="text-2xl font-bold text-primary">{{ i }}</div>
            <p class="text-sm text-muted-foreground mt-1">{{ t().staggerCardLabel }} {{ i }}</p>
          </div>
          }
        </ui-stagger-children>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">{{ t().rippleHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().rippleDescription }}</p>
        <div class="flex gap-4 flex-wrap">
          <button uiRipple class="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium">
            {{ t().rippleButton1 }}
          </button>
          <button uiRipple uiRippleColor="rgba(59,130,246,0.4)"
            class="px-6 py-3 rounded-lg border bg-card font-medium">
            {{ t().rippleButton2 }}
          </button>
          <div uiRipple class="p-6 rounded-xl border bg-card cursor-pointer">
            <p class="font-medium">{{ t().rippleCard1Title }}</p>
            <p class="text-sm text-muted-foreground">{{ t().rippleCard1Desc }}</p>
          </div>
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">{{ t().magneticHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().magneticDescription }}</p>
        <div class="flex gap-8 items-center justify-center py-8">
          <button uiMagnetic class="px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium">
            {{ t().magneticButton1 }}
          </button>
          <button uiMagnetic [uiMagneticStrength]="0.5"
            class="h-16 w-16 rounded-full border-2 flex items-center justify-center text-2xl">
            +
          </button>
          <button uiMagnetic [uiMagneticStrength]="0.6" [uiMagneticRadius]="150"
            class="px-6 py-3 rounded-lg border font-medium">
            {{ t().magneticButton3 }}
          </button>
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">{{ t().particlesHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().particlesDescription }}</p>
        <div class="relative h-72 rounded-xl border overflow-hidden">
          <ui-particles [count]="60" [connectDistance]="100" [speed]="0.4" />
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="text-center">
              <h4 class="text-2xl font-bold">{{ t().particlesTitle }}</h4>
              <p class="text-muted-foreground mt-1">{{ t().particlesSubtitle }}</p>
            </div>
          </div>
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">{{ t().scrollProgressHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().scrollProgressDescription }}</p>
        <div class="p-4 rounded-xl border bg-primary/10 text-sm font-medium">
          {{ t().scrollProgressHint }}
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">{{ t().streamingHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().streamingDescription }}</p>
        <div class="border rounded-md p-6 min-h-[100px]">
          <ui-streaming-text [text]="t().streamingText" class="font-mono text-lg" />
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">{{ t().textRevealHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().textRevealDescription }}</p>
        <div class="border rounded-md p-6 flex justify-center items-center">
          <ui-text-reveal [text]="t().textRevealText" class="text-3xl font-bold" />
        </div>
      </div>

      <ui-separator />

      <div class="space-y-4">
        <h3 class="text-lg font-medium">{{ t().sparklesHeading }}</h3>
        <p class="text-muted-foreground text-sm">{{ t().sparklesDescription }}</p>
        <div class="flex gap-4 items-center">
          <ui-sparkles-button>{{ t().sparklesButton }}</ui-sparkles-button>
        </div>
      </div>
    </section>
  `,
})
export class AnimationsDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => ANIMATIONS_DEMO_LOCALES[this.localeId()] ?? ANIMATIONS_DEMO_LOCALES['en'],
  );

  readonly flipTextRef = viewChild<FlipTextComponent>('flipTextRef');
  readonly blurFadeRef1 = viewChild<BlurFadeComponent>('blurFadeRef1');
  readonly blurFadeRef2 = viewChild<BlurFadeComponent>('blurFadeRef2');
  readonly blurFadeRef3 = viewChild<BlurFadeComponent>('blurFadeRef3');
  readonly staggerRef = viewChild<StaggerChildrenComponent>('staggerRef');

  replayFlipText() {
    this.flipTextRef()?.playAnimation();
  }

  /** Counts `(replay)` emissions from the first blur-fade block. */
  readonly blurFadeReplays = signal(0);

  /** Bumps the visible replay counter. */
  onBlurFadeReplay() {
    this.blurFadeReplays.update((count) => count + 1);
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
