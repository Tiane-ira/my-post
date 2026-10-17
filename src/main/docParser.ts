import YAML from 'yaml';
import SwaggerParser from '@apidevtools/swagger-parser';
import { DataImporters, ParsedApiDocResult } from '../common/importers';

export class MainDocParser {
  /**
   * Parse Swagger 2.0 or OpenAPI 3.x document in the Node.js Main process
   * Dereferences all external and internal $ref schemas using @apidevtools/swagger-parser
   */
  public static async parse(content: string): Promise<ParsedApiDocResult> {
    const cleanContent = (content || '').trim().replace(/^\uFEFF/, '');
    let parsed: any;
    try {
      parsed = YAML.parse(cleanContent);
    } catch {
      try {
        parsed = JSON.parse(cleanContent);
      } catch (err: any) {
        throw new Error(`无法解析文档内容为 JSON 或 YAML: ${err.message || err}`);
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('无效的接口文档内容');
    }

    let dereferenced: any = parsed;
    try {
      // Use mature open-source @apidevtools/swagger-parser in Node.js environment
      dereferenced = await SwaggerParser.dereference(parsed, {
        continueOnError: true,
        dereference: {
          circular: 'ignore',
        },
      });
    } catch (derefErr) {
      console.warn('[MainDocParser] SwaggerParser.dereference notice:', derefErr);
      dereferenced = parsed;
    }

    return DataImporters.parseApiDocFromObject(dereferenced);
  }
}
