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
});
