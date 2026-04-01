import { TestBed } from '@angular/core/testing';
import { ExamplesWorkflowFacade } from './examples-workflow.facade';
import { ReconstructionStateService } from './reconstruction-state.service';
import { SimulationStateService } from './simulation-state.service';
import { ExamplesGraphStateService } from './visualization-state.service';

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
});