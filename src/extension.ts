import * as vscode from 'vscode';
import { PlantUMLPreviewProvider } from './providers/previewProvider';
import { PlantUMLService } from './services/plantUMLService';

export function activate(context: vscode.ExtensionContext) {
    try {
        const plantUMLService = new PlantUMLService();

        // Register the preview provider
        context.subscriptions.push(
            vscode.window.registerWebviewPanelSerializer(PlantUMLPreviewProvider.viewType, {
                async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
                    PlantUMLPreviewProvider.revive(webviewPanel, context.extensionUri, plantUMLService);
                }
            })
        );

        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand('plantumlviewer.preview', () => {
                try {
                    PlantUMLPreviewProvider.createOrShow(context.extensionUri, plantUMLService);
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to open PlantUML preview: ${error}`);
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('plantumlviewer.exportSVG', async () => {
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document.languageId === 'plantuml') {
                    try {
                        const svgContent = await plantUMLService.generateSVG(editor.document.getText());
                        const uri = await vscode.window.showSaveDialog({
                            filters: {
                                'SVG files': ['svg']
                            }
                        });
                        if (uri) {
                            await vscode.workspace.fs.writeFile(uri, Buffer.from(svgContent));
                            const openFileAction = 'Open File';
                            const showInFolderAction = 'Show in Folder';
                            const result = await vscode.window.showInformationMessage(
                                'SVG exported successfully!',
                                { modal: false, detail: uri.fsPath },
                                openFileAction,
                                showInFolderAction
                            );
                            if (result === openFileAction) {
                                await vscode.commands.executeCommand('vscode.open', uri);
                            } else if (result === showInFolderAction) {
                                await vscode.commands.executeCommand('revealFileInOS', uri);
                            }
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to export SVG: ${error}`);
                    }
                } else {
                    vscode.window.showWarningMessage('Please open a PlantUML file to export.');
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('plantumlviewer.exportPNG', async () => {
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document.languageId === 'plantuml') {
                    try {
                        const pngUrl = plantUMLService.generatePNGUrl(editor.document.getText());
                        const uri = await vscode.window.showSaveDialog({
                            filters: {
                                'PNG files': ['png']
                            }
                        });
                        if (uri) {
                            const response = await fetch(pngUrl);
                            const arrayBuffer = await response.arrayBuffer();
                            const buffer = Buffer.from(arrayBuffer);
                            await vscode.workspace.fs.writeFile(uri, buffer);
                            const openFileAction = 'Open File';
                            const showInFolderAction = 'Show in Folder';
                            const result = await vscode.window.showInformationMessage(
                                'PNG exported successfully!',
                                { modal: false, detail: uri.fsPath },
                                openFileAction,
                                showInFolderAction
                            );
                            if (result === openFileAction) {
                                vscode.env.openExternal(vscode.Uri.file(uri.fsPath));
                            } else if (result === showInFolderAction) {
                                await vscode.commands.executeCommand('revealFileInOS', uri);
                            }
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to export PNG: ${error}`);
                    }
                } else {
                    vscode.window.showWarningMessage('Please open a PlantUML file to export.');
                }
            })
        );

        // Update preview when document changes
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
                if (e.document.languageId === 'plantuml') {
                    PlantUMLPreviewProvider.updateCurrent();
                }
            })
        );

        // Update preview when active editor changes
        context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor(() => {
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document.languageId === 'plantuml') {
                    PlantUMLPreviewProvider.updateCurrent();
                }
            })
        );
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to activate PlantUML extension: ${error}`);
    }
}

export function deactivate() {} 