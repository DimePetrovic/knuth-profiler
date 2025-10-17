import { Injectable } from '@angular/core';
import { ExampleItem, GraphData } from '../../core/graph/graph.types';

@Injectable({ providedIn: 'root' })
export class ExamplesCatalogService {

  list(): ExampleItem[] {
    const items = [
      this.linearFlow(),
      this.ifElse(),
      this.whileLoop(),
      this.nestedLoop(),
      this.switchThree(),
      this.loopWithIf()
    ];
    // Bake sentinels once for all items
    return items.map(it => ({ ...it, data: this.ensureSentinels(it.data) }));
  }

  getDefault(): ExampleItem {
    return this.list()[0];
  }

  // --- Helpers --------------------------------------------------------------

  private ensureSentinels(data: GraphData): GraphData {
    const nodes = [...data.nodes];
    const edges = [...data.edges];

    const hasEntry = nodes.some(n => n.id === 'ENTRY');
    const hasExit  = nodes.some(n => n.id === 'EXIT');
    if (!hasEntry || !hasExit) return { nodes, edges };

    const GIN = '__ghost_in__', GOUT = '__ghost_out__';
    if (!nodes.some(n => n.id === GIN)) nodes.push({ id: GIN, label: '', kind: 'normal', data: { ghost: true } });
    if (!nodes.some(n => n.id === GOUT)) nodes.push({ id: GOUT, label: '', kind: 'normal', data: { ghost: true } });

    if (!edges.some(e => e.source === GIN && e.target === 'ENTRY' && e.kind === 'entry'))
      edges.push({ id: '__entry_sentinel__', source: GIN, target: 'ENTRY', label: '', kind: 'entry', weight: 0 });

    if (!edges.some(e => e.source === 'EXIT' && e.target === GOUT && e.kind === 'exit'))
      edges.push({ id: '__exit_sentinel__', source: 'EXIT', target: GOUT, label: '', kind: 'exit', weight: 0 });

    return { nodes, edges };
  }

  private n(id: string, label: string, kind: GraphData['nodes'][number]['kind'] = 'normal') {
    return { id, label, kind };
  }
  private e(id: string, source: string, target: string, label: string | undefined, weight: number, kind: GraphData['edges'][number]['kind'] = 'normal') {
    return { id, source, target, label, weight, kind };
  }

  // --- Examples -------------------------------------------------------------

  // 1) Linear flow
  private linearFlow(): ExampleItem {
    const data: GraphData = {
      nodes: [
        this.n('ENTRY', 'ENTRY', 'entry'),
        this.n('A', 'A'),
        this.n('B', 'B'),
        this.n('C', 'C'),
        this.n('EXIT', 'EXIT', 'exit')
      ],
      edges: [
        this.e('e0', 'ENTRY', 'A', '', 20, 'entry'),
        this.e('e1', 'A', 'B', '', 60),
        this.e('e2', 'B', 'C', '', 50),
        this.e('e3', 'C', 'EXIT', '', 70, 'exit')
      ]
    };
    return { id: 'linear-flow', title: 'Линеарни ток', description: 'Најједноставнији пример без гранања.', data };
  }

  // 2) If / Else
  private ifElse(): ExampleItem {
    const data: GraphData = {
      nodes: [
        this.n('ENTRY', 'ENTRY', 'entry'),
        this.n('S', 'S'),
        this.n('D', 'D', 'decision'),
        this.n('T', 'T'),
        this.n('F', 'F'),
        this.n('M', 'M'),
        this.n('EXIT', 'EXIT', 'exit')
      ],
      edges: [
        this.e('e0', 'ENTRY', 'S', '', 22, 'entry'),
        this.e('e1', 'S', 'D', '', 66),
        this.e('e2', 'D', 'T', 'true', 55),
        this.e('e3', 'D', 'F', 'false', 33),
        this.e('e4', 'T', 'M', '', 40),
        this.e('e5', 'F', 'M', '', 30),
        this.e('e6', 'M', 'EXIT', '', 77, 'exit')
      ]
    };
    return { id: 'if-else', title: 'If / Else', description: 'Гранање са спајањем путања.', data };
  }

  // 3) While loop
  private whileLoop(): ExampleItem {
    const data: GraphData = {
      nodes: [
        this.n('ENTRY', 'ENTRY', 'entry'),
        this.n('I', 'I'),
        this.n('D', 'D', 'decision'),
        this.n('B', 'B'),
        this.n('EXIT', 'EXIT', 'exit')
      ],
      edges: [
        this.e('e0', 'ENTRY', 'I', '', 18, 'entry'),
        this.e('e1', 'I', 'D', '', 66),
        this.e('e2', 'D', 'B', 'true', 55),
        this.e('e3', 'B', 'D', '', 33),   // back
        this.e('e4', 'D', 'EXIT', 'false', 44, 'exit')
      ]
    };
    return { id: 'while-loop', title: 'Једноставна петља', description: 'While-петља са повратном ивицом.', data };
  }

  // 4) Nested loop
  private nestedLoop(): ExampleItem {
    const data: GraphData = {
      nodes: [
        this.n('ENTRY', 'ENTRY', 'entry'),
        this.n('P', 'P'),
        this.n('D1', 'D1', 'decision'),
        this.n('D2', 'D2', 'decision'),
        this.n('B', 'B'),
        this.n('EXIT', 'EXIT', 'exit')
      ],
      edges: [
        this.e('e0', 'ENTRY', 'P', '', 20, 'entry'),
        this.e('e1', 'P', 'D1', '', 60),
        this.e('e2', 'D1', 'D2', 'true', 50),
        this.e('e3', 'D2', 'B', 'true', 30),
        this.e('e4', 'B', 'D2', '', 30),  // inner back
        this.e('e5', 'D2', 'D1', 'false', 30),
        this.e('e6', 'D1', 'EXIT', 'false', 70, 'exit')
      ]
    };
    return { id: 'nested-loop', title: 'Угњеждена петља', description: 'Две петље: унутрашња у спољашњој.', data };
  }

  // 5) Switch / 3 outcomes
  private switchThree(): ExampleItem {
    const data: GraphData = {
      nodes: [
        this.n('ENTRY', 'ENTRY', 'entry'),
        this.n('D', 'D', 'decision'),
        this.n('B0', 'B0 = 0'),
        this.n('B1', 'B1 = 1'),
        this.n('B2', 'B2'),
        this.n('M', 'M'),
        this.n('EXIT', 'EXIT', 'exit')
      ],
      edges: [
        this.e('e0', 'ENTRY', 'D', '', 22, 'entry'),
        this.e('e1', 'D', 'B0', '=0', 66),
        this.e('e2', 'D', 'B1', '=1', 55),
        this.e('e3', 'D', 'B2', 'else', 33),
        this.e('e4', 'B0', 'M', '', 35),
        this.e('e5', 'B1', 'M', '', 25),
        this.e('e6', 'B2', 'M', '', 20),
        this.e('e7', 'M', 'EXIT', '', 77, 'exit')
      ]
    };
    return { id: 'switch-three', title: 'Више исхода', description: 'Гранање са три излаза и спајањем.', data };
  }

  // 6) Loop with inner if
  private loopWithIf(): ExampleItem {
    const data: GraphData = {
      nodes: [
        this.n('ENTRY', 'ENTRY', 'entry'),
        this.n('Dloop', 'Dloop', 'decision'),
        this.n('Body', 'Body'),
        this.n('Dif', 'Dif', 'decision'),
        this.n('T', 'T'),
        this.n('F', 'F'),
        this.n('EXIT', 'EXIT', 'exit')
      ],
      edges: [
        this.e('e0', 'ENTRY', 'Dloop', '', 21, 'entry'),
        this.e('e1', 'Dloop', 'Body', 'true', 61),
        this.e('e2', 'Body', 'Dif', '', 36),
        this.e('e3', 'Dif', 'T', 'true', 34),
        this.e('e4', 'Dif', 'F', 'false', 27),
        this.e('e5', 'T', 'Dloop', '', 28),
        this.e('e6', 'F', 'Dloop', '', 26),
        this.e('e7', 'Dloop', 'EXIT', 'false', 72, 'exit')
      ]
    };
    return { id: 'loop-if', title: 'Петља + if', description: 'If-else унутар петље.', data };
  }
}
