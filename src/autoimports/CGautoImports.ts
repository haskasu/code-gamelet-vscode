import * as vscode from 'vscode';
import { DtsInfo, DtsParser } from './DtsParser';

const problemCodes = [2552, 2304];

export class CGAutoImports implements vscode.CodeActionProvider {

    dtsInfoList: DtsInfo[] = [];

    parsedUris: string[] = [];

    constructor() {
    }

    refresh(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            vscode.workspace.findFiles('typings/*_modules.cg_*.d.ts', null, 1000)
                .then(uris =>
                    Promise.all(
                        uris.filter(uri =>
                            !this.parsedUris.includes(uri.toString())
                        )
                            .map(uri => this.loadDts(uri))
                    )
                )
                .then(() => resolve());
        });
    }

    loadDts(uri: vscode.Uri) {
        this.parsedUris.push(uri.toString());
        return vscode.workspace.openTextDocument(uri)
            .then(document => {
                let content = document.getText();
                let parser = new DtsParser();
                this.dtsInfoList = this.dtsInfoList.concat(parser.parse(content));
            });
    }

    createLibProposals(document: vscode.TextDocument, text: string): vscode.CompletionItem[] {
        let list: vscode.CompletionItem[] = [];
        for (let info of this.dtsInfoList) {
            if (info.shortName.startsWith(text)) {
                let suggestion = new AutoCompleteSuggestion(info.shortName, info.type, info.declareName, info.hasGenerics);
                list.push(this.createAutoCompleteProposal(document, info, suggestion, info.autocomplateLabel, info.autoCompleteInsertText, info.declareName, info.declareName, { dtsInfo: info, className: info.shortName }));
            }
        }
        return list;
    }

    private createAutoCompleteProposal(document: vscode.TextDocument, dtsInfo: DtsInfo, suggest: AutoCompleteSuggestion, label: string, insertText: string, detailName: string, doc: string, cgmeta: any): any {
        // let proposal = {
        //     label: insertText,
        //     description: doc,
        //     insertText: insertText,
        //     detail: '(' + suggest.type + ') ' + detailName,
        //     cgmeta: cgmeta,
        //     kind: suggest.toCompletionItemKind()
        // };
        // return proposal;
        let item = new vscode.CompletionItem({
            label: label,
            detail: '(' + suggest.type + ') ' + detailName,
        }, suggest.toCompletionItemKind());
        item.sortText = '_' + label;
        item.insertText = insertText;
        item.documentation = doc;

        let data = this.getAutoImportData(document, dtsInfo);
        if (data) {
            let edit = new vscode.TextEdit(new vscode.Range(data.position, data.position), data.newLine);
            item.additionalTextEdits = [edit];
        }
        return item;
    }

    private findAndGetAutoImportData(document: vscode.TextDocument, range: vscode.Range): { position: vscode.Position, newLine: string } {
        if (range.start.line === range.end.line) {
            let text = document.getText(range);
            let dtsInfo = this.dtsInfoList.find(i => i.shortName === text);
            if (dtsInfo) {
                let line = document.lineAt(range.start.line).text;
                let prevChar = range.start.character > 0 ? line.substr(range.start.character - 1, 1) : '';
                if (prevChar && prevChar.match(/[a-zA-Z0-9\._]/)) {
                    return undefined;
                }
                let nextChar = range.end.character < line.length - 1 ? line.substr(range.end.character, 1) : '';
                if (nextChar && nextChar.match(/[a-zA-Z0-9\._]/)) {
                    return undefined;
                }

                return this.getAutoImportData(document, dtsInfo);
            }
        }
        return undefined;
    }

    private getAutoImportData(document: vscode.TextDocument, dtsInfo: DtsInfo): { position: vscode.Position, newLine: string } {
        try {
            let lines: Array<string> = document.getText().split("\n");
            let alreadyImported: boolean = false;
            let insertLine = 0;
            let foundNotImportLine: boolean = false;

            for (let i: number = 0; i < lines.length; ++i) {
                let line = lines[i].trim();
                let isImportLine = line.match(/import\s.+\s(from|=)\s.+/);
                if (isImportLine && line.match(new RegExp('import\\s+' + dtsInfo.shortName + '\\s*=\\s*' + dtsInfo.declareName + '\s*(?:;)?$'))) {
                    alreadyImported = true;
                    break;
                }
                if (line && !isImportLine) {
                    foundNotImportLine = true;
                } else if (!foundNotImportLine && isImportLine) {
                    insertLine = i + 1;
                }
            }

            if (!alreadyImported) {
                let newLine = 'import ' + dtsInfo.shortName + ' = ' + dtsInfo.declareName + ';\n';
                if (insertLine === 0) {
                    newLine += '\n';
                }

                return {
                    position: new vscode.Position(insertLine, 0),
                    newLine: newLine,
                };
            }
        } catch (e) {

        }
        return undefined;
    }

    public onCompletionItem(item: any): void {
        console.log(item);
    }

    public provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext): vscode.CodeAction[] | undefined {
        let data = this.findAndGetAutoImportData(document, range);
        if (data) {
            let fix = new vscode.CodeAction('Auto Import', vscode.CodeActionKind.QuickFix);
            fix.edit = new vscode.WorkspaceEdit();
            fix.edit.insert(document.uri, data.position, data.newLine);
            fix.isPreferred = true;
            fix.diagnostics = [this.getDiagnostic(context.diagnostics, range)];
            return [fix];
        }
        return undefined;
    }

    private getDiagnostic(dignostics: readonly vscode.Diagnostic[], range: vscode.Range) {
        return dignostics.find(problem => {
            return problemCodes.includes(problem.code as any) && problem.source === 'ts' && problem.range.isEqual(range);
        });
    }

    // public onDidChangeDiagnostics(e: vscode.DiagnosticChangeEvent) {
    //     let diagnostics = vscode.languages.getDiagnostics();
    //     let document = vscode.window.activeTextEditor.document;
    //     let currentUri = document.uri.toString();
    //     let diag = diagnostics.find(d => d[0].toString() === currentUri);
    //     if (diag) {
    //         diag[1].find(problem => {
    //             if (problem.code === 2304 && problem.source === 'ts') {
    //                 let range = problem.range;
    //                 let data = this.getAutoImportData(document, range);
    //                 if (data) {
    //                     vscode.window.activeTextEditor.edit(builder => {
    //                         builder.insert(data.position, data.newLine);
    //                     });
    //                     return true;
    //                 }
    //             }
    //             return false;
    //         });
    //     }
    // }

}


export class AutoCompleteSuggestion {
    constructor(public name: string, public type: string, public line: string, public hasGenerics: boolean) {
        this.name = name.replace(':', '');
    }

    get autocompleteLabel(): string {
        if (this.hasGenerics) {
            return this.name + '<T>';
        }
        return this.name;
    }

    public toCompletionItemKind(): number {
        if (this.type === 'class') {
            return vscode.CompletionItemKind.Class;
        } else if (this.type === 'const') {
            return vscode.CompletionItemKind.Constant;
        } else if (this.type === 'function') {
            return vscode.CompletionItemKind.Function;
        } else if (this.type === 'interface') {
            return vscode.CompletionItemKind.Interface;
        } else if (this.type === 'enum') {
            return vscode.CompletionItemKind.Enum;
        } else {
            return vscode.CompletionItemKind.Value;
        }
    }
}