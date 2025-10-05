import { Injectable, WritableSignal, computed, signal } from '@angular/core';
import { ExampleItem, GraphData, GraphEdge, GraphLayoutName, GraphOverlay, VizStep } from '../../core/graph/graph.types';
import { ExamplesCatalogService } from './examples-catalog.service';

// Simple disjoint set for Kruskal (undirected MST by max total weight)
class DSU {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x)!;
    if (p !== x) this.parent.set(x, this.find(p));
    return this.parent.get(x)!;
  }
  union(a: string, b: string): boolean {
    const ra = this.find(a), rb = this.find(b);
    if (ra === rb) return false;
    this.parent.set(ra, rb);
    return true;
  }
}

@Injectable({ providedIn: 'root' })
export class VisualizationStateService {
  // Core state
  readonly examples: ExampleItem[] = [];
  readonly selectedId: WritableSignal<string> = signal<string>("");
  readonly step = signal<VizStep>(0);
  readonly layout = signal<GraphLayoutName>('dagre');

  // Derived
  readonly selectedExample = computed<ExampleItem | undefined>(() => this.examples.find(e => e.id === this.selectedId()));
  readonly graphData = computed<GraphData | null>(() => this.selectedExample()?.data ?? null);

  // MST and instrumentation
  readonly mstEdgeIds = computed<string[]>(() => {
    const gd = this.graphData();
    if (!gd) return [];
    return this.computeMaxWeightST(gd);
  });

  // Simple rule: instrument all non-tree edges
  readonly instrumentedEdgeIds = computed<string[]>(() => {
    const gd = this.graphData();
    if (!gd) return [];

    const mst = new Set(this.mstEdgeIds());

    // Base: all non-MST edges with positive weight (measurable, ignore zero-weight ghost edges)
    const base = gd.edges
      .filter(e => (typeof e.weight === 'number' ? e.weight : 0) > 0)
      .filter(e => !mst.has(e.id))
      .map(e => e.id);

    // Sentinels
    const entrySentinel = gd.edges.find(e => e.id === '__entry_sentinel__'); // ghost→ENTRY
    const exitSentinel  = gd.edges.find(e => e.id === '__exit_sentinel__');  // EXIT→ghost

    // Always include ENTRY sentinel
    if (entrySentinel && !base.includes(entrySentinel.id)) {
      base.push(entrySentinel.id);
    }

    // Never include EXIT sentinel
    const result = exitSentinel ? base.filter(id => id !== exitSentinel.id) : base;

    return Array.from(new Set(result));
  });


  // Overlay per step
  readonly overlay = computed<GraphOverlay>(() => {
    const s = this.step();
    return {
      showWeights: s === 1,
      mstEdgeIds: s >= 2 ? this.mstEdgeIds() : [],
      instrumentedEdgeIds: s >= 3 ? this.instrumentedEdgeIds() : [],
      showEdgeIds: s >= 5
    };
  });

  constructor(private catalog: ExamplesCatalogService) {
    this.examples = this.catalog.list();
    this.selectedId = signal<string>(this.catalog.getDefault().id);
  }

  // Step controls
  start(): void { this.step.set(1); }     // Start -> Weights
  next(): void  { this.step.update(v => Math.min(5, (v + 1)) as VizStep); }
  prev(): void  { this.step.update(v => Math.max(0, (v - 1)) as VizStep); }
  reset(): void { this.step.set(0); }

  pickExample(id: string): void {
    this.selectedId.set(id);
    this.reset();
  }

  // --- Algorithms -----------------------------------------------------------

  // Max-weight spanning tree on undirected view (ignore entry/exit edges)
  private computeMaxWeightST(data: GraphData): string[] {
    const nodes = data.nodes.map(n => n.id);
    const dsu = new DSU();

    const edges = data.edges
      .map(e => ({ e, w: typeof e.weight === 'number' ? e.weight : 0 }))
      .filter(x => x.w > 0); // exclude zero-weight edges (sentinel ghost edges)

    // Sort by descending weight, tie-break by id (deterministic)
    edges.sort((a, b) => {
      const d = b.w - a.w;
      return d !== 0 ? d : (a.e.id < b.e.id ? -1 : a.e.id > b.e.id ? 1 : 0);
    });

    const picked: string[] = [];
    for (const { e } of edges) {
      // Undirected connectivity check
      if (dsu.union(e.source, e.target)) {
        picked.push(e.id);
      }
      if (picked.length >= nodes.length - 1) break;
    }
    return picked;
  }
}
