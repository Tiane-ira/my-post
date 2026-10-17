import { describe, it, expect } from 'vitest';
import {
  parseJsonToNodes,
  serializeNodesToJson,
  serializeNodesToXml,
  inferType,
  VisualFieldNode,
} from '../src/common/visualBodyUtils';

describe('VisualBodyUtils Engine', () => {
  it('should infer data types correctly', () => {
    expect(inferType('hello')).toBe('string');
    expect(inferType(123)).toBe('integer');
    expect(inferType(3.14)).toBe('number');
    expect(inferType(true)).toBe('boolean');
    expect(inferType(null)).toBe('null');
    expect(inferType([])).toBe('array');
    expect(inferType({})).toBe('object');
  });

  it('should parse nested JSON object into VisualFieldNode hierarchy', () => {
    const json = JSON.stringify({
      username: 'alex',
      age: 28,
      is_active: true,
      meta: {
        role: 'admin',
        score: 99.5,
      },
      tags: ['developer', 'tester'],
    });

    const nodes = parseJsonToNodes(json);
    expect(nodes.length).toBe(5);

    const usernameNode = nodes.find((n) => n.key === 'username');
    expect(usernameNode?.type).toBe('string');
    expect(usernameNode?.value).toBe('alex');

    const ageNode = nodes.find((n) => n.key === 'age');
    expect(ageNode?.type).toBe('integer');
    expect(ageNode?.value).toBe('28');

    const activeNode = nodes.find((n) => n.key === 'is_active');
    expect(activeNode?.type).toBe('boolean');
    expect(activeNode?.value).toBe('true');

    const metaNode = nodes.find((n) => n.key === 'meta');
    expect(metaNode?.type).toBe('object');
    expect(metaNode?.children?.length).toBe(2);

    const tagsNode = nodes.find((n) => n.key === 'tags');
    expect(tagsNode?.type).toBe('array');
    expect(tagsNode?.children?.length).toBe(2);
  });

  it('should serialize VisualFieldNodes back to exact JSON format with proper types', () => {
    const nodes: VisualFieldNode[] = [
      { id: '1', key: 'name', type: 'string', value: 'John' },
      { id: '2', key: 'age', type: 'integer', value: '30' },
      { id: '3', key: 'verified', type: 'boolean', value: 'true' },
      {
        id: '4',
        key: 'profile',
        type: 'object',
        value: '',
        children: [
          { id: '4-1', key: 'city', type: 'string', value: 'Beijing' },
          { id: '4-2', key: 'score', type: 'number', value: '98.5' },
        ],
      },
    ];

    const jsonStr = serializeNodesToJson(nodes);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.name).toBe('John');
    expect(parsed.age).toBe(30);
    expect(parsed.verified).toBe(true);
    expect(parsed.profile.city).toBe('Beijing');
    expect(parsed.profile.score).toBe(98.5);
  });

  it('should serialize VisualFieldNodes to formatted XML', () => {
    const nodes: VisualFieldNode[] = [
      {
        id: 'root-1',
        key: 'root',
        type: 'object',
        value: '',
        children: [
          { id: 'c1', key: 'status', type: 'integer', value: '200' },
          { id: 'c2', key: 'message', type: 'string', value: 'success' },
        ],
      },
    ];

    const xml = serializeNodesToXml(nodes);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<root>');
    expect(xml).toContain('<status>200</status>');
    expect(xml).toContain('<message>success</message>');
    expect(xml).toContain('</root>');
  });
});
