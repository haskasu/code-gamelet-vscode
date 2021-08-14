import path = require('path');
import { twig } from 'twig';
import * as vscode from 'vscode';
import { Uri } from "vscode";

export class TemplateManager {

    context: vscode.ExtensionContext;

    onFileCreated(file: Uri): Promise<void> {
        return Promise.resolve()
            .then(() => {
                let templateFile = this.getTemplateFile(file.path);
                if (templateFile) {
                    return vscode.workspace.fs.readFile(templateFile)
                        .then(data => {
                            let content = fillinContent(file.path, data.toString());
                            let edit = new vscode.WorkspaceEdit();
                            edit.replace(file, new vscode.Range(1, 0, 1, 0), content);
                            return vscode.workspace.applyEdit(edit);
                        });

                }
            })
            .then(() => { });
    }

    getTemplateFile(filename: string): Uri {
        let template = getTemplateFile(filename);
        return Uri.file(this.context.asAbsolutePath(path.join('templates', template)));
    }
}

function fillinContent(filename: string, content: string): string {
    filename = filename.split('/').pop();
    let className = filename.split('.').shift();
    className = className.substr(0, 1).toUpperCase() + className.substr(1);
    let twigobj = twig({ data: content });

    if (filename.match(/\.(action|check|trigger|definition)\.ts$/)) {
        content = twigobj.render({ type: className });
    } else if (filename.match(/\.tsx?$/)) {
        content = twigobj.render({ classname: className });
    }
    return content;
}

function getTemplateFile(filename: string): string {
    if (filename.endsWith('.action.ts')) {
        return 'action.default.ts.twig';
    } else if (filename.endsWith('.check.ts')) {
        return 'check.default.ts.twig';
    } else if (filename.endsWith('.trigger.ts')) {
        return 'trigger.default.ts.twig';
    } else if (filename.endsWith('.definition.ts')) {
        return 'definition.default.ts.twig';
    } else if (filename.endsWith('.ts')) {
        return 'default.ts.twig';
    } else if (filename.endsWith('.tsx')) {
        return 'default.tsx.twig';
    }
    return null;
}