import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import elk from 'cytoscape-elk';
import { GraphData, GraphLayoutName, GraphOverlay } from '../../core/graph/graph.types';

// Register plugins once
cytoscape.use(dagre);
cytoscape.use(elk);

@Component({
  selector: 'app-graph-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './graph-canvas.component.html'
})
export class GraphCanvasComponent implements OnInit, OnChanges, OnDestroy {
  @Input() data: GraphData | null = null;
  @Input() layoutName: GraphLayoutName = 'dagre';
  @Input() overlay: GraphOverlay | null = null;

  @ViewChild('cyHost', { static: true }) cyHost!: ElementRef<HTMLDivElement>;
  private cy?: Core;

  ngOnInit(): void {
    this.cy = cytoscape({
      container: this.cyHost.nativeElement,
      elements: [],
      style: [
        // Nodes
        { selector: 'node[ghost]', style: { 'opacity': 0, 'width': 1, 'height': 1, 'events': 'no' } },
        { selector: 'node[kind = "entry"]', style: { 'shape': 'round-rectangle', 'background-color': '#22c55e', 'label': 'data(label)', 'color': '#111827' } },
        { selector: 'node[kind = "exit"]',  style: { 'shape': 'round-rectangle', 'background-color': '#ef4444', 'label': 'data(label)', 'color': '#111827' } },
        { selector: 'node[kind = "decision"]', style: { 'shape': 'diamond', 'background-color': '#0ea5e9', 'label': 'data(label)', 'color': '#111827' } },
        { selector: 'node', style: { 'background-color': '#1f2937', 'label': 'data(label)', 'color': '#e5e7eb', 'font-size': 12, 'text-wrap': 'wrap', 'text-max-width': "160", 'text-valign': 'center', 'text-halign': 'center' } },

        // Edges (base)
        { selector: 'edge[kind = "entry"]', style: { 'line-color': '#22c55e', 'target-arrow-color': '#22c55e' } },
        { selector: 'edge[kind = "exit"]',  style: { 'line-color': '#ef4444', 'target-arrow-color': '#ef4444' } },
        { selector: 'edge', style: { 
          'curve-style': 'bezier',
          'width': 2,
          'line-color': '#6b7280',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#6b7280',
          'label': 'data(_label)',
          'font-size': 14,           
          'font-weight': 'bold',     
          'color': '#1f2937',        
          'text-background-color': '#ffffff',
          'text-background-opacity': 0.9,
          'text-background-shape': 'roundrectangle',
          'text-background-padding': "2"
        }},

        // MST & instrumentation layers
        { selector: 'edge.mst', style: { 'width': 5, 'line-color': '#111827', 'target-arrow-color': '#111827' } },
        { selector: 'edge.instrumented', style: { 'line-style': 'dashed' } },

        // Simulation highlight
        { selector: 'edge.current', style: { 'line-color': '#7c3aed', 'target-arrow-color': '#7c3aed', 'width': 6 } },
        { selector: 'node.current', style: { 'border-width': 4, 'border-color': '#7c3aed' } },

        { selector: ':selected', style: { 'border-width': 3, 'border-color': '#f59e0b' } }
      ],
      layout: { name: 'dagre' },
      wheelSensitivity: 0.2,
      pixelRatio: 1
    });

    if (this.data) {
      this.setGraph(this.data);
      this.applyOverlay();
      this.runLayout();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.cy) return;
    if (changes['data'] && this.data) {
      this.setGraph(this.data);
      this.applyOverlay();
      this.runLayout();
    }
    if (changes['overlay']) {
      this.applyOverlay();
    }
    if (changes['layoutName']) {
      this.runLayout();
    }
  }

  ngOnDestroy(): void { this.cy?.destroy(); }

  fit(): void { this.cy?.fit(undefined, 20); }
  relayout(): void { this.runLayout(); }

  // --- Internals ------------------------------------------------------------

  private setGraph(graph: GraphData): void {
    const nodes: ElementDefinition[] = graph.nodes.map(n => ({
      data: { id: n.id, label: n.label ?? n.id, kind: n.kind ?? 'normal', ...(n.data ?? {}) }
    }));
    const edges: ElementDefinition[] = graph.edges.map(e => ({
      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        kind: e.kind ?? 'normal',
        label: e.label ?? '',
        weight: e.weight ?? null,
        _label: e.label ?? ''
      }
    }));
    this.cy!.elements().remove();
    this.cy!.add([...nodes, ...edges]);
  }

  private applyOverlay(): void {
    if (!this.cy) return;
    const ov = this.overlay ?? { showWeights: false, mstEdgeIds: [], instrumentedEdgeIds: [] };

    // Reset classes and labels
    this.cy.nodes().removeClass('current');
    this.cy.edges().forEach(e => {
      e.removeClass('mst');
      e.removeClass('instrumented');
      e.removeClass('current');
      const data = e.data();
      e.data('_label', data.label || '');
    });

    // Weights label
    if (ov.showWeights) {
      this.cy.edges().forEach(e => {
        const w = e.data('weight');
        const base = e.data('label') || '';
        const suffix = typeof w === 'number' ? ` (w=${w})` : '';
        e.data('_label', `${base}${suffix}`);
      });
    }

    // MST
    const mst = new Set(ov.mstEdgeIds ?? []);
    this.cy.edges().forEach(e => { if (mst.has(e.id())) e.addClass('mst'); });

    // Instrumentation
    const inst = new Set(ov.instrumentedEdgeIds ?? []);
    this.cy.edges().forEach(e => { if (inst.has(e.id())) e.addClass('instrumented'); });

    // Counters (instrumented only)
    if (ov.counters) {
      const counters = ov.counters;
      this.cy.edges().forEach(e => {
        const id = e.id();
        if (counters[id] != null) {
          const base = e.data('label') || '';
          const label = base ? `${base}  ×${counters[id]}` : `×${counters[id]}`;
          e.data('_label', label);
        }
      });
    }

    // Current highlight
    if (ov.currentNodeId) {
      const n = this.cy.getElementById(ov.currentNodeId);
      if (n) n.addClass('current');
    }
    if (ov.currentEdgeId) {
      const ed = this.cy.getElementById(ov.currentEdgeId);
      if (ed) ed.addClass('current');
    }
  }

  private runLayout(): void {
    if (!this.cy) return;
    const name = this.layoutName;
    const layoutOpts: any = name === 'elk'
      ? { name: 'elk', fit: true, elk: { algorithm: 'layered', 'elk.direction': 'DOWN', 'elk.layered.spacing.nodeNodeBetweenLayers': 40 } }
      : { name: 'dagre', fit: true, nodeSep: 30, rankSep: 60, rankDir: 'TB' };
    this.cy.layout(layoutOpts).run();
    this.fit();
  }
}
