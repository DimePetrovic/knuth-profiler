import { TestBed } from '@angular/core/testing';
import { ExamplesWorkflowFacade } from './examples-workflow.facade';
import { ReconstructionStateService } from './reconstruction-state.service';
import { SimulationStateService } from './simulation-state.service';
import { ExamplesGraphStateService } from './visualization-state.service';
import { GraphData } from '../../core/graph/graph.types';

const IMPORTED_GRAPH_FIXTURE: GraphData = {
  nodes: [
    { id: 'ENTRY', label: 'ENTRY', kind: 'entry' },
    { id: 'A', label: 'A', kind: 'normal' },
    { id: 'EXIT', label: 'EXIT', kind: 'exit' }
  ],
  edges: [
    { id: 'e0', source: 'ENTRY', target: 'A', kind: 'normal', weight: 1 },
    { id: 'e1', source: 'A', target: 'EXIT', kind: 'normal', weight: 1 }
  ]
};

describe('ExamplesWorkflowFacade', () => {
  let facade: ExamplesWorkflowFacade;
  let visualization: ExamplesGraphStateService;
  let simulation: SimulationStateService;
  let reconstruction: ReconstructionStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    facade = TestBed.inject(ExamplesWorkflowFacade);
    visualization = TestBed.inject(ExamplesGraphStateService);
    simulation = TestBed.inject(SimulationStateService);
    reconstruction = TestBed.inject(ReconstructionStateService);
  });

  it('preserves simulation counters when moving from measurement to reconstruction', () => {
    visualization.step.set(4);
    simulation.counters.set({ e2: 3 });
    reconstruction.reconCounters.set({ e0: 1 });

    facade.nextStep();

    expect(visualization.step()).toBe(5);
    expect(simulation.counters()).toEqual({ e2: 3 });
    expect(reconstruction.reconCounters()).toEqual({ e0: 1 });
  });

  it('resets both simulation and reconstruction when advancing before measurement', () => {
    visualization.step.set(2);
    simulation.counters.set({ e2: 3 });
    reconstruction.reconCounters.set({ e0: 1 });

    facade.nextStep();

    expect(visualization.step()).toBe(3);
    expect(simulation.counters()).toEqual({});
    expect(reconstruction.reconCounters()).toEqual({});
  });

  it('resets reconstruction but keeps simulation counters when leaving reconstruction', () => {
    visualization.step.set(5);
    simulation.counters.set({ e2: 3 });
    reconstruction.reconCounters.set({ e0: 1 });

    facade.prevStep();

    expect(visualization.step()).toBe(4);
    expect(simulation.counters()).toEqual({ e2: 3 });
    expect(reconstruction.reconCounters()).toEqual({});
  });

  it('requires imported CFG graph in cfg context before first step can proceed', () => {
    facade.enterCfgPage();
    visualization.selectedId.set(visualization.examples[0].id);

    expect(facade.step()).toBe(0);
    expect(facade.canProceedFromCurrentStep()).toBeFalse();

    facade.loadImportedGraph(IMPORTED_GRAPH_FIXTURE);
    expect(facade.canProceedFromCurrentStep()).toBeTrue();
  });

  it('enterExamplesPage hard-resets runtime state and requires fresh selection', () => {
    facade.loadImportedGraph(IMPORTED_GRAPH_FIXTURE);
    visualization.step.set(4);
    simulation.counters.set({ e2: 9 });
    reconstruction.reconCounters.set({ e0: 5 });

    facade.enterExamplesPage();

    expect(facade.step()).toBe(0);
    expect(visualization.importedGraphData()).toBeNull();
    expect(facade.selectedId()).toBe('');
    expect(simulation.counters()).toEqual({});
    expect(reconstruction.reconCounters()).toEqual({});
    expect(facade.canProceedFromCurrentStep()).toBeFalse();
  });

  it('finishAndReset clears both graph sources and runtime state', () => {
    facade.loadImportedGraph(IMPORTED_GRAPH_FIXTURE);
    facade.pickExample(visualization.examples[0].id);
    visualization.step.set(5);
    simulation.counters.set({ e9: 1 });
    reconstruction.reconCounters.set({ e0: 7 });

    facade.finishAndReset();

    expect(facade.step()).toBe(0);
    expect(visualization.importedGraphData()).toBeNull();
    expect(facade.selectedId()).toBe('');
    expect(simulation.counters()).toEqual({});
    expect(reconstruction.reconCounters()).toEqual({});
  });
});