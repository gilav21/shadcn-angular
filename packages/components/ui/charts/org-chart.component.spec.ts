import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrgChartComponent } from './org-chart.component';
import { OrgNode } from './chart.types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('OrgChartComponent', () => {
    let component: OrgChartComponent;
    let fixture: ComponentFixture<OrgChartComponent>;

    const sampleData: OrgNode[] = [
        { id: '1', name: 'CEO', title: 'Chief Executive Officer', parentId: null },
        { id: '2', name: 'CTO', title: 'Chief Technology Officer', parentId: '1' },
        { id: '3', name: 'CFO', title: 'Chief Financial Officer', parentId: '1' },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [OrgChartComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(OrgChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should build a tree from data', () => {
        expect(component.tree()).toBeTruthy();
        expect(component.tree()!.node.name).toBe('CEO');
    });

    it('should flatten nodes', () => {
        expect(component.flatNodes().length).toBe(3);
    });

    it('should compute connections between nodes', () => {
        expect(component.connections().length).toBe(2);
    });

    it('should render an SVG element', () => {
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).toBeTruthy();
    });

    it('should return initials for a name', () => {
        expect(component.getInitials('John Doe')).toBe('JD');
    });

    it('should emit nodeClick when onNodeClick is called', () => {
        let emitted: unknown;
        component.nodeClick.subscribe(val => emitted = val);

        const node = sampleData[0];
        const event = new MouseEvent('click');
        component.onNodeClick(event, node);

        expect(emitted).toBeDefined();
        expect((emitted as { node: OrgNode }).node.name).toBe('CEO');
    });

    it('should set hoveredId and emit nodeHover on onNodeHover', () => {
        let emitted: unknown;
        component.nodeHover.subscribe(val => emitted = val);

        const node = sampleData[1];
        component.onNodeHover(node);

        expect(component.hoveredId()).toBe('2');
        expect(emitted).toBeDefined();
        expect((emitted as OrgNode).name).toBe('CTO');
    });

    it('should reset hoveredId and emit null on onNodeLeave', () => {
        let emitted: unknown = 'not-set';
        component.nodeHover.subscribe(val => emitted = val);

        component.onNodeHover(sampleData[0]);
        expect(component.hoveredId()).toBe('1');

        component.onNodeLeave();
        expect(component.hoveredId()).toBeNull();
        expect(emitted).toBeNull();
    });

    it('should build tree with correct parent-child relationships', () => {
        const tree = component.tree()!;
        expect(tree.node.name).toBe('CEO');
        expect(tree.children.length).toBe(2);
        expect(tree.children[0].node.name).toBe('CTO');
        expect(tree.children[1].node.name).toBe('CFO');
    });

    it('should assign non-zero positions to flat nodes', () => {
        const nodes = component.flatNodes();
        const ceoNode = nodes.find(n => n.node.name === 'CEO')!;
        const ctoNode = nodes.find(n => n.node.name === 'CTO')!;

        expect(ceoNode.width).toBeGreaterThan(0);
        expect(ceoNode.height).toBeGreaterThan(0);
        expect(ctoNode.y).toBeGreaterThan(0);
    });

    it('should generate connection paths containing M commands', () => {
        const connections = component.connections();
        for (const connection of connections) {
            expect(connection.path).toContain('M');
        }
    });

    it('should change node positions when layout is horizontal', () => {
        const verticalNodes = component.flatNodes().map(n => ({ x: n.x, y: n.y }));

        fixture.componentRef.setInput('layout', 'horizontal');
        fixture.detectChanges();

        const horizontalNodes = component.flatNodes().map(n => ({ x: n.x, y: n.y }));

        const verticalCTO = verticalNodes[1];
        const horizontalCTO = horizontalNodes[1];
        expect(verticalCTO.x).not.toBe(horizontalCTO.x);
    });

    it('should return correct aria label from getNodeAriaLabel', () => {
        const label = component.getNodeAriaLabel(sampleData[0]);
        expect(label).toBe('CEO, Chief Executive Officer');
    });

    it('should return name only in aria label when title is absent', () => {
        const nodeWithoutTitle: OrgNode = { id: '10', name: 'Intern', parentId: '2' };
        const label = component.getNodeAriaLabel(nodeWithoutTitle);
        expect(label).toBe('Intern');
    });

    it('should return chart color by level for nodes without custom color', () => {
        const tree = component.tree()!;
        const ceoColor = component.getNodeColor(tree);
        const ctoColor = component.getNodeColor(tree.children[0]);

        expect(ceoColor).toBe('hsl(221, 83%, 53%)');
        expect(ctoColor).toBe('hsl(142, 71%, 45%)');
    });

    it('should return custom color when node has one', () => {
        const customData: OrgNode[] = [
            { id: '1', name: 'Boss', color: '#ff0000', parentId: null },
        ];
        fixture.componentRef.setInput('data', customData);
        fixture.detectChanges();

        const tree = component.tree()!;
        const color = component.getNodeColor(tree);
        expect(color).toBe('#ff0000');
    });

    it('should return null tree for empty data', () => {
        fixture.componentRef.setInput('data', []);
        fixture.detectChanges();

        expect(component.tree()).toBeNull();
        expect(component.flatNodes()).toEqual([]);
        expect(component.connections()).toEqual([]);
    });
});
