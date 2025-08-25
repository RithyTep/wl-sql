"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLLinter = void 0;
const vscode = __importStar(require("vscode"));
class SQLLinter {
    lint(document) {
        const diagnostics = [];
        const text = document.getText();
        const lines = text.split('\n');
        lines.forEach((line, lineIndex) => {
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
                        const range = new vscode.Range(lineIndex, startPos, lineIndex, endPos);
                        diagnostics.push(new vscode.Diagnostic(range, 'Avoid SELECT *. Use explicit column names.', vscode.DiagnosticSeverity.Warning));
                    }
                }
                // Check for missing WITH(NOLOCK)
                const tableRegex = /(?:FROM|JOIN)\s+(\[[^\]]+\])(?!\s+WITH\(NOLOCK\))/gi;
                let match;
                while ((match = tableRegex.exec(line)) !== null) {
                    if (match.index !== undefined) {
                        const startPos = Math.max(0, match.index);
                        const endPos = Math.min(line.length, startPos + match[0].length);
                        const range = new vscode.Range(lineIndex, startPos, lineIndex, endPos);
                        diagnostics.push(new vscode.Diagnostic(range, 'Add WITH(NOLOCK) after table reference.', vscode.DiagnosticSeverity.Information));
                    }
                }
                // Check variable naming (should be camelCase)
                const varRegex = /@([A-Z][a-zA-Z0-9_]*)/g;
                while ((match = varRegex.exec(line)) !== null) {
                    if (match.index !== undefined) {
                        const startPos = Math.max(0, match.index);
                        const endPos = Math.min(line.length, startPos + match[0].length);
                        const range = new vscode.Range(lineIndex, startPos, lineIndex, endPos);
                        diagnostics.push(new vscode.Diagnostic(range, `Variable should be in camelCase: @${match[1].charAt(0).toLowerCase() + match[1].slice(1)}`, vscode.DiagnosticSeverity.Information));
                    }
                }
                // Check DECIMAL precision
                const decimalRegex = /DECIMAL\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi;
                while ((match = decimalRegex.exec(line)) !== null) {
                    if (match[1] !== '19' || match[2] !== '6' && match.index !== undefined) {
                        const startPos = Math.max(0, match.index);
                        const endPos = Math.min(line.length, startPos + match[0].length);
                        const range = new vscode.Range(lineIndex, startPos, lineIndex, endPos);
                        diagnostics.push(new vscode.Diagnostic(range, 'Use DECIMAL(19,6) for amount fields.', vscode.DiagnosticSeverity.Information));
                    }
                }
            }
            catch (error) {
                // Silently skip lines that cause errors to prevent extension crashes
                console.warn(`WL SQL: Error processing line ${lineIndex}:`, error);
            }
        });
        return diagnostics;
    }
}
exports.SQLLinter = SQLLinter;
//# sourceMappingURL=linter.js.map