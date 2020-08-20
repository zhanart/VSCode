'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode_1 = require("vscode");
const events_1 = require("events");
const Repl = require("repl");
const Path = require("path");
const Fs = require("fs");
const stream_1 = require("stream");
let replExt;
let outputWindow = vscode_1.window.createOutputChannel("NodeJs REPL");
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    context.subscriptions.push(vscode_1.commands.registerCommand('extension.nodejsRepl', () => __awaiter(this, void 0, void 0, function* () {
        try {
            if (!replExt || replExt.disposed)
                replExt = new ReplExtension();
            yield replExt.close();
            yield replExt.showEditor();
            return;
        }
        catch (err) {
            outputWindow.appendLine(err);
        }
    })));
    context.subscriptions.push(vscode_1.commands.registerCommand('extension.nodejsReplCurrent', () => __awaiter(this, void 0, void 0, function* () {
        try {
            if (!replExt || replExt.disposed)
                replExt = new ReplExtension();
            yield replExt.close();
            yield replExt.openDocument(true);
            yield replExt.showEditor();
            yield replExt.interpret();
            return;
        }
        catch (err) {
            outputWindow.appendLine(err);
        }
    })));
    context.subscriptions.push(vscode_1.commands.registerCommand('extension.nodejsReplClose', () => __awaiter(this, void 0, void 0, function* () {
        try {
            if (replExt && !replExt.disposed) {
                yield replExt.close();
                replExt.dispose();
            }
        }
        catch (err) {
            outputWindow.appendLine(err);
        }
    })));
    (() => __awaiter(this, void 0, void 0, function* () {
        try {
            for (let document of vscode_1.workspace.textDocuments) {
                if (document.fileName.indexOf('Untitled-') >= 0 && document.languageId == 'javascript') {
                    if (!replExt || replExt.disposed)
                        replExt = new ReplExtension();
                    yield replExt.showEditor(document);
                    yield replExt.interpret();
                    break;
                }
            }
        }
        catch (err) {
            outputWindow.appendLine(err);
        }
    }))();
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() {
    replExt.dispose();
    outputWindow.dispose();
}
exports.deactivate = deactivate;
class ReplExtension {
    constructor() {
        this.interpretTimer = null;
        // create a decorator type that we use to decorate small numbers
        this.resultDecorationType = vscode_1.window.createTextEditorDecorationType({
            rangeBehavior: vscode_1.DecorationRangeBehavior.ClosedClosed,
            light: {},
            dark: {}
        });
        this.resultDecorators = new Map();
        this.init();
    }
    get disposed() {
        return this.repl == null;
    }
    dispose() {
        if (outputWindow)
            outputWindow.appendLine(`Disposing REPL extension`);
        this.changeActiveDisposable.dispose();
        this.changeEventDisposable.dispose();
        this.repl = null;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            outputWindow.appendLine(`Initializing REPL extension with Node ${process.version}`);
            outputWindow.appendLine(`  Warning; Be careful with CRUD operations since the code is running multiple times in REPL.`);
            this.changeActiveDisposable = vscode_1.window.onDidChangeActiveTextEditor((editor) => __awaiter(this, void 0, void 0, function* () {
                if (this.editor && this.editor.document === editor.document) {
                    this.interpret();
                }
            }));
            vscode_1.workspace.onDidCloseTextDocument((document) => __awaiter(this, void 0, void 0, function* () {
                if (this.editor && this.editor.document == document)
                    this.dispose();
            }));
            this.changeEventDisposable = vscode_1.workspace.onDidChangeTextDocument((event) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (!this.editor || this.editor.document !== event.document) {
                        return;
                    }
                    let change = event.contentChanges[0], text = change.text;
                    if (/\n/.test(text) == false && change.range.isSingleLine == true)
                        this.editor.setDecorations(this.resultDecorationType, Array.from(this.resultDecorators.values()).filter(d => {
                            return this.editor.selection.active.line != d.range.start.line;
                        }));
                    if (this.interpretTimer)
                        clearTimeout(this.interpretTimer);
                    if (text.indexOf(';') >= 0 || text.indexOf('\n') >= 0 || (text == '' && change.range.isSingleLine == false)) {
                        yield this.interpret();
                    }
                    else {
                        this.interpretTimer = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                            yield this.interpret();
                        }), 2000);
                    }
                }
                catch (err) {
                    outputWindow.appendLine(err);
                }
            }));
        });
    }
    interpret() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.showEditor();
                let code = this.editor.document.getText();
                this.resultDecorators.clear();
                new NodeRepl()
                    .on('exit', () => {
                    if (this.resultDecorators.size == 0)
                        this.editor.setDecorations(this.resultDecorationType, []);
                })
                    .on('output', (result) => {
                    let decorator, color;
                    switch (result.type) {
                        case 'result':
                            color = 'green';
                            break;
                        case 'error':
                            color = 'red';
                            break;
                        case 'console':
                            color = '#457abb';
                            break;
                    }
                    if ((decorator = this.resultDecorators.get(result.line)) == null) {
                        let length = this.getTextAtLine(result.line - 1).length, startPos = new vscode_1.Position(result.line - 1, length + 1), endPos = new vscode_1.Position(result.line - 1, length + 1);
                        this.resultDecorators.set(result.line, decorator = { renderOptions: { before: { margin: '0 0 0 1em', contentText: '', color: color } }, range: new vscode_1.Range(startPos, endPos) });
                    }
                    decorator.renderOptions.before.color = color;
                    decorator.renderOptions.before.contentText = ` ${result.text}`;
                    decorator.hoverMessage = new vscode_1.MarkdownString(result.type.slice(0, 1).toUpperCase() + result.type.slice(1));
                    decorator.hoverMessage.appendCodeblock(result.value || result.text, "javascript");
                    this.editor.setDecorations(this.resultDecorationType, Array.from(this.resultDecorators.values()));
                })
                    .interpret(code);
            }
            catch (ex) {
                outputWindow.appendLine(ex);
                return false;
            }
            return true;
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            this.document = null;
        });
    }
    show() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.showEditor();
        });
    }
    openDocument(currentWindow = false) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.document == null || this.document.isClosed == true) {
                if (currentWindow && vscode_1.window.activeTextEditor) {
                    if (vscode_1.window.activeTextEditor.document.languageId == 'javascript') {
                        return this.document = vscode_1.window.activeTextEditor.document;
                    }
                    else {
                        vscode_1.window.showErrorMessage('Selected document is not Javascript, unable to start REPL here');
                        return null;
                    }
                }
                this.document = yield vscode_1.workspace.openTextDocument({ content: '', language: 'javascript' });
            }
            return this.document;
        });
    }
    showEditor(document = undefined) {
        return __awaiter(this, void 0, void 0, function* () {
            if (document)
                this.document = document;
            this.editor = yield vscode_1.window.showTextDocument(this.document || (yield this.openDocument()), vscode_1.ViewColumn.Active);
            return this.editor;
        });
    }
    getTextAtLine(line) {
        let startPos = new vscode_1.Position(line, 0), endPos = new vscode_1.Position(line, 37768);
        return this.editor.document.getText(new vscode_1.Range(startPos, endPos));
    }
}
class NodeRepl extends events_1.EventEmitter {
    constructor() {
        super();
        this.output = new Map();
        if (vscode_1.workspace && Array.isArray(vscode_1.workspace.workspaceFolders)) {
            let doc = vscode_1.window.activeTextEditor.document;
            this.basePath = (doc.isUntitled)
                ? vscode_1.workspace.workspaceFolders[0].uri.fsPath
                : vscode_1.workspace.getWorkspaceFolder(vscode_1.Uri.file(doc.fileName)).uri.fsPath;
            outputWindow.appendLine(`[${new Date().toLocaleTimeString()}] working at: ${this.basePath}`);
        }
    }
    interpret(code) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                outputWindow.appendLine(`[${new Date().toLocaleTimeString()}] starting to interpret ${code.length} bytes of code`);
                let inputStream = new stream_1.Readable({
                    read: () => { }
                }), lineCount = 0, outputCount = 0, requireIdx = 0;
                this.output.clear(); // new interpretation, clear all outputs
                inputStream.push("");
                let repl = Repl.start({
                    prompt: '',
                    input: inputStream,
                    output: new stream_1.Writable({
                        write: (chunk, enc, cb) => {
                            let out = chunk.toString().trim();
                            switch (out) {
                                case 'undefined':
                                case '...':
                                case '':
                                    break;
                                default:
                                    let match;
                                    if ((match = /(?:Thrown:\n)\[?(\w+:\s.*)/gi.exec(out)) != null) {
                                        this.output.set(lineCount, { line: lineCount, type: 'error', text: match[1], value: match[1] });
                                        this.emit('output', { line: lineCount, type: 'error', text: match[1], value: match[1] });
                                        outputWindow.appendLine(`  ${match[1]}\n\tat line ${lineCount}`);
                                    }
                                    else if ((match = /(\w+:\s.*)\n\s*at\s/gi.exec(out)) != null) {
                                        this.output.set(lineCount, { line: lineCount, type: 'error', text: match[1], value: match[1] });
                                        this.emit('output', { line: lineCount, type: 'error', text: match[1], value: match[1] });
                                        outputWindow.appendLine(`  ${match[1]}\n\tat line ${lineCount}`);
                                    }
                                    else if ((match = /`\{(\d+)\}`([\s\S]*)/gi.exec(out)) != null) {
                                        let output = this.output.get(Number(match[1]));
                                        if (output == null)
                                            this.output.set(Number(match[1]), output = { line: Number(match[1]), type: 'console', text: '', value: [] });
                                        output.text += (output.text == '' ? '' : ', ') + (match[2] || '').replace(/\r\n|\n/g, ' ');
                                        output.value.push(match[2]);
                                        this.emit('output', output);
                                        outputWindow.appendLine(`  ${match[2]}`);
                                    }
                                    else {
                                        outputWindow.appendLine(`  ${out}`);
                                    }
                                    break;
                            }
                            cb();
                        }
                    }),
                });
                if (this.replEval == null)
                    this.replEval = repl.eval; // keep a backup of original eval
                // nice place to read the result in sequence and inject it in the code
                repl.eval = (cmd, context, filename, cb) => {
                    lineCount++;
                    this.replEval(cmd, context, filename, (err, result) => {
                        let regex = /\/\*`(\d+)`\*\//gi, match;
                        if (!err) {
                            while ((match = regex.exec(cmd)) != null)
                                lineCount += Number(match[1]);
                            let currentLine = lineCount;
                            this.formatOutput(result) // we can't await this since callback of eval needs to be called synchronious
                                .then(output => {
                                if (output) {
                                    this.output.set(currentLine, { line: currentLine, type: output.type, text: output.text, value: output.value });
                                    this.emit('output', { line: currentLine, type: output.type, text: `${output.text}`, value: output.value });
                                    if (output.type == 'error')
                                        outputWindow.appendLine(`  ${err.name}: ${err.message}\n\tat line ${currentLine}`);
                                }
                            });
                        }
                        cb(err, result);
                    });
                };
                Object.defineProperty(repl.context, '_console', {
                    value: (line) => {
                        let _log = (text, ...args) => {
                            repl.context.console.log(`\`{${line}}\`${(this.serialize(text) || '').replace(/\r\n|\n/g, ' ').replace(/\s{2}/g, '')}`, ...args);
                        };
                        return Object.assign({}, repl.context.console, {
                            log: _log,
                            warn: _log,
                            error: _log
                        });
                    }
                });
                code = this.rewriteImport(code);
                code = this.rewriteRequire(code);
                code = this.rewriteConsole(code);
                code = this.rewriteMethod(code);
                //inputStream.push(`require("${Path.join(this.basePath, "node_modules", "ts-node").replace(/\\/g, '\\\\')}").register({});\n`)
                for (let line of code.split(/\r\n|\n/)) {
                    inputStream.push(`${line}\n`); // tell the REPL about the line of code to see if there is any result coming out of it
                }
                inputStream.push(`.exit\n`);
                inputStream.push(null);
                repl.on('exit', () => {
                    setTimeout(() => this.emit('exit'), 100);
                });
            }
            catch (ex) {
                outputWindow.appendLine(ex);
            }
        });
    }
    formatOutput(result) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (typeof (result)) {
                case 'undefined':
                    break;
                case 'object':
                    if (result.constructor && result.constructor.name == 'Promise' && result.then) {
                        try {
                            let ret = yield Promise.resolve(result);
                            return this.formatOutput(ret);
                        }
                        catch (ex) {
                            return {
                                type: 'error',
                                text: `${ex.name}: ${ex.message}`,
                                value: ex
                            };
                        }
                    }
                    let text = this.serialize(result);
                    return {
                        type: 'result',
                        text: text.replace(/\r\n|\n/g, ' ').replace(/\s{2}/g, ''),
                        value: text
                    };
                default:
                    return {
                        type: 'result',
                        text: result.toString().replace(/(\r\n|\n)/g, ' '),
                        value: result
                    };
            }
        });
    }
    serialize(value, indent = 0, stack = []) {
        const injectSpaces = (indent, spaces) => {
            let ret = '';
            if (indent >= 0) {
                for (let i = 0; i < (indent + spaces); i++)
                    ret += ' ';
            }
            return ret;
        };
        if (value === null)
            return null;
        try {
            switch (typeof value) {
                case 'string':
                    return `"${value.toString()}"`;
                case 'number':
                case 'boolean':
                    return value.toString();
                case 'undefined':
                    return 'undefined';
                case 'function':
                    return `[Function: ${value.name}]`;
                case 'object':
                    if (value == null)
                        return 'null';
                    if (Array.isArray(value))
                        return `[\n${injectSpaces(indent, 2)}${Array.from(value).map(value => this.serialize(value, indent > -1 ? indent + 2 : indent, stack)).join(`,\n${injectSpaces(indent, 2)}`)}\n${injectSpaces(indent, 0)}]`;
                    if (stack.includes(value))
                        return '[circular reference]';
                    stack.push(value);
                    let ret = `{\n`, num = 0;
                    for (let key of Object.keys(value)) {
                        ret += `${injectSpaces(indent, 4)}${key}: ${this.serialize(value[key], indent > -1 ? indent + 4 : indent, stack)},\n`;
                        num++;
                    }
                    ret += `${injectSpaces(indent, 0)}}`;
                    if (num == 0)
                        return value.toString();
                    return ret;
                default:
                    return value.toString();
            }
        }
        catch (ex) {
            return null;
        }
    }
    rewriteImport(code) {
        let regex = /import\s*(?:(\*\s+as\s)?([\w-_]+),?)?\s*(?:\{([^\}]+)\})?\s+from\s+["']([^"']+)["']/gi, match;
        return code.replace(regex, (str, wildcard, module, modules, from) => {
            let rewrite = '', path;
            if (module)
                rewrite += `${rewrite == '' ? '' : ', '}default: ${module} `;
            if (modules)
                rewrite += `${rewrite == '' ? '' : ', '}${modules
                    .split(',')
                    .map(r => r.replace(/\s*([\w-_]+)(?:\s+as\s+([\w-_]))?\s*/gi, (str, moduleName, moduleNewName) => {
                    return `${moduleNewName ? `${moduleNewName.trim()}: ` : ``}${moduleName.trim()}`;
                }))
                    .join(', ')}`;
            return `const ${wildcard ? module : `{ ${rewrite} }`} = require('${from}')`;
        });
    }
    rewriteRequire(code) {
        let regex = /require\s*\(\s*(['"])([A-Z0-9_~\-\\\/\.]+)\s*\1\)/gi, match;
        return code.replace(regex, (str, par, name) => {
            let doc = vscode_1.window.activeTextEditor.document, local = name && name.trim().indexOf('.') == 0 || false, path = '';
            if (local) {
                let dirname = Path.dirname(doc.fileName);
                path = Path.join(dirname == '.' ? this.basePath : dirname, name);
            }
            else {
                if (Fs.existsSync(path = Path.join(this.basePath, 'node_modules', name)) == false)
                    path = name;
            }
            return `require('${path.replace(/\\/g, '\\\\')}')`;
        });
    }
    rewriteConsole(code) {
        let num = 0, out = [];
        for (let line of code.split(/\r\n|\n/)) {
            out.push(line.replace(/console/g, `_console(${++num})`));
        }
        return out.join('\n');
    }
    rewriteMethod(code) {
        let regex = /([\n\s]+)\./gi, match;
        return code.replace(regex, (str, whitespace) => {
            return `/*\`${whitespace.split(/\r\n|\n/).length - 1}\`*/.`;
        });
    }
    isRecoverableError(error) {
        if (error.name === 'SyntaxError') {
            return /^(Unexpected end of input|Unexpected token)/.test(error.message);
        }
        return false;
    }
}
//# sourceMappingURL=extension.js.map