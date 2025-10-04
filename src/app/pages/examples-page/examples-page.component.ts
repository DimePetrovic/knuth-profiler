import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GraphCanvasComponent } from '../../shared/graph-canvas/graph-canvas.component';
import { VisualizationStateService } from '../../features/examples/visualization-state.service';
import { GraphData, GraphLayoutName } from '../../core/graph/graph.types';

@Component({
  selector: 'app-examples-page',
  standalone: true,
  imports: [CommonModule, GraphCanvasComponent],
  templateUrl: './examples-page.component.html'
})
export class ExamplesPageComponent {
  // Signals proxied as getters for template ergonomics
  get examples() { return this.state.examples; }
  get selectedId() { return this.state.selectedId(); }
  get step() { return this.state.step(); }
  get layoutName() { return this.state.layout(); }

  readonly selectedData = computed<GraphData | null>(() => this.state.graphData());
  readonly overlay = computed(() => this.state.overlay());

  constructor(private state: VisualizationStateService) {}

  pick(id: string): void { this.state.pickExample(id); }
  onLayoutChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.state.layout.set(select.value as GraphLayoutName);
  }

  start(): void { this.state.start(); }
  next(): void { this.state.next(); }
  prev(): void { this.state.prev(); }
  reset(): void { this.state.reset(); }
}
