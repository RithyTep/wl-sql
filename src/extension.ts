
import * as vscode from 'vscode';
import { SQLFormatter } from './formatter';
import { SQLLinter } from './linter';

export function activate(context: vscode.ExtensionContext) {
  const formatter = new SQLFormatter();
  const linter = new SQLLinter();

  // Register document formatting provider
  const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider('sql', {
    provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
      const text = document.getText();
      const formattedText = formatter.format(text);

      const range = new vscode.Range(
        document.positionAt(0),
        document.positionAt(text.length)
      );

      return [vscode.TextEdit.replace(range, formattedText)];
    }
  });

  // Register diagnostic provider for linting
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('wl-sql');

  const updateDiagnostics = (document: vscode.TextDocument) => {
    if (document.languageId === 'sql') {
      try {
        const diagnostics = linter.lint(document);
        diagnosticCollection.set(document.uri, diagnostics);
      } catch (error) {
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
  let lintTimeout: NodeJS.Timeout;
  const onChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.document.languageId !== 'sql') return;

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

  context.subscriptions.push(
    formattingProvider,
    formatCommand,
    validateCommand,
    onSaveListener,
    onChangeListener,
    diagnosticCollection
  );
}

export function deactivate() { }
