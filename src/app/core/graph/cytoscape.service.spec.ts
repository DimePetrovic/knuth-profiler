import { TestBed } from '@angular/core/testing';

import { CytoscapeService } from './cytoscape.service';

describe('CytoscapeService', () => {
  let service: CytoscapeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CytoscapeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
