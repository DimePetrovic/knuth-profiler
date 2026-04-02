import { TestBed } from '@angular/core/testing';

import { SimulationStateService } from './simulation-state.service';

describe('SimulationStateService', () => {
  let service: SimulationStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SimulationStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
  describe('Configuration', () => {
    it('should update run count', () => {
      service.setRuns(10);
      expect(service.config().runs).toBe(10);
    });

    it('should clamp run count to minimum 0', () => {
      service.setRuns(0);
      expect(service.config().runs).toBe(0);
    });

    it('should normalize NaN run count to 0', () => {
      service.setRuns(Number.NaN);
      expect(service.config().runs).toBe(0);
    });

    it('should update speed', () => {
      service.setSpeed(2);
      expect(service.config().speed).toBe(2);
    });

    it('should clamp speed between 0.25 and 3', () => {
      service.setSpeed(5);
      expect(service.config().speed).toBe(3);

      service.setSpeed(0.1);
      expect(service.config().speed).toBe(0.25);
    });

    it('should toggle fastMode', () => {
      service.setFastMode(true);
      expect(service.config().fastMode).toBe(true);

      service.setFastMode(false);
      expect(service.config().fastMode).toBe(false);
    });
  });

  describe('State Management', () => {
    it('should initialize in stopped state', () => {
      expect(service.isRunning()).toBe(false);
      expect(service.isPaused()).toBe(false);
      expect(service.currentRun()).toBe(0);
      expect(service.currentNodeId()).toBe(null);
      expect(service.currentEdgeId()).toBe(null);
    });

    it('should reset all state', () => {
      service.config.set({ runs: 5, maxStepsPerRun: 100, speed: 2, fastMode: true });
      service.currentRun.set(3);
      service.currentNodeId.set('A');
      service.counters.set({ e1: 10 });
      service.isConfigLocked.set(true);

      service.reset();

      expect(service.currentRun()).toBe(0);
      expect(service.currentNodeId()).toBe(null);
      expect(service.currentEdgeId()).toBe(null);
      expect(service.counters()).toEqual({});
      expect(service.isRunning()).toBe(false);
      expect(service.isConfigLocked()).toBe(false);
    });

    it('should provide overlay for canvas', () => {
      const overlay = service.simOverlay();
      expect(overlay.counters).toEqual(service.counters());
      expect(overlay.currentNodeId).toBe(service.currentNodeId());
      expect(overlay.currentEdgeId).toBe(service.currentEdgeId());
    });
  });
});
