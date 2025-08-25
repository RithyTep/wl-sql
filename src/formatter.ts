export class SQLFormatter {
  format(sql: string): string {
    let formatted = sql;

    // 1. First, make ALL SQL keywords uppercase
    formatted = this.formatAllKeywords(formatted);

    // 2. Format stored procedure parameters properly
    formatted = this.formatStoredProcedureParameters(formatted);

    // 3. Wrap ALL identifiers in square brackets (but avoid over-bracketing)
    formatted = this.formatAllIdentifiers(formatted);

    // 4. Format variables to camelCase
    formatted = this.formatVariables(formatted);

    // 5. Add WITH(NOLOCK) where missing (but avoid duplicates)
    formatted = this.addNoLock(formatted);

    // 6. Format decimal precision
    formatted = formatted.replace(/DECIMAL\s*\(\s*\d+\s*,\s*\d+\s*\)/gi, 'DECIMAL(19,6)');

    // 7. Handle stored procedures
    formatted = this.formatStoredProcedures(formatted);

    // 7.1 Normalize spacing (commas, operators, blank lines)
    formatted = this.normalizeSpacing(formatted);

    // 8. Clean up and indent with proper line breaks
    formatted = this.cleanupAndIndent(formatted);

    return formatted;
  }

  private formatAllKeywords(sql: string): string {
    // Comprehensive list of SQL keywords to uppercase
    const keywords = [
      // Core SQL keywords
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN',
      'RIGHT JOIN', 'FULL JOIN', 'OUTER JOIN', 'CROSS JOIN',
      'ORDER BY', 'GROUP BY', 'HAVING', 'UNION', 'UNION ALL',
      'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
      'CREATE', 'ALTER', 'DROP', 'TABLE', 'VIEW', 'INDEX',
      'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'CONSTRAINT',

      // Stored procedure keywords
      'PROCEDURE', 'FUNCTION', 'TRIGGER', 'DECLARE', 'BEGIN', 'END',
      'IF', 'ELSE', 'ELSEIF', 'WHILE', 'FOR', 'LOOP', 'BREAK', 'CONTINUE',
      'TRY', 'CATCH', 'THROW', 'RETURN', 'EXEC', 'EXECUTE',

      // Data types and modifiers
      'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT',
      'DECIMAL', 'NUMERIC', 'FLOAT', 'REAL', 'MONEY', 'SMALLMONEY',
      'BIT', 'CHAR', 'VARCHAR', 'NCHAR', 'NVARCHAR', 'TEXT', 'NTEXT',
      'DATETIME', 'DATETIME2', 'DATE', 'TIME', 'TIMESTAMP',
      'BINARY', 'VARBINARY', 'IMAGE', 'UNIQUEIDENTIFIER',
      'NOT NULL', 'NULL', 'DEFAULT', 'IDENTITY', 'AUTO_INCREMENT',

      // Logical operators and functions
      'AND', 'OR', 'NOT', 'IN', 'NOT IN', 'EXISTS', 'NOT EXISTS',
      'BETWEEN', 'LIKE', 'NOT LIKE', 'IS', 'IS NOT', 'IS NULL', 'IS NOT NULL',
      'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'CAST', 'CONVERT',

      // Aggregate and window functions
      'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'DISTINCT',
      'OVER', 'PARTITION BY', 'ROW_NUMBER', 'RANK', 'DENSE_RANK',

      // Other keywords
      'AS', 'ON', 'WITH', 'NOLOCK', 'ROWLOCK', 'OPTION', 'RECOMPILE',
      'TOP', 'PERCENT', 'OFFSET', 'FETCH', 'NEXT', 'ROWS', 'ONLY',
      'WAITFOR', 'DELAY', 'GO', 'DESC', 'ASC'
    ];

    // Sort by length (longest first) to avoid partial replacements
    keywords.sort((a, b) => b.length - a.length);

    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'gi');
      sql = sql.replace(regex, keyword.toUpperCase());
    });

    return sql;
  }

  private formatStoredProcedureParameters(sql: string): string {
    // Format procedure parameters so each parameter is on its own line and indented
    sql = sql.replace(/(CREATE\s+PROCEDURE\s+[^\r\n(]+)([\s\S]*?)\bAS\b/gi, (match, header, params) => {
      const paramsRaw = params.trim();
      // If no parameters detected, return header + AS
      if (!paramsRaw) return `${header}\nAS`;

      // Normalize newlines and split by top-level commas
      const flattened = paramsRaw.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
      const parts = flattened.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0);

      // Build parameter block with trailing commas except last
      const formattedParams = parts.map((p: string, i: number) => {
        const suffix = i < parts.length - 1 ? ',' : '';
        return '\t' + p + suffix;
      }).join('\n');

      return `${header}\n${formattedParams}\nAS`;
    });

    return sql;
  }

  private formatAllIdentifiers(sql: string): string {
    // First, normalize nested brackets like '[[[name]]]' -> '[name]'
    sql = sql.replace(/\[+\s*([^\[\]]+?)\s*\]+/g, '[$1]');

    // Remove brackets around variables: '@[name]' -> '@name'
    sql = sql.replace(/@\[([^\]]+)\]/g, '@$1');

    // Fix broken identifiers like [dbo].[[table]] -> [dbo].[table]
    sql = sql.replace(/\]\.\[\[/g, '].[');
    sql = sql.replace(/\[\[([^\]]+)\]\]/g, '[$1]');

    // Only wrap identifiers that are not already bracketed and not parameters/keywords/aliases
    sql = sql.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\b/g, (match, identifier, offset, full) => {
      // If the token is immediately preceded by '@' it's a variable - don't bracket
      if (offset > 0 && full[offset - 1] === '@') return match;

      // If the token is already bracketed, skip
      const before = offset > 0 ? full[offset - 1] : '';
      const after = full[offset + match.length] || '';
      if (before === '[') return match;

      // Skip if it's a keyword
      if (this.isKeyword(identifier)) return match;

      // Skip numbers
      if (/^\d/.test(identifier)) return match;

      // Skip single letter identifiers that are likely table aliases
      if (identifier.length === 1) return match;

      // Skip common SQL functions that shouldn't be bracketed
      const skipFunctions = [
        'GETDATE', 'DATEADD', 'DATEDIFF', 'CAST', 'CONVERT', 'ISNULL',
        'COALESCE', 'SUBSTRING', 'LEN', 'LTRIM', 'RTRIM', 'UPPER', 'LOWER',
        'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROW_NUMBER', 'RANK'
      ];
      if (skipFunctions.includes(identifier.toUpperCase())) return match;

      // Check if this appears to be a table alias (appears after a bracketed table name)
      const beforeContext = full.substring(Math.max(0, offset - 50), offset);
      if (beforeContext.match(/\]\s+WITH\s*\(\s*NOLOCK\s*\)\s*$/i)) {
        return match; // This is likely a table alias after WITH(NOLOCK)
      }

      // Handle dotted identifiers like schema.table
      if (identifier.includes('.')) {
        return identifier.split('.').map((part: string) => `[${part}]`).join('.');
      }

      return `[${identifier}]`;
    });

    return sql;
  }

  private formatVariables(sql: string): string {
    // Convert variables to camelCase
    return sql.replace(/@([A-Z][a-zA-Z0-9_]*)/g, (match, varName) => {
      const camelCase = varName.charAt(0).toLowerCase() + varName.slice(1);
      return '@' + camelCase;
    });
  }

  private formatStoredProcedures(sql: string): string {
    // Ensure procedure has a BEGIN after AS (idempotent)
    sql = sql.replace(/(\bCREATE\s+PROCEDURE[\s\S]*?\bAS\b)\s*(?!BEGIN\b)/gi, '$1\nBEGIN\n');

    // Ensure a single SET NOCOUNT ON; immediately after BEGIN inside the procedure
    // Only add if not present to remain idempotent
    sql = sql.replace(/(\bCREATE\s+PROCEDURE[\s\S]*?\bAS\b\s*BEGIN\s*)(?!SET\s+NOCOUNT\s+ON\b)/gi, '$1\tSET NOCOUNT ON;\n');

    return sql;
  }

  private normalizeSpacing(sql: string): string {
    // Ensure comma followed by single space
    sql = sql.replace(/,\s*/g, ', ');

    // Ensure operators have spaces: =, <, >, <=, >=, <>, !=
    sql = sql.replace(/\s*(=|<>|!=|<=|>=|<|>)\s*/g, ' $1 ');

    // Fix broken AS keyword combinations like "ASBEGIN" -> "AS\nBEGIN"
    sql = sql.replace(/\bAS([A-Z])/g, 'AS\n$1');

    // Collapse multiple spaces into one (but keep newlines)
    sql = sql.replace(/ {2,}/g, ' ');

    // Trim trailing spaces on each line
    sql = sql.split('\n').map(l => l.replace(/\s+$/g, '')).join('\n');

    return sql;
  }

  private addNoLock(sql: string): string {
    // Add WITH(NOLOCK) to table references that don't have it
    // But avoid duplicating existing WITH(NOLOCK) hints

    // First, clean up malformed WITH(NOLOCK) patterns
    sql = sql.replace(/WITH\(NOLOCK\)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+WITH\s*\(\s*NOLOCK\s*\)/gi, '$1 WITH(NOLOCK)');

    // Fix patterns like "[table] WITH(NOLOCK) [alias] WITH (NOLOCK)"
    sql = sql.replace(/(\[[^\]]+\])\s+WITH\(NOLOCK\)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+WITH\s*\(\s*NOLOCK\s*\)/gi, '$1 $2 WITH(NOLOCK)');

    // Add WITH(NOLOCK) to table references that don't already have it
    sql = sql.replace(/\b(FROM|JOIN)\s+((?:\[[^\]]+\]|[A-Za-z0-9_]+)(?:\s*\.\s*(?:\[[^\]]+\]|[A-Za-z0-9_]+))*)(?:\s+([a-zA-Z_][a-zA-Z0-9_]*))?\s*(?!WITH)/gi,
      (match, op, tableRef, alias) => {
        const aliasStr = alias ? ` ${alias}` : '';
        return `${op} ${tableRef}${aliasStr} WITH(NOLOCK)`;
      }
    );

    return sql;
  }

  private cleanupAndIndent(sql: string): string {
    // Split into lines and clean up
    const lines = sql.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let indentLevel = 0;
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const upperLine = line.toUpperCase();

      // Decrease indent before these keywords
      if (upperLine.match(/^(END|}\s*$|\))/)) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // Add proper indentation
      let indentedLine = '\t'.repeat(indentLevel) + line;

      // Special formatting for different types of statements
      if (upperLine.startsWith('CREATE PROCEDURE')) {
        result.push(indentedLine);
      } else if (upperLine.startsWith('SELECT')) {
        result.push(indentedLine);
      } else if (upperLine.startsWith('FROM') || upperLine.includes('JOIN')) {
        result.push(indentedLine);
      } else if (upperLine.startsWith('WHERE') || upperLine.startsWith('AND ') || upperLine.startsWith('OR ')) {
        result.push(indentedLine);
      } else if (upperLine.startsWith('ORDER BY') || upperLine.startsWith('GROUP BY')) {
        result.push(indentedLine);
      } else {
        result.push(indentedLine);
      }

      // Increase indent after these keywords
      if (upperLine.match(/^(BEGIN|CREATE\s+PROCEDURE|IF|ELSE|WHILE|TRY|CATCH|\()/)) {
        indentLevel++;
      }
    }

    return result.join('\n');
  }

  private isKeyword(word: string): boolean {
    const keywords = [
      // SQL Keywords that should NOT be bracketed
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS',
      'ORDER', 'GROUP', 'BY', 'HAVING', 'AS', 'ON', 'AND', 'OR', 'NOT',
      'NULL', 'IS', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'CREATE', 'ALTER',
      'DROP', 'INSERT', 'UPDATE', 'DELETE', 'DECLARE', 'SET', 'BEGIN', 'END',
      'IF', 'ELSE', 'WHILE', 'FOR', 'BREAK', 'CONTINUE', 'RETURN', 'EXEC', 'EXECUTE',
      'PROCEDURE', 'FUNCTION', 'TRIGGER', 'TABLE', 'VIEW', 'INDEX',
      'PRIMARY', 'FOREIGN', 'KEY', 'REFERENCES', 'CONSTRAINT', 'IDENTITY',
      'DEFAULT', 'CHECK', 'UNIQUE', 'CLUSTERED', 'NONCLUSTERED',

      // Data types
      'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'BIT',
      'DECIMAL', 'NUMERIC', 'FLOAT', 'REAL', 'MONEY', 'SMALLMONEY',
      'CHAR', 'VARCHAR', 'NCHAR', 'NVARCHAR', 'TEXT', 'NTEXT',
      'DATETIME', 'DATETIME2', 'DATE', 'TIME', 'TIMESTAMP',
      'BINARY', 'VARBINARY', 'IMAGE', 'UNIQUEIDENTIFIER',

      // Functions and operators
      'CASE', 'WHEN', 'THEN', 'ELSE', 'CAST', 'CONVERT', 'ISNULL', 'COALESCE',
      'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'DISTINCT', 'TOP', 'PERCENT',
      'UNION', 'ALL', 'INTERSECT', 'EXCEPT', 'OVER', 'PARTITION',
      'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE',
      'WITH', 'NOLOCK', 'ROWLOCK', 'UPDLOCK', 'HOLDLOCK', 'OPTION', 'RECOMPILE',
      'WAITFOR', 'DELAY', 'GO', 'TRY', 'CATCH', 'THROW', 'RAISERROR',

      // Common system functions
      'GETDATE', 'DATEADD', 'DATEDIFF', 'DATENAME', 'DATEPART',
      'SUBSTRING', 'LEN', 'LTRIM', 'RTRIM', 'UPPER', 'LOWER', 'REPLACE',
      'ABS', 'CEILING', 'FLOOR', 'ROUND', 'POWER', 'SQRT', 'RAND',
      'NEWID', 'NEWSEQUENTIALID', 'SCOPE_IDENTITY', 'IDENT_CURRENT',

      // Transaction keywords
      'TRANSACTION', 'BEGIN_TRANSACTION', 'COMMIT', 'ROLLBACK', 'SAVE',
      'ISOLATION', 'LEVEL', 'READ', 'COMMITTED', 'UNCOMMITTED', 'REPEATABLE', 'SERIALIZABLE',

      // Other keywords
      'FETCH', 'NEXT', 'PRIOR', 'FIRST', 'LAST', 'ABSOLUTE', 'RELATIVE',
      'OFFSET', 'ROWS', 'ONLY', 'COLLATE', 'WITHIN', 'CONTAINS', 'FREETEXT', 'DESC', 'ASC'
    ];
    return keywords.includes(word.toUpperCase());
  }
}
