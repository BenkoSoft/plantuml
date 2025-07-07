import * as vscode from 'vscode';
import { PlantUMLService } from '../services/plantUMLService';
import fetch from 'node-fetch';

export class PlantUMLPreviewProvider implements vscode.WebviewPanelSerializer {
    public static readonly viewType = 'plantumlviewer.preview';

    private static currentPanel: PlantUMLPreviewProvider | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _plantUMLService: PlantUMLService;
    private _disposables: vscode.Disposable[] = [];
    private _currentContent: string = '';

    public static createOrShow(extensionUri: vscode.Uri, plantUMLService: PlantUMLService) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (PlantUMLPreviewProvider.currentPanel) {
            PlantUMLPreviewProvider.currentPanel._panel.reveal(column);
            PlantUMLPreviewProvider.currentPanel.update();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            PlantUMLPreviewProvider.viewType,
            'PlantUML Preview',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        PlantUMLPreviewProvider.currentPanel = new PlantUMLPreviewProvider(panel, extensionUri, plantUMLService);
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, plantUMLService: PlantUMLService) {
        PlantUMLPreviewProvider.currentPanel = new PlantUMLPreviewProvider(panel, extensionUri, plantUMLService);
    }

    public static updateCurrent() {
        if (PlantUMLPreviewProvider.currentPanel) {
            PlantUMLPreviewProvider.currentPanel.update();
        }
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, plantUMLService: PlantUMLService) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._plantUMLService = plantUMLService;

        this.update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Update content when the panel is revealed
        this._panel.onDidChangeViewState(e => {
            if (this._panel.visible) {
                this.update();
            }
        }, null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message: any) => {
                if (!this._currentContent || !this._plantUMLService.isValidPlantUMLCode(this._currentContent)) {
                    vscode.window.showWarningMessage('No valid PlantUML diagram is currently being previewed.');
                    return;
                }

                const getDefaultFilename = () => {
                    const editor = vscode.window.activeTextEditor;
                    if (editor && editor.document.languageId === 'plantuml') {
                        return editor.document.fileName;
                    }
                    return 'diagram';
                };

                switch (message.command) {
                    case 'exportSVG':
                        try {
                            const svgContent = await this._plantUMLService.generateSVG(this._currentContent);
                            const uri = await vscode.window.showSaveDialog({
                                defaultUri: vscode.Uri.file(getDefaultFilename().replace(/\.(puml|plantuml|pu)$/, '.svg')),
                                filters: {
                                    'SVG files': ['svg']
                                },
                                title: 'Save PlantUML diagram as SVG'
                            });
                            if (uri) {
                                await vscode.workspace.fs.writeFile(uri, Buffer.from(svgContent));
                                vscode.window.showInformationMessage('SVG exported successfully!', 'Open File').then(selection => {
                                    if (selection === 'Open File') {
                                        vscode.commands.executeCommand('vscode.open', uri);
                                    }
                                });
                            }
                        } catch (error) {
                            vscode.window.showErrorMessage(`Failed to export SVG: ${error}`);
                        }
                        return;
                    case 'exportPNG':
                        try {
                            const pngUrl = this._plantUMLService.generatePNGUrl(this._currentContent);
                            const uri = await vscode.window.showSaveDialog({
                                defaultUri: vscode.Uri.file(getDefaultFilename().replace(/\.(puml|plantuml|pu)$/, '.png')),
                                filters: {
                                    'PNG files': ['png']
                                },
                                title: 'Save PlantUML diagram as PNG'
                            });
                            if (uri) {
                                const response = await fetch(pngUrl);
                                const arrayBuffer = await response.arrayBuffer();
                                await vscode.workspace.fs.writeFile(uri, new Uint8Array(arrayBuffer));
                                vscode.window.showInformationMessage('PNG exported successfully!', 'Open File').then(selection => {
                                    if (selection === 'Open File') {
                                        vscode.commands.executeCommand('vscode.open', uri);
                                    }
                                });
                            }
                        } catch (error) {
                            vscode.window.showErrorMessage(`Failed to export PNG: ${error}`);
                        }
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public update() {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'plantuml') {
            this._currentContent = editor.document.getText();
        }
        this._updateWebview();
    }

    private _updateWebview() {
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const editor = vscode.window.activeTextEditor;
        let content = '';
        let imageUrl = '';

        if (editor && editor.document.languageId === 'plantuml') {
            const plantUMLCode = editor.document.getText();
            if (this._plantUMLService.isValidPlantUMLCode(plantUMLCode)) {
                imageUrl = this._plantUMLService.generateSVGUrl(plantUMLCode);
                content = `<img src="${imageUrl}" alt="PlantUML Diagram" style="max-width: 100%; height: auto;">`;
            } else {
                content = `
                    <div class="error-container">
                        <div class="error-message">
                            No valid PlantUML diagram found.<br>
                            Make sure your file contains @startuml and @enduml tags.
                        </div>
                    </div>`;
            }
        } else {
            content = `
                <div class="error-container">
                    <div class="error-message">
                        Open a PlantUML file (.puml, .plantuml, .pu) to see the preview.
                    </div>
                </div>`;
        }

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>PlantUML Preview</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 0;
                        margin: 0;
                        display: flex;
                        flex-direction: column;
                        min-height: 100vh;
                    }
                    img {
                        display: block;
                        margin: 0 auto;
                        border: 1px solid var(--vscode-panel-border);
                        background-color: white;
                        padding: 10px;
                        border-radius: 4px;
                    }
                    .error-container {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex: 1;
                        min-height: 100vh;
                        padding: 20px;
                    }
                    .error-message {
                        text-align: center;
                        opacity: 0.7;
                        padding: 20px;
                        border: 1px solid var(--vscode-inputValidation-infoBackground);
                        border-radius: 6px;
                        background-color: var(--vscode-editor-background);
                        line-height: 1.6;
                    }
                </style>
            </head>
            <body>
                ${content}
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    // Handle image load errors
                    const img = document.querySelector('img');
                    if (img) {
                        img.onerror = function() {
                            this.style.display = 'none';
                            const errorContainer = document.createElement('div');
                            errorContainer.className = 'error-container';
                            const errorMessage = document.createElement('div');
                            errorMessage.className = 'error-message';
                            errorMessage.innerHTML = 'Failed to load PlantUML diagram.<br>Please check your diagram syntax or server connection.';
                            errorContainer.appendChild(errorMessage);
                            document.body.appendChild(errorContainer);
                        };
                    }
                </script>
            </body>
            </html>`;
    }

    public dispose() {
        PlantUMLPreviewProvider.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    public async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any): Promise<void> {
        PlantUMLPreviewProvider.currentPanel = new PlantUMLPreviewProvider(
            webviewPanel,
            this._extensionUri,
            this._plantUMLService
        );
    }
} 