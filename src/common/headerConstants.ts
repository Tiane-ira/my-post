export interface HeaderSuggestion {
  key: string;
  description: string;
  commonValues: string[];
}

export const COMMON_HTTP_HEADERS: HeaderSuggestion[] = [
  {
    key: 'Content-Type',
    description: '指示请求体的媒体格式 (MIME)',
    commonValues: [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
      'text/plain',
      'text/html',
      'application/xml',
      'text/xml',
      'application/octet-stream',
      'application/javascript',
      'text/event-stream',
    ],
  },
  {
    key: 'Authorization',
    description: '客户端认证凭据',
    commonValues: [
      'Bearer {{token}}',
      'Basic {{credentials}}',
      'Bearer ',
      'Basic ',
    ],
  },
  {
    key: 'Accept',
    description: '指示客户端可处理的响应媒体类型',
    commonValues: [
      'application/json',
      '*/*',
      'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'text/event-stream',
      'text/plain',
      'application/octet-stream',
    ],
  },
  {
    key: 'User-Agent',
    description: '发起请求的客户端标识',
    commonValues: [
      'mypost/1.0 (Desktop; Offline)',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'curl/8.0.0',
      'PostmanRuntime/7.36.0',
    ],
  },
  {
    key: 'Cache-Control',
    description: '缓存控制指令',
    commonValues: [
      'no-cache',
      'no-store',
      'max-age=0',
      'no-cache, no-store, must-revalidate',
      'max-age=3600',
      'private',
      'public',
    ],
  },
  {
    key: 'Connection',
    description: '网络连接管理选项',
    commonValues: ['keep-alive', 'close', 'Upgrade'],
  },
  {
    key: 'Accept-Encoding',
    description: '客户端支持的内容编码算法',
    commonValues: ['gzip, deflate, br', 'gzip, deflate', 'br', 'identity'],
  },
  {
    key: 'Accept-Language',
    description: '客户端优先接受的自然语言',
    commonValues: ['zh-CN,zh;q=0.9,en;q=0.8', 'en-US,en;q=0.9', 'zh-CN,zh;q=0.9', '*'],
  },
  {
    key: 'Origin',
    description: '跨域请求或POST请求的源地址',
    commonValues: ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:3000'],
  },
  {
    key: 'Referer',
    description: '发起请求的前一个页面来源URL',
    commonValues: ['http://localhost:3000/'],
  },
  {
    key: 'Cookie',
    description: '发送给服务器的会话Cookie',
    commonValues: ['session_id={{sessionId}}', 'token={{token}}'],
  },
  {
    key: 'Host',
    description: '目标服务器的域名和端口',
    commonValues: ['localhost', 'api.example.com'],
  },
  {
    key: 'X-Requested-With',
    description: '标识Ajax异步请求',
    commonValues: ['XMLHttpRequest'],
  },
  {
    key: 'X-Forwarded-For',
    description: '经过反向代理时记录客户端真实IP',
    commonValues: ['127.0.0.1'],
  },
  {
    key: 'If-None-Match',
    description: '条件请求ETag标识',
    commonValues: ['*'],
  },
  {
    key: 'If-Modified-Since',
    description: '条件请求最后修改时间',
    commonValues: [],
  },
  {
    key: 'Pragma',
    description: '向后兼容的防缓存指令',
    commonValues: ['no-cache'],
  },
  {
    key: 'Upgrade',
    description: '协议切换指示 (如WebSocket)',
    commonValues: ['websocket'],
  },
  {
    key: 'Sec-WebSocket-Protocol',
    description: 'WebSocket子协议协商',
    commonValues: ['chat', 'json'],
  },
  {
    key: 'Sec-WebSocket-Version',
    description: 'WebSocket协议版本',
    commonValues: ['13'],
  },
  {
    key: 'Access-Control-Allow-Origin',
    description: 'CORS跨域资源共享允许的来源',
    commonValues: ['*', 'http://localhost:3000'],
  },
  {
    key: 'Access-Control-Allow-Headers',
    description: 'CORS允许的自定义请求头',
    commonValues: ['Content-Type, Authorization, *'],
  },
  {
    key: 'Access-Control-Allow-Methods',
    description: 'CORS允许的HTTP方法',
    commonValues: ['GET, POST, PUT, DELETE, OPTIONS'],
  },
];

export interface SuggestionItem {
  value: string;
  description?: string;
  badge?: string;
}

export function getHeaderKeySuggestions(): SuggestionItem[] {
  return COMMON_HTTP_HEADERS.map((h) => ({
    value: h.key,
    description: h.description,
    badge: 'Header',
  }));
}

export function getHeaderValueSuggestions(headerKey: string): SuggestionItem[] {
  if (!headerKey || !headerKey.trim()) return [];
  const normalized = headerKey.trim().toLowerCase();
  const matched = COMMON_HTTP_HEADERS.find((h) => h.key.toLowerCase() === normalized);
  if (!matched || !matched.commonValues || matched.commonValues.length === 0) {
    return [];
  }
  return matched.commonValues.map((val) => ({
    value: val,
    description: matched.description,
  }));
}
