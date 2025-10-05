import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GraphCanvasComponent } from '../../shared/graph-canvas/graph-canvas.component';
import { VisualizationStateService } from '../../features/examples/visualization-state.service';
import { SimulationStateService } from '../../features/examples/simulation-state.service';
import { GraphData, GraphLayoutName } from '../../core/graph/graph.types';

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

  // Overlay = viz overlay + simulation overlay combined
  readonly overlay = computed(() => {
    const base = this.state.overlay();
    const sim = this.sim.simOverlay();
    return {
      ...base,
      counters: sim.counters,
      currentNodeId: sim.currentNodeId,
      currentEdgeId: sim.currentEdgeId
    };
  });

  // Simulation props
  get runs() { return this.sim.config().runs; }
  get speed() { return this.sim.config().speed ?? 1; }
  get isRunning() { return this.sim.isRunning(); }
  get isPaused() { return this.sim.isPaused(); }
  get currentRun() { return this.sim.currentRun(); }

  constructor(private state: VisualizationStateService, private sim: SimulationStateService) {}

  pick(id: string): void { this.state.pickExample(id); this.sim.reset(); }
  onLayoutChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.state.layout.set(select.value as GraphLayoutName);
  }

  // Stepper
  startStep(): void { this.state.start(); this.sim.reset(); }
  nextStep(): void { this.state.next(); this.sim.reset(); }
  prevStep(): void { this.state.prev(); this.sim.reset(); }
  resetSteps(): void { this.state.reset(); this.sim.reset(); }

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
