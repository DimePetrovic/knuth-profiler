import { computed, inject, Injectable } from '@angular/core';
import { GraphData, GraphLayoutName, ReconStep, VizStep } from '../../core/graph/graph.types';
import { ReconstructionStateService } from './reconstruction-state.service';
import { SimulationStateService } from './simulation-state.service';
import { ExamplesGraphStateService } from './visualization-state.service';

const STEP_DESCRIPTIONS: Record<VizStep, string> = {
  0: 'Старт – прикажи граф. Кликни „Покрени визуализацију“.',
  1: 'Тежине – на свакој грани видиш ознаку w=тежина.',
  2: 'MST – истакнуте су гране које чине максимално разапињуће стабло (по тежинама > 0).',
  3: 'Инструментација – означене су испрекиданом линијом гране које треба мерити.',
  4: 'Мерења – изабери број покретања и покрени симулацију. Током симулације видиш бројаче на инструментизованим гранама.',
  5: 'Реконструкција – приказ броја пролазака по свим гранама.'
};

@Injectable({ providedIn: 'root' })
export class ExamplesWorkflowFacade {
  private readonly visualization = inject(ExamplesGraphStateService);
  private readonly simulation = inject(SimulationStateService);
  private readonly reconstruction = inject(ReconstructionStateService);

  readonly examples = this.visualization.examples;
  readonly selectedId = this.visualization.selectedId;
  readonly step = this.visualization.step;
  readonly layoutName = this.visualization.layout;
  readonly selectedData = computed<GraphData | null>(() => this.visualization.graphData());
  readonly hasGraph = computed(() => this.selectedData() !== null);

  readonly overlay = computed(() => {
    const baseOverlay = this.visualization.overlay();
    const simulationOverlay = this.simulation.simOverlay();

    return {
      ...baseOverlay,
      counters: this.reconstruction.mergedCounters(),
      currentNodeId: simulationOverlay.currentNodeId,
      currentEdgeId: simulationOverlay.currentEdgeId
    };
  });

  readonly runs = computed(() => this.simulation.config().runs);
  readonly speed = computed(() => this.simulation.config().speed ?? 1);
  readonly isRunning = this.simulation.isRunning;
  readonly isPaused = this.simulation.isPaused;
  readonly currentRun = this.simulation.currentRun;
  readonly simulationStatusLabel = computed(() => {
    if (this.isRunning() && !this.isPaused()) {
      return 'Ради';
    }

    if (this.isRunning() && this.isPaused()) {
      return 'Пауза';
    }

    return 'Стојеће';
  });

  readonly reconSteps = this.reconstruction.steps;
  readonly reconIdx = this.reconstruction.idx;
  readonly pendingTreeEdges = this.reconstruction.pendingTreeEdgeIds;
  readonly reconLastMessage = this.reconstruction.lastComputeMessage;
  readonly stepDescription = computed(() => STEP_DESCRIPTIONS[this.step()]);

  readonly canStartVisualization = computed(() => this.step() === 0);
  readonly canAdvance = computed(() => this.step() > 0 && this.step() < 5);
  readonly isSimulationStep = computed(() => this.step() === 4);
  readonly isReconstructionStep = computed(() => this.step() >= 5);

  pickExample(exampleId: string): void {
    this.visualization.pickExample(exampleId);
    this.resetDerivedState();
  }

  setLayout(layoutName: string): void {
    if (layoutName === 'dagre' || layoutName === 'elk') {
      this.visualization.layout.set(layoutName as GraphLayoutName);
    }
  }

  loadImportedGraph(graphData: GraphData): void {
    this.visualization.setImportedGraph(graphData);
    this.resetDerivedState();
  }

  clearImportedGraph(): void {
    this.visualization.clearImportedGraph();
    this.resetDerivedState();
  }

  startStep(): void {
    this.visualization.start();
    this.resetDerivedState();
  }

  nextStep(): void {
    const before = this.step();
    this.visualization.next();
    this.handleStepTransition(before, this.step());
  }

  prevStep(): void {
    const before = this.step();
    this.visualization.prev();
    this.handleStepTransition(before, this.step());
  }

  resetSteps(): void {
    this.visualization.reset();
    this.resetDerivedState();
  }

  reconComputeNext(): ReconStep | null {
    if (Object.keys(this.simulation.counters()).length === 0) {
      const prevFastMode = this.simulation.config().fastMode ?? false;
      this.simulation.setFastMode(true);
      this.simulation.start();
      this.simulation.setFastMode(prevFastMode);
    }

    return this.reconstruction.computeNext();
  }

  reconPrev(): void {
    this.reconstruction.prev();
  }

  reconNext(): void {
    this.reconstruction.next();
  }

  reconReset(): void {
    this.reconstruction.reset();
  }

  setRuns(runs: number): void {
    this.simulation.setRuns(runs);
  }

  setSpeed(speed: number): void {
    this.simulation.setSpeed(speed);
  }

  simStart(): void {
    this.simulation.start();
  }

  simPause(): void {
    this.simulation.pause();
  }

  simResume(): void {
    this.simulation.resume();
  }

  simStop(): void {
    this.simulation.stop();
  }

  simReset(): void {
    this.simulation.reset();
  }

  private handleStepTransition(before: VizStep, after: VizStep): void {
    const keepsSimulationState = (before === 4 && after === 5) || (before === 5 && after === 4);
    const leftReconstruction = before === 5 && after < 5;

    if (!keepsSimulationState) {
      this.simulation.reset();
    }

    if (after < 5 || leftReconstruction) {
      this.reconstruction.reset();
    }
  }

  private resetDerivedState(): void {
    this.simulation.reset();
    this.reconstruction.reset();
  }
}