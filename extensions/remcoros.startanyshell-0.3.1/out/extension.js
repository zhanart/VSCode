'use strict';
var vscode_1 = require('vscode');
var child_process = require('child_process');
var path = require('path');
function activate(context) {
    console.log('StartAnyShell is now active.');
    context.subscriptions.push(vscode_1.commands.registerCommand('startanyshell.startShell', startAnyShell));
}
exports.activate = activate;
function deactivate(context) {
}
exports.deactivate = deactivate;
function startAnyShell() {
    var config = vscode_1.workspace.getConfiguration('startanyshell');
    var editor = vscode_1.window.activeTextEditor;
    var rootPath = vscode_1.workspace.rootPath;
    var alwaysOpenRoot = config.get('openworkspaceroot', true);
    if ((!alwaysOpenRoot || !rootPath) && editor && editor.document && editor.document.uri) {
        rootPath = path.dirname(editor.document.uri.fsPath);
    }
    if (!rootPath || rootPath === '') {
        rootPath = '.';
    }
    var options = { matchOnDescription: false, placeHolder: 'Launch any shell in: ' + rootPath };
    Promise.resolve(vscode_1.window.showQuickPick(getShells(config), options))
        .then(function (item) {
        if (!item) {
            return;
        }
        if (!item.shell) {
            return;
        }
        child_process.exec(formatCommand(item.shell, rootPath), {
            cwd: rootPath
        });
    })
        .catch(function (error) {
        vscode_1.window.showErrorMessage(error.message || error);
    });
}
function getShells(config) {
    var shells = config.get('shells', []);
    return shells.map(function (shell) {
        return { label: shell.description, description: shell.command, shell: shell };
    });
}
function formatCommand(command, rootPath) {
    return command.command
        .replace('%path%', rootPath)
        .replace('%description%', command.description);
    // TODO: add more tokens or eval();
}
//# sourceMappingURL=extension.js.map