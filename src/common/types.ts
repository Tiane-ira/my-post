export type ParamDataType =
  | 'string'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'file'
  | 'array'
  | 'object';

export interface KeyValueItem {
  param_id: string;
  key: string;
  value: string;
  description?: string;
  is_checked: number; // 1: checked, -1/0: unchecked
  type?: 'text' | 'file' | ParamDataType;
  data_type?: ParamDataType;
  content_type?: string; // e.g. '自动 (content-type)'
  is_required?: number; // 1: required (*), 0: optional
  required?: boolean;
  file_path?: string; // local absolute file path on disk when type === 'file'
  file_name?: string; // display file name
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export type TargetType = 'api' | 'folder' | 'doc' | 'sse' | 'websocket';

export interface ApiTreeNode {
  target_id: string;
  parent_id: string;
  target_type: TargetType;
  name: string;
  method: HttpMethod | '';
  url: string;
  sort: number;
  status: number;
  mark_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ApiDetail {
  target_id: string;
  parent_id: string;
  project_id: string;
  target_type: TargetType;
  name: string;
  method: HttpMethod;
  url: string;
  sort: number;
  status: number;
  mark_id?: string;
  description?: string;
  request: {
    query: {
      parameter: KeyValueItem[];
      query_add_equal?: number;
    };
    path?: {
      parameter: KeyValueItem[];
    };
    header: {
      parameter: KeyValueItem[];
    };
    cookie?: {
      parameter: KeyValueItem[];
    };
    body: {
      mode: 'none' | 'json' | 'form-data' | 'urlencoded' | 'raw' | 'binary' | 'msgpack';
      raw_type?: 'json' | 'xml' | 'text';
      raw?: string;
      parameter?: KeyValueItem[];
      urlencoded?: KeyValueItem[];
      binary_file?: string;
      msgpack_raw?: string;
      raw_json?: string;
      raw_xml?: string;
      raw_text?: string;
    };
    auth: {
      type: 'inherit' | 'none' | 'bearer' | 'basic' | 'apikey';
      bearer?: { token: string };
      basic?: { username: string; password: string };
      apikey?: { key: string; value: string; in: 'header' | 'query' };
    };
    pre_tasks?: { type: string; script?: string }[];
    post_tasks?: { type: string; script?: string }[];
  };
  websocket?: WebSocketConfig;
  response?: {
    example?: ResponseExample[];
    is_check_result?: number;
  };
}

export interface WebSocketConfig {
  protocols?: string;
  heartbeat?: {
    enabled: boolean;
    interval: number;
    message: string;
  };
  messageDraft?: string;
  messageMode?: 'json' | 'text';
}

export interface ResponseExample {
  example_id: string;
  name: string;
  expect?: {
    code: string;
    content_type: string;
    is_default?: number;
    verify_type?: string;
  };
  raw: string;
  raw_parameter?: KeyValueItem[];
}

export interface ApipostScannedProject {
  project_id: string;
  name: string;
  path: string;
  created_at: string;
  apiCount: number;
  isImported: boolean;
}

export interface ProjectInfo {
  project_id: string;
  name: string;
  intro?: string;
  path: string;
  created_at: string;
  updated_at: string;
}

export interface EnvironmentInfo {
  env_id: string;
  name: string;
  pre_url: string;
  list: KeyValueItem[];
}

export interface GlobalParams {
  header: KeyValueItem[];
  query: KeyValueItem[];
  body: KeyValueItem[];
  vars: KeyValueItem[];
}

export interface TestResult {
  title: string;
  passed: boolean;
  message?: string;
}

export interface HttpResponseResult {
  statusCode: number;
  statusText: string;
  timeMs: number;
  sizeBytes: number;
  headers: Record<string, string>;
  data: any;
  rawText: string;
  error?: string;
  tests?: TestResult[];
  logs?: string[];
  actualRequest?: {
    method: string;
    url: string;
    fullUrl: string;
    headers: Record<string, string>;
    queryParams: Record<string, string>;
    pathParams?: Record<string, string>;
    bodyMode?: string;
    bodyData?: any;
    bodySummary?: string;
    formParams?: Record<string, { value: string; type: string; fileName?: string }>;
  };
  cookies?: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: string;
    httpOnly?: boolean;
    secure?: boolean;
    raw?: string;
  }>;
}

export interface DocShareRecord {
  shareId: string;
  title: string;
  projectId: string;
  projectName: string;
  scope: 'api' | 'folder' | 'project';
  targetId?: string;
  password?: string;
  createdAt: number;
  expiresAt?: number;
  tree: ApiTreeNode[];
  apis: ApiDetail[];
}

export interface DocShareItem extends DocShareRecord {
  lanUrl: string;
  localUrl: string;
  apiCount: number;
  isExpired: boolean;
}

export interface ShareServerInfo {
  port: number;
  primaryIp: string;
  allIps: string[];
  running: boolean;
  baseUrl: string;
}


