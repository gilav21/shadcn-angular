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
import { prefersReducedMotion } from '../lib/utils';

interface Meteor {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    headSize: number;
    trailLength: number;
    opacity: number;
    maxOpacity: number;
    fadeIn: boolean;
}

@Component({
    selector: 'ui-meteors',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: ``,
    host: {
        '[style.position]': '"absolute"',
        '[style.inset]': '"0"',
        '[style.display]': '"block"',
        '[style.pointerEvents]': '"none"',
        '[attr.data-slot]': '"meteors"',
    },
})
export class MeteorsComponent implements OnInit, OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly ngZone = inject(NgZone);
    private readonly renderer = inject(Renderer2);

    count = input(20);
    speed = input<'slow' | 'medium' | 'fast'>('medium');
    color = input('white');
    class = input('');

    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private meteors: Meteor[] = [];
    private animationFrameId: number | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private rgb = { r: 255, g: 255, b: 255 };

    ngOnInit() {
        if (prefersReducedMotion()) return;
        this.ngZone.runOutsideAngular(() => {
            this.setupCanvas();
            this.resolveColor();
            this.createMeteors();
            this.animate();
        });
    }

    ngOnDestroy() {
        if (this.animationFrameId != null) cancelAnimationFrame(this.animationFrameId);
        this.resizeObserver?.disconnect();
        this.canvas?.remove();
    }

    private resolveColor() {
        const raw = this.color();
        if (raw === 'white') {
            this.rgb = { r: 255, g: 255, b: 255 };
            return;
        }
        const temp = document.createElement('div');
        temp.style.color = raw;
        document.body.appendChild(temp);
        const computed = getComputedStyle(temp).color;
        document.body.removeChild(temp);
        const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
            this.rgb = { r: +match[1], g: +match[2], b: +match[3] };
        }
    }

    private setupCanvas() {
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
            if (this.meteors.length === 0) this.createMeteors();
        });
        this.resizeObserver.observe(host);
    }

    private syncCanvasSize() {
        if (!this.canvas) return;
        const host = this.el.nativeElement as HTMLElement;
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (w > 0 && h > 0) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
    }

    private speedMultiplier(): number {
        const s = this.speed();
        if (s === 'slow') return 0.5;
        if (s === 'fast') return 2;
        return 1;
    }

    private spawnMeteor(randomPhase: boolean): Meteor {
        const w = this.canvas?.width ?? 800;
        const h = this.canvas?.height ?? 400;
        const mult = this.speedMultiplier();

        const baseAngle = Math.PI * 0.78;
        const angle = baseAngle + (Math.random() - 0.5) * 0.7;
        const spd = (1 + Math.random() * 3) * mult;

        let x: number;
        let y: number;
        if (Math.random() > 0.3) {
            x = Math.random() * w * 1.4 - w * 0.1;
            y = -10 - Math.random() * 80;
        } else {
            x = w + 10 + Math.random() * 60;
            y = Math.random() * h * 0.5;
        }

        const m: Meteor = {
            x, y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            angle,
            headSize: 0.5 + Math.random() * 3.5,
            trailLength: 30 + Math.random() * 200,
            opacity: 0,
            maxOpacity: 0.5 + Math.random() * 0.5,
            fadeIn: true,
        };

        if (randomPhase) {
            const travel = (Math.max(w, h) * 1.2) * Math.random();
            const steps = travel / spd;
            m.x += m.vx * steps;
            m.y += m.vy * steps;
            m.opacity = m.maxOpacity;
            m.fadeIn = false;
        }

        return m;
    }

    private createMeteors() {
        this.meteors = [];
        for (let i = 0; i < this.count(); i++) {
            this.meteors.push(this.spawnMeteor(true));
        }
    }

    private outOfBounds(m: Meteor): boolean {
        const w = this.canvas?.width ?? 800;
        const h = this.canvas?.height ?? 400;
        return m.x < -250 || m.x > w + 250 || m.y > h + 250 || m.y < -250;
    }

    private animate = () => {
        if (!this.canvas || !this.ctx) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        if (w === 0 || h === 0) {
            this.animationFrameId = requestAnimationFrame(this.animate);
            return;
        }

        const { r, g, b } = this.rgb;
        ctx.clearRect(0, 0, w, h);

        for (let i = 0; i < this.meteors.length; i++) {
            const m = this.meteors[i];

            m.x += m.vx;
            m.y += m.vy;

            if (m.fadeIn) {
                m.opacity = Math.min(m.opacity + 0.04, m.maxOpacity);
                if (m.opacity >= m.maxOpacity) m.fadeIn = false;
            }

            if (this.outOfBounds(m)) {
                this.meteors[i] = this.spawnMeteor(false);
                continue;
            }

            const op = m.opacity;
            if (op <= 0) continue;

            const tailX = m.x - Math.cos(m.angle) * m.trailLength;
            const tailY = m.y - Math.sin(m.angle) * m.trailLength;

            const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
            grad.addColorStop(0, `rgba(${r},${g},${b},${op * 0.9})`);
            grad.addColorStop(0.15, `rgba(${r},${g},${b},${op * 0.5})`);
            grad.addColorStop(0.5, `rgba(${r},${g},${b},${op * 0.15})`);
            grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

            ctx.beginPath();
            ctx.moveTo(m.x, m.y);
            ctx.lineTo(tailX, tailY);
            ctx.strokeStyle = grad;
            ctx.lineWidth = m.headSize * 0.5;
            ctx.lineCap = 'round';
            ctx.stroke();

            const glow = m.headSize * 5;
            const hg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, glow);
            hg.addColorStop(0, `rgba(${r},${g},${b},${op * 0.8})`);
            hg.addColorStop(0.15, `rgba(${r},${g},${b},${op * 0.3})`);
            hg.addColorStop(1, `rgba(${r},${g},${b},0)`);

            ctx.beginPath();
            ctx.arc(m.x, m.y, glow, 0, Math.PI * 2);
            ctx.fillStyle = hg;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(m.x, m.y, m.headSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r},${g},${b},${op})`;
            ctx.fill();
        }

        this.animationFrameId = requestAnimationFrame(this.animate);
    };
}
