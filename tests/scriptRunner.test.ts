import { describe, it, expect } from 'vitest';
import { ScriptRunner } from '../src/main/scriptRunner';

describe('ScriptRunner Sandbox Engine', () => {
  describe('Pre-request Script Execution', () => {
    it('should set and get environment variables via pm.environment', () => {
      const script = `
        pm.environment.set("token", "abc-xyz-123");
        pm.environment.set("timestamp", 1700000000);
      `;
      const res = ScriptRunner.runPreScript(script, { env: {}, globals: {} });
      expect(res.env['token']).toBe('abc-xyz-123');
      expect(res.env['timestamp']).toBe('1700000000');
    });

    it('should set global variables via pm.globals', () => {
      const script = `
        pm.globals.set("globalDomain", "https://api.test.com");
      `;
      const res = ScriptRunner.runPreScript(script, { env: {}, globals: {} });
      expect(res.globals['globalDomain']).toBe('https://api.test.com');
    });

    it('should capture console.log output into logs array', () => {
      const script = `
        console.log("Starting test setup");
        console.log("Generated id:", 42);
        console.warn("Watch out");
      `;
      const res = ScriptRunner.runPreScript(script, { env: {}, globals: {} });
      expect(res.logs.length).toBe(3);
      expect(res.logs[0]).toBe('Starting test setup');
      expect(res.logs[1]).toBe('Generated id: 42');
      expect(res.logs[2]).toContain('[WARN] Watch out');
    });

    it('should gracefully handle syntax errors in pre-scripts without throwing', () => {
      const script = `this is invalid js syntax %%% !!!`;
      const res = ScriptRunner.runPreScript(script, { env: {}, globals: {} });
      expect(res.logs.some((l) => l.includes('[Script Error]'))).toBe(true);
    });
  });

  describe('Post-response Tests & Assertions', () => {
    it('should evaluate pm.response.to.have.status correctly', () => {
      const script = `
        pm.test("Status is 200", function () {
          pm.response.to.have.status(200);
        });
        pm.test("Status is 404 (should fail)", function () {
          pm.response.to.have.status(404);
        });
      `;
      const response = {
        code: 200,
        responseTime: 150,
        responseSize: 1024,
        rawText: '{"code":0}',
        data: { code: 0 },
      };
      const res = ScriptRunner.runTests(script, response, { env: {}, globals: {} });
      expect(res.tests.length).toBe(2);
      expect(res.tests[0].passed).toBe(true);
      expect(res.tests[1].passed).toBe(false);
      expect(res.tests[1].message.toLowerCase()).toContain('404 but got 200');
    });

    it('should evaluate pm.expect equality and comparisons', () => {
      const script = `
        pm.test("Check data code and message", function () {
          var res = pm.response.json();
          pm.expect(res.code).to.equal(0);
          pm.expect(res.message).to.eql("success");
        });
        pm.test("Check response time below threshold", function () {
          pm.expect(pm.response.responseTime).to.be.below(500);
        });
      `;
      const response = {
        code: 200,
        responseTime: 120,
        responseSize: 512,
        rawText: '{"code":0,"message":"success"}',
        data: { code: 0, message: 'success' },
      };
      const res = ScriptRunner.runTests(script, response, { env: {}, globals: {} });
      expect(res.tests.length).toBe(2);
      expect(res.tests[0].passed).toBe(true);
      expect(res.tests[1].passed).toBe(true);
    });

    it('should evaluate property existence and type checks', () => {
      const script = `
        pm.test("Check object properties", function () {
          var res = pm.response.json();
          pm.expect(res).to.have.property("token");
          pm.expect(res.count).to.be.a("number");
        });
      `;
      const response = {
        code: 200,
        responseTime: 80,
        responseSize: 256,
        rawText: '{"token":"xyz789","count":10}',
        data: { token: 'xyz789', count: 10 },
      };
      const res = ScriptRunner.runTests(script, response, { env: {}, globals: {} });
      expect(res.tests.length).toBe(1);
      expect(res.tests[0].passed).toBe(true);
    });

    it('should allow extracting response tokens and updating environment', () => {
      const script = `
        var res = pm.response.json();
        pm.environment.set("savedToken", res.token);
      `;
      const response = {
        code: 200,
        responseTime: 90,
        responseSize: 100,
        rawText: '{"token":"bearer-abc-999"}',
        data: { token: 'bearer-abc-999' },
      };
      const res = ScriptRunner.runTests(script, response, { env: {}, globals: {} });
      expect(res.env['savedToken']).toBe('bearer-abc-999');
    });
  });
});
