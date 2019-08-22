'use strict';

import { Position, Range, TextEdit, Uri, WorkspaceEdit, TextEditorEdit } from 'vscode';
import * as jsDiff from 'diff';

export enum EditTypes { EDIT_DELETE, EDIT_INSERT, EDIT_REPLACE };

export class Edit {
  action: number;
  start: Position;
  end: Position;
  text: string;

  constructor(action: number, start: Position) {
    this.action = action;
    this.start = start;
    this.text = '';
  }

  // Creates TextEdit for current Edit
  apply(): TextEdit {
    switch (this.action) {
      case EditTypes.EDIT_INSERT:
        return TextEdit.insert(this.start, this.text);

      case EditTypes.EDIT_DELETE:
        return TextEdit.delete(new Range(this.start, this.end));

      case EditTypes.EDIT_REPLACE:
        return TextEdit.replace(new Range(this.start, this.end), this.text);
    }
  }

  // Applies Edit using given TextEditorEdit
  applyUsingTextEditorEdit(editBuilder: TextEditorEdit): void {
    switch (this.action) {
      case EditTypes.EDIT_INSERT:
        editBuilder.insert(this.start, this.text);
        break;

      case EditTypes.EDIT_DELETE:
        editBuilder.delete(new Range(this.start, this.end));
        break;

      case EditTypes.EDIT_REPLACE:
        editBuilder.replace(new Range(this.start, this.end), this.text);
        break;
    }
  }

  // Applies Edits to given WorkspaceEdit
  applyUsingWorkspaceEdit(workspaceEdit: WorkspaceEdit, fileUri: Uri): void {
    switch (this.action) {
      case EditTypes.EDIT_INSERT:
        workspaceEdit.insert(fileUri, this.start, this.text);
        break;

      case EditTypes.EDIT_DELETE:
        workspaceEdit.delete(fileUri, new Range(this.start, this.end));
        break;

      case EditTypes.EDIT_REPLACE:
        workspaceEdit.replace(fileUri, new Range(this.start, this.end), this.text);
        break;
    }
  }
}

export interface FilePatch {
  fileName: string;
  edits: Edit[];
}

/**
 * Uses diff module to parse given array of ParsedDiff objects and returns edits for files
 *
 * @param diffOutput jsDiff.ParsedDiff[]
 *
 * @returns Array of FilePatch objects, one for each file
 */
function parseUniDiffs(diffOutput: jsDiff.ParsedDiff[]): FilePatch[] {
  let filePatches: FilePatch[] = [];
  diffOutput.forEach((uniDiff: jsDiff.ParsedDiff) => {
    let edit: Edit = null;
    let edits: Edit[] = [];
    uniDiff.hunks.forEach((hunk: jsDiff.Hunk) => {
      let startLine = hunk.oldStart;
      hunk.lines.forEach((line) => {
        switch (line.substr(0, 1)) {
          case '-':
            if (edit == null) {
              edit = new Edit(EditTypes.EDIT_DELETE, new Position(startLine - 1, 0));
            }
            edit.end = new Position(startLine, 0);
            startLine++;
            break;
          case '+':
            if (edit == null) {
              edit = new Edit(EditTypes.EDIT_INSERT, new Position(startLine - 1, 0));
            } else if (edit.action === EditTypes.EDIT_DELETE) {
              edit.action = EditTypes.EDIT_REPLACE;
            }
            edit.text += line.substr(1) + '\n';
            break;
          case ' ':
            startLine++;
            if (edit != null) {
              edits.push(edit);
            }
            edit = null;
            break;
        }
      });
      if (edit != null) {
        edits.push(edit);
      }
    });

    let fileName = uniDiff.oldFileName;
    filePatches.push({ fileName, edits });
  });

  return filePatches;

}

/**
 * Returns a FilePatch object by generating diffs between given oldStr and newStr using the diff module
 *
 * @param fileName string: Name of the file to which edits should be applied
 * @param oldStr string
 * @param newStr string
 *
 * @returns A single FilePatch object
 */
export function getEdits(fileName: string, oldStr: string, newStr: string): FilePatch {
  if (process.platform === 'win32') {
    oldStr = oldStr.split('\r\n').join('\n');
    newStr = newStr.split('\r\n').join('\n');
  }
  let unifiedDiffs = jsDiff.structuredPatch(fileName, fileName, oldStr, newStr, '', '');
  let filePatches: FilePatch[] = parseUniDiffs([unifiedDiffs]);
  return filePatches[0];
}
