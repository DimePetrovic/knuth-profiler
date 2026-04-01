import { Injectable, computed, signal } from '@angular/core';
import { Counters, GraphData, SimulationConfig } from '../../core/graph/graph.types';
import { ExamplesGraphStateService } from './visualization-state.service';
import {
  runFastSimulation,
  initializeAnimatedTraversal,
  tickAnimatedTraversal,
  AnimatedTraversalState
} from './simulation.engine';

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

  constructor(private viz: ExamplesGraphStateService) {}

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

  // --- Core simulation (using pure engine) --------------------------------

  private runFast() {
    const gd = this.gd;
    if (!gd) return;

    const cfg = this.config();
    const counters = runFastSimulation(gd, this.instrumented, cfg, this.rng);

    this.counters.set(counters);
    this.currentRun.set(cfg.runs);
    this.isRunning.set(false);
  }

  private runAnimated() {
    const gd = this.gd;
    if (!gd) return;

    const state = initializeAnimatedTraversal(gd, this.instrumented);
    this.applyTraversalState(state);
    this.tickLoop();
  }

  private tick() {
    if (!this.isRunning() || this.isPaused()) return;

    const gd = this.gd;
    if (!gd) return;

    // Reconstruct engine state from signals
    const currentState: AnimatedTraversalState = {
      currentRun: this.currentRun(),
      currentNodeId: this.currentNodeId() || '',
      currentEdgeId: this.currentEdgeId(),
      counters: this.counters(),
      isFinished: false
    };

    const cfg = this.config();
    const nextState = tickAnimatedTraversal(gd, this.instrumented, cfg, currentState);

    this.applyTraversalState(nextState);

    if (nextState.isFinished) {
      this.stop();
    }
  }

  private applyTraversalState(state: AnimatedTraversalState) {
    this.currentRun.set(state.currentRun);
    this.currentNodeId.set(state.currentNodeId);
    this.currentEdgeId.set(state.currentEdgeId);
    this.counters.set(state.counters);
  }

  // --- Helpers ----------------------------------------------------------

  private stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tickLoop() {
    const cfg = this.config();
    const baseInterval = 500; // ms baseline
    const interval = Math.round(baseInterval / (cfg.speed || 1));
    this.stopTimer();
    this.timer = setInterval(() => this.tick(), interval);
  }
}
