import * as vscode from 'vscode';
import { PlantUMLService } from '../services/plantUMLService';

export class PlantUMLPreviewProvider implements vscode.WebviewPanelSerializer {
    public static readonly viewType = 'plantumlviewer.preview';

    private static currentPanel: PlantUMLPreviewProvider | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _plantUMLService: PlantUMLService;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, plantUMLService: PlantUMLService) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (PlantUMLPreviewProvider.currentPanel) {
            PlantUMLPreviewProvider.currentPanel._panel.reveal(column);
            PlantUMLPreviewProvider.currentPanel.update();
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            PlantUMLPreviewProvider.viewType,
            'PlantUML Preview',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
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

        // Set the webview's initial html content
        this.update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            (message: any) => {
                switch (message.command) {
                    case 'alert':
                        vscode.window.showErrorMessage(message.text);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any): Promise<void> {
        // Restore the panel
        PlantUMLPreviewProvider.currentPanel = new PlantUMLPreviewProvider(
            webviewPanel, 
            this._extensionUri, 
            this._plantUMLService
        );
    }

    public dispose() {
        PlantUMLPreviewProvider.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    public update() {
        const webview = this._panel.webview;
        this._panel.title = 'PlantUML Preview';
        this._panel.webview.html = this._getHtmlForWebview(webview);
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
                content = '<p>No valid PlantUML diagram found. Make sure your file contains @startuml and @enduml tags.</p>';
            }
        } else {
            content = '<p>Open a PlantUML file (.puml, .plantuml, .pu) to see the preview.</p>';
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
                        padding: 20px;
                        margin: 0;
                    }
                    img {
                        display: block;
                        margin: 0 auto;
                        border: 1px solid var(--vscode-panel-border);
                        background-color: white;
                        padding: 10px;
                        border-radius: 4px;
                    }
                    p {
                        text-align: center;
                        opacity: 0.7;
                    }
                    .error {
                        color: var(--vscode-errorForeground);
                        background-color: var(--vscode-inputValidation-errorBackground);
                        border: 1px solid var(--vscode-inputValidation-errorBorder);
                        padding: 10px;
                        border-radius: 4px;
                        margin: 10px 0;
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
                            const errorDiv = document.createElement('div');
                            errorDiv.className = 'error';
                            errorDiv.textContent = 'Failed to load PlantUML diagram. Please check your diagram syntax or server connection.';
                            this.parentNode.appendChild(errorDiv);
                        };
                    }
                </script>
            </body>
            </html>`;
    }
} 