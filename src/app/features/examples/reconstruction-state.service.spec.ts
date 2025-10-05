import { TestBed } from '@angular/core/testing';

import { ReconstructionStateService } from './reconstruction-state.service';

describe('ReconstructionStateService', () => {
  let service: ReconstructionStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReconstructionStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
