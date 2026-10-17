export type VisualFieldType =
  | 'string'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'null';

export interface VisualFieldNode {
  id: string;
  key: string;
  type: VisualFieldType;
  value: string;
  description?: string;
  required?: boolean;
  children?: VisualFieldNode[];
  isExpanded?: boolean;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

/**
 * Infer field type from a JavaScript value
 */
export function inferType(val: any): VisualFieldType {
  if (val === null || val === undefined) return 'null';
  if (Array.isArray(val)) return 'array';
  if (typeof val === 'object') return 'object';
  if (typeof val === 'boolean') return 'boolean';
  if (typeof val === 'number') {
    return Number.isInteger(val) ? 'integer' : 'number';
  }
  return 'string';
}

/**
 * Parse a JS object/array into VisualFieldNode[]
 */
function walkValue(val: any, key: string = ''): VisualFieldNode {
  const type = inferType(val);
  const id = generateId();

  if (type === 'object') {
    const children: VisualFieldNode[] = [];
    if (val && typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) {
        children.push(walkValue(v, k));
      }
    }
    return {
      id,
      key,
      type: 'object',
      value: '',
      children,
      isExpanded: true,
      required: false,
    };
  }

  if (type === 'array') {
    const children: VisualFieldNode[] = [];
    if (Array.isArray(val)) {
      val.forEach((item, idx) => {
        children.push(walkValue(item, `[${idx}]`));
      });
    }
    return {
      id,
      key,
      type: 'array',
      value: '',
      children,
      isExpanded: true,
      required: false,
    };
  }

  return {
    id,
    key,
    type,
    value: val !== null && val !== undefined ? String(val) : '',
    required: false,
  };
}

/**
 * Parse JSON string into VisualFieldNode[]
 */
export function parseJsonToNodes(jsonStr: string): VisualFieldNode[] {
  const trimmed = jsonStr.trim();
  if (!trimmed) {
    return [
      {
        id: generateId(),
        key: '',
        type: 'string',
        value: '',
        required: false,
      },
    ];
  }

  const parsed = JSON.parse(trimmed);

  if (Array.isArray(parsed)) {
    return parsed.map((item, idx) => walkValue(item, `[${idx}]`));
  }

  if (parsed && typeof parsed === 'object') {
    return Object.entries(parsed).map(([k, v]) => walkValue(v, k));
  }

  // Primitive root
  return [
    {
      id: generateId(),
      key: 'value',
      type: inferType(parsed),
      value: String(parsed),
      required: false,
    },
  ];
}

/**
 * Convert VisualFieldNode[] back to a JS value
 */
function nodeToJsValue(node: VisualFieldNode): any {
  switch (node.type) {
    case 'integer': {
      const n = parseInt(node.value, 10);
      return isNaN(n) ? 0 : n;
    }
    case 'number': {
      const n = parseFloat(node.value);
      return isNaN(n) ? 0 : n;
    }
    case 'boolean': {
      return node.value === 'true' || node.value === '1';
    }
    case 'null': {
      return null;
    }
    case 'object': {
      const obj: Record<string, any> = {};
      if (node.children) {
        for (const child of node.children) {
          if (child.key) {
            obj[child.key] = nodeToJsValue(child);
          }
        }
      }
      return obj;
    }
    case 'array': {
      if (node.children) {
        return node.children.map((child) => nodeToJsValue(child));
      }
      return [];
    }
    case 'string':
    default:
      return node.value;
  }
}

/**
 * Serialize VisualFieldNode[] to formatted JSON string
 */
export function serializeNodesToJson(nodes: VisualFieldNode[]): string {
  if (nodes.length === 0) return '{}';

  // Check if root nodes look like array items: "[0]", "[1]"
  const isArray = nodes.length > 0 && nodes.every((n) => /^\[\d+\]$/.test(n.key));

  if (isArray) {
    const arr = nodes.map((n) => nodeToJsValue(n));
    return JSON.stringify(arr, null, 2);
  }

  const obj: Record<string, any> = {};
  for (const node of nodes) {
    if (node.key) {
      obj[node.key] = nodeToJsValue(node);
    }
  }

  return JSON.stringify(obj, null, 2);
}

/**
 * Parse XML string into VisualFieldNode[]
 */
export function parseXmlToNodes(xmlStr: string): VisualFieldNode[] {
  const trimmed = xmlStr.trim();
  if (!trimmed) {
    return [
      {
        id: generateId(),
        key: 'root',
        type: 'object',
        value: '',
        isExpanded: true,
        children: [
          {
            id: generateId(),
            key: 'item',
            type: 'string',
            value: 'value',
          },
        ],
      },
    ];
  }

  // Use DOMParser if in browser, or fallback regex/manual parser
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(trimmed, 'application/xml');

    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      throw new Error(`XML 语法解析错误: ${parserError.textContent?.slice(0, 80)}`);
    }

    const walkXmlNode = (elem: Element): VisualFieldNode => {
      const childrenElements = Array.from(elem.children);
      const id = generateId();

      if (childrenElements.length > 0) {
        return {
          id,
          key: elem.tagName,
          type: 'object',
          value: '',
          isExpanded: true,
          children: childrenElements.map(walkXmlNode),
        };
      }

      const text = elem.textContent?.trim() || '';
      let type: VisualFieldType = 'string';
      if (/^-?\d+$/.test(text)) type = 'integer';
      else if (/^-?\d+\.\d+$/.test(text)) type = 'number';
      else if (text === 'true' || text === 'false') type = 'boolean';

      return {
        id,
        key: elem.tagName,
        type,
        value: text,
      };
    };

    if (doc.documentElement) {
      return [walkXmlNode(doc.documentElement)];
    }
  }

  // Basic fallback
  return [
    {
      id: generateId(),
      key: 'root',
      type: 'string',
      value: trimmed,
    },
  ];
}

/**
 * Serialize VisualFieldNode[] to formatted XML string
 */
export function serializeNodesToXml(nodes: VisualFieldNode[]): string {
  const formatNode = (node: VisualFieldNode, indent: number): string => {
    const tag = (node.key || 'item').trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
    const prefix = '  '.repeat(indent);

    if (node.type === 'object' && node.children && node.children.length > 0) {
      const inner = node.children.map((c) => formatNode(c, indent + 1)).join('\n');
      return `${prefix}<${tag}>\n${inner}\n${prefix}</${tag}>`;
    }

    const val = node.value || '';
    return `${prefix}<${tag}>${val}</${tag}>`;
  };

  if (nodes.length === 0) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<root></root>';
  }

  // If there's a single root object node, use it directly
  if (nodes.length === 1 && nodes[0].type === 'object') {
    return `<?xml version="1.0" encoding="UTF-8"?>\n${formatNode(nodes[0], 0)}`;
  }

  // Wrap multiple roots or primitives in a default <root>
  const body = nodes.map((n) => formatNode(n, 1)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n${body}\n</root>`;
}
