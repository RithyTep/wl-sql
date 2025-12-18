import * as vscode from 'vscode';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sqlFormatter = require('poor-mans-t-sql-formatter');

interface FormatterOptions {
  indent: string;
  spacesPerTab: number;
  maxLineWidth: number;
  statementBreaks: number;
  clauseBreaks: number;
  expandCommaLists: boolean;
  trailingCommas: boolean;
  uppercaseKeywords: boolean;
  expandBooleanExpressions: boolean;
  expandCaseStatements: boolean;
  breakJoinOnSections: boolean;
}

interface SqlFormatterResult {
  errorFound: boolean;
  text: string;
}

export class SQLFormatter {
  private config: vscode.WorkspaceConfiguration;

  constructor() {
    this.config = vscode.workspace.getConfiguration('wl-sql');
  }

  refreshConfig(): void {
    this.config = vscode.workspace.getConfiguration('wl-sql');
  }

  private getFormatterOptions(): FormatterOptions {
    const editorConfig = vscode.workspace.getConfiguration('editor');
    const tabSize = editorConfig.get<number>('tabSize') || 4;
    const insertSpaces = editorConfig.get<boolean>('insertSpaces') !== false;

    return {
      indent: insertSpaces ? ' '.repeat(tabSize) : '\t',
      spacesPerTab: tabSize,
      maxLineWidth: this.config.get<number>('maxLineWidth') || 120,
      statementBreaks: 2,
      clauseBreaks: 1,
      expandCommaLists: this.config.get<boolean>('expandCommaLists') !== false,
      trailingCommas: this.config.get<boolean>('trailingCommas') !== false,
      uppercaseKeywords: true,
      expandBooleanExpressions: this.config.get<boolean>('expandBooleanExpressions') !== false,
      expandCaseStatements: this.config.get<boolean>('expandCaseStatements') !== false,
      breakJoinOnSections: this.config.get<boolean>('breakJoinOnSections') !== false,
    };
  }

  format(input: string): string {
    const sql = input || '';

    // Check if we should use base formatter
    const useBaseFormatter = this.config.get<boolean>('useBaseFormatter') !== false;

    let formatted: string;
    if (useBaseFormatter) {
      // Step 1: Use poor-mans-t-sql-formatter for base formatting
      formatted = this.baseFormat(sql);
    } else {
      formatted = sql;
    }

    // Step 2: Apply WL conventions on top
    formatted = this.preserveSegments(formatted, (code: string) => {
      let s = code;
      s = this.collapseExistingNoLock(s);
      s = this.uppercaseKeywords(s);
      s = this.formatStoredProcedureParameters(s);
      s = this.stripExistingBrackets(s);
      s = this.bracketIdentifiers(s);
      s = this.addNoLock(s);
      if (!useBaseFormatter) {
        s = this.normalizeClauses(s);
        s = this.cleanupIndentSimple(s);
      }
      s = this.normalizeSpacing(s);
      s = this.normalizeIdempotency(s);
      return s;
    });

    // Final cleanup
    let finalOut = formatted.replace(/[ \t]+$/gm, '').trim();
    finalOut = finalOut.replace(/\*\/(?=\s*(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|--))/gi, '*/\n');
    finalOut = finalOut.replace(/([^ \t])(--)/g, '$1 $2');

    return finalOut;
  }

  private baseFormat(sql: string): string {
    try {
      const options = this.getFormatterOptions();
      const result = sqlFormatter.formatSql(sql, options) as SqlFormatterResult;
      return result.text || sql;
    } catch {
      // If base formatter fails, return original
      return sql;
    }
  }

  private preserveSegments(sql: string, transformCode: (c: string) => string): string {
    const parts: string[] = [];
    let i = 0;
    const len = sql.length;
    while (i < len) {
      const ch = sql[i];
      if (ch === "'") {
        let j = i + 1;
        let buf = "'";
        while (j < len) {
          if (sql[j] === "'") {
            buf += "'";
            j++;
            if (sql[j] === "'") { buf += "'"; j++; continue; }
            break;
          }
          buf += sql[j++];
        }
        parts.push(buf);
        i = j;
        continue;
      }

      if (ch === '-' && sql[i + 1] === '-') {
        const j = sql.indexOf('\n', i + 2);
        if (j === -1) { parts.push(sql.slice(i)); break; }
        parts.push(sql.slice(i, j));
        i = j;
        continue;
      }

      if (ch === '/' && sql[i + 1] === '*') {
        const j = sql.indexOf('*/', i + 2);
        if (j === -1) { parts.push(sql.slice(i)); break; }
        parts.push(sql.slice(i, j + 2));
        i = j + 2;
        continue;
      }

      let j = i;
      while (j < len && sql[j] !== "'" && !(sql[j] === '-' && sql[j + 1] === '-') && !(sql[j] === '/' && sql[j + 1] === '*')) j++;
      const code = sql.slice(i, j);
      parts.push(transformCode(code));
      i = j;
    }
    return parts.join('');
  }

  private uppercaseKeywords(sql: string): string {
    const kws = [
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
      'FULL JOIN', 'CROSS JOIN', 'OUTER JOIN', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN',
      'ORDER BY', 'GROUP BY', 'HAVING', 'UNION', 'UNION ALL', 'EXCEPT', 'INTERSECT',
      'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'TRUNCATE',
      'CREATE', 'ALTER', 'DROP', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'VIEW', 'TABLE', 'INDEX',
      'AS', 'ON', 'WITH', 'NOLOCK', 'READUNCOMMITTED', 'HOLDLOCK', 'UPDLOCK', 'ROWLOCK',
      'TOP', 'DISTINCT', 'ALL', 'PERCENT',
      'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
      'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'BETWEEN', 'EXISTS',
      'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION', 'TRAN',
      'DECLARE', 'EXEC', 'EXECUTE', 'RETURN', 'RETURNS',
      'IF', 'WHILE', 'BREAK', 'CONTINUE', 'GOTO', 'TRY', 'CATCH', 'THROW',
      'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'OVER', 'PARTITION BY',
      'CAST', 'CONVERT', 'COALESCE', 'ISNULL', 'NULLIF', 'IIF',
      'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'BIT', 'DECIMAL', 'NUMERIC', 'FLOAT', 'REAL', 'MONEY',
      'NVARCHAR', 'VARCHAR', 'NCHAR', 'CHAR', 'TEXT', 'NTEXT',
      'DATETIME', 'DATETIME2', 'DATE', 'TIME', 'DATETIMEOFFSET', 'SMALLDATETIME',
      'UNIQUEIDENTIFIER', 'VARBINARY', 'BINARY', 'IMAGE', 'XML',
      'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'CONSTRAINT', 'DEFAULT', 'IDENTITY',
      'ASC', 'DESC', 'OFFSET', 'FETCH', 'NEXT', 'ROWS', 'ONLY',
      'OUTPUT', 'INSERTED', 'DELETED', 'MERGE', 'MATCHED', 'TARGET', 'SOURCE',
      'CURSOR', 'OPEN', 'CLOSE', 'DEALLOCATE', 'SCROLL',
      'WAITFOR', 'DELAY', 'RAISERROR', 'PRINT',
      'NOCOUNT', 'XACT_ABORT', 'ANSI_NULLS', 'QUOTED_IDENTIFIER'
    ];
    kws.sort((a, b) => b.length - a.length);
    let out = sql;
    for (const k of kws) {
      const pat = new RegExp('\\b' + k.replace(/\s+/g, '\\s+') + '\\b', 'gi');
      out = out.replace(pat, k);
    }
    return out;
  }

  private formatStoredProcedureParameters(sql: string): string {
    return sql.replace(/CREATE\s+PROCEDURE\s+([^\r\n(]+)([\s\S]*?)\bAS\b/gi, (_m, name: string, params: string) => {
      const proc = (name || '').trim();
      let schema = 'dbo';
      let procName = proc;

      if (proc.includes('.')) {
        const p = proc.split('.').map((s: string) => s.trim());
        schema = p[0].replace(/\[|\]/g, '');
        procName = p[1].replace(/\[|\]/g, '');
      } else {
        procName = procName.replace(/\[|\]/g, '');
      }

      const schemaPart = `[${schema}].`;
      const procPartName = /[A-Z]/.test(procName.slice(1)) ? procName : this.toPascal(procName);
      const procPart = `[${procPartName}]`;

      const ptext = (params || '').trim();
      if (!ptext) return `CREATE PROCEDURE ${schemaPart}${procPart}\nAS`;

      const flat = ptext.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
      const parts = flat.split(',').map((p: string) => p.trim()).filter(Boolean);

      const formatted = parts.map((p: string, i: number) => {
        const m = p.match(/^(@?[a-zA-Z0-9_]+)\s+([a-zA-Z0-9()]+)(\s*=\s*(.*))?$/i);
        if (m) {
          let paramName = m[1];
          // Ensure parameter starts with @ and is camelCase
          if (!paramName.startsWith('@')) {
            paramName = '@' + paramName;
          }
          paramName = '@' + this.toCamelCase(paramName.slice(1));

          const type = m[2].toUpperCase();
          const def = m[4] ? ' = ' + m[4].trim() : '';
          return '    ' + `${paramName} ${type}${def}` + (i < parts.length - 1 ? ',' : '');
        }
        return '    ' + p.replace(/\s*=\s*/, ' = ') + (i < parts.length - 1 ? ',' : '');
      }).join('\n');

      return `CREATE PROCEDURE ${schemaPart}${procPart}\n${formatted}\nAS`;
    });
  }

  private bracketIdentifiers(sql: string): string {
    return sql.replace(/(?<!@)\b([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\b(?!\s*\()/g, (m: string) => {
      if (m.startsWith('@')) return m;
      if (this.isKeyword(m)) return m;
      if (/^\d/.test(m)) return m;
      if (/^\(/.test(m)) return m;

      const raw = m.replace(/\[|\]/g, '');
      if (raw.includes('.')) {
        const parts = raw.split('.');
        const first = parts[0];
        const rest = parts.slice(1).map(p => `[${this.toPascal(p)}]`).join('.');
        // Keep schema aliases (single lowercase letters or short names like 'dbo')
        if ((/^[a-z][a-z0-9_]*$/.test(first) && first.length <= 3) || first.toLowerCase() === 'dbo') {
          return `[${first}].${rest}`;
        }
        return parts.map(p => `[${this.toPascal(p)}]`).join('.');
      }
      // Keep single-letter aliases
      if (raw.length === 1 && /^[a-z]$/i.test(raw)) return raw;
      return `[${this.toPascal(raw)}]`;
    });
  }

  private stripExistingBrackets(sql: string): string {
    return sql.replace(/\[+\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\]+/g, '$1');
  }

  private normalizeIdempotency(sql: string): string {
    let s = sql;
    s = s.replace(/(?:WITH\s*\(\s*NOLOCK\s*\)\s*){2,}/gi, 'WITH(NOLOCK)');
    s = s.replace(/\bWITH\s+WITH\s*\(\s*NOLOCK\s*\)/gi, 'WITH(NOLOCK)');
    s = s.replace(/\(NOLOCK\)(?:\s*\(NOLOCK\))+/gi, '(NOLOCK)');
    s = s.replace(/\[{2,}/g, '[').replace(/\]{2,}/g, ']');
    s = s.replace(/\[\s*\[+/g, '[').replace(/\]+\s*\]/g, ']');
    return s;
  }

  private collapseExistingNoLock(sql: string): string {
    let s = sql;
    s = s.replace(/WITH\s*\(\s*NOLOCK\s*\)(?:\s*WITH\s*\(\s*NOLOCK\s*\))*/gi, 'WITH(NOLOCK)');
    s = s.replace(/\bWITH\s+WITH\s*\(\s*NOLOCK\s*\)/gi, 'WITH(NOLOCK)');
    return s;
  }

  private addNoLock(sql: string): string {
    if (!this.config.get<boolean>('addNoLock', true)) {
      return sql;
    }

    return sql.replace(/\b(FROM|INNER JOIN|JOIN|LEFT JOIN|RIGHT JOIN|FULL JOIN|CROSS JOIN|LEFT OUTER JOIN|RIGHT OUTER JOIN)\s+([^\s(]+)(?:\s+([a-zA-Z0-9_]+))?/gi, (m: string, op: string, tblRaw: string, alias: string) => {
      if (/WITH\s*\(\s*NOLOCK\s*\)/i.test(m)) return m;
      if (/^\(/.test(tblRaw)) return m;
      // Skip if it's a variable
      if (tblRaw.startsWith('@')) return m;

      const tbl = tblRaw.replace(/\[|\]/g, '');
      const parts = tbl.split('.');
      let mapped: string;

      if (parts.length === 1) {
        mapped = `[dbo].[${this.toPascal(parts[0])}]`;
      } else {
        mapped = parts.map((p, i) => i === 0 ? `[${p}]` : `[${this.toPascal(p)}]`).join('.');
      }

      const aliasPart = alias ? ' ' + alias.replace(/WITH\s*\(\s*NOLOCK\s*\)/i, '').trim() : '';
      return `${op} ${mapped}${aliasPart} WITH(NOLOCK)`;
    });
  }

  private normalizeClauses(sql: string): string {
    let s = sql;
    s = s.replace(/\s+(INNER JOIN|LEFT JOIN|RIGHT JOIN|FULL JOIN|CROSS JOIN|LEFT OUTER JOIN|RIGHT OUTER JOIN|JOIN)\s+/gi, '\n$1 ');
    s = s.replace(/\s+FROM\s+/gi, '\nFROM ');
    s = s.replace(/\s+WHERE\s+/gi, '\nWHERE ');
    s = s.replace(/\s+GROUP\s+BY\s+/gi, '\nGROUP BY ');
    s = s.replace(/\s+ORDER\s+BY\s+/gi, '\nORDER BY ');
    s = s.replace(/\s+UNION\s+/gi, '\nUNION\n');
    s = s.replace(/\s+VALUES\s+/gi, '\nVALUES ');
    s = s.replace(/\s+ON\s+/gi, '\n    ON ');
    s = s.replace(/\s+HAVING\s+/gi, '\nHAVING ');
    return s;
  }

  private normalizeSpacing(sql: string): string {
    const lines = sql.split('\n');
    const out: string[] = [];
    for (const line of lines) {
      const m = line.match(/^(\s*)([\s\S]*)$/);
      const indent = m ? m[1] : '';
      let body = m ? m[2] : line;
      body = body.replace(/,\s*/g, ', ');
      body = body.replace(/\s*(=|<>|!=|<=|>=|<|>)\s*/g, ' $1 ');
      body = body.replace(/[ \t]{2,}/g, ' ');
      out.push(indent + body);
    }
    return out.join('\n');
  }

  private cleanupIndentSimple(sql: string): string {
    const lines: string[] = [];
    const rawLines = sql.split('\n');
    for (const ln of rawLines) {
      if (!ln.trim()) continue;
      if (/^\s{4,}/.test(ln)) { lines.push(ln.replace(/\s+$/, '')); continue; }
      const t = ln.trim();
      const up = t.toUpperCase();
      if (up.startsWith('SELECT')) {
        const rest = t.slice(6).trim();
        let selectLine = 'SELECT';
        let cols = rest;
        const mod = cols.match(/^(DISTINCT\s+TOP\s+\d+|DISTINCT|TOP\s+\d+)/i);
        if (mod) { selectLine = 'SELECT ' + mod[0].toUpperCase(); cols = cols.slice(mod[0].length).trim(); }
        lines.push(selectLine);
        if (cols) {
          if (/\(\s*SELECT\b/i.test(cols)) {
            lines.push('    ' + cols);
          } else {
            const parts = cols.split(',').map((s: string) => s.trim()).filter(Boolean);
            if (parts.length <= 2) {
              lines.push('    ' + parts.join(', '));
            } else {
              for (let i = 0; i < parts.length; i++) {
                const suffix = i < parts.length - 1 ? ',' : '';
                lines.push('    ' + parts[i] + suffix);
              }
            }
          }
        }
        continue;
      }

      if (/^(FROM|INNER JOIN|LEFT JOIN|RIGHT JOIN|FULL JOIN|CROSS JOIN|LEFT OUTER JOIN|RIGHT OUTER JOIN|JOIN)/i.test(t)) {
        lines.push(t);
        continue;
      }

      if (/^WHERE\b/i.test(t)) {
        const rest = t.replace(/^WHERE\s+/i, '');
        const parts = rest.split(/\s+(AND|OR)\s+/i).filter(Boolean);
        const cur = 'WHERE ' + parts[0].trim();
        lines.push(cur);
        for (let i = 1; i < parts.length; i += 2) {
          const op = parts[i].toUpperCase();
          const cond = parts[i + 1] ? parts[i + 1].trim() : '';
          lines.push('    ' + op + ' ' + cond);
        }
        continue;
      }
      if (/^ON\b/i.test(t)) { lines.push('    ' + t); continue; }
      if (/^(AND |OR )/i.test(t)) { lines.push('    ' + t); continue; }

      if (/^SET\b/i.test(t)) {
        const rhs = t.slice(3).trim();
        const parts = rhs.split(',').map(p => p.trim()).filter(Boolean);
        lines.push('SET ' + (parts.length ? parts[0] : ''));
        for (let i = 1; i < parts.length; i++) lines.push('    ' + parts[i].replace(/\s*=\s*/, ' = '));
        continue;
      }

      if (/^VALUES\b/i.test(t)) { lines.push(t); continue; }
      lines.push(t);
    }
    return lines.join('\n');
  }

  private toPascal(s: string): string {
    if (!s) return s;
    if (s.toLowerCase() === 'dbo') return 'dbo';
    // If already has uppercase letters, keep as-is
    if (/[A-Z]/.test(s)) return s;
    const cleaned = s.replace(/[^a-zA-Z0-9]+/g, ' ');
    return cleaned.split(/\s+/).map(p => p.length ? p[0].toUpperCase() + p.slice(1).toLowerCase() : '').join('');
  }

  private toCamelCase(s: string): string {
    if (!s) return s;
    // If already starts with lowercase, keep as-is
    if (/^[a-z]/.test(s)) return s;
    return s.charAt(0).toLowerCase() + s.slice(1);
  }

  private isKeyword(w: string): boolean {
    if (!w) return false;
    const k = [
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'OUTER',
      'ORDER', 'GROUP', 'BY', 'HAVING', 'AS', 'ON', 'WITH', 'NOLOCK',
      'INSERT', 'UPDATE', 'DELETE', 'VALUES', 'INTO', 'PROCEDURE', 'CREATE', 'ALTER', 'DROP',
      'SET', 'TOP', 'DISTINCT', 'UNION', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
      'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'BETWEEN', 'EXISTS',
      'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
      'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'BIT', 'DECIMAL', 'NUMERIC', 'FLOAT', 'REAL', 'MONEY',
      'NVARCHAR', 'VARCHAR', 'NCHAR', 'CHAR', 'TEXT', 'NTEXT',
      'DATETIME', 'DATETIME2', 'DATE', 'TIME', 'UNIQUEIDENTIFIER',
      'DESC', 'ASC', 'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION',
      'DECLARE', 'EXEC', 'EXECUTE', 'RETURN', 'RETURNS',
      'IF', 'WHILE', 'BREAK', 'CONTINUE', 'GOTO', 'TRY', 'CATCH', 'THROW',
      'OUTPUT', 'INSERTED', 'DELETED', 'MERGE'
    ];
    return k.includes(w.toUpperCase());
  }
}
