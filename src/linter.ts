import * as vscode from 'vscode';

export class SQLLinter {
  lint(document: vscode.TextDocument): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    // Check for SP naming and versioning across the full document
    this.checkStoredProcedureNaming(text, lines, diagnostics);

    lines.forEach((line: string, lineIndex: number) => {
      // Validate line index is within document bounds
      if (lineIndex >= document.lineCount) {
        return;
      }

      try {
        // Check for SELECT *
        if (/SELECT\s+\*/i.test(line)) {
          const match = line.match(/SELECT\s+\*/i);
          if (match && match.index !== undefined) {
            const startPos = Math.max(0, match.index);
            const endPos = Math.min(line.length, startPos + match[0].length);

            const range = new vscode.Range(
              lineIndex, startPos,
              lineIndex, endPos
            );
            diagnostics.push(new vscode.Diagnostic(
              range,
              'Avoid SELECT *. Use explicit column names.',
              vscode.DiagnosticSeverity.Warning
            ));
          }
        }

        // Check for missing WITH(NOLOCK)
        this.checkNoLockHints(line, lineIndex, diagnostics);

        // Check variable naming (should be camelCase)
        const varRegex = /@([A-Z][a-zA-Z0-9_]*)/g;
        let match;
        while ((match = varRegex.exec(line)) !== null) {
          if (match.index !== undefined) {
            const startPos = Math.max(0, match.index);
            const endPos = Math.min(line.length, startPos + match[0].length);

            const range = new vscode.Range(
              lineIndex, startPos,
              lineIndex, endPos
            );
            diagnostics.push(new vscode.Diagnostic(
              range,
              `Variable should be in camelCase: @${match[1].charAt(0).toLowerCase() + match[1].slice(1)}`,
              vscode.DiagnosticSeverity.Information
            ));
          }
        }

        // Check DECIMAL precision
        const decimalRegex = /DECIMAL\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi;
        while ((match = decimalRegex.exec(line)) !== null) {
          if ((match[1] !== '19' || match[2] !== '6') && match.index !== undefined) {
            const startPos = Math.max(0, match.index);
            const endPos = Math.min(line.length, startPos + match[0].length);

            const range = new vscode.Range(
              lineIndex, startPos,
              lineIndex, endPos
            );
            diagnostics.push(new vscode.Diagnostic(
              range,
              'Use DECIMAL(19,6) for amount fields.',
              vscode.DiagnosticSeverity.Information
            ));
          }
        }

        // Check for missing schema prefix
        this.checkSchemaPrefix(line, lineIndex, diagnostics);

        // Check NVARCHAR minimum length
        this.checkNvarcharLength(line, lineIndex, diagnostics);

      } catch (error) {
        // Silently skip lines that cause errors to prevent extension crashes
        console.warn(`WL SQL: Error processing line ${lineIndex}:`, error);
      }
    });

    return diagnostics;
  }

  /**
   * Check stored procedure naming follows convention: [dbo].[ProjectName_FeatureName_Version]
   * Version format: Major.Minor.Patch (e.g., 1.0.0, 2.1.3)
   */
  private checkStoredProcedureNaming(
    text: string,
    lines: string[],
    diagnostics: vscode.Diagnostic[]
  ): void {
    // Match CREATE PROCEDURE statements
    const spRegex = /CREATE\s+PROCEDURE\s+(\[?[a-zA-Z0-9_]+\]?\.)?\[?([a-zA-Z0-9_.]+)\]?/gi;
    let match;

    while ((match = spRegex.exec(text)) !== null) {
      const fullMatch = match[0];
      const procName = match[2];

      // Find the line number where this match occurs
      const matchIndex = match.index;
      let charCount = 0;
      let lineIndex = 0;

      for (let i = 0; i < lines.length; i++) {
        const lineLength = lines[i].length + 1; // +1 for newline
        if (charCount + lineLength > matchIndex) {
          lineIndex = i;
          break;
        }
        charCount += lineLength;
      }

      const lineStartPos = matchIndex - charCount;
      const startPos = Math.max(0, lineStartPos);
      const endPos = Math.min(lines[lineIndex]?.length || 0, startPos + fullMatch.length);

      // Check naming convention: ProjectName_FeatureName_Version
      const nameParts = procName.split('_');

      if (nameParts.length < 2) {
        const range = new vscode.Range(lineIndex, startPos, lineIndex, endPos);
        diagnostics.push(new vscode.Diagnostic(
          range,
          'SP naming should follow: [dbo].[ProjectName_FeatureName_Version] (e.g., Coloris_GetMember_1.0.0)',
          vscode.DiagnosticSeverity.Warning
        ));
        continue;
      }

      // Check if last part is a valid version
      const lastPart = nameParts[nameParts.length - 1];
      const versionRegex = /^\d+\.\d+\.\d+$/;

      if (!versionRegex.test(lastPart)) {
        const range = new vscode.Range(lineIndex, startPos, lineIndex, endPos);
        diagnostics.push(new vscode.Diagnostic(
          range,
          `SP should include version suffix (Major.Minor.Patch). Suggested: "${procName}_1.0.0"`,
          vscode.DiagnosticSeverity.Warning
        ));
      }
    }
  }

  /**
   * Check for missing WITH(NOLOCK) hints on table references
   */
  private checkNoLockHints(
    line: string,
    lineIndex: number,
    diagnostics: vscode.Diagnostic[]
  ): void {
    // Match FROM/JOIN table references
    const tableRegex = /\b(FROM|JOIN)\s+(\[?[a-zA-Z_][a-zA-Z0-9_]*\]?(?:\.\[?[a-zA-Z_][a-zA-Z0-9_]*\]?)*)(?:\s+([a-zA-Z][a-zA-Z0-9_]*))?/gi;
    let match;

    while ((match = tableRegex.exec(line)) !== null) {
      // Check if WITH(NOLOCK) follows this table reference
      const afterMatch = line.slice(match.index + match[0].length);
      if (/^\s*WITH\s*\(\s*NOLOCK\s*\)/i.test(afterMatch)) {
        continue;
      }

      // Skip if it's a subquery or variable
      const tableName = match[2];
      if (tableName.startsWith('@') || tableName.startsWith('(')) {
        continue;
      }

      // Skip INSERT INTO, UPDATE statements (they shouldn't have NOLOCK)
      const beforeMatch = line.slice(0, match.index);
      if (/\b(INSERT\s+INTO|UPDATE)\s*$/i.test(beforeMatch)) {
        continue;
      }

      if (match.index !== undefined) {
        const startPos = Math.max(0, match.index);
        const endPos = Math.min(line.length, startPos + match[0].length);

        const range = new vscode.Range(
          lineIndex, startPos,
          lineIndex, endPos
        );
        diagnostics.push(new vscode.Diagnostic(
          range,
          'Consider adding WITH(NOLOCK) after table reference for read operations.',
          vscode.DiagnosticSeverity.Information
        ));
      }
    }
  }

  /**
   * Check for missing schema prefix (should be [dbo] by default)
   */
  private checkSchemaPrefix(
    line: string,
    lineIndex: number,
    diagnostics: vscode.Diagnostic[]
  ): void {
    // Match table references without schema prefix in FROM/JOIN/INTO/UPDATE
    const noSchemaRegex = /\b(FROM|JOIN|INTO|UPDATE)\s+\[?([A-Z][a-zA-Z0-9_]+)\]?(?!\s*\.)/gi;
    let match;

    while ((match = noSchemaRegex.exec(line)) !== null) {
      const tableName = match[2];
      // Skip if it's likely an alias (short names)
      if (tableName.length <= 3) continue;
      // Skip common non-table keywords that might be caught
      const skipKeywords = ['TOP', 'SET', 'ALL', 'DISTINCT', 'INTO', 'OUTPUT', 'VALUES'];
      if (skipKeywords.includes(tableName.toUpperCase())) continue;

      // Check if the next character indicates it already has a schema
      const afterMatch = line.slice(match.index + match[0].length);
      if (/^\s*\./.test(afterMatch)) continue;

      if (match.index !== undefined) {
        const startPos = Math.max(0, match.index);
        const endPos = Math.min(line.length, startPos + match[0].length);

        const range = new vscode.Range(
          lineIndex, startPos,
          lineIndex, endPos
        );
        diagnostics.push(new vscode.Diagnostic(
          range,
          `Consider adding schema prefix: [dbo].[${tableName}]`,
          vscode.DiagnosticSeverity.Hint
        ));
      }
    }
  }

  /**
   * Check NVARCHAR length (should be minimum 200 if unknown size)
   */
  private checkNvarcharLength(
    line: string,
    lineIndex: number,
    diagnostics: vscode.Diagnostic[]
  ): void {
    const config = vscode.workspace.getConfiguration('wl-sql');
    const minLength = config.get<number>('minNvarcharLength') || 200;

    const nvarcharRegex = /NVARCHAR\s*\(\s*(\d+)\s*\)/gi;
    let match;

    while ((match = nvarcharRegex.exec(line)) !== null) {
      const length = parseInt(match[1], 10);
      if (length < minLength && match.index !== undefined) {
        const startPos = Math.max(0, match.index);
        const endPos = Math.min(line.length, startPos + match[0].length);

        const range = new vscode.Range(
          lineIndex, startPos,
          lineIndex, endPos
        );
        diagnostics.push(new vscode.Diagnostic(
          range,
          `NVARCHAR length ${length} is below minimum ${minLength}. Consider NVARCHAR(${minLength}) if size is unknown.`,
          vscode.DiagnosticSeverity.Information
        ));
      }
    }
  }
}
