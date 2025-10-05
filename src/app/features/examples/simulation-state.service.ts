import { Injectable, computed, signal } from '@angular/core';
import { Counters, GraphData, GraphEdge, SimulationConfig } from '../../core/graph/graph.types';
import { VisualizationStateService } from './visualization-state.service';

@Injectable({ providedIn: 'root' })
export class SimulationStateService {
  // Config & runtime
  readonly config = signal<SimulationConfig>({ runs: 20, maxStepsPerRun: 200, speed: 1, fastMode: false });
  readonly isRunning = signal(false);
  readonly isPaused = signal(false);
  readonly currentRun = signal(0);
  readonly currentNodeId = signal<string | null>(null);
  readonly currentEdgeId = signal<string | null>(null);
  readonly counters = signal<Counters>({}); // instrumented only

  // Internal
  private timer: any = null;
  private rng: () => number = Math.random;

  // Derived from visualization state
  private get gd(): GraphData | null { return this.viz.graphData(); }
  private get instrumented(): Set<string> { return new Set(this.viz.instrumentedEdgeIds()); }

  // Public overlay for canvas
  readonly simOverlay = computed(() => ({
    counters: this.counters(),
    currentNodeId: this.currentNodeId(),
    currentEdgeId: this.currentEdgeId()
  }));

  constructor(private viz: VisualizationStateService) {}

  setRuns(n: number) {
    this.config.update(c => ({ ...c, runs: Math.max(1, Math.floor(n)) }));
  }
  setSpeed(mult: number) {
    this.config.update(c => ({ ...c, speed: Math.min(3, Math.max(0.25, mult)) }));
  }
  setFastMode(on: boolean) {
    this.config.update(c => ({ ...c, fastMode: on }));
  }

  reset() {
    this.stopTimer();
    this.isRunning.set(false);
    this.isPaused.set(false);
    this.currentRun.set(0);
    this.currentNodeId.set(null);
    this.currentEdgeId.set(null);
    this.counters.set({});
  }

  start() {
    if (!this.gd) return;
    this.reset();
    const cfg = this.config();
    this.rng = Math.random;
    this.isRunning.set(true);
    if (cfg.fastMode) {
      this.runFast();
    } else {
      this.runAnimated();
    }
  }

  pause() {
    if (!this.isRunning()) return;
    this.isPaused.set(true);
    this.stopTimer();
  }

  resume() {
    if (!this.isRunning()) return;
    if (!this.isPaused()) return;
    this.isPaused.set(false);
    this.tickLoop(); // resume timer
  }

  stop() {
    this.stopTimer();
    this.isRunning.set(false);
    this.isPaused.set(false);
    this.currentNodeId.set(null);
    this.currentEdgeId.set(null);
  }

  // --- Core simulation ------------------------------------------------------

  private runFast() {
    const gd = this.gd!;
    const inst = this.instrumented;
    const cfg = this.config();

    for (let r = 0; r < cfg.runs; r++) {
      // Traverse entry sentinel first (always instrumented in our rules)
      const entryEdge = gd.edges.find(e => e.id === '__entry_sentinel__');
      if (entryEdge && inst.has(entryEdge.id)) {
        this.inc(entryEdge.id);
      }
      // Start at ENTRY
      let node = 'ENTRY';
      let steps = 0;
      while (steps++ < cfg.maxStepsPerRun) {
        // If at EXIT, traverse exit sentinel and break
        if (node === 'EXIT') {
          break; // exit sentinel not counted by rules
        }
        const out = this.getOutgoing(gd, node);
        if (out.length === 0) break; // dead end
        const edge = this.pickEdge(out);
        if (inst.has(edge.id)) this.inc(edge.id);
        node = edge.target;
      }
    }

    this.currentRun.set(this.config().runs);
    this.isRunning.set(false);
  }

  private runAnimated() {
    // Initialize for first run
    this.currentRun.set(0);
    this.currentNodeId.set('ENTRY');
    // Count entry sentinel immediately if present & instrumented
    const gd = this.gd!;
    const entryEdge = gd.edges.find(e => e.id === '__entry_sentinel__');
    if (entryEdge && this.instrumented.has(entryEdge.id)) this.inc(entryEdge.id);
    this.tickLoop();
  }

  private tickLoop() {
    const cfg = this.config();
    const baseInterval = 500; // ms baseline
    const interval = Math.round(baseInterval / (cfg.speed || 1));
    this.stopTimer();
    this.timer = setInterval(() => this.tick(), interval);
  }

  private tick() {
    const gd = this.gd!;
    if (!this.isRunning() || this.isPaused()) return;

    let run = this.currentRun();
    if (run >= this.config().runs) {
      this.stop();
      return;
    }

    let node = this.currentNodeId();
    if (!node) node = 'ENTRY';
    // If we are at EXIT, finish this run and start next
    // if (node === 'EXIT') {
    //   run += 1;
    //   this.currentRun.set(run);
    //   if (run >= this.config().runs) {
    //     this.stop();
    //     return;
    //   }
    //   // Start next run
    //   this.currentNodeId.set('ENTRY');
    //   this.currentEdgeId.set('__entry_sentinel__');
    //   const entryEdge = gd.edges.find(e => e.id === '__entry_sentinel__');
    //   if (entryEdge && this.instrumented.has(entryEdge.id)) this.inc(entryEdge.id);
    //   return;
    // }

    // Special handling: EXIT node -> traverse exit sentinel before finishing
    if (node === 'EXIT') {
      const exitEdge = gd.edges.find(e => e.kind === 'exit');
      if (exitEdge) {
        this.currentEdgeId.set(exitEdge.id);
        this.currentNodeId.set(exitEdge.target); // __ghost_out__
      }
      // Wait one tick before finishing this run
      this.currentRun.set(run);
      // Mark that next tick will actually increment run
      this.currentNodeId.set('__ghost_out__');
      return;
    }

    // If we are on ghost_out after traversing exit sentinel, finish this run
    if (node === '__ghost_out__') {
      run += 1;
      this.currentRun.set(run);
      if (run >= this.config().runs) {
        this.stop();
        return;
      }
      // Start next run
      this.currentNodeId.set('ENTRY');
      this.currentEdgeId.set('__entry_sentinel__');
      const entryEdge = gd.edges.find(e => e.id === '__entry_sentinel__');
      if (entryEdge && this.instrumented.has(entryEdge.id)) this.inc(entryEdge.id);
      return;
    }

    // Pick next edge from current node
    const out = this.getOutgoing(gd, node);
    if (out.length === 0) {
      // dead end: jump to EXIT to avoid hang and continue next run
      this.currentNodeId.set('EXIT');
      this.currentEdgeId.set('__exit_sentinel__');
      return;
    }
    const edge = this.pickEdge(out);
    this.currentEdgeId.set(edge.id);
    if (this.instrumented.has(edge.id)) this.inc(edge.id);
    this.currentNodeId.set(edge.target);
  }

  // --- Helpers --------------------------------------------------------------

  private stopTimer() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private inc(edgeId: string) {
    this.counters.update(c => ({ ...c, [edgeId]: (c[edgeId] ?? 0) + 1 }));
  }

  private getOutgoing(gd: GraphData, nodeId: string): GraphEdge[] {
    return gd.edges.filter(e => e.source === nodeId);
  }

  private pickEdge(edges: GraphEdge[]): GraphEdge {
    // Probabilities proportional to weight > 0; if all zero -> uniform
    const weights = edges.map(e => (typeof e.weight === 'number' ? e.weight : 0));
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum <= 0) {
      const idx = Math.floor(this.rng() * edges.length);
      return edges[Math.min(idx, edges.length - 1)];
    }
    let r = this.rng() * sum;
    for (let i = 0; i < edges.length; i++) {
      if (r < weights[i]) return edges[i];
      r -= weights[i];
    }
    return edges[edges.length - 1];
  }
}
