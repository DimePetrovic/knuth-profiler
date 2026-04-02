import { Component, computed, inject } from '@angular/core';
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

  protected readonly workflowSubtitle = computed(() => {
    switch (this.facade.step()) {
      case 0:
        return 'Изабери пример контролисаног тока и покрени визуализацију корак по корак.';
      case 1:
        return 'Тежине грана откривају релативну учесталост и значај појединих путања.';
      case 2:
        return 'Максимално разапињуће стабло издваја кључне гране за ефикасну реконструкцију.';
      case 3:
        return 'Овај корак приказује које су гране инструментисане ради минималног трошка мерења.';
      case 4:
        return 'Извршава се симулација и попуњавају се бројачи инструментисаних грана.';
      case 5:
        return 'Реконструишу се недостајуће вредности на основу познатих бројања и баланса тока.';
      case 6:
        return 'Извештај сумира резултате, пореди трошкове и даје процену добити приступа.';
      default:
        return 'Визуелни ток анализе профилисања.';
    }
  });

  constructor() {
    this.facade.enterExamplesPage();
  }
}
