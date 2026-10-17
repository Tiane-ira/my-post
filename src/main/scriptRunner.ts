import vm from 'vm';
import { TestResult } from '../common/types';

export class ScriptRunner {
  public static runPreScript(
    script: string,
    context: {
      env: Record<string, string>;
      globals: Record<string, string>;
    }
  ): { env: Record<string, string>; globals: Record<string, string>; logs: string[] } {
    const logs: string[] = [];
    const envMap = { ...context.env };
    const globalsMap = { ...context.globals };

    const sandbox = {
      console: {
        log: (...args: any[]) => logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),
        warn: (...args: any[]) => logs.push('[WARN] ' + args.map((a) => String(a)).join(' ')),
        error: (...args: any[]) => logs.push('[ERROR] ' + args.map((a) => String(a)).join(' ')),
      },
      pm: {
        environment: {
          set: (k: string, v: any) => { envMap[k] = String(v); },
          get: (k: string) => envMap[k],
        },
        globals: {
          set: (k: string, v: any) => { globalsMap[k] = String(v); },
          get: (k: string) => globalsMap[k],
        },
        variables: {
          set: (k: string, v: any) => { envMap[k] = String(v); },
          get: (k: string) => envMap[k] || globalsMap[k],
        },
      },
      setTimeout: () => {},
    };

    try {
      vm.createContext(sandbox);
      vm.runInContext(script, sandbox, { timeout: 2000 });
    } catch (e: any) {
      logs.push(`[Script Error] ${e.message}`);
    }

    return { env: envMap, globals: globalsMap, logs };
  }

  public static runTests(
    script: string,
    response: {
      code: number;
      responseTime: number;
      responseSize: number;
      rawText: string;
      data: any;
    },
    context: {
      env: Record<string, string>;
      globals: Record<string, string>;
    }
  ): { tests: TestResult[]; env: Record<string, string>; globals: Record<string, string>; logs: string[] } {
    const tests: TestResult[] = [];
    const logs: string[] = [];
    const envMap = { ...context.env };
    const globalsMap = { ...context.globals };

    const createExpect = (actual: any) => {
      const assertions: any = {
        to: {},
      };

      const wrapMatchers = (target: any, isNegated = false) => {
        target.equal = target.eql = (expected: any) => {
          const pass = isNegated ? actual != expected : actual == expected;
          if (!pass) throw new Error(`Assertion failed: expected ${actual} to ${isNegated ? 'not ' : ''}equal ${expected}`);
        };
        target.below = (expected: number) => {
          const pass = isNegated ? actual >= expected : actual < expected;
          if (!pass) throw new Error(`Assertion failed: expected ${actual} to ${isNegated ? 'not ' : ''}be below ${expected}`);
        };
        target.above = (expected: number) => {
          const pass = isNegated ? actual <= expected : actual > expected;
          if (!pass) throw new Error(`Assertion failed: expected ${actual} to ${isNegated ? 'not ' : ''}be above ${expected}`);
        };
        target.be = {
          below: target.below,
          above: target.above,
          a: (typeStr: string) => {
            const actualType = typeof actual;
            if (actualType !== typeStr) throw new Error(`Assertion failed: expected type ${actualType} to be ${typeStr}`);
          },
          true: () => {
            if (actual !== true) throw new Error(`Assertion failed: expected ${actual} to be true`);
          },
          false: () => {
            if (actual !== false) throw new Error(`Assertion failed: expected ${actual} to be false`);
          },
        };
        target.have = {
          property: (propName: string, expectedVal?: any) => {
            if (!actual || typeof actual !== 'object' || !(propName in actual)) {
              throw new Error(`Assertion failed: target does not have property ${propName}`);
            }
            if (expectedVal !== undefined && actual[propName] !== expectedVal) {
              throw new Error(`Assertion failed: property ${propName} expected ${expectedVal} but got ${actual[propName]}`);
            }
          },
          status: (expectedCode: number) => {
            if (response.code !== expectedCode) {
              throw new Error(`Assertion failed: expected status code ${expectedCode} but got ${response.code}`);
            }
          },
        };
      };

      wrapMatchers(assertions.to, false);
      assertions.to.not = {};
      wrapMatchers(assertions.to.not, true);
      return assertions;
    };

    const pmResponse = {
      code: response.code,
      status: response.code,
      responseTime: response.responseTime,
      responseSize: response.responseSize,
      text: () => response.rawText,
      json: () => response.data,
      to: {
        have: {
          status: (expectedCode: number) => {
            if (response.code !== expectedCode) {
              throw new Error(`Expected status ${expectedCode} but got ${response.code}`);
            }
          },
        },
      },
    };

    const sandbox = {
      console: {
        log: (...args: any[]) => logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),
        warn: (...args: any[]) => logs.push('[WARN] ' + args.map((a) => String(a)).join(' ')),
        error: (...args: any[]) => logs.push('[ERROR] ' + args.map((a) => String(a)).join(' ')),
      },
      pm: {
        response: pmResponse,
        test: (title: string, fn: () => void) => {
          try {
            fn();
            tests.push({ title, passed: true });
          } catch (e: any) {
            tests.push({ title, passed: false, message: e.message });
          }
        },
        expect: createExpect,
        environment: {
          set: (k: string, v: any) => { envMap[k] = String(v); },
          get: (k: string) => envMap[k],
        },
        globals: {
          set: (k: string, v: any) => { globalsMap[k] = String(v); },
          get: (k: string) => globalsMap[k],
        },
        variables: {
          set: (k: string, v: any) => { envMap[k] = String(v); },
          get: (k: string) => envMap[k] || globalsMap[k],
        },
      },
    };

    try {
      vm.createContext(sandbox);
      vm.runInContext(script, sandbox, { timeout: 3000 });
    } catch (e: any) {
      logs.push(`[Test Script Error] ${e.message}`);
    }

    return { tests, env: envMap, globals: globalsMap, logs };
  }
}
