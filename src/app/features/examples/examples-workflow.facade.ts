import { computed, inject, Injectable, signal } from '@angular/core';
import {
  ENTRY_NODE_ID,
  EXIT_NODE_ID,
  GHOST_IN_NODE_ID,
  GHOST_OUT_NODE_ID,
  isSentinelEdge,
} from '../../core/graph/graph.constants';
import { GraphData, GraphLayoutName, ReconStep, VizStep } from '../../core/graph/graph.types';
import { ReconstructionStateService } from './reconstruction-state.service';
import { SimulationStateService } from './simulation-state.service';
import { ExamplesGraphStateService } from './visualization-state.service';

const STEP_DESCRIPTIONS: Record<VizStep, string> = {
  0: 'Старт – прикажи граф. Кликни „Покрени визуализацију“.',
  1: 'Тежине – на свакој грани видиш ознаку w=тежина.',
  2: 'MST – истакнуте су гране које чине максимално разапињуће стабло (по тежинама > 0).',
  3: 'Инструментација – означене су испрекиданом линијом гране које треба мерити.',
  4: 'Мерења – изабери број покретања и покрени симулацију. Током симулације видиш бројаче на инструментизованим гранама.',
  5: 'Реконструкција – приказ броја пролазака по свим гранама.',
  6: 'Извештај – агрегирани показатељи ефеката селективне инструментације.'
};

const EXAMPLE_SOURCE_SNIPPETS: Record<string, { filename: string; language: string; source: string }> = {
  'linear-flow': {
    filename: 'linear-flow.c',
    language: 'c',
    source: 'int linear_flow(int x) {\n  int a = x + 1;\n  int b = a * 2;\n  return b - 3;\n}',
  },
  'if-else': {
    filename: 'if-else.c',
    language: 'c',
    source: 'int classify(int x) {\n  if (x > 0) {\n    return 1;\n  } else {\n    return -1;\n  }\n}',
  },
  'while-loop': {
    filename: 'while-loop.c',
    language: 'c',
    source: 'int sum_to_n(int n) {\n  int i = 0;\n  int s = 0;\n  while (i < n) {\n    s += i;\n    i++;\n  }\n  return s;\n}',
  },
  'nested-loop': {
    filename: 'nested-loop.c',
    language: 'c',
    source: 'int nested(int n, int m) {\n  int c = 0;\n  for (int i = 0; i < n; i++) {\n    for (int j = 0; j < m; j++) {\n      c += i + j;\n    }\n  }\n  return c;\n}',
  },
  'switch-three': {
    filename: 'switch-three.c',
    language: 'c',
    source: 'int route(int x) {\n  switch (x) {\n    case 0: return 10;\n    case 1: return 20;\n    default: return 30;\n  }\n}',
  },
  'loop-if': {
    filename: 'loop-if.c',
    language: 'c',
    source: 'int loop_if(int n) {\n  int acc = 0;\n  while (n-- > 0) {\n    if ((n & 1) == 0) acc += 2;\n    else acc += 1;\n  }\n  return acc;\n}',
  },
};

export interface WorkflowReportMetrics {
  nodeCount: number;
  edgeCount: number;
  instrumentedEdgeCount: number;
  instrumentedEdgePercent: number;
  instrumentedOps: number;
  fullInstrumentationOps: number;
  savedOps: number;
  savedOpsPercent: number;
}

export interface WorkflowReportCodeArtifact {
  filename: string;
  language: string;
  source: string;
}

export interface WorkflowInstrumentedEdgeRow {
  edgeId: string;
  sourceLabel: string;
  targetLabel: string;
  count: number;
}

export interface WorkflowNodeExecutionRow {
  nodeId: string;
  nodeLabel: string;
  executionCount: number;
  executionPercent: number;
}

export interface WorkflowReportSourceLine {
  lineNumber: number;
  text: string;
  highlighted: boolean;
  edgeIds: string[];
}

@Injectable({ providedIn: 'root' })
export class ExamplesWorkflowFacade {
  private readonly visualization = inject(ExamplesGraphStateService);
  private readonly simulation = inject(SimulationStateService);
  private readonly reconstruction = inject(ReconstructionStateService);
  private readonly visualizationContext = signal<'examples' | 'cfg'>('examples');
  private readonly reportSourceArtifact = signal<WorkflowReportCodeArtifact | null>(null);
  private readonly context = computed<'examples' | 'cfg'>(() => this.visualizationContext());

  readonly examples = this.visualization.examples;
  readonly selectedId = this.visualization.selectedId;
  readonly step = this.visualization.step;
  readonly layoutName = this.visualization.layout;
  readonly selectedData = computed<GraphData | null>(() => this.visualization.graphData());
  readonly hasGraph = computed(() => this.selectedData() !== null);
  readonly hasImportedGraph = computed(() => this.visualization.importedGraphData() !== null);

  readonly overlay = computed(() => {
    const baseOverlay = this.visualization.overlay();
    const simulationOverlay = this.simulation.simOverlay();

    return {
      ...baseOverlay,
      counters: this.reconstruction.mergedCounters(),
      currentNodeId: simulationOverlay.currentNodeId,
      currentEdgeId: simulationOverlay.currentEdgeId
    };
  });

  readonly runs = computed(() => this.simulation.config().runs);
  readonly speed = computed(() => this.simulation.config().speed ?? 1);
  readonly isRunning = this.simulation.isRunning;
  readonly isPaused = this.simulation.isPaused;
  readonly currentRun = this.simulation.currentRun;
  readonly hasSimulationData = computed(() => Object.keys(this.simulation.counters()).length > 0);
  readonly simulationStatusLabel = computed(() => {
    if (this.isRunning() && !this.isPaused()) {
      return 'Ради';
    }

    if (this.isRunning() && this.isPaused()) {
      return 'Пауза';
    }

    if (!this.isRunning() && this.currentRun() >= this.runs() && this.hasSimulationData()) {
      return 'Завршено';
    }

    return 'Стојеће';
  });

  readonly reconSteps = this.reconstruction.steps;
  readonly reconIdx = this.reconstruction.idx;
  readonly pendingTreeEdges = this.reconstruction.pendingTreeEdgeIds;
  readonly reconLastMessage = this.reconstruction.lastComputeMessage;
  readonly reconCurrentNodeLabel = computed(() => {
    const idx = this.reconIdx();
    const steps = this.reconSteps();
    if (idx < 0 || idx >= steps.length) {
      return null;
    }

    const nodeId = steps[idx].nodeId;
    const node = this.selectedData()?.nodes.find(n => n.id === nodeId);
    return node?.label || nodeId;
  });
  readonly stepDescription = computed(() => STEP_DESCRIPTIONS[this.step()]);
  readonly reportMetrics = computed<WorkflowReportMetrics | null>(() => {
    const graph = this.selectedData();
    if (!graph) {
      return null;
    }

    const nonSentinelEdges = graph.edges.filter(edge => !isSentinelEdge(edge));
    const edgeCount = nonSentinelEdges.length;
    const nodeCount = graph.nodes.length;

    const instrumentedIds = new Set(
      this.visualization.instrumentedEdgeIds().filter(id => !id.startsWith('__'))
    );
    const instrumentedEdgeCount = nonSentinelEdges.filter(edge => instrumentedIds.has(edge.id)).length;
    const mergedCounters = this.reconstruction.mergedCounters();

    const fullInstrumentationOps = nonSentinelEdges.reduce(
      (sum, edge) => sum + (mergedCounters[edge.id] ?? 0),
      0
    );
    const instrumentedOps = nonSentinelEdges.reduce(
      (sum, edge) => sum + (instrumentedIds.has(edge.id) ? (mergedCounters[edge.id] ?? 0) : 0),
      0
    );

    const savedOps = Math.max(0, fullInstrumentationOps - instrumentedOps);
    const savedOpsPercent = fullInstrumentationOps > 0 ? (savedOps / fullInstrumentationOps) * 100 : 0;
    const instrumentedEdgePercent = edgeCount > 0 ? (instrumentedEdgeCount / edgeCount) * 100 : 0;

    return {
      nodeCount,
      edgeCount,
      instrumentedEdgeCount,
      instrumentedEdgePercent,
      instrumentedOps,
      fullInstrumentationOps,
      savedOps,
      savedOpsPercent,
    };
  });
  readonly reportCodeArtifact = computed<WorkflowReportCodeArtifact | null>(() => {
    if (this.context() === 'cfg') {
      return this.reportSourceArtifact();
    }

    const selectedId = this.selectedId();
    return EXAMPLE_SOURCE_SNIPPETS[selectedId] ?? null;
  });
  readonly reportRunCount = computed(() => this.currentRun());
  readonly reportConfiguredRunCount = computed(() => this.runs());
  readonly reportRunProgressText = computed(() => `${this.reportRunCount()} / ${this.reportConfiguredRunCount()}`);
  readonly reportInstrumentedEdges = computed<WorkflowInstrumentedEdgeRow[]>(() => {
    const graph = this.selectedData();
    if (!graph) {
      return [];
    }

    const nodeLabels = new Map(graph.nodes.map(node => [node.id, node.label ?? node.id]));
    const counters = this.reconstruction.mergedCounters();
    const instrumentedIds = new Set(
      this.visualization.instrumentedEdgeIds().filter(id => !id.startsWith('__'))
    );

    return graph.edges
      .filter(edge => !isSentinelEdge(edge) && instrumentedIds.has(edge.id))
      .map(edge => ({
        edgeId: edge.id,
        sourceLabel: nodeLabels.get(edge.source) ?? edge.source,
        targetLabel: nodeLabels.get(edge.target) ?? edge.target,
        count: counters[edge.id] ?? 0,
      }));
  });
  readonly reportNodeExecutions = computed<WorkflowNodeExecutionRow[]>(() => {
    const graph = this.selectedData();
    if (!graph) {
      return [];
    }

    const counters = this.reconstruction.mergedCounters();
    const configuredRuns = Math.max(1, this.reportConfiguredRunCount());
    const incoming = new Map<string, number>();
    const outgoing = new Map<string, number>();

    for (const edge of graph.edges) {
      if (isSentinelEdge(edge)) {
        continue;
      }
      const count = counters[edge.id] ?? 0;
      outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + count);
      incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + count);
    }

    return graph.nodes
      .filter(node =>
        node.id !== ENTRY_NODE_ID &&
        node.id !== EXIT_NODE_ID &&
        node.id !== GHOST_IN_NODE_ID &&
        node.id !== GHOST_OUT_NODE_ID
      )
      .map(node => {
        const inCount = incoming.get(node.id) ?? 0;
        const outCount = outgoing.get(node.id) ?? 0;
        return {
          nodeId: node.id,
          nodeLabel: node.label ?? node.id,
          executionCount: Math.max(inCount, outCount),
          executionPercent: (Math.max(inCount, outCount) / configuredRuns) * 100,
        };
      })
      .sort((a, b) => b.executionCount - a.executionCount || a.nodeLabel.localeCompare(b.nodeLabel));
  });
  readonly reportSourceLines = computed<WorkflowReportSourceLine[]>(() => {
    const artifact = this.reportCodeArtifact();
    if (!artifact) {
      return [];
    }

    const lineHints = this.edgeLineHints();
    const lineToEdges = new Map<number, string[]>();
    for (const [edgeId, lines] of lineHints.entries()) {
      for (const line of lines) {
        if (!lineToEdges.has(line)) {
          lineToEdges.set(line, []);
        }
        lineToEdges.get(line)!.push(edgeId);
      }
    }

    return artifact.source.split(/\r?\n/).map((text, idx) => {
      const lineNumber = idx + 1;
      const edgeIds = lineToEdges.get(lineNumber) ?? [];
      return {
        lineNumber,
        text,
        highlighted: edgeIds.length > 0,
        edgeIds,
      };
    });
  });

  readonly canStartVisualization = computed(() => this.step() === 0);
  readonly canAdvance = computed(() => this.step() > 0 && this.step() < 6);
  readonly isSimulationStep = computed(() => this.step() === 4);
  readonly isReconstructionStep = computed(() => this.step() === 5);
  readonly isReportStep = computed(() => this.step() === 6);
  readonly canProceedFromCurrentStep = computed(() => {
    const step = this.step();
    const graphReady = this.context() === 'cfg' ? this.hasImportedGraph() : this.hasGraph();

    if (step === 0) {
      return graphReady;
    }

    if (step >= 1 && step <= 3) {
      return graphReady;
    }

    if (step === 4) {
      return this.hasSimulationData() && !this.isRunning() && this.currentRun() >= this.runs();
    }

    if (step === 5) {
      return this.pendingTreeEdges().length === 0;
    }

    return false;
  });
  readonly nextBlockedReason = computed(() => {
    const step = this.step();
    const graphReady = this.context() === 'cfg' ? this.hasImportedGraph() : this.hasGraph();

    if (step === 0 && !graphReady) {
      if (this.context() === 'cfg') {
        return 'Учитај CFG граф и сачекај успешну обраду да откључаш следећи корак.';
      }
      return 'Изабери пример да откључаш следећи корак.';
    }

    if (step >= 1 && step <= 3 && !graphReady) {
      return 'Граф није спреман за следећи корак.';
    }

    if (step === 4) {
      if (this.isRunning()) {
        return 'Сачекај да се симулација заврши или је ручно заустави пре преласка на реконструкцију.';
      }
      if (this.currentRun() < this.runs()) {
        return 'Сачекај да се заврше сви пролази кроз граф (статус: Завршено) пре преласка на реконструкцију.';
      }
      if (!this.hasSimulationData()) {
        return 'Покрени симулацију да би се појавили бројачи и откључала реконструкција.';
      }
    }

    if (step === 5 && this.pendingTreeEdges().length > 0) {
      return 'Израчунај све преостале MST гране пре преласка на извештај.';
    }

    return null;
  });

  useExamplesContext(): void {
    this.visualizationContext.set('examples');
  }

  useCfgContext(): void {
    this.visualizationContext.set('cfg');
  }

  enterExamplesPage(): void {
    this.useExamplesContext();
    this.visualization.resetAllState(true);
    this.reportSourceArtifact.set(null);
    this.resetDerivedState();
  }

  enterCfgPage(): void {
    this.useCfgContext();
    this.visualization.resetAllState(false);
    this.reportSourceArtifact.set(null);
    this.resetDerivedState();
  }

  finishAndReset(): void {
    this.visualization.resetAllState(true);
    this.reportSourceArtifact.set(null);
    this.resetDerivedState();
  }

  pickExample(exampleId: string): void {
    this.visualization.pickExample(exampleId);
    this.resetDerivedState();
  }

  setLayout(layoutName: string): void {
    if (layoutName === 'dagre' || layoutName === 'elk') {
      this.visualization.layout.set(layoutName as GraphLayoutName);
    }
  }

  loadImportedGraph(graphData: GraphData): void {
    this.visualization.setImportedGraph(graphData);
    this.resetDerivedState();
  }

  clearImportedGraph(): void {
    this.visualization.clearImportedGraph();
    this.reportSourceArtifact.set(null);
    this.resetDerivedState();
  }

  setReportSourceArtifact(artifact: WorkflowReportCodeArtifact): void {
    this.reportSourceArtifact.set(artifact);
  }

  startStep(): void {
    this.visualization.start();
    this.resetDerivedState();
  }

  nextStep(): void {
    const before = this.step();
    this.visualization.next();
    this.handleStepTransition(before, this.step());
  }

  prevStep(): void {
    const before = this.step();
    this.visualization.prev();
    this.handleStepTransition(before, this.step());
  }

  resetSteps(): void {
    this.visualization.reset();
    this.resetDerivedState();
  }

  reconComputeNext(): ReconStep | null {
    if (Object.keys(this.simulation.counters()).length === 0) {
      const prevFastMode = this.simulation.config().fastMode ?? false;
      this.simulation.setFastMode(true);
      this.simulation.start();
      this.simulation.setFastMode(prevFastMode);
    }

    return this.reconstruction.computeNext();
  }

  reconPrev(): void {
    this.reconstruction.prev();
  }

  reconNext(): void {
    this.reconstruction.next();
  }

  reconReset(): void {
    this.reconstruction.reset();
  }

  setRuns(runs: number): void {
    this.simulation.setRuns(runs);
  }

  setSpeed(speed: number): void {
    this.simulation.setSpeed(speed);
  }

  simStart(): void {
    this.simulation.start();
  }

  simPause(): void {
    this.simulation.pause();
  }

  simResume(): void {
    this.simulation.resume();
  }

  simStop(): void {
    this.simulation.stop();
  }

  simReset(): void {
    this.simulation.reset();
  }

  private handleStepTransition(before: VizStep, after: VizStep): void {
    const keepsSimulationState =
      (before === 4 && after === 5) ||
      (before === 5 && after === 4) ||
      (before === 5 && after === 6) ||
      (before === 6 && after === 5);
    const leftReconstruction = (before === 5 || before === 6) && after < 5;

    if (!keepsSimulationState) {
      this.simulation.reset();
    }

    if (after < 5 || leftReconstruction) {
      this.reconstruction.reset();
    }
  }

  private resetDerivedState(): void {
    this.simulation.reset();
    this.reconstruction.reset();
  }

  private edgeLineHints(): Map<string, number[]> {
    const graph = this.selectedData();
    const artifact = this.reportCodeArtifact();
    if (!graph || !artifact) {
      return new Map<string, number[]>();
    }

    const sourceLines = artifact.source.split(/\r?\n/);
    const nodeById = new Map(graph.nodes.map(node => [node.id, node]));
    const result = new Map<string, number[]>();

    for (const edge of graph.edges) {
      if (isSentinelEdge(edge)) {
        continue;
      }

      const instrumented = this.visualization.instrumentedEdgeIds().includes(edge.id);
      if (!instrumented) {
        continue;
      }

      const sourceNode = nodeById.get(edge.source);
      const targetNode = nodeById.get(edge.target);
      const explicitLines = new Set<number>();

      const sourceLine = extractLineNumberFromNode(sourceNode);
      const targetLine = extractLineNumberFromNode(targetNode);
      if (sourceLine !== null) {
        explicitLines.add(sourceLine);
      }
      if (targetLine !== null) {
        explicitLines.add(targetLine);
      }

      const hintLines = explicitLines.size > 0
        ? Array.from(explicitLines)
        : findLineHintsFromLabels(sourceLines, sourceNode?.label, targetNode?.label);

      if (hintLines.length > 0) {
        result.set(edge.id, hintLines);
      }
    }

    return result;
  }
}

function extractLineNumberFromNode(node: GraphData['nodes'][number] | undefined): number | null {
  const range = node?.data?.['range'];
  if (typeof range === 'number' && Number.isInteger(range) && range > 0) {
    return range;
  }

  if (!range || typeof range !== 'object') {
    return null;
  }

  const directKeys = ['line', 'lineNumber', 'startLine'];
  for (const key of directKeys) {
    const value = (range as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }
  }

  const start = (range as Record<string, unknown>)['start'];
  if (start && typeof start === 'object') {
    const nested = (start as Record<string, unknown>)['line'];
    if (typeof nested === 'number' && Number.isInteger(nested) && nested > 0) {
      return nested;
    }
  }

  return null;
}

function findLineHintsFromLabels(sourceLines: string[], sourceLabel?: string, targetLabel?: string): number[] {
  const candidates = [sourceLabel, targetLabel]
    .map(normalizeLabel)
    .filter((value): value is string => value.length > 0 && value !== 'entry' && value !== 'exit');

  if (candidates.length === 0) {
    return [];
  }

  const hits = new Set<number>();
  sourceLines.forEach((line, idx) => {
    const normalized = normalizeLine(line);
    if (candidates.some(label => normalized.includes(label))) {
      hits.add(idx + 1);
    }
  });

  return Array.from(hits).sort((a, b) => a - b);
}

function normalizeLabel(value: string | undefined): string {
  if (!value) {
    return '';
  }
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, ' ').trim();
}

function normalizeLine(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, ' ');
}