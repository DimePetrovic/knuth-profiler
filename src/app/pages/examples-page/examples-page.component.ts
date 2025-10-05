import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GraphCanvasComponent } from '../../shared/graph-canvas/graph-canvas.component';
import { VisualizationStateService } from '../../features/examples/visualization-state.service';
import { SimulationStateService } from '../../features/examples/simulation-state.service';
import { GraphData, GraphLayoutName } from '../../core/graph/graph.types';
import { ReconstructionStateService } from '../../features/examples/reconstruction-state.service';

@Component({
  selector: 'app-examples-page',
  standalone: true,
  imports: [CommonModule, GraphCanvasComponent],
  templateUrl: './examples-page.component.html'
})
export class ExamplesPageComponent {
  // Viz state
  get examples() { return this.state.examples; }
  get selectedId() { return this.state.selectedId(); }
  get step() { return this.state.step(); }
  get layoutName() { return this.state.layout(); }
  readonly selectedData = computed<GraphData | null>(() => this.state.graphData());

  // Merge counters (sim + recon) into overlay
  readonly overlay = computed(() => {
    const base = this.state.overlay();
    const simo = this.sim.simOverlay();
    const mergedCounters = this.recon.mergedCounters();
    return {
      ...base,
      counters: mergedCounters,
      currentNodeId: simo.currentNodeId,
      currentEdgeId: simo.currentEdgeId
    };
  });

  // Simulation props
  get runs() { return this.sim.config().runs; }
  get speed() { return this.sim.config().speed ?? 1; }
  get isRunning() { return this.sim.isRunning(); }
  get isPaused() { return this.sim.isPaused(); }
  get currentRun() { return this.sim.currentRun(); }

  // Recon getters for template
  get reconSteps() { return this.recon.steps(); }
  get reconIdx() { return this.recon.idx(); }
  get pendingTreeEdges() { return this.recon.pendingTreeEdgeIds(); }

  constructor(private state: VisualizationStateService, private sim: SimulationStateService, private recon: ReconstructionStateService) {}

  pick(id: string): void { this.state.pickExample(id); this.sim.reset(); this.recon.reset(); }
  onLayoutChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.state.layout.set(select.value as GraphLayoutName);
  }

  // Hook step transitions to reset recon if user goes back/forward
  startStep(): void { this.state.start(); this.sim.reset(); this.recon.reset(); }
  nextStep(): void {
    const before = this.state.step();
    this.state.next();
    const after = this.state.step();

    // Preserve simulation counters when moving from step 4 to 5
    if (!(before === 4 && after === 5)) {
      this.sim.reset(); // safe to reset in other transitions
    }

    // Reset reconstruction unless we are entering step 5
    if (after < 5) {
      this.recon.reset();
    }
  };  
  prevStep(): void {
    const before = this.state.step();
    this.state.prev();
    const after = this.state.step();

    // Preserve simulation counters when moving from step 5 back to 4
    // No sim.reset() here. Leave counters intact.

    // If we moved away from 5 (e.g., 5 -> 3), clear reconstruction
    if (before === 5 && after < 5) {
      this.recon.reset();
    }
  }  
  resetSteps(): void { this.state.reset(); this.sim.reset(); this.recon.reset(); }

  // Recon actions
  reconComputeNext(): void { this.recon.computeNext(); }
  reconPrev(): void { this.recon.prev(); }
  reconNext(): void { this.recon.next(); }
  reconReset(): void { this.recon.reset(); }

  // Simulation controls
  onRunsChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.sim.setRuns(Number(input.value));
  }
  onSpeedChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.sim.setSpeed(Number(input.value));
  }

  simStart(): void { this.sim.start(); }
  simPause(): void { this.sim.pause(); }
  simResume(): void { this.sim.resume(); }
  simStop(): void { this.sim.stop(); }
  simReset(): void { this.sim.reset(); }
}
