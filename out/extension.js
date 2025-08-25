"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode2 = __toESM(require("vscode"));

// src/formatter.ts
var SQLFormatter = class {
  format(sql) {
    let formatted = sql;
    formatted = this.formatAllKeywords(formatted);
    formatted = this.formatStoredProcedureParameters(formatted);
    formatted = this.formatAllIdentifiers(formatted);
    formatted = this.formatVariables(formatted);
    formatted = this.addNoLock(formatted);
    formatted = formatted.replace(/DECIMAL\s*\(\s*\d+\s*,\s*\d+\s*\)/gi, "DECIMAL(19,6)");
    formatted = this.formatStoredProcedures(formatted);
    formatted = this.normalizeSpacing(formatted);
    formatted = this.cleanupAndIndent(formatted);
    return formatted;
  }
  formatAllKeywords(sql) {
    const keywords = [
      // Core SQL keywords
      "SELECT",
      "FROM",
      "WHERE",
      "JOIN",
      "INNER JOIN",
      "LEFT JOIN",
      "RIGHT JOIN",
      "FULL JOIN",
      "OUTER JOIN",
      "CROSS JOIN",
      "ORDER BY",
      "GROUP BY",
      "HAVING",
      "UNION",
      "UNION ALL",
      "INSERT",
      "INTO",
      "VALUES",
      "UPDATE",
      "SET",
      "DELETE",
      "CREATE",
      "ALTER",
      "DROP",
      "TABLE",
      "VIEW",
      "INDEX",
      "PRIMARY KEY",
      "FOREIGN KEY",
      "REFERENCES",
      "CONSTRAINT",
      // Stored procedure keywords
      "PROCEDURE",
      "FUNCTION",
      "TRIGGER",
      "DECLARE",
      "BEGIN",
      "END",
      "IF",
      "ELSE",
      "ELSEIF",
      "WHILE",
      "FOR",
      "LOOP",
      "BREAK",
      "CONTINUE",
      "TRY",
      "CATCH",
      "THROW",
      "RETURN",
      "EXEC",
      "EXECUTE",
      // Data types and modifiers
      "INT",
      "INTEGER",
      "BIGINT",
      "SMALLINT",
      "TINYINT",
      "DECIMAL",
      "NUMERIC",
      "FLOAT",
      "REAL",
      "MONEY",
      "SMALLMONEY",
      "BIT",
      "CHAR",
      "VARCHAR",
      "NCHAR",
      "NVARCHAR",
      "TEXT",
      "NTEXT",
      "DATETIME",
      "DATETIME2",
      "DATE",
      "TIME",
      "TIMESTAMP",
      "BINARY",
      "VARBINARY",
      "IMAGE",
      "UNIQUEIDENTIFIER",
      "NOT NULL",
      "NULL",
      "DEFAULT",
      "IDENTITY",
      "AUTO_INCREMENT",
      // Logical operators and functions
      "AND",
      "OR",
      "NOT",
      "IN",
      "NOT IN",
      "EXISTS",
      "NOT EXISTS",
      "BETWEEN",
      "LIKE",
      "NOT LIKE",
      "IS",
      "IS NOT",
      "IS NULL",
      "IS NOT NULL",
      "CASE",
      "WHEN",
      "THEN",
      "ELSE",
      "END",
      "CAST",
      "CONVERT",
      // Aggregate and window functions
      "COUNT",
      "SUM",
      "AVG",
      "MIN",
      "MAX",
      "DISTINCT",
      "OVER",
      "PARTITION BY",
      "ROW_NUMBER",
      "RANK",
      "DENSE_RANK",
      // Other keywords
      "AS",
      "ON",
      "WITH",
      "NOLOCK",
      "ROWLOCK",
      "OPTION",
      "RECOMPILE",
      "TOP",
      "PERCENT",
      "OFFSET",
      "FETCH",
      "NEXT",
      "ROWS",
      "ONLY",
      "WAITFOR",
      "DELAY",
      "GO",
      "DESC",
      "ASC"
    ];
    keywords.sort((a, b) => b.length - a.length);
    keywords.forEach((keyword) => {
      const regex = new RegExp(`\\b${keyword.replace(/\s+/g, "\\s+")}\\b`, "gi");
      sql = sql.replace(regex, keyword.toUpperCase());
    });
    return sql;
  }
  formatStoredProcedureParameters(sql) {
    sql = sql.replace(/(CREATE\s+PROCEDURE\s+[^\r\n(]+)([\s\S]*?)\bAS\b/gi, (match, header, params) => {
      const paramsRaw = params.trim();
      if (!paramsRaw)
        return `${header}
AS`;
      const flattened = paramsRaw.replace(/\r?\n/g, " ").replace(/\s+/g, " ");
      const parts = flattened.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
      const formattedParams = parts.map((p, i) => {
        const suffix = i < parts.length - 1 ? "," : "";
        return "	" + p + suffix;
      }).join("\n");
      return `${header}
${formattedParams}
AS`;
    });
    return sql;
  }
  formatAllIdentifiers(sql) {
    sql = sql.replace(/\[+\s*([^\[\]]+?)\s*\]+/g, "[$1]");
    sql = sql.replace(/@\[([^\]]+)\]/g, "@$1");
    sql = sql.replace(/\]\.\[\[/g, "].[");
    sql = sql.replace(/\[\[([^\]]+)\]\]/g, "[$1]");
    sql = sql.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\b/g, (match, identifier, offset, full) => {
      if (offset > 0 && full[offset - 1] === "@")
        return match;
      const before = offset > 0 ? full[offset - 1] : "";
      const after = full[offset + match.length] || "";
      if (before === "[")
        return match;
      if (this.isKeyword(identifier))
        return match;
      if (/^\d/.test(identifier))
        return match;
      if (identifier.length === 1)
        return match;
      const skipFunctions = [
        "GETDATE",
        "DATEADD",
        "DATEDIFF",
        "CAST",
        "CONVERT",
        "ISNULL",
        "COALESCE",
        "SUBSTRING",
        "LEN",
        "LTRIM",
        "RTRIM",
        "UPPER",
        "LOWER",
        "COUNT",
        "SUM",
        "AVG",
        "MIN",
        "MAX",
        "ROW_NUMBER",
        "RANK"
      ];
      if (skipFunctions.includes(identifier.toUpperCase()))
        return match;
      const beforeContext = full.substring(Math.max(0, offset - 50), offset);
      if (beforeContext.match(/\]\s+WITH\s*\(\s*NOLOCK\s*\)\s*$/i)) {
        return match;
      }
      if (identifier.includes(".")) {
        return identifier.split(".").map((part) => `[${part}]`).join(".");
      }
      return `[${identifier}]`;
    });
    return sql;
  }
  formatVariables(sql) {
    return sql.replace(/@([A-Z][a-zA-Z0-9_]*)/g, (match, varName) => {
      const camelCase = varName.charAt(0).toLowerCase() + varName.slice(1);
      return "@" + camelCase;
    });
  }
  formatStoredProcedures(sql) {
    sql = sql.replace(/(\bCREATE\s+PROCEDURE[\s\S]*?\bAS\b)\s*(?!BEGIN\b)/gi, "$1\nBEGIN\n");
    sql = sql.replace(/(\bCREATE\s+PROCEDURE[\s\S]*?\bAS\b\s*BEGIN\s*)(?!SET\s+NOCOUNT\s+ON\b)/gi, "$1	SET NOCOUNT ON;\n");
    return sql;
  }
  normalizeSpacing(sql) {
    sql = sql.replace(/,\s*/g, ", ");
    sql = sql.replace(/\s*(=|<>|!=|<=|>=|<|>)\s*/g, " $1 ");
    sql = sql.replace(/\bAS([A-Z])/g, "AS\n$1");
    sql = sql.replace(/ {2,}/g, " ");
    sql = sql.split("\n").map((l) => l.replace(/\s+$/g, "")).join("\n");
    return sql;
  }
  addNoLock(sql) {
    sql = sql.replace(/WITH\(NOLOCK\)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+WITH\s*\(\s*NOLOCK\s*\)/gi, "$1 WITH(NOLOCK)");
    sql = sql.replace(/(\[[^\]]+\])\s+WITH\(NOLOCK\)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+WITH\s*\(\s*NOLOCK\s*\)/gi, "$1 $2 WITH(NOLOCK)");
    sql = sql.replace(
      /\b(FROM|JOIN)\s+((?:\[[^\]]+\]|[A-Za-z0-9_]+)(?:\s*\.\s*(?:\[[^\]]+\]|[A-Za-z0-9_]+))*)(?:\s+([a-zA-Z_][a-zA-Z0-9_]*))?\s*(?!WITH)/gi,
      (match, op, tableRef, alias) => {
        const aliasStr = alias ? ` ${alias}` : "";
        return `${op} ${tableRef}${aliasStr} WITH(NOLOCK)`;
      }
    );
    return sql;
  }
  cleanupAndIndent(sql) {
    const lines = sql.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
    let indentLevel = 0;
    const result = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const upperLine = line.toUpperCase();
      if (upperLine.match(/^(END|}\s*$|\))/)) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      let indentedLine = "	".repeat(indentLevel) + line;
      if (upperLine.startsWith("CREATE PROCEDURE")) {
        result.push(indentedLine);
      } else if (upperLine.startsWith("SELECT")) {
        result.push(indentedLine);
      } else if (upperLine.startsWith("FROM") || upperLine.includes("JOIN")) {
        result.push(indentedLine);
      } else if (upperLine.startsWith("WHERE") || upperLine.startsWith("AND ") || upperLine.startsWith("OR ")) {
        result.push(indentedLine);
      } else if (upperLine.startsWith("ORDER BY") || upperLine.startsWith("GROUP BY")) {
        result.push(indentedLine);
      } else {
        result.push(indentedLine);
      }
      if (upperLine.match(/^(BEGIN|CREATE\s+PROCEDURE|IF|ELSE|WHILE|TRY|CATCH|\()/)) {
        indentLevel++;
      }
    }
    return result.join("\n");
  }
  isKeyword(word) {
    const keywords = [
      // SQL Keywords that should NOT be bracketed
      "SELECT",
      "FROM",
      "WHERE",
      "JOIN",
      "INNER",
      "LEFT",
      "RIGHT",
      "FULL",
      "OUTER",
      "CROSS",
      "ORDER",
      "GROUP",
      "BY",
      "HAVING",
      "AS",
      "ON",
      "AND",
      "OR",
      "NOT",
      "NULL",
      "IS",
      "IN",
      "EXISTS",
      "BETWEEN",
      "LIKE",
      "CREATE",
      "ALTER",
      "DROP",
      "INSERT",
      "UPDATE",
      "DELETE",
      "DECLARE",
      "SET",
      "BEGIN",
      "END",
      "IF",
      "ELSE",
      "WHILE",
      "FOR",
      "BREAK",
      "CONTINUE",
      "RETURN",
      "EXEC",
      "EXECUTE",
      "PROCEDURE",
      "FUNCTION",
      "TRIGGER",
      "TABLE",
      "VIEW",
      "INDEX",
      "PRIMARY",
      "FOREIGN",
      "KEY",
      "REFERENCES",
      "CONSTRAINT",
      "IDENTITY",
      "DEFAULT",
      "CHECK",
      "UNIQUE",
      "CLUSTERED",
      "NONCLUSTERED",
      // Data types
      "INT",
      "INTEGER",
      "BIGINT",
      "SMALLINT",
      "TINYINT",
      "BIT",
      "DECIMAL",
      "NUMERIC",
      "FLOAT",
      "REAL",
      "MONEY",
      "SMALLMONEY",
      "CHAR",
      "VARCHAR",
      "NCHAR",
      "NVARCHAR",
      "TEXT",
      "NTEXT",
      "DATETIME",
      "DATETIME2",
      "DATE",
      "TIME",
      "TIMESTAMP",
      "BINARY",
      "VARBINARY",
      "IMAGE",
      "UNIQUEIDENTIFIER",
      // Functions and operators
      "CASE",
      "WHEN",
      "THEN",
      "ELSE",
      "CAST",
      "CONVERT",
      "ISNULL",
      "COALESCE",
      "COUNT",
      "SUM",
      "AVG",
      "MIN",
      "MAX",
      "DISTINCT",
      "TOP",
      "PERCENT",
      "UNION",
      "ALL",
      "INTERSECT",
      "EXCEPT",
      "OVER",
      "PARTITION",
      "ROW_NUMBER",
      "RANK",
      "DENSE_RANK",
      "NTILE",
      "WITH",
      "NOLOCK",
      "ROWLOCK",
      "UPDLOCK",
      "HOLDLOCK",
      "OPTION",
      "RECOMPILE",
      "WAITFOR",
      "DELAY",
      "GO",
      "TRY",
      "CATCH",
      "THROW",
      "RAISERROR",
      // Common system functions
      "GETDATE",
      "DATEADD",
      "DATEDIFF",
      "DATENAME",
      "DATEPART",
      "SUBSTRING",
      "LEN",
      "LTRIM",
      "RTRIM",
      "UPPER",
      "LOWER",
      "REPLACE",
      "ABS",
      "CEILING",
      "FLOOR",
      "ROUND",
      "POWER",
      "SQRT",
      "RAND",
      "NEWID",
      "NEWSEQUENTIALID",
      "SCOPE_IDENTITY",
      "IDENT_CURRENT",
      // Transaction keywords
      "TRANSACTION",
      "BEGIN_TRANSACTION",
      "COMMIT",
      "ROLLBACK",
      "SAVE",
      "ISOLATION",
      "LEVEL",
      "READ",
      "COMMITTED",
      "UNCOMMITTED",
      "REPEATABLE",
      "SERIALIZABLE",
      // Other keywords
      "FETCH",
      "NEXT",
      "PRIOR",
      "FIRST",
      "LAST",
      "ABSOLUTE",
      "RELATIVE",
      "OFFSET",
      "ROWS",
      "ONLY",
      "COLLATE",
      "WITHIN",
      "CONTAINS",
      "FREETEXT",
      "DESC",
      "ASC"
    ];
    return keywords.includes(word.toUpperCase());
  }
};

// src/linter.ts
var vscode = __toESM(require("vscode"));
var SQLLinter = class {
  lint(document) {
    const diagnostics = [];
    const text = document.getText();
    const lines = text.split("\n");
    lines.forEach((line, lineIndex) => {
      if (lineIndex >= document.lineCount) {
        return;
      }
      try {
        if (/SELECT\s+\*/i.test(line)) {
          const match2 = line.match(/SELECT\s+\*/i);
          if (match2 && match2.index !== void 0) {
            const startPos = Math.max(0, match2.index);
            const endPos = Math.min(line.length, startPos + match2[0].length);
            const range = new vscode.Range(
              lineIndex,
              startPos,
              lineIndex,
              endPos
            );
            diagnostics.push(new vscode.Diagnostic(
              range,
              "Avoid SELECT *. Use explicit column names.",
              vscode.DiagnosticSeverity.Warning
            ));
          }
        }
        const tableRegex = /(?:FROM|JOIN)\s+(\[[^\]]+\])(?!\s+WITH\(NOLOCK\))/gi;
        let match;
        while ((match = tableRegex.exec(line)) !== null) {
          if (match.index !== void 0) {
            const startPos = Math.max(0, match.index);
            const endPos = Math.min(line.length, startPos + match[0].length);
            const range = new vscode.Range(
              lineIndex,
              startPos,
              lineIndex,
              endPos
            );
            diagnostics.push(new vscode.Diagnostic(
              range,
              "Add WITH(NOLOCK) after table reference.",
              vscode.DiagnosticSeverity.Information
            ));
          }
        }
        const varRegex = /@([A-Z][a-zA-Z0-9_]*)/g;
        while ((match = varRegex.exec(line)) !== null) {
          if (match.index !== void 0) {
            const startPos = Math.max(0, match.index);
            const endPos = Math.min(line.length, startPos + match[0].length);
            const range = new vscode.Range(
              lineIndex,
              startPos,
              lineIndex,
              endPos
            );
            diagnostics.push(new vscode.Diagnostic(
              range,
              `Variable should be in camelCase: @${match[1].charAt(0).toLowerCase() + match[1].slice(1)}`,
              vscode.DiagnosticSeverity.Information
            ));
          }
        }
        const decimalRegex = /DECIMAL\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi;
        while ((match = decimalRegex.exec(line)) !== null) {
          if (match[1] !== "19" || match[2] !== "6" && match.index !== void 0) {
            const startPos = Math.max(0, match.index);
            const endPos = Math.min(line.length, startPos + match[0].length);
            const range = new vscode.Range(
              lineIndex,
              startPos,
              lineIndex,
              endPos
            );
            diagnostics.push(new vscode.Diagnostic(
              range,
              "Use DECIMAL(19,6) for amount fields.",
              vscode.DiagnosticSeverity.Information
            ));
          }
        }
      } catch (error) {
        console.warn(`WL SQL: Error processing line ${lineIndex}:`, error);
      }
    });
    return diagnostics;
  }
};

// src/extension.ts
function activate(context) {
  const formatter = new SQLFormatter();
  const linter = new SQLLinter();
  const formattingProvider = vscode2.languages.registerDocumentFormattingEditProvider("sql", {
    provideDocumentFormattingEdits(document) {
      const text = document.getText();
      const formattedText = formatter.format(text);
      const range = new vscode2.Range(
        document.positionAt(0),
        document.positionAt(text.length)
      );
      return [vscode2.TextEdit.replace(range, formattedText)];
    }
  });
  const diagnosticCollection = vscode2.languages.createDiagnosticCollection("wl-sql");
  const updateDiagnostics = (document) => {
    if (document.languageId === "sql") {
      try {
        const diagnostics = linter.lint(document);
        diagnosticCollection.set(document.uri, diagnostics);
      } catch (error) {
        console.error("WL SQL: Error updating diagnostics:", error);
        diagnosticCollection.set(document.uri, []);
      }
    }
  };
  const formatCommand = vscode2.commands.registerCommand("wl-sql.formatDocument", () => {
    const editor = vscode2.window.activeTextEditor;
    if (editor && editor.document.languageId === "sql") {
      vscode2.commands.executeCommand("editor.action.formatDocument");
    }
  });
  const validateCommand = vscode2.commands.registerCommand("wl-sql.validateDocument", () => {
    const editor = vscode2.window.activeTextEditor;
    if (editor && editor.document.languageId === "sql") {
      updateDiagnostics(editor.document);
      vscode2.window.showInformationMessage("SQL validation completed!");
    }
  });
  const onSaveListener = vscode2.workspace.onDidSaveTextDocument((document) => {
    const config = vscode2.workspace.getConfiguration("wl-sql");
    if (config.get("enableFormatOnSave") && document.languageId === "sql") {
      const editor = vscode2.window.activeTextEditor;
      if (editor && editor.document === document) {
        vscode2.commands.executeCommand("editor.action.formatDocument");
      }
    }
  });
  let lintTimeout;
  const onChangeListener = vscode2.workspace.onDidChangeTextDocument((event) => {
    if (event.document.languageId !== "sql")
      return;
    const config = vscode2.workspace.getConfiguration("wl-sql");
    if (config.get("enableLinting")) {
      clearTimeout(lintTimeout);
      lintTimeout = setTimeout(() => {
        updateDiagnostics(event.document);
      }, 500);
    }
  });
  vscode2.window.onDidChangeActiveTextEditor((editor) => {
    if (editor && editor.document.languageId === "sql") {
      const config = vscode2.workspace.getConfiguration("wl-sql");
      if (config.get("enableLinting")) {
        updateDiagnostics(editor.document);
      }
    }
  });
  context.subscriptions.push(
    formattingProvider,
    formatCommand,
    validateCommand,
    onSaveListener,
    onChangeListener,
    diagnosticCollection
  );
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
