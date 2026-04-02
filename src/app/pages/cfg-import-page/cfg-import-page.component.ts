import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExamplesWorkflowFacade } from '../../features/examples/examples-workflow.facade';
import { CfgImportApiService } from '../../features/cfg-import/cfg-import.api.service';
import { mapCfgJsonToGraphData } from '../../features/cfg-import/cfg-import.adapter';
import { CfgErrorJson, CfgImportViewState, CfgLanguage, CfgResultJson } from '../../features/cfg-import/cfg-import.types';
import { GraphCanvasComponent } from '../../shared/graph-canvas/graph-canvas.component';
import { WorkflowPipelineComponent } from '../../shared/workflow-pipeline/workflow-pipeline.component';

const LANGUAGE_PRESETS: Record<CfgLanguage, { filename: string; source: string; extensions: readonly string[] }> = {
  c: {
    filename: 'main.c',
    source: 'int main() {\n  return 0;\n}',
    extensions: ['.c', '.h'],
  },
  cpp: {
    filename: 'main.cpp',
    source: '#include <iostream>\n\nint main() {\n  std::cout << "Hello" << std::endl;\n  return 0;\n}',
    extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'],
  },
  java: {
    filename: 'Main.java',
    source: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello");\n  }\n}',
    extensions: ['.java'],
  },
  python: {
    filename: 'main.py',
    source: 'def main():\n  print("Hello")\n\n\nif __name__ == "__main__":\n  main()',
    extensions: ['.py'],
  },
  javascript: {
    filename: 'main.js',
    source: 'function main() {\n  console.log("Hello");\n}\n\nmain();',
    extensions: ['.js', '.mjs', '.cjs'],
  },
};

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
  readonly filename = signal(LANGUAGE_PRESETS.c.filename);
  readonly source = signal(LANGUAGE_PRESETS.c.source);
  readonly isSourceLocked = signal(false);
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
      case 6:
        return 'Корак 7: Извештај';
      default:
        return 'Увоз CFG-а';
    }
  });

  readonly workflowSubtitle = computed(() => {
    switch (this.workflow.step()) {
      case 0:
        return 'Унеси или отпреми изворни код, покрени CFG обраду и сачекај успешан резултат посла.';
      case 1:
        return 'Прегледај тежине грана да би се разумела релативна важност контролних прелаза.';
      case 2:
        return 'Приказује се максимално разапињуће стабло као основа за селективну инструментацију.';
      case 3:
        return 'Означавају се гране за инструментацију, односно оне које се прате бројачима током извршавања.';
      case 4:
        return 'Покрени симулацију и прикупи мерења како би бројачи инструментисаних грана били попуњени.';
      case 5:
        return 'На основу познатих бројача реконструиши преостале вредности и добије се потпуна слика пролазака.';
      case 6:
        return 'Извештај приказује метрике, упоређује трошак и истиче ефекат селективне инструментације.';
      default:
        return 'Ток рада за увоз и анализу CFG-а.';
    }
  });

  constructor() {
    this.workflow.enterCfgPage();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  onLanguageChange(language: CfgLanguage): void {
    this.language.set(language);
    this.applyLanguagePreset(language);
    this.isSourceLocked.set(false);
  }

  async submitSource(): Promise<void> {
    this.resetStateForSubmit();
    this.workflow.setReportSourceArtifact({
      filename: this.filename(),
      language: this.language(),
      source: this.source(),
    });
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
    const detectedLanguage = this.detectLanguageFromFilename(file.name);
    if (detectedLanguage) {
      this.language.set(detectedLanguage);
      this.applyLanguagePreset(detectedLanguage);
    }

    let uploadedSource = this.source();
    try {
      const text = await file.text();
      if (text.trim().length > 0) {
        uploadedSource = text;
      }
    } catch {
      // Keep current source if uploaded file is not readable as text.
    }

    this.filename.set(file.name);
    this.source.set(uploadedSource);
    this.isSourceLocked.set(true);
    this.workflow.setReportSourceArtifact({
      filename: file.name,
      language: this.language(),
      source: uploadedSource,
    });

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

  private applyLanguagePreset(language: CfgLanguage): void {
    const preset = LANGUAGE_PRESETS[language];
    this.filename.set(preset.filename);
    this.source.set(preset.source);
  }

  private detectLanguageFromFilename(filename: string): CfgLanguage | null {
    const lower = filename.toLowerCase();
    const languages = Object.keys(LANGUAGE_PRESETS) as CfgLanguage[];
    for (const language of languages) {
      if (LANGUAGE_PRESETS[language].extensions.some(ext => lower.endsWith(ext))) {
        return language;
      }
    }
    return null;
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Непозната грешка.';
}
