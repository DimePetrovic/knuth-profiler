import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExamplesWorkflowFacade } from '../../features/examples/examples-workflow.facade';
import { CfgImportApiService } from '../../features/cfg-import/cfg-import.api.service';
import { mapCfgJsonToGraphData } from '../../features/cfg-import/cfg-import.adapter';
import { CfgErrorJson, CfgImportViewState, CfgLanguage, CfgResultJson } from '../../features/cfg-import/cfg-import.types';
import { GraphCanvasComponent } from '../../shared/graph-canvas/graph-canvas.component';
import { WorkflowPipelineComponent } from '../../shared/workflow-pipeline/workflow-pipeline.component';

@Component({
  selector: 'app-cfg-import-page',
  standalone: true,
  imports: [CommonModule, FormsModule, GraphCanvasComponent, WorkflowPipelineComponent],
  templateUrl: './cfg-import-page.component.html',
})
export class CfgImportPageComponent implements OnDestroy {
  private readonly api = inject(CfgImportApiService);
  readonly workflow = inject(ExamplesWorkflowFacade);
  private pollTimer: any = null;

  readonly language = signal<CfgLanguage>('c');
  readonly filename = signal('main.c');
  readonly source = signal('int main() {\n  return 0;\n}');
  readonly isSubmitting = signal(false);
  readonly message = signal<string | null>(null);

  readonly state = signal<CfgImportViewState>({
    jobId: null,
    status: null,
    result: null,
    error: null,
    graphData: null,
  });

  readonly workflowTitle = computed(() => {
    switch (this.workflow.step()) {
      case 0:
        return 'Корак 1: Увоз CFG-а';
      case 1:
        return 'Корак 2: Тежине';
      case 2:
        return 'Корак 3: MST';
      case 3:
        return 'Корак 4: Инструментација';
      case 4:
        return 'Корак 5: Мерења';
      case 5:
        return 'Корак 6: Реконструкција';
      default:
        return 'Увоз CFG-а';
    }
  });

  constructor() {
    this.workflow.useCfgContext();
    this.workflow.clearImportedGraph();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  async submitSource(): Promise<void> {
    this.resetStateForSubmit();
    try {
      const jobId = await this.api.createJobFromSource(
        this.language(),
        this.filename(),
        this.source()
      );
      this.state.update(s => ({ ...s, jobId }));
      this.startPolling(jobId);
    } catch (error) {
      this.message.set(toErrorMessage(error));
      this.isSubmitting.set(false);
    }
  }

  async uploadFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.resetStateForSubmit();
    this.filename.set(file.name);

    try {
      const jobId = await this.api.createJobFromUpload(this.language(), file);
      this.state.update(s => ({ ...s, jobId }));
      this.startPolling(jobId);
    } catch (error) {
      this.message.set(toErrorMessage(error));
      this.isSubmitting.set(false);
    } finally {
      input.value = '';
    }
  }

  private startPolling(jobId: string): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      void this.pollOnce(jobId);
    }, 1000);
    void this.pollOnce(jobId);
  }

  private async pollOnce(jobId: string): Promise<void> {
    try {
      const status = await this.api.getStatus(jobId);
      this.state.update(s => ({ ...s, status }));

      const resultState = await this.api.getResult(jobId);
      if (resultState.pending) {
        return;
      }

      this.stopPolling();
      this.isSubmitting.set(false);

      const payload = resultState.result;
      if (payload.version === 'cfg-error-1') {
        this.state.update(s => ({ ...s, error: payload as CfgErrorJson }));
        this.message.set(`${payload.code}: ${payload.message}`);
        return;
      }

      const cfg = payload as CfgResultJson;
      const graphData = mapCfgJsonToGraphData(cfg);

      this.state.update(s => ({
        ...s,
        result: cfg,
        graphData,
      }));
      this.workflow.loadImportedGraph(graphData);
      this.message.set('CFG је спреман. Покрени визуализацију кроз кораке као на примерима.');
    } catch (error) {
      this.stopPolling();
      this.isSubmitting.set(false);
      this.message.set(toErrorMessage(error));
    }
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private resetStateForSubmit(): void {
    this.stopPolling();
    this.workflow.clearImportedGraph();
    this.isSubmitting.set(true);
    this.message.set(null);
    this.state.set({
      jobId: null,
      status: null,
      result: null,
      error: null,
      graphData: null,
    });
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Непозната грешка.';
}
