// src/app/core/graph/cytoscape.service.ts
import { Injectable } from '@angular/core';
import cytoscape, { Core } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import elk from 'cytoscape-elk';

// Register plugins once.
cytoscape.use(dagre);
cytoscape.use(elk);

@Injectable({ providedIn: 'root' })
export class CytoscapeService {
  private _cy?: Core;

  create(container: HTMLElement) {
    this._cy = cytoscape({
      container,
      elements: [],
      style: [
        { selector: 'node', style: { 'background-color': '#1f2937', 'label': 'data(label)', 'color': '#111827', 'text-background-opacity': 0 } },
        { selector: 'edge', style: { 'curve-style': 'bezier', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#374151', 'line-color': '#374151', 'width': 2, 'arrow-scale': 1 } }
      ],
      layout: { name: 'dagre' },
      wheelSensitivity: 0.2
    });
    return this._cy;
  }

  get cy(): Core | undefined {
    return this._cy;
  }
}
