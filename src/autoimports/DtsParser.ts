export class DtsInfo {
    
    static TYPE = {
        CLASS: 'class',
        INTERFACE: 'interface',
        FUNCTION: 'function',
        CONST: 'const',
        VAR: 'var',
        ENUM: 'enum',
        REXPORT: 'rexport',
    };

    public id: string = '';

    public title: string = '';

    public declareSource: string = '';

    public hasGenerics: boolean = false;

    public preSource: string = '';

    public shortName: string = '';

    public declareName: string = '';

    public declareNameWithSpan: string = '';

    private _lineNumber: number = -1;

    constructor(public namespace: string, declareName: string, public type: string, public endLine: string, public declares: Array<DtsInfo>, public oneLineDeclare: boolean) {
        this.init(declareName);
    }

    public get autocomplateLabel(): string {
        if (this.hasGenerics) {
            return this.shortName + '<T>';
        }
        return this.shortName;
    }

    private init(declareName: string): void {
        let matches;
        switch (this.type) {
            case 'class':
            case 'interface':
                matches = declareName.match(/([^<>\s]+)(<[^<>]+>)?(\s+extends\s+[^{]+)?/);
                if (matches) {
                    this.shortName = matches[1];
                    if (matches[2]) {
                        this.hasGenerics = true;
                    }
                }
                break;
            case 'function':
                matches = declareName.match(/([^\(]+)\(/);
                if (matches) {
                    this.shortName = matches[1];
                }
                break;
            case 'const':
            case 'var':
                matches = declareName.match(/^([^:\s]+):/);
                if (matches) {
                    this.shortName = matches[1];
                }
                break;
        }

        if (!this.shortName) {
            this.shortName = declareName;
        }
        this.declareName = this.namespace + '.' + this.shortName;
        let filename: string = this.declareName;
        if (this.isOneLineDeclareType()) {
            filename = this.namespace;
        }
        this.id = filename;
        this.title = filename.replace('CG.', '');
        this.transformDeclarename(this.namespace + '.' + declareName);
    }

    public get autoCompleteInsertText(): string {
        switch (this.type) {
            case 'class':
            case 'interface':
            case 'enum':
            case 'const':
            case 'var':
                return this.shortName;

            case 'function':
                return this.convertAutoCompleteFunctionText(this.declareName);

            default:
                return this.declareName;
        }
    }

    private convertAutoCompleteFunctionText(text: string): string {
        text = text.replace(/:\s*[a-zA-Z0-9]+\s*,/g, ',');
        text = text.replace(/:\s*[a-zA-Z0-9]+\s*\)/g, ')');
        text = text.replace(/:\s*[a-zA-Z0-9]+\s*$/g, '');
        return text;
    }

    private transformDeclarename(declareName: string): void {
        switch (this.type) {
            case 'class':
            case 'interface':
                this.declareNameWithSpan = declareName
                    .replace(/(<[^<>]*>)/g, '[span class="genericType"]$1[/span]')
                    .replace(/(\sextends\s[^,:<>]+)/g, '[span class="paramType"]$1[/span]')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/\[/g, '<')
                    .replace(/\]/g, '>')
                    ;
                break;
            case 'function':
                this.declareNameWithSpan = declareName
                    .replace(/(\(.*\))/g, '[span class="genericType"]$1[/span]')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/\[/g, '<')
                    .replace(/\]/g, '>')
                    ;
                break;
            default:
                this.declareNameWithSpan = declareName
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    ;
                break;
        }

        var index: number = 0;
        while (true) {
            index = this.declareNameWithSpan.indexOf(':', index);
            if (index === -1) {
                break;
            }
            var end: number = this.declareNameWithSpan.indexOf(',', index);
            if (end === -1) {
                end = this.declareNameWithSpan.indexOf(')', index);
            }
            var replacement: string = '<span class="paramType">' +
                (end === -1 ? this.declareNameWithSpan.substr(index) : this.declareNameWithSpan.substr(index, end - index)) +
                '</span>';
            this.declareNameWithSpan = this.declareNameWithSpan.substr(0, index) + replacement + (end === -1 ? '' : this.declareNameWithSpan.substr(end));

            if (end === -1) {
                break;
            }
            index += replacement.length;
        }
    }

    public isOneLineDeclareType(): boolean {
        return this.oneLineDeclare;
    }

    public addSourceLine(line: string): void {
        this.declareSource += '    ' + line + '\n';
        if (this.type === 'function' && !this.oneLineDeclare) {
            let search = line.indexOf(';');
            if (search !== -1 && this.declareSource.split('(').length === this.declareSource.split(')').length) {
                let fullLine = this.declareSource.replace(/[\n\r\t]/g, '');
                this.oneLineDeclare = true;
                let startIndex: number = fullLine.indexOf('function ');
                this.init(fullLine.substr(startIndex + 'function '.length));
            }
        }
    }

    public finish(preSource: string): void {
        this.preSource = preSource;
    }

    get preSourceWithLine(): string {
        return this.preSource ? this.preSource + '\n' : '';
    }

    public get fileContent(): string {
        if (!this.fileContentAlone) {
            let content: string = '';
            for (let info of this.declares) {
                if (info.namespace === this.namespace && !info.fileContentAlone) {
                    content += '\n' + info.preSourceWithLine + info.declareSource;
                }
            }
            content = 'namespace ' + this.namespace + ' {\n\n' + content + '\n\n}';
            let position: number = content.indexOf(this.declareSource);
            if (position !== -1) {
                this._lineNumber = content.substr(0, position).split('\n').length;
            }
            return content;
        } else {
            return this.preSourceWithLine + 'namespace ' + this.namespace + ' {\n\n' + this.declareSource + '\n\n}';
        }
    }

    public get fileContentAlone(): boolean {
        switch (this.type) {
            case DtsInfo.TYPE.CLASS:
            case DtsInfo.TYPE.INTERFACE:
            case DtsInfo.TYPE.ENUM:
                return true;
        }
        return false;
    }

    public get lineNumber(): number {
        if (this._lineNumber === -1) {
            // do this to calc lineNumber
            this.fileContent;
            if (this._lineNumber === -1) {
                this._lineNumber = 0;
            }
        }
        return this._lineNumber;
    }

    getContent(): Promise<string> {
        return Promise.resolve(this.fileContent);
    }
}

export class DtsParser {

    private searchNamespace: string = 'namespace ';
    private searchInterface: string = 'export interface ';
    private searchClass: string = 'export declare class ';
    private searchConst: string = 'export declare const ';
    private searchVar: string = 'export declare var ';
    private searchEnum: string = 'export declare enum ';
    private searchFunction: string = 'export declare function ';
    private searchExtends: string = ' extends ';
    private searchExtendsEnd: string = ' {';
    private searchImplements: string = ' implements ';
    private searchTypeEnd: string = ';';
    private searchTypeEnd2: string = ':';

    public parse(dts: string): Array<DtsInfo> {

        var declares: Array<DtsInfo> = [];
        var lines: Array<string> = dts.replace(/\r/g, '').split("\n");

        var currentNamespace: string;
        var start, end;
        var currentDeclare: DtsInfo;
        var preSource: string = '';

        var finishDeclare: () => void = () => {
            declares.push(currentDeclare);
            currentDeclare.finish(preSource);
            currentDeclare = null;
            preSource = '';
        };

        for (var i: number = 0; i < lines.length; ++i) {
            var line: string = lines[i];
            var trimedLine: string = line.trim();

            if (trimedLine.indexOf('import {') === 0 || trimedLine.indexOf('private ') === 0) {
                continue;
            }

            start = line.indexOf(this.searchNamespace);
            if (start !== -1) {
                start += this.searchNamespace.length;
                end = line.indexOf(' ', start);
                currentNamespace = line.substr(start, end - start);
            } else if (currentNamespace) {
                let _declare: DtsInfo = this.searchDeclare(currentNamespace, line, declares);
                if (_declare) {
                    if (currentDeclare) {
                        finishDeclare();
                    }
                    currentDeclare = _declare;
                    if (currentDeclare.type === DtsInfo.TYPE.CONST) {
                        if (line.endsWith(';')) {
                            currentDeclare.addSourceLine(line);
                            finishDeclare();
                        }
                    }
                } else if ((currentDeclare && currentDeclare.endLine === line) || (currentDeclare === null && line.trim() === '}')) {
                    if (currentDeclare) {
                        currentDeclare.addSourceLine(line);
                        finishDeclare();
                    }
                    preSource = '';
                } else {
                    if (currentDeclare && currentDeclare.isOneLineDeclareType() && this.isCommentLine(trimedLine)) {
                        finishDeclare();
                    }
                    if (!currentDeclare) {
                        preSource += '\n    ' + line;
                    }
                }

                if (currentDeclare) {
                    currentDeclare.addSourceLine(line);

                    if (currentDeclare.isOneLineDeclareType()) {
                        finishDeclare();
                    }
                }
            } else {
                preSource += '\n    ' + line;
            }
        }
        if (currentDeclare) {
            declares.push(currentDeclare);
        }
        this.parseRexports(dts, declares);

        declares.sort(this.sortFunc);

        return declares;
    }

    private parseRexports(dts: string, declares: DtsInfo[]) {
        let namespaces: { index: number, value: string }[] = [];
        let search = dts.matchAll(/namespace\s+([\w\.]+)\s+{/g);
        if (search) {
            for (let nsresult of search) {
                namespaces.push({
                    index: nsresult.index,
                    value: nsresult[1],
                });
            }
            namespaces.sort((a, b) => a.index - b.index);
        }
        function getNamespaceByIndex(index: number): string {
            let find = namespaces.find(ns => ns.index < index);
            return find && find.value;
        }

        let reexpostList = dts.matchAll(/export\s+{([\s\S]+?)}/g);
        if (reexpostList) {
            for (let reexport of reexpostList) {
                let namespace = getNamespaceByIndex(reexport.index);
                if (namespace) {
                    let exports = reexport[1].split(',');
                    let expDeclares: DtsInfo[] = [];
                    for (let exportStr of exports) {
                        exportStr = exportStr.trim();
                        let search = exportStr.match(/^([\w_]+)(\s+as\s+([\w_]+))?$/);
                        if (search) {
                            let sourceName = search[1];
                            let declareName = search[3] || sourceName;
                            let info = new DtsInfo(namespace, declareName, DtsInfo.TYPE.REXPORT, '', declares, true);
                            info.finish(exportStr);
                            declares.push(info);
                            expDeclares.push(info);
                        }
                    }

                    if(expDeclares.length === 1) {
                        let first = expDeclares[0];
                        first.declareSource = '    export { ' + first.preSource + ' }';
                        first.preSource = '';
                    } else if (expDeclares.length) {
                        expDeclares.forEach((info, index) => {
                            info.id = 'zzz' + index + '_' + info.id;
                            info.declareSource = '        ' + info.preSource + ',';
                            info.preSource = '';
                        });
                        let first = expDeclares[0];
                        first.declareSource = '    export {\n' + first.declareSource;
                        let last = expDeclares[expDeclares.length - 1];
                        last.declareSource += '\n    }';
                    }
                }
            }
        }
    }

    private isCommentLine(trimedLine: string): boolean {
        return trimedLine.startsWith('/*') || trimedLine.startsWith('*');
    }

    private searchDeclare(namespace: string, line: string, declares: Array<DtsInfo>): DtsInfo {
        var lineStart: number, start: number, end: number;
        lineStart = start = line.indexOf(this.searchInterface);
        if (start !== -1) {
            start += this.searchInterface.length;
            end = line.lastIndexOf(this.searchExtends, start);
            if (end === -1) {
                end = line.indexOf(this.searchExtendsEnd);
            }
            return new DtsInfo(namespace, line.substr(start, end - start), DtsInfo.TYPE.INTERFACE, line.substr(0, lineStart) + "}", declares, false);
        }
        lineStart = start = line.indexOf(this.searchClass);
        if (start !== -1) {
            start += this.searchClass.length;
            end = line.lastIndexOf(this.searchExtends, start);
            if (end === -1) {
                end = line.indexOf(this.searchImplements);
            }
            if (end === -1) {
                end = line.indexOf(this.searchExtendsEnd);
            }
            return new DtsInfo(namespace, line.substr(start, end - start), DtsInfo.TYPE.CLASS, line.substr(0, lineStart) + "}", declares, false);
        }
        lineStart = start = line.indexOf(this.searchConst);
        if (start !== -1) {
            let oneLine: boolean = true;
            start += this.searchConst.length;
            end = line.indexOf(this.searchTypeEnd);
            if (end === -1) {
                end = line.indexOf(this.searchTypeEnd2);
                oneLine = false;
            }
            return new DtsInfo(namespace, line.substr(start, end - start), DtsInfo.TYPE.CONST, line.substr(0, lineStart) + "};", declares, oneLine);
        }
        lineStart = start = line.indexOf(this.searchVar);
        if (start !== -1) {
            let oneLine: boolean = true;
            start += this.searchVar.length;
            end = line.indexOf(this.searchTypeEnd);
            if (end === -1) {
                end = line.indexOf(this.searchTypeEnd2);
                oneLine = false;
            }
            return new DtsInfo(namespace, line.substr(start, end - start), DtsInfo.TYPE.VAR, line.substr(0, lineStart) + "};", declares, oneLine);
        }
        lineStart = start = line.indexOf(this.searchFunction);
        if (start !== -1) {
            let oneLine: boolean = true;
            start += this.searchFunction.length;
            end = line.indexOf(this.searchTypeEnd);
            if (end === -1) {
                end = line.length;
                oneLine = false;
            }
            return new DtsInfo(namespace, line.substr(start, end - start), DtsInfo.TYPE.FUNCTION, line.substr(0, lineStart) + "}", declares, oneLine);
        }
        lineStart = start = line.indexOf(this.searchEnum);
        if (start !== -1) {
            start += this.searchEnum.length;
            end = line.indexOf(this.searchExtendsEnd);
            return new DtsInfo(namespace, line.substr(start, end - start), DtsInfo.TYPE.ENUM, line.substr(0, lineStart) + "}", declares, false);
        }
        return null;
    }

    private sortFunc(a: DtsInfo, b: DtsInfo): number {
        if (a.id === b.id) {
            return 0;
        }
        return a.id > b.id ? 1 : -1;
    }
}