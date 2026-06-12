import {
    Directive,
    ElementRef,
    OnDestroy,
    OnInit,
    Renderer2,
    effect,
    inject,
    input,
} from '@angular/core';
import { prefersReducedMotion } from '../lib/utils';

export interface ConfettiOptions {
    /** Number of particles to launch. Default 50. */
    particleCount?: number;
    /** Angle of the explosion in degrees. Default 90 (up). */
    angle?: number;
    /** Spread of the explosion in degrees. Default 45. */
    spread?: number;
    /** Initial velocity of the particles. Default 45. Lower this to make the burst slower. */
    startVelocity?: number;
    /** How quickly the particles lose speed. Default 0.9. 1 is no decay. */
    decay?: number;
    /** How fast the particles fall. Default 1. Lower this to make them fall slower. */
    gravity?: number;
    /** How much the particles drift sideways. Default 0. */
    drift?: number;
    /** How many frames the particles last. Default 200. Controls duration, not speed. */
    ticks?: number;
    /** Origin of the explosion. x/y are 0-1 relative to container. Default {x: 0.5, y: 0.5}. */
    origin?: { x: number; y: number };
    /** Array of color strings. */
    colors?: string[];
    /** Array of shapes. Default ['square', 'circle']. */
    shapes?: ('square' | 'circle')[];
    /** Scale factor for particle size. Default 1. */
    scalar?: number;
    /** Z-index of the canvas. Default 100. */
    zIndex?: number;
    /** Whether to disable for reduced motion preference. */
    disableForReducedMotion?: boolean;
    /** Variant of the confetti explosion. 'default' | 'side-cannons'. Default 'default'. */
    variant?: 'default' | 'side-cannons';
}

interface ParticleConfig {
    x: number;
    y: number;
    angle: number;
    spread: number;
    startVelocity: number;
    decay: number;
    gravity: number;
    drift: number;
    colors: string[];
    shapes: ('square' | 'circle')[];
    scalar: number;
    ticks: number;
}

interface Particle {
    x: number;
    y: number;
    wobble: number;
    wobbleSpeed: number;
    velocity: { x: number; y: number };
    angle2D: number;
    tiltAngle: number;
    color: string;
    shape: 'square' | 'circle';
    tick: number;
    totalTicks: number;
    decay: number;
    drift: number;
    random: number;
    tiltSin: number;
    tiltCos: number;
    wobbleX: number;
    wobbleY: number;
    gravity: number;
    scalar: number;
}

@Directive({
    selector: '[uiConfetti]',
    host: {
        '[style.position]': '"relative"',
        '[style.overflow]': '"hidden"',
    },
})
export class UiConfettiDirective implements OnInit, OnDestroy {
    private readonly _el = inject(ElementRef);
    private readonly _renderer = inject(Renderer2);

    public readonly manualTrigger = input<boolean>(false);
    public readonly options = input<ConfettiOptions>({});

    private _canvas: HTMLCanvasElement | null = null;
    private _ctx: CanvasRenderingContext2D | null = null;
    private _particles: Particle[] = [];
    private _animationFrameId: number | null = null;
    private _resizeObserver: ResizeObserver | null = null;
    private _initialized = false;

    constructor() {
        effect(() => {
            const trigger = this.manualTrigger();
            if (trigger && this._initialized) {
                this.fire();
            }
        });
    }

    ngOnInit(): void {
        this._initCanvas();
        this._initResizeObserver();
        this._initialized = true;
    }

    ngOnDestroy(): void {
        this._stopAnimation();
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }
        if (this._canvas) {
            this._renderer.removeChild(this._el.nativeElement, this._canvas);
        }
    }

    /**
     * Manually fires the confetti effect with current options.
     */
    public fire(): void {
        if (!this._canvas || !this._ctx) return;

        const opts = this.options();

        if (prefersReducedMotion() && (opts.disableForReducedMotion ?? true)) return;

        const variant = opts.variant ?? 'default';

        if (variant === 'side-cannons') {
            // Left cannon
            this._launchParticles({
                ...opts,
                origin: { x: 0, y: 1 },
                angle: 60,
                spread: 55
            });
            // Right cannon
            this._launchParticles({
                ...opts,
                origin: { x: 1, y: 1 },
                angle: 120,
                spread: 55
            });
        } else {
            this._launchParticles(opts);
        }

        if (this._animationFrameId === null) {
            this._animate();
        }
    }

    private _launchParticles(opts: ConfettiOptions): void {
        /* eslint-disable @typescript-eslint/prefer-nullish-coalescing -- numeric options use `||` so an explicit 0 (e.g. spread:0, gravity:0) falls back to the documented default, matching the original behaviour */
        const particleCount = opts.particleCount || 50;
        const angle = opts.angle ?? 90;
        const spread = opts.spread || 45;
        const startVelocity = opts.startVelocity || 25;
        const decay = opts.decay || 0.9;
        const gravity = opts.gravity || 0.05;
        const drift = opts.drift ?? 0;
        const ticks = opts.ticks || 800;
        const origin = opts.origin ?? { x: 0.5, y: 0.5 };
        const colors = opts.colors ?? ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'];
        const shapes = opts.shapes ?? ['square', 'circle'];
        const scalar = opts.scalar || 1;
        /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */

        const canvas = this._canvas;
        if (!canvas) return;
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        const originX = origin.x * canvasWidth;
        const originY = origin.y * canvasHeight;

        for (let i = 0; i < particleCount; i++) {
            this._particles.push(
                this._createParticle({
                    x: originX,
                    y: originY,
                    angle,
                    spread,
                    startVelocity,
                    decay,
                    gravity,
                    drift,
                    colors,
                    shapes,
                    scalar,
                    ticks,
                })
            );
        }
    }

    private _createParticle(config: ParticleConfig): Particle {
        const radAngle = (config.angle * Math.PI) / 180;
        const radSpread = (config.spread * Math.PI) / 180;

        const randomAngle = radAngle + (Math.random() - 0.5) * radSpread;

        const velocity = config.startVelocity * 0.5 + Math.random() * config.startVelocity;
        const velX = velocity * Math.cos(randomAngle);
        const velY = velocity * -Math.sin(randomAngle);

        const color = config.colors[Math.floor(Math.random() * config.colors.length)];
        const shape = config.shapes[Math.floor(Math.random() * config.shapes.length)];

        return {
            x: config.x,
            y: config.y,
            wobble: Math.random() * 10,
            wobbleSpeed: Math.min(0.11, Math.random() * 0.1 + 0.05),
            velocity: { x: velX, y: velY },
            angle2D: -randomAngle + Math.PI / 2,
            tiltAngle: Math.random() * Math.PI,
            color,
            shape,
            tick: 0,
            totalTicks: config.ticks,
            decay: config.decay,
            drift: config.drift,
            random: Math.random() + 2,
            tiltSin: 0,
            tiltCos: 0,
            wobbleX: 0,
            wobbleY: 0,
            gravity: config.gravity * 3,
            scalar: config.scalar,
        };
    }

    private readonly _animate = (): void => {
        const ctx = this._ctx;
        const canvas = this._canvas;
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const particlesToRemove: number[] = [];
        for (let i = 0; i < this._particles.length; i++) {
            const p = this._particles[i];
            this._updateParticle(p);
            const opacity = 1 - p.tick / p.totalTicks;
            if (opacity <= 0 || p.y > canvas.height + 100) {
                particlesToRemove.push(i);
                continue;
            }
            this._drawParticle(ctx, p, opacity);
        }

        for (let i = particlesToRemove.length - 1; i >= 0; i--) {
            this._particles.splice(particlesToRemove[i], 1);
        }

        if (this._particles.length > 0) {
            this._animationFrameId = requestAnimationFrame(this._animate);
        } else {
            this._animationFrameId = null;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    private _updateParticle(p: Particle): void {
        p.tick++;
        p.x += p.velocity.x;
        p.y += p.velocity.y;
        p.velocity.x = (p.velocity.x + p.drift) * p.decay;
        p.velocity.y = (p.velocity.y + p.gravity) * p.decay;
        p.wobble += p.wobbleSpeed;
        p.wobbleX = p.x + (10 * p.scalar) * Math.cos(p.wobble);
        p.wobbleY = p.y + (10 * p.scalar) * Math.sin(p.wobble);
        p.tiltAngle += 0.1;
        p.tiltSin = Math.sin(p.tiltAngle);
        p.tiltCos = Math.cos(p.tiltAngle);
        p.random = Math.random() + 2;
    }

    private _drawParticle(ctx: CanvasRenderingContext2D, p: Particle, opacity: number): void {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        if (p.shape === 'circle') {
            ctx.ellipse(p.x, p.y, Math.abs(p.wobbleX - p.x) * 0.6, Math.abs(p.wobbleY - p.y) * 0.6, 0, 0, 2 * Math.PI);
            ctx.fill();
        } else {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle2D);
            ctx.scale(Math.cos(p.wobble), 1);
            ctx.fillRect(-5 * p.scalar, -5 * p.scalar, 10 * p.scalar, 10 * p.scalar);
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }

    private _stopAnimation(): void {
        if (this._animationFrameId !== null) {
            cancelAnimationFrame(this._animationFrameId);
            this._animationFrameId = null;
        }
        this._particles = [];
    }

    private _initCanvas(): void {
        const canvas: HTMLCanvasElement = this._renderer.createElement('canvas');
        this._canvas = canvas;
        this._renderer.setStyle(canvas, 'position', 'absolute');
        this._renderer.setStyle(canvas, 'top', '0');
        this._renderer.setStyle(canvas, 'left', '0');
        this._renderer.setStyle(canvas, 'pointer-events', 'none');
        this._renderer.setStyle(canvas, 'z-index', this.options().zIndex?.toString() ?? '100');

        const rect = this._el.nativeElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        this._renderer.appendChild(this._el.nativeElement, canvas);
        this._ctx = canvas.getContext('2d');
    }

    private _initResizeObserver(): void {
        this._resizeObserver = new ResizeObserver((entries) => {
            if (!this._canvas) return;
            for (const entry of entries) {
                const rect = entry.contentRect;
                this._canvas.width = rect.width;
                this._canvas.height = rect.height;
            }
        });
        this._resizeObserver.observe(this._el.nativeElement);
    }
}
