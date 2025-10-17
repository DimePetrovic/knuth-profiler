import { Injectable, computed, signal } from '@angular/core';
import { Counters, GraphData, GraphEdge, ReconStep } from '../../core/graph/graph.types';
import { VisualizationStateService } from './visualization-state.service';
import { SimulationStateService } from './simulation-state.service';

// Sentinel ids (by id, not by kind)
const ENTRY_SENTINEL_ID = '__entry_sentinel__';
const EXIT_SENTINEL_ID  = '__exit_sentinel__';
function isSentinelEdge(e: GraphEdge): boolean {
  return e.id === ENTRY_SENTINEL_ID || e.id === EXIT_SENTINEL_ID;
}

@Injectable({ providedIn: 'root' })
export class ReconstructionStateService {
  // Reconstructed counts for MST edges (edgeId -> count)
  readonly reconCounters = signal<Counters>({});
  // Ordered explanation steps user can browse
  readonly steps = signal<ReconStep[]>([]);
  // Pointer in the steps list
  readonly idx = signal<number>(-1);

  // Data providers
  private get gd(): GraphData | null { return this.viz.graphData(); }
  private get mstIds(): Set<string> { return new Set(this.viz.mstEdgeIds()); }

  // Known (instrumented) counters from simulation
  private get simCounters(): Counters { return this.sim.counters(); }

  // Merge known + reconstructed -> overlay counters for the canvas
  readonly mergedCounters = computed<Counters>(() => {
    const merged: Counters = { ...this.simCounters };
    const r = this.reconCounters();
    for (const k of Object.keys(r)) merged[k] = r[k];
    return merged;
  });

  /**
   * Pending = ALL MST edges (excluding sentinels by id) minus already reconstructed.
   * This is the correct definition of "Preostalo za rešavanje".
   */
  readonly pendingTreeEdgeIds = computed<string[]>(() => {
    const gd = this.gd; if (!gd) return [];
    const setTree = this.mstIds;
    const solved = new Set(Object.keys(this.reconCounters()));

    return gd.edges
      .filter(e => setTree.has(e.id))
      .filter(e => !isSentinelEdge(e)) // exclude only __entry_sentinel__/__exit_sentinel__
      .map(e => e.id)
      .filter(id => !solved.has(id));
  });

  constructor(
    private viz: VisualizationStateService,
    private sim: SimulationStateService
  ) {}

  reset() {
    this.reconCounters.set({});
    this.steps.set([]);
    this.idx.set(-1);
  }

  /**
   * Compute exactly one next MST edge using node-flow balance.
   * Rule: pick a node where there is EXACTLY ONE unknown MST incident edge
   * AND all other incident edges (MST or not) are known, or are sentinels (sentinels don't block).
   */
  computeNext(): ReconStep | null {
    const gd = this.gd; if (!gd) return null;

    const candidate = this.findSolvableNodeAndEdge();
    if (!candidate) {
      // Nothing solvable right now (insufficient information) or all done
      return null;
    }

    const { nodeId, edge } = candidate;

    // Solve x via balance at `nodeId`
    const { x, terms } = this.solveAtNode(gd, nodeId, edge);

    // Persist result
    const rec = { ...this.reconCounters() };
    rec[edge.id] = x;
    this.reconCounters.set(rec);

    const step: ReconStep = {
      solvedEdgeId: edge.id,
      value: x,
      nodeId,
      parentId: (edge.source === nodeId ? edge.target : edge.source),
      equation: terms,
      text: renderBalanceText(nodeId, edge, terms, x)
    };

    const arr = [...this.steps(), step];
    this.steps.set(arr);
    this.idx.set(arr.length - 1);

    return step;
  }

  // Optional step browsing
  prev(): ReconStep | null {
    const i = this.idx(); if (i <= 0) return null;
    this.idx.set(i - 1);
    return this.steps()[this.idx()];
  }
  next(): ReconStep | null {
    const i = this.idx(); if (i + 1 >= this.steps().length) return null;
    this.idx.set(i + 1);
    return this.steps()[this.idx()];
  }

  // ------------------------ Core selection logic ----------------------------

  /**
   * Find a node with EXACTLY ONE unknown MST incident edge,
   * such that all other incident edges (MST or non-MST) have known counts,
   * or are sentinels (sentinels don't block solving).
   */
  private findSolvableNodeAndEdge():
    | { nodeId: string; edge: GraphEdge }
    | null {
    const gd = this.gd; if (!gd) return null;

    const unknownMst = new Set(this.pendingTreeEdgeIds()); // unknowns to solve (MST-only)
    if (unknownMst.size === 0) return null;

    const known = this.allKnownCounts(); // includes sim + recon + virtual EXIT sentinel

    for (const n of gd.nodes) {
      const nodeId = n.id;
      const incident = gd.edges.filter(e => e.source === nodeId || e.target === nodeId);

      // Exactly one unknown MST around the node
      const unknownMstInc = incident.filter(e => unknownMst.has(e.id));
      if (unknownMstInc.length !== 1) continue;

      // All others must be known or sentinels
      const others = incident.filter(e => !unknownMst.has(e.id));
      const allOthersOk = others.every(e => isSentinelEdge(e) || known.has(e.id));
      if (!allOthersOk) continue;

      return { nodeId, edge: unknownMstInc[0] };
    }
    return null;
  }

  /**
   * Balance at node:
   *   sum(incomingKnown) + (x if unknown is incoming) = sum(outgoingKnown) + (x if unknown is outgoing)
   * => x = outSum - inSum   (if x is incoming)
   *    x = inSum - outSum   (if x is outgoing)
   * Returns both x and readable terms for explanation panel.
   */
  private solveAtNode(gd: GraphData, nodeId: string, xEdge: GraphEdge) {
    const known = this.allKnownCounts();

    const incomingKnown = gd.edges
      .filter(e => e.target === nodeId)
      .map(e => ({ e, v: known.get(e.id) }))
      .filter(x => x.v != null) as { e: GraphEdge, v: number }[];

    const outgoingKnown = gd.edges
      .filter(e => e.source === nodeId)
      .map(e => ({ e, v: known.get(e.id) }))
      .filter(x => x.v != null) as { e: GraphEdge, v: number }[];

    const sumIn = incomingKnown.reduce((a, b) => a + b.v, 0);
    const sumOut = outgoingKnown.reduce((a, b) => a + b.v, 0);

    const xIsIncoming = (xEdge.target === nodeId);

    // Build explanation terms: +incoming, -outgoing (relative to node balance)
    const terms: { edgeId: string; sign: 1 | -1; value: number; label?: string }[] = [];
    for (const { e, v } of incomingKnown) terms.push({ edgeId: e.id, sign: +1, value: v, label: e.label });
    for (const { e, v } of outgoingKnown) terms.push({ edgeId: e.id, sign: -1, value: v, label: e.label });

    let x: number;
    if (xIsIncoming) {
      // sumIn + x = sumOut  ->  x = sumOut - sumIn
      x = sumOut - sumIn;
    } else {
      // sumIn = sumOut + x  ->  x = sumIn - sumOut
      x = sumIn - sumOut;
    }

    return { x, terms };
  }

  /**
   * Known counts = simulation counters (instrumented + entry sentinel) + already reconstructed
   * + VIRTUAL exit sentinel set equal to entry sentinel (conservation of runs).
   * Exit sentinel is not displayed; it's only used internally for balance at EXIT node.
   */
  private allKnownCounts(): Map<string, number> {
    const m = new Map<string, number>();

    // 1) Instrumented (includes ENTRY sentinel if instrumented – in our logic it always is)
    const simC = this.simCounters;
    for (const k of Object.keys(simC)) m.set(k, simC[k]);

    // 2) Reconstructed (already solved MST edges)
    const recC = this.reconCounters();
    for (const k of Object.keys(recC)) m.set(k, recC[k]);

    // 3) Virtual EXIT sentinel = ENTRY sentinel (conservation of runs)
    if (m.has(ENTRY_SENTINEL_ID)) {
      const entryCount = m.get(ENTRY_SENTINEL_ID)!;
      m.set(EXIT_SENTINEL_ID, entryCount);
    }

    return m;
  }
}

// ---------------------------- Helpers ---------------------------------------

function renderBalanceText(
  nodeId: string,
  edge: GraphEdge,
  terms: { edgeId: string; sign: 1 | -1; value: number; label?: string }[],
  x: number
): string {
  const parts = terms.map(t => {
    const sign = t.sign > 0 ? '+' : '−';
    const name = t.label && t.label.length ? `${t.label} (${t.edgeId})` : t.edgeId;
    return `${sign} ${name} = ${t.value}`;
  });
  ;
  const xSide = (edge.target === nodeId) ? 'улаз' : 'излаз';
  const val = x >= 0 ? `${x}` : `−${Math.abs(x)}`;

  return `Баланс у чвору ${nodeId}: Σ(улази) = Σ(излази)
Рачунамо непознату MST грану ${edge.id} као део ${xSide}-а:
⇒ вредност непознате гране је ${val}.`;
}
