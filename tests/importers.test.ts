import { describe, it, expect } from 'vitest';
import { DataImporters } from '../src/common/importers';
import { MainDocParser } from '../src/main/docParser';

describe('DataImporters Engine', () => {
  describe('cURL Parser', () => {
    it('should parse simple cURL GET command', () => {
      const curl = 'curl https://api.example.com/users';
      const parsed = DataImporters.parseCurl(curl);
      expect(parsed.method).toBe('GET');
      expect(parsed.url).toBe('https://api.example.com/users');
      expect(parsed.name).toBe('/users');
      expect(parsed.bodyMode).toBe('none');
    });

    it('should parse cURL POST with custom headers and JSON body', () => {
      const curl = `curl -X POST https://api.example.com/login -H "Content-Type: application/json" -H "X-Client: test" -d '{"username": "admin", "password": "123"}'`;
      const parsed = DataImporters.parseCurl(curl);
      expect(parsed.method).toBe('POST');
      expect(parsed.url).toBe('https://api.example.com/login');
      expect(parsed.headers.length).toBe(2);
      expect(parsed.headers[0].key).toBe('Content-Type');
      expect(parsed.headers[0].value).toBe('application/json');
      expect(parsed.headers[1].key).toBe('X-Client');
      expect(parsed.bodyMode).toBe('json');
      expect(parsed.bodyRaw).toBe('{"username": "admin", "password": "123"}');
    });

    it('should correctly identify cURL command strings via isCurl', () => {
      expect(DataImporters.isCurl('curl https://api.example.com')).toBe(true);
      expect(DataImporters.isCurl('  curl -X POST "https://test.com"')).toBe(true);
      expect(DataImporters.isCurl('curl\n  --location "https://test.com"')).toBe(true);
      expect(DataImporters.isCurl('https://api.example.com/users')).toBe(false);
      expect(DataImporters.isCurl('GET /api/v1/test')).toBe(false);
    });

    it('should parse browser devtools multiline cURL with single quotes and --data-raw', () => {
      const devtoolsCurl = `curl 'https://api.example.com/orders?status=paid&limit=10' \\
  -H 'Accept: application/json, text/plain, */*' \\
  -H 'Authorization: Bearer my-secret-jwt' \\
  -H 'User-Agent: Mozilla/5.0' \\
  --data-raw '{"order_id":12345,"note":"test"}' \\
  --compressed`;

      const parsed = DataImporters.parseCurl(devtoolsCurl);
      expect(parsed.method).toBe('POST');
      expect(parsed.url).toBe('https://api.example.com/orders?status=paid&limit=10');
      expect(parsed.headers.some((h) => h.key === 'Accept')).toBe(true);
      expect(parsed.headers.some((h) => h.key === 'Authorization')).toBe(true);
      expect(parsed.bodyMode).toBe('json');
      expect(parsed.bodyRaw).toBe('{"order_id":12345,"note":"test"}');
    });

    it('should transform cURL command directly into full ApiDetail structure', () => {
      const curl = `curl -X PUT "https://api.example.com/products/88?category=phone" -H "Authorization: Bearer abc-xyz-token" -H "Content-Type: application/json" -d '{"stock": 100}'`;
      const baseApi: any = {
        target_id: 'api-existing-1',
        name: '原始接口',
        method: 'GET',
        url: '',
        request: {
          query: { parameter: [] },
          header: { parameter: [] },
          body: { mode: 'none' },
          auth: { type: 'none' },
        },
      };

      const updated = DataImporters.curlToApiDetail(curl, baseApi);
      expect(updated.target_id).toBe('api-existing-1');
      expect(updated.method).toBe('PUT');
      expect(updated.url).toBe('https://api.example.com/products/88?category=phone');
      expect(updated.request.query.parameter.length).toBe(1);
      expect(updated.request.query.parameter[0].key).toBe('category');
      expect(updated.request.query.parameter[0].value).toBe('phone');
      expect(updated.request.header.parameter.length).toBe(2);
      expect(updated.request.body.mode).toBe('json');
      expect(updated.request.body.raw).toBe('{"stock": 100}');
      expect(updated.request.auth.type).toBe('bearer');
      expect(updated.request.auth.bearer?.token).toBe('abc-xyz-token');
    });

    it('should strip environment preUrl from url when curl command matches current environment', () => {
      const curl = `curl "https://api.example.com/api/v1/orders/999?status=active" -H "X-Token: 123"`;
      const baseApi: any = { target_id: 'api-env-1' };
      const preUrl = 'https://api.example.com';

      const updated = DataImporters.curlToApiDetail(curl, baseApi, preUrl);
      expect(updated.url).toBe('/api/v1/orders/999?status=active');
      expect(updated.request.query.parameter.length).toBe(1);
      expect(updated.request.query.parameter[0].key).toBe('status');
      expect(updated.request.query.parameter[0].value).toBe('active');
    });

    it('should keep full url when curl command does not match current environment preUrl', () => {
      const curl = `curl "https://httpbin.org/get?source=postman"`;
      const baseApi: any = { target_id: 'api-env-2' };
      const preUrl = 'http://localhost:8080';

      const updated = DataImporters.curlToApiDetail(curl, baseApi, preUrl);
      expect(updated.url).toBe('https://httpbin.org/get?source=postman');
      expect(updated.request.query.parameter.length).toBe(1);
      expect(updated.request.query.parameter[0].key).toBe('source');
      expect(updated.request.query.parameter[0].value).toBe('postman');
    });

    it('should parse Windows CMD multiline cURL with carets and caret escaping', () => {
      const cmdCurl = `curl ^"https://api.example.com/api/v1/auth/login?source=client^" ^
  -H ^"accept: application/json^" ^
  -H ^"authorization: Bearer cmd-token-789^" ^
  -H ^"user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)^" ^
  --data-raw ^"^{^\^"username^\^":^\^"admin^\^",^\^"password^\^":^\^"123456^\^"^}^"`;

      const parsed = DataImporters.parseCurl(cmdCurl);
      expect(parsed.method).toBe('POST');
      expect(parsed.url).toBe('https://api.example.com/api/v1/auth/login?source=client');
      expect(parsed.headers.some((h) => h.key.toLowerCase() === 'accept')).toBe(true);
      expect(parsed.headers.some((h) => h.key.toLowerCase() === 'authorization')).toBe(true);
      expect(parsed.auth?.type).toBe('bearer');
      expect(parsed.auth?.bearer?.token).toBe('cmd-token-789');
      expect(parsed.bodyMode).toBe('json');
      expect(JSON.parse(parsed.bodyRaw)).toEqual({ username: 'admin', password: '123456' });
    });

    it('should parse Chrome DevTools Copy as cURL (cmd) for DeepSeek with caret-escaped brackets, parentheses, percent, semicolon header and cookies', () => {
      const chromeCmdCurl = `curl --url ^"https://chat.deepseek.com/api/v0/client/settings/report^" ^
  -H ^"accept: */*^" ^
  -H ^"accept-language: zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7^" ^
  -H ^"authorization: Bearer TdRw+gLaymcrmEzk79KhaqlHSM4LDbC8VsM/VNfK0kFrYv0fgLZ59S/teA39M5+M^" ^
  -H ^"content-type: application/json^" ^
  -b ^"smidV2=2025120821171944b18b7769b49ef5922ccd6bd4b4aa1c0063544fbc8e6f860; .thumbcache_6b2e5483f9d858d7c661c5e276b6a6ae=L49lHPm1IkDmZ80UcCVYH6BBClnsrkypoeZo29rFRK4cAan2c2N0sP/RoHz5vgkiocxxXiLaxYbzAU/5RpVQxA^%^3D^%^3D; HWWAFSESID=6abce213d515648b4896; HWWAFSESTIME=1792210897116; ds_session_id=a52d57f4e4794f8da169597bc8319a02^" ^
  -H ^"origin: https://chat.deepseek.com^" ^
  -H ^"priority: u=1, i^" ^
  -H ^"referer: https://chat.deepseek.com/^" ^
  -H ^"sec-ch-ua: ^\^"Google Chrome^\^";v=^\^"155^\^", ^\^"Chromium^\^";v=^\^"155^\^", ^\^"Not^(A:Brand^\^";v=^\^"24^\^"^" ^
  -H ^"sec-ch-ua-mobile: ?0^" ^
  -H ^"sec-ch-ua-platform: ^\^"Windows^\^"^" ^
  -H ^"sec-fetch-dest: empty^" ^
  -H ^"sec-fetch-mode: cors^" ^
  -H ^"sec-fetch-site: same-origin^" ^
  -H ^"user-agent: Mozilla/5.0 ^(Windows NT 10.0; Win64; x64^) AppleWebKit/537.36 ^(KHTML, like Gecko^) Chrome/155.0.0.0 Safari/537.36^" ^
  -H ^"x-client-bundle-id: com.deepseek.chat^" ^
  -H ^"x-client-locale: zh_CN^" ^
  -H ^"x-client-platform: web^" ^
  -H ^"x-client-timezone-offset: 28800^" ^
  -H ^"x-client-version: 2.5.0^" ^
  -H ^"x-device-id: fb577e3d-c81b-41ee-9e34-bbd3beb0b688^" ^
  -H ^"x-device-model;^" ^
  -H ^"x-settings-token: eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..okvHPD8zHLUy8c4s.e5dCOJjr4mNO3eCh9QXZVhtWdPRr5nuck4nrbpStKVvgDoCb5MCYmVOQDSisQfoUnJNd523__lq3y1_y9HwvWJtG7bgbejzROAxmJeSfpsEzT5Tlc88zegMPATA83a6cbHJlA84BB5-ZbayfB4KXvzDhEVFhwtG6_i8FXWECvysAIJX90cYwfq0LrSpEnaz9YdDGWLIHEVtcUEsSvAPMVid6h5VTSaynlIdKYiydZT51dRb5it0uVM6hZs1Csb1AfsNqLBPb.NCj99kFW1f4WKpilgG_QBg^" ^
  --data-raw ^"^{^\^"settings_ids^\^":^[1918634372,1806834993,1336349584,655820012,714289219,58457202,985220088,1806424694,1429241854,912299024,962533274,2001562968,410318079,1804498312,19572873,1724703034,1081694394,741308588,948828287,1291879659,2037161179,1720155256,591966471,1467781796,677462759,304806084,1450201665,1704976799,870509613,993773936,559384626,1914233287,1640113473^],^\^"did^\^":^\^"21f7f50b-94b9-47ff-ae72-4c1f9db963c8^\^",^\^"sso_id^\^":^\^"a4fe0cb7-549c-4a40-a808-f3ac2c2a2dc0^\^"^}^"  谷歌拷贝出来的curl命令cmd格式，解析出来是无法使用的`;

      const parsed = DataImporters.parseCurl(chromeCmdCurl);
      expect(parsed.method).toBe('POST');
      expect(parsed.url).toBe('https://chat.deepseek.com/api/v0/client/settings/report');
      expect(parsed.bodyMode).toBe('json');
      const bodyObj = JSON.parse(parsed.bodyRaw);
      expect(bodyObj.settings_ids).toBeInstanceOf(Array);
      expect(bodyObj.settings_ids[0]).toBe(1918634372);
      expect(bodyObj.did).toBe('21f7f50b-94b9-47ff-ae72-4c1f9db963c8');
      expect(bodyObj.sso_id).toBe('a4fe0cb7-549c-4a40-a808-f3ac2c2a2dc0');
      
      // Semicolon header check
      const modelHeader = parsed.headers.find((h) => h.key === 'x-device-model');
      expect(modelHeader).toBeDefined();

      // User-agent unescaped check
      const uaHeader = parsed.headers.find((h) => h.key === 'user-agent');
      expect(uaHeader?.value).toContain('(Windows NT 10.0; Win64; x64)');
      expect(uaHeader?.value).not.toContain('^(');

      // sec-ch-ua unescaped check
      const secChUa = parsed.headers.find((h) => h.key === 'sec-ch-ua');
      expect(secChUa?.value).toContain('Not(A:Brand');
      expect(secChUa?.value).not.toContain('^(');

      // Cookies unescaped check
      const thumbCacheCookie = parsed.cookies?.find((c) => c.key.includes('thumbcache'));
      expect(thumbCacheCookie?.value).toContain('%3D%3D');
      expect(thumbCacheCookie?.value).not.toContain('^%');

      // Test full conversion to ApiDetail
      const apiDetail = DataImporters.curlToApiDetail(chromeCmdCurl);
      expect(apiDetail.method).toBe('POST');
      expect(apiDetail.url).toBe('https://chat.deepseek.com/api/v0/client/settings/report');
      expect(apiDetail.request.body.mode).toBe('json');
      expect(JSON.parse(apiDetail.request.body.raw || '{}').settings_ids.length).toBe(33);
      expect(apiDetail.request.auth.type).toBe('bearer');
      expect(apiDetail.request.auth.bearer?.token).toBe('TdRw+gLaymcrmEzk79KhaqlHSM4LDbC8VsM/VNfK0kFrYv0fgLZ59S/teA39M5+M');
      expect(apiDetail.request.cookie?.parameter?.length).toBeGreaterThanOrEqual(5);
      expect(apiDetail.request.header.parameter.some((h) => h.key.toLowerCase() === 'cookie')).toBe(false);
    });

    it('should parse Bash cURL with ANSI-C quoting $\'...\' and multiline payload', () => {
      const bashCurl = `curl 'https://api.example.com/v1/users' \\
  -X 'POST' \\
  -H 'Content-Type: application/json' \\
  --data-raw $'{\\n  "name": "Jane Doe",\\n  "active": true\\n}'`;

      const parsed = DataImporters.parseCurl(bashCurl);
      expect(parsed.method).toBe('POST');
      expect(parsed.url).toBe('https://api.example.com/v1/users');
      expect(parsed.bodyMode).toBe('json');
      expect(JSON.parse(parsed.bodyRaw)).toEqual({ name: 'Jane Doe', active: true });
    });

    it('should recognize curl.exe and prompt prefixes like $ and >', () => {
      expect(DataImporters.isCurl('curl.exe "https://api.example.com"')).toBe(true);
      expect(DataImporters.isCurl('$ curl "https://api.example.com"')).toBe(true);
      expect(DataImporters.isCurl('> curl -X GET "https://api.example.com"')).toBe(true);
    });

    it('should parse PowerShell multiline cURL with backticks', () => {
      const psCurl = `curl.exe \`
  -X DELETE \`
  "https://api.example.com/items/99" \`
  -H "Authorization: Bearer ps-secret"`;

      const parsed = DataImporters.parseCurl(psCurl);
      expect(parsed.method).toBe('DELETE');
      expect(parsed.url).toBe('https://api.example.com/items/99');
      expect(parsed.auth?.type).toBe('bearer');
      expect(parsed.auth?.bearer?.token).toBe('ps-secret');
    });

    it('should parse form-data in cURL commands', () => {
      const formCurl = `curl -X POST "https://api.example.com/upload" -F "description=test" -F "file=@/tmp/avatar.png"`;
      const parsed = DataImporters.parseCurl(formCurl);
      expect(parsed.method).toBe('POST');
      expect(parsed.bodyMode).toBe('form-data');
      expect(parsed.formData?.length).toBe(2);
      expect(parsed.formData?.[0].key).toBe('description');
      expect(parsed.formData?.[0].value).toBe('test');
      expect(parsed.formData?.[1].key).toBe('file');
      expect(parsed.formData?.[1].type).toBe('file');
    });
  });

  describe('Postman Collection Parser', () => {
    it('should parse postman collection v2.1 json into api items', () => {
      const postmanJson = JSON.stringify({
        info: { name: 'My Collection' },
        item: [
          {
            name: 'Get User Info',
            request: {
              method: 'GET',
              url: 'https://api.example.com/user/1',
              header: [{ key: 'Authorization', value: 'Bearer token' }],
            },
          },
          {
            name: 'Create User',
            request: {
              method: 'POST',
              url: { raw: 'https://api.example.com/user' },
              header: [{ key: 'Content-Type', value: 'application/json' }],
              body: { raw: '{"name":"Jack"}' },
            },
          },
        ],
      });

      const results = DataImporters.parsePostmanCollection(postmanJson);
      expect(results.length).toBe(2);
      expect(results[0].name).toBe('Get User Info');
      expect(results[0].method).toBe('GET');
      expect(results[0].headers[0].key).toBe('Authorization');

      expect(results[1].name).toBe('Create User');
      expect(results[1].method).toBe('POST');
      expect(results[1].bodyRaw).toBe('{"name":"Jack"}');
    });
  });

  describe('Swagger / OpenAPI Parser', () => {
    it('should parse swagger paths and operations into api items', () => {
      const swaggerJson = JSON.stringify({
        swagger: '2.0',
        basePath: '/api/v2',
        paths: {
          '/pets': {
            get: {
              summary: 'List all pets',
              operationId: 'listPets',
              parameters: [
                { in: 'query', name: 'status', default: 'available', description: 'Status filter' },
              ],
            },
            post: {
              summary: 'Create a pet',
              operationId: 'createPet',
              parameters: [
                {
                  in: 'body',
                  name: 'body',
                  schema: {
                    type: 'object',
                    properties: { name: { type: 'string', example: 'doggie' }, age: { type: 'integer', default: 3 } },
                  },
                },
              ],
            },
          },
          '/pets/{id}': {
            delete: {
              summary: 'Delete pet by id',
              parameters: [{ in: 'path', name: 'id', default: '101' }],
            },
          },
        },
      });

      const results = DataImporters.parseSwagger(swaggerJson);
      expect(results.length).toBe(3);
      const getPets = results.find((r) => r.method === 'GET');
      expect(getPets?.url).toBe('/api/v2/pets');
      expect(getPets?.queryParams?.length).toBe(1);
      expect(getPets?.queryParams?.[0].key).toBe('status');
      expect(getPets?.queryParams?.[0].value).toBe('available');

      const postPets = results.find((r) => r.method === 'POST');
      expect(postPets?.bodyMode).toBe('json');
      expect(JSON.parse(postPets?.bodyRaw || '{}')).toEqual({ name: 'doggie', age: 3 });

      const detail = DataImporters.apiDocItemToApiDetail(postPets!, 'api-10', 'proj-1', 'folder-5');
      expect(detail.target_id).toBe('api-10');
      expect(detail.parent_id).toBe('folder-5');
      expect(detail.method).toBe('POST');
      expect(detail.request.body.mode).toBe('json');
    });

    it('should parse OpenAPI 3.0 JSON with requestBody and servers', () => {
      const openApiJson = JSON.stringify({
        openapi: '3.0.0',
        servers: [{ url: '/v3' }],
        paths: {
          '/users': {
            post: {
              summary: 'Create user account',
              requestBody: {
                content: {
                  'application/json': {
                    example: { username: 'testuser', email: 'test@example.com' },
                  },
                },
              },
            },
          },
        },
      });

      const results = DataImporters.parseOpenApi(openApiJson);
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Create user account');
      expect(results[0].url).toBe('/v3/users');
      expect(results[0].bodyMode).toBe('json');
      expect(JSON.parse(results[0].bodyRaw || '{}')).toEqual({ username: 'testuser', email: 'test@example.com' });
    });

    it('should parse Swagger/OpenAPI in YAML format', () => {
      const yamlContent = `
swagger: "2.0"
info:
  title: Sample API
  version: "0.1.0"
paths:
  /echo:
    get:
      summary: Echo endpoint
      parameters:
        - name: msg
          in: query
          type: string
          default: hello
`;
      const results = DataImporters.parseSwaggerOrOpenApi(yamlContent);
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Echo endpoint');
      expect(results[0].queryParams?.[0].key).toBe('msg');
      expect(results[0].queryParams?.[0].value).toBe('hello');
    });

    it('should resolve $ref definitions, extract path variables, and extract folder hierarchy from tags', () => {
      const swaggerWithRef = JSON.stringify({
        swagger: '2.0',
        info: { title: 'Ecommerce API', version: '1.0.0' },
        definitions: {
          Address: {
            type: 'object',
            properties: {
              city: { type: 'string', example: 'Beijing' },
              zipcode: { type: 'string', default: '100000' },
            },
          },
          CreateOrderDto: {
            type: 'object',
            properties: {
              productId: { type: 'integer', example: 999 },
              quantity: { type: 'integer', default: 2 },
              shippingAddress: { $ref: '#/definitions/Address' },
            },
          },
        },
        paths: {
          '/orders/{orderId}/items/{itemId}': {
            post: {
              summary: 'Add item to order',
              tags: ['订单管理/订单子项'],
              parameters: [
                { in: 'path', name: 'orderId', default: 'ORD-123', description: 'Order ID' },
                // itemId is omitted from parameters deliberately to test URL path variable auto-extraction
                { in: 'body', name: 'body', schema: { $ref: '#/definitions/CreateOrderDto' } },
              ],
            },
          },
        },
      });

      const docResult = DataImporters.parseApiDoc(swaggerWithRef);
      expect(docResult.title).toBe('Ecommerce API');
      expect(docResult.docFormat).toBe('swagger');
      expect(docResult.items.length).toBe(1);

      const item = docResult.items[0];
      expect(item.name).toBe('Add item to order');
      expect(item.url).toBe('/orders/{orderId}/items/{itemId}');
      expect(item.folderPath).toEqual(['订单管理', '订单子项']);

      // Path variables check (orderId from parameter, itemId auto-extracted from path template)
      expect(item.pathParams?.length).toBe(2);
      expect(item.pathParams?.find((p) => p.key === 'orderId')?.value).toBe('ORD-123');
      expect(item.pathParams?.find((p) => p.key === 'itemId')?.value).toBe('1');

      // Body $ref resolution check
      expect(item.bodyMode).toBe('json');
      const bodyObj = JSON.parse(item.bodyRaw || '{}');
      expect(bodyObj.productId).toBe(999);
      expect(bodyObj.quantity).toBe(2);
      expect(bodyObj.shippingAddress).toEqual({ city: 'Beijing', zipcode: '100000' });
    });

    it('should parse async document with open-source SwaggerParser and handle circular models gracefully', async () => {
      const circularSpec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Tree Hierarchy API', version: '2.0.0' },
        paths: {
          '/nodes/{nodeId}': {
            get: {
              tags: ['Node System / Tree Nodes'],
              summary: 'Get node and descendants',
              parameters: [
                { name: 'nodeId', in: 'path', required: true, schema: { type: 'string', example: 'root-1' } }
              ],
              responses: {
                '200': {
                  description: 'Node details',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/TreeNode' }
                    }
                  }
                }
              }
            }
          }
        },
        components: {
          schemas: {
            TreeNode: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'node-101' },
                name: { type: 'string', example: 'Root Directory' },
                parent: { $ref: '#/components/schemas/TreeNode' }
              }
            }
          }
        }
      });

      const result = await DataImporters.parseApiDocAsync(circularSpec);
      expect(result.title).toBe('Tree Hierarchy API');
      expect(result.items.length).toBe(1);
      const nodeItem = result.items[0];
      expect(nodeItem.name).toBe('Get node and descendants');
      expect(nodeItem.folderPath).toEqual(['Node System', 'Tree Nodes']);
      expect(nodeItem.pathParams?.length).toBe(1);
      expect(nodeItem.pathParams?.[0].key).toBe('nodeId');
      expect(nodeItem.pathParams?.[0].value).toBe('root-1');
    });

    it('should parse document via MainDocParser using @apidevtools/swagger-parser in Node main process', async () => {
      const openApiYaml = `
openapi: 3.0.0
info:
  title: Pet Store API
  version: 1.0.0
paths:
  /pets:
    get:
      summary: List all pets
      tags:
        - Pets Management / Dogs
      responses:
        '200':
          description: A paged array of pets
`;
      const mainResult = await MainDocParser.parse(openApiYaml);
      expect(mainResult.title).toBe('Pet Store API');
      expect(mainResult.docFormat).toBe('openapi');
      expect(mainResult.items.length).toBe(1);
      expect(mainResult.items[0].name).toBe('List all pets');
      expect(mainResult.items[0].folderPath).toEqual(['Pets Management', 'Dogs']);
    });

    it('should parse document via MainDocParser when requestBody contains circular model', async () => {
      const circularRequestBodySpec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Tree API', version: '1.0' },
        paths: {
          '/nodes': {
            post: {
              summary: 'Create node',
              requestBody: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/TreeNode' }
                  }
                }
              },
              responses: { '200': { description: 'ok' } }
            }
          }
        },
        components: {
          schemas: {
            TreeNode: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                parent: { $ref: '#/components/schemas/TreeNode' }
              }
            }
          }
        }
      });

      const res = await MainDocParser.parse(circularRequestBodySpec);
      expect(res.title).toBe('Tree API');
      expect(res.items.length).toBe(1);
      expect(res.items[0].bodyMode).toBe('json');
    });
  });
});

