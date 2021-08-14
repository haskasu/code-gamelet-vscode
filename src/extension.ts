// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { CGAutoImports } from './autoimports/CGautoImports';
import { TemplateManager } from './templates/TemplateManager';

let cgAutoImports: CGAutoImports = new CGAutoImports();
let templateManager = new TemplateManager();

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	templateManager.context = context;

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "code-gamelet" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('code-gamelet.helloCG', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello from Code.Gamelet!');
	});

	context.subscriptions.push(disposable);

	disposable = vscode.languages.registerCompletionItemProvider(
		{
			scheme: 'file',
			language: 'typescript',
		},
		{
			provideCompletionItems: (document: vscode.TextDocument, position: vscode.Position) => {

				// get all text until the `position` and check if it reads `console.`
				// and if so then complete if `log`, `warn`, and `error`
				let range = document.getWordRangeAtPosition(position);
				let word = document.getText(range);
				let prevChar = document.lineAt(position.line).text.substr(range.start.character - 1, 1);
				if (prevChar !== '.') {
					return cgAutoImports.refresh()
						.then(() => cgAutoImports.createLibProposals(document, word));
				}
				return undefined;
			},
			resolveCompletionItem: (item: any) => {
				cgAutoImports.onCompletionItem(item);
				return null;
			}
		}
	);

	context.subscriptions.push(disposable);

	disposable = vscode.languages.registerCodeActionsProvider(
		{
			scheme: 'file',
			language: 'typescript',
		},
		cgAutoImports,
		{
			providedCodeActionKinds: [
				vscode.CodeActionKind.QuickFix,
				vscode.CodeActionKind.Refactor,
			],

		}
	);

	context.subscriptions.push(disposable);

	// disposable = vscode.languages.onDidChangeDiagnostics(cgAutoImports.onDidChangeDiagnostics, cgAutoImports);
	// context.subscriptions.push(disposable);

	disposable = vscode.workspace.onDidCreateFiles((event) => {
		event.files.forEach(file => templateManager.onFileCreated(file));
	});
	context.subscriptions.push(disposable);

}

// this method is called when your extension is deactivated
export function deactivate() { }
