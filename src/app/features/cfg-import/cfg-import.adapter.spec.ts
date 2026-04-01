import { mapCfgJsonToGraphData } from './cfg-import.adapter';

describe('cfg-import.adapter', () => {
  it('should prefer actual ENTRY/EXIT nodes over mismatched entryNodeId/exitNodeId metadata', () => {
    const result = mapCfgJsonToGraphData({
      version: 'cfg-json-1',
      language: 'c',
      filename: 'main.c',
      sourceHash: 'sha256:x',
      graph: {
        // Deliberately incorrect metadata to reproduce user-reported issue.
        entryNodeId: 'n1',
        exitNodeId: 'n1',
        nodes: [
          { id: 'n0', kind: 'entry', label: 'ENTRY', range: null },
          { id: 'n1', kind: 'stmt', label: 'x=1', range: null },
          { id: 'n2', kind: 'exit', label: 'EXIT', range: null },
        ],
        edges: [
          { from: 'n0', to: 'n1', kind: 'next', label: '' },
          { from: 'n1', to: 'n2', kind: 'next', label: '' },
        ],
      },
    });

    const entrySentinel = result.edges.find(e => e.id === '__entry_sentinel__');
    const exitSentinel = result.edges.find(e => e.id === '__exit_sentinel__');

    expect(entrySentinel?.target).toBe('ENTRY');
    expect(exitSentinel?.source).toBe('EXIT');
    expect(result.nodes.filter(n => n.kind === 'entry').length).toBe(1);
    expect(result.nodes.filter(n => n.kind === 'exit').length).toBe(1);

    // Main flow must remain ENTRY -> stmt -> EXIT
    expect(result.edges.some(e => e.source === 'ENTRY' && e.target === 'n1')).toBeTrue();
    expect(result.edges.some(e => e.source === 'n1' && e.target === 'EXIT')).toBeTrue();
  });

  it('should map METHOD_RETURN to canonical EXIT when multiple RETURN-like nodes exist', () => {
    const result = mapCfgJsonToGraphData({
      version: 'cfg-json-1',
      language: 'c',
      filename: 'main.c',
      sourceHash: 'sha256:y',
      graph: {
        entryNodeId: 'n10',
        exitNodeId: 'n20',
        nodes: [
          { id: 'n10', kind: 'entry', label: 'METHOD, 2 main', range: null },
          { id: 'n31', kind: 'exit', label: 'RETURN, 27 return 1;', range: null },
          { id: 'n32', kind: 'exit', label: 'RETURN, 32 return 1;', range: null },
          { id: 'n99', kind: 'exit', label: 'METHOD_RETURN, 3 int', range: null },
        ],
        edges: [
          { from: 'n10', to: 'n31', kind: 'next', label: '' },
          { from: 'n31', to: 'n99', kind: 'next', label: '' },
          { from: 'n32', to: 'n99', kind: 'next', label: '' },
        ],
      },
    });

    const exitNode = result.nodes.find(n => n.id === 'EXIT');
    expect(exitNode?.label).toBe('EXIT');
    expect(result.nodes.filter(n => n.kind === 'exit').length).toBe(1);
    expect(result.edges.some(e => e.source === 'n31' && e.target === 'EXIT')).toBeTrue();
    expect(result.edges.some(e => e.source === 'n32' && e.target === 'EXIT')).toBeTrue();
  });

  it('should trim verbose Joern prefixes before comma in node labels', () => {
    const result = mapCfgJsonToGraphData({
      version: 'cfg-json-1',
      language: 'c',
      filename: 'main.c',
      sourceHash: 'sha256:z',
      graph: {
        entryNodeId: 'm',
        exitNodeId: 'mr',
        nodes: [
          { id: 'm', kind: 'entry', label: 'METHOD, 2 main', range: null },
          { id: 'n1', kind: 'stmt', label: 'RETURN, 36 return 0;', range: null },
          { id: 'mr', kind: 'exit', label: 'METHOD_RETURN, 3 int', range: null },
        ],
        edges: [
          { from: 'm', to: 'n1', kind: 'next', label: '' },
          { from: 'n1', to: 'mr', kind: 'next', label: '' },
        ],
      },
    });

    const n1 = result.nodes.find(n => n.id === 'n1');
    expect(n1?.label).toBe('36 return 0;');
    expect(result.edges.some(e => e.id === 'e0')).toBeTrue();
  });

  it('should keep only the content after first comma in imported labels', () => {
    const result = mapCfgJsonToGraphData({
      version: 'cfg-json-1',
      language: 'c',
      filename: 'main.c',
      sourceHash: 'sha256:a1',
      graph: {
        entryNodeId: 'm',
        exitNodeId: 'mr',
        nodes: [
          { id: 'm', kind: 'entry', label: 'METHOD, 2 main', range: null },
          { id: 'add', kind: 'stmt', label: 'addition, 14 a + b', range: null },
          { id: 'mr', kind: 'exit', label: 'METHOD_RETURN, 3 int', range: null },
        ],
        edges: [
          { from: 'm', to: 'add', kind: 'next', label: '' },
          { from: 'add', to: 'mr', kind: 'next', label: '' },
        ],
      },
    });

    const add = result.nodes.find(n => n.id === 'add');
    expect(add?.label).toBe('14 a + b');
  });
});
