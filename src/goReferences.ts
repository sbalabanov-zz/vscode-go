/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');
import cp = require('child_process');
import path = require('path');
import {getBinPath} from './goPath'

class ReferenceSupport implements vscode.Modes.IReferenceSupport {

	public findReferences(document: vscode.TextDocument, position:vscode.Position, includeDeclaration:boolean, token: vscode.CancellationToken): Thenable<vscode.Modes.IReference[]> {
		return vscode.workspace.saveAll(false).then(() => {
				return this.doFindReferences(document, position, includeDeclaration, token);
		});
	}

	private doFindReferences(document:vscode.TextDocument, position:vscode.Position, includeDeclaration:boolean, token: vscode.CancellationToken): Thenable<vscode.Modes.IReference[]> {
		return new Promise((resolve, reject) => {
			var filename = this.canonicalizeForWindows(document.getUri().fsPath);
			var cwd = path.dirname(filename)
			var workspaceRoot = vscode.workspace.getPath();

			// get current word
			var wordAtPosition = document.getWordRangeAtPosition(position);

			// compute the file offset for position
			var range = new vscode.Range(0, 0, position.line, position.character);
			var offset = document.getTextInRange(range).length;

			var gofindreferences = getBinPath("go-find-references");

			cp.execFile(gofindreferences, ["-file", filename, "-offset", offset.toString(), "-root", workspaceRoot], {}, (err, stdout, stderr) => {
				try {
					if (err && (<any>err).code == "ENOENT") {
						vscode.window.showInformationMessage("The 'go-find-references' command is not available.  Use 'go get -v github.com/lukehoban/go-find-references' to install.");
						return resolve(null);
					}

					var lines = stdout.toString().split('\n');
					var results: vscode.Modes.IReference[] = [];
					for(var i = 0; i < lines.length; i+=2) {
						var line = lines[i];
						var match = /(.*):(\d+):(\d+)/.exec(lines[i]);
						if(!match) continue;
						var [_, file, lineStr, colStr] = match;
						var referenceResource = vscode.Uri.file(path.resolve(cwd, file));
						var range = new vscode.Range(
							+lineStr, +colStr, +lineStr, +colStr + wordAtPosition.end.character - wordAtPosition.start.character
						);
						results.push({
							resource: referenceResource,
							range
						});
					}
					resolve(results);
				} catch(e) {
					reject(e);
				}
			});
		});
	}

	private canonicalizeForWindows(filename:string):string {
		// convert backslashes to forward slashes on Windows
		// otherwise go-find-references returns no matches
		if (/^[a-z]:\\/.test(filename))
			return filename.replace(/\\/g, '/');
		return filename;
	}

}

export = ReferenceSupport