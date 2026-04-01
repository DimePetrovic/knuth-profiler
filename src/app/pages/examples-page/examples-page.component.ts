import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExamplesWorkflowFacade } from '../../features/examples/examples-workflow.facade';
import { GraphCanvasComponent } from '../../shared/graph-canvas/graph-canvas.component';
import { WorkflowPipelineComponent } from '../../shared/workflow-pipeline/workflow-pipeline.component';

@Component({
  selector: 'app-examples-page',
  standalone: true,
  imports: [CommonModule, GraphCanvasComponent, WorkflowPipelineComponent],
  templateUrl: './examples-page.component.html'
})
export class ExamplesPageComponent {
  protected readonly facade = inject(ExamplesWorkflowFacade);

  constructor() {
    this.facade.enterExamplesPage();
  }
}
