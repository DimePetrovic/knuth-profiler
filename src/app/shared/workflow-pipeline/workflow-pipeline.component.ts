import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ExamplesWorkflowFacade } from '../../features/examples/examples-workflow.facade';

@Component({
  selector: 'app-workflow-pipeline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workflow-pipeline.component.html',
})
export class WorkflowPipelineComponent {
  private readonly router = inject(Router);
  @Input({ required: true }) facade!: ExamplesWorkflowFacade;
  @Input() title = 'Ток рада';
  @Input() subtitle = '';
  @Input() firstStepTitle = 'Корак 1';

  protected readonly stepTitles = [
    'Корак 1',
    'Корак 2: Тежине',
    'Корак 3: MST',
    'Корак 4: Инструментација',
    'Корак 5: Мерења',
    'Корак 6: Реконструкција',
  ];

  stepState(idx: number): 'completed' | 'current' | 'locked' {
    const current = this.facade.step();
    if (idx < current) {
      return 'completed';
    }
    if (idx === current) {
      return 'current';
    }
    return 'locked';
  }

  stepHint(idx: number): string {
    const state = this.stepState(idx);
    if (state === 'completed') {
      return 'Завршено';
    }
    if (state === 'current') {
      return 'Активно';
    }
    return 'Закључано';
  }

  onNext(): void {
    const step = this.facade.step();
    if (step === 0) {
      this.facade.startStep();
      return;
    }
    this.facade.nextStep();
  }

  onPrev(): void {
    this.facade.prevStep();
  }

  onReconComputeNext(): void {
    this.facade.reconComputeNext();
  }

  canGoNext(): boolean {
    return this.facade.canProceedFromCurrentStep();
  }

  async onFinish(): Promise<void> {
    this.facade.finishAndReset();
    await this.router.navigateByUrl('/');
  }
}
