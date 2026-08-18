import {
    Component,
    ChangeDetectionStrategy,
    input,
    ElementRef,
    OnInit,
    OnDestroy,
    inject,
    NgZone,
    Renderer2,
} from '@angular/core';
import { prefersReducedMotion } from '../../lib/utils';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
}

@Component({
    selector: 'ui-particles',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: ``,
    host: {
        '[style.position]': '"absolute"',
        '[style.inset]': '"0"',
        '[style.display]': '"block"',
        '[attr.data-slot]': '"particles"',
    },
})
export class ParticlesComponent implements OnInit, OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly ngZone = inject(NgZone);
    private readonly renderer = inject(Renderer2);

    /**
     * Number of particles seeded across the canvas. Cost is roughly quadratic
     * because every pair is tested for a connecting line each frame, so keep it
     * modest on large surfaces. Read when the field is created (init, or the
     * first resize that gives the host a non-zero size).
     */
    count = input(50);
    /**
     * Colour of both dots and connecting lines. `'currentColor'` (the default)
     * and any `var(...)` expression are resolved once against the host's
     * computed `color`, so the field picks up the surrounding theme; a literal
     * CSS colour is used verbatim.
     */
    color = input('currentColor');
    /** Maximum initial velocity, in pixels per frame, of each axis; each particle gets a random value in `±speed / 2`. Applied at seed time only. */
    speed = input(0.5);
    /**
     * Maximum distance, in pixels, at which two particles are joined by a line;
     * the line fades out as the pair approaches this distance. Set to 0 to draw
     * dots with no web.
     */
    connectDistance = input(120);
    /**
     * Lets the pointer repel nearby particles. Enabling it makes the host
     * capture pointer events (it is otherwise click-through), which can block
     * clicks on content behind the field. Has no effect on touch-only devices,
     * where there is no hover position. Read once during setup.
     */
    mouseInteraction = input(true);

    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private particles: Particle[] = [];
    private animationFrameId: number | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private mouseX = -1000;
    private mouseY = -1000;
    private resolvedColor = '#888888';

    private readonly mouseMoveHandler = (e: MouseEvent): void => {
        const rect = (this.el.nativeElement as HTMLElement).getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
    };

    private readonly mouseLeaveHandler = (): void => {
        this.mouseX = -1000;
        this.mouseY = -1000;
    };

    ngOnInit(): void {
        if (prefersReducedMotion()) return;

        this.ngZone.runOutsideAngular(() => {
            this.setupCanvas();
            this.resolveColor();
            this.createParticles();
            this.animate();
        });
    }

    ngOnDestroy(): void {
        if (this.animationFrameId != null) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.resizeObserver?.disconnect();
        const host = this.el.nativeElement as HTMLElement;
        host.removeEventListener('mousemove', this.mouseMoveHandler);
        host.removeEventListener('mouseleave', this.mouseLeaveHandler);
        this.canvas?.remove();
    }

    private resolveColor(): void {
        const raw = this.color();
        if (raw === 'currentColor' || raw.includes('var(')) {
            const host = this.el.nativeElement as HTMLElement;
            const computed = getComputedStyle(host);
             
            this.resolvedColor = computed.color || '#888888';
        } else {
            this.resolvedColor = raw;
        }
    }

    private setupCanvas(): void {
        const host = this.el.nativeElement as HTMLElement;
        this.canvas = this.renderer.createElement('canvas') as HTMLCanvasElement;
        this.renderer.setStyle(this.canvas, 'position', 'absolute');
        this.renderer.setStyle(this.canvas, 'inset', '0');
        this.renderer.setStyle(this.canvas, 'pointerEvents', 'none');
        this.renderer.setStyle(this.canvas, 'width', '100%');
        this.renderer.setStyle(this.canvas, 'height', '100%');
        this.renderer.appendChild(host, this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.syncCanvasSize();

        this.resizeObserver = new ResizeObserver(() => {
            this.syncCanvasSize();
            if (this.particles.length === 0) this.createParticles();
        });
        this.resizeObserver.observe(host);

        if (this.mouseInteraction()) {
            host.style.pointerEvents = 'auto';
            host.addEventListener('mousemove', this.mouseMoveHandler, { passive: true });
            host.addEventListener('mouseleave', this.mouseLeaveHandler);
        }
    }

    private syncCanvasSize(): void {
        if (!this.canvas) return;
        const host = this.el.nativeElement as HTMLElement;
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (w > 0 && h > 0) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
    }

    private createParticles(): void {
        if (!this.canvas || this.canvas.width === 0) return;
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.particles = [];

        for (let i = 0; i < this.count(); i++) {
            const spd = this.speed();
            this.particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * spd,
                vy: (Math.random() - 0.5) * spd,
                radius: 1 + Math.random() * 2,
            });
        }
    }

    private readonly animate = (): void => {
        if (!this.canvas || !this.ctx) return;
        const w = this.canvas.width;
        const h = this.canvas.height;

        if (w === 0 || h === 0) {
            this.animationFrameId = requestAnimationFrame(this.animate);
            return;
        }

        const color = this.resolvedColor;

        this.ctx.clearRect(0, 0, w, h);

        this.updateAndDrawParticles(w, h, color);
        this.drawConnections(color);

        this.ctx.globalAlpha = 1;
        this.animationFrameId = requestAnimationFrame(this.animate);
    };

    private updateAndDrawParticles(w: number, h: number, color: string): void {
        if (!this.ctx) return;
        const ctx = this.ctx;;
        const applyMouse = this.mouseInteraction() && this.mouseX > -999;

        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0 || p.x > w) p.vx *= -1;
            if (p.y < 0 || p.y > h) p.vy *= -1;

            if (applyMouse) {
                const dx = this.mouseX - p.x;
                const dy = this.mouseY - p.y;
                const dist = Math.hypot(dx, dy);
                if (dist < 100) {
                    p.vx -= dx * 0.002;
                    p.vy -= dy * 0.002;
                }
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.6;
            ctx.fill();
        }
    }

    private drawConnections(color: string): void {
        if (!this.ctx) return;
        const ctx = this.ctx;;
        const connDist = this.connectDistance();
        if (connDist <= 0) return;

        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const a = this.particles[i];
                const b = this.particles[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.hypot(dx, dy);
                if (dist < connDist) {
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = color;
                    ctx.globalAlpha = 0.3 * (1 - dist / connDist);
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }
}
