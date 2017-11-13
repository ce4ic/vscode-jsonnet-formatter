'use strict';

import * as vscode from 'vscode';
import { JsonnetDocumentFormattingEditProvider } from './format';


export function activate(ctx: vscode.ExtensionContext): void {
  ctx.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('jsonnet', new JsonnetDocumentFormattingEditProvider()));
}

function deactivate() {
}
