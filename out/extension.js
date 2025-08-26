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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const formatter_1 = require("./formatter");
const linter_1 = require("./linter");
function activate(context) {
    const formatter = new formatter_1.SQLFormatter();
    const linter = new linter_1.SQLLinter();
    // Register document formatting provider
    const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider('sql', {
        provideDocumentFormattingEdits(document) {
            const text = document.getText();
            const formattedText = formatter.format(text);
            const range = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
            return [vscode.TextEdit.replace(range, formattedText)];
        }
    });
    // Register diagnostic provider for linting
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('wl-sql');
    const updateDiagnostics = (document) => {
        if (document.languageId === 'sql') {
            try {
                const diagnostics = linter.lint(document);
                diagnosticCollection.set(document.uri, diagnostics);
            }
            catch (error) {
                console.error('WL SQL: Error updating diagnostics:', error);
                // Clear diagnostics on error to prevent stale issues
                diagnosticCollection.set(document.uri, []);
            }
        }
    };
    // Format command
    const formatCommand = vscode.commands.registerCommand('wl-sql.formatDocument', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'sql') {
            vscode.commands.executeCommand('editor.action.formatDocument');
        }
    });
    // Validate command
    const validateCommand = vscode.commands.registerCommand('wl-sql.validateDocument', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'sql') {
            updateDiagnostics(editor.document);
            vscode.window.showInformationMessage('SQL validation completed!');
        }
    });
    // Auto-format on save if enabled
    const onSaveListener = vscode.workspace.onDidSaveTextDocument((document) => {
        const config = vscode.workspace.getConfiguration('wl-sql');
        if (config.get('enableFormatOnSave') && document.languageId === 'sql') {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document === document) {
                vscode.commands.executeCommand('editor.action.formatDocument');
            }
        }
    });
    // Auto-lint on change with debounce
    let lintTimeout;
    const onChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.languageId !== 'sql')
            return;
        const config = vscode.workspace.getConfiguration('wl-sql');
        if (config.get('enableLinting')) {
            // Debounce to avoid excessive linting on rapid changes
            clearTimeout(lintTimeout);
            lintTimeout = setTimeout(() => {
                updateDiagnostics(event.document);
            }, 500);
        }
    });
    // Lint open documents
    vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document.languageId === 'sql') {
            const config = vscode.workspace.getConfiguration('wl-sql');
            if (config.get('enableLinting')) {
                updateDiagnostics(editor.document);
            }
        }
    });
    context.subscriptions.push(formattingProvider, formatCommand, validateCommand, onSaveListener, onChangeListener, diagnosticCollection);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map