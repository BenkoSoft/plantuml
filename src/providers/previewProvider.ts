import * as vscode from 'vscode';
import { PlantUMLService } from '../services/plantUMLService';
import panzoom from 'panzoom';

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

        this._panel.onDidChangeViewState(e => {
            if (this._panel.visible) {
                this.update();
            }
        }, null, this._disposables);

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
                        await this._exportWithProgress('Exporting SVG...', async () => {
                            const svgContent = await this._plantUMLService.generateSVG(this._currentContent);
                            const uri = await vscode.window.showSaveDialog({
                                defaultUri: vscode.Uri.file(getDefaultFilename().replace(/\.(puml|plantuml|pu)$/, '.svg')),
                                filters: { 'SVG files': ['svg'] },
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
                        });
                        return;

                    case 'exportPNG':
                        await this._exportWithProgress('Exporting PNG...', async () => {
                            const pngUrl = this._plantUMLService.generatePNGUrl(this._currentContent);
                            const uri = await vscode.window.showSaveDialog({
                                defaultUri: vscode.Uri.file(getDefaultFilename().replace(/\.(puml|plantuml|pu)$/, '.png')),
                                filters: { 'PNG files': ['png'] },
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
                        });
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

        // Get path to panzoom script in media directory
        const panzoomScriptPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'lib', 'panzoom.min.js');
        const panzoomScriptUri = webview.asWebviewUri(panzoomScriptPath);

        if (editor && editor.document.languageId === 'plantuml') {
            const plantUMLCode = editor.document.getText();
            if (this._plantUMLService.isValidPlantUMLCode(plantUMLCode)) {
                imageUrl = this._plantUMLService.generateSVGUrl(plantUMLCode);
                content = `
                    <div class="diagram-container">
                        <div class="spinner">
                            <div class="bounce1"></div>
                            <div class="bounce2"></div>
                            <div class="bounce3"></div>
                        </div>
                        <div class="zoom-controls">
                            <div class="zoom-level">100%</div>
                            <button id="zoomReset" class="reset-button" title="Reset Zoom">Reset View</button>
                        </div>
                        <div class="export-controls">
                            <button id="exportSVG" title="Save as SVG">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M2.5 2.5C2.5 1.94772 2.94772 1.5 3.5 1.5H10.5L13.5 4.5V12.5C13.5 13.0523 13.0523 13.5 12.5 13.5H3.5C2.94772 13.5 2.5 13.0523 2.5 12.5V2.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                                    <path d="M5 8.5H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                                    <path d="M5.5 1.5V5.5H10.5V1.5" stroke="currentColor" stroke-width="1.5"/>
                                </svg>
                                Save SVG
                            </button>
                            <button id="exportPNG" title="Save as PNG">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M2.5 2.5C2.5 1.94772 2.94772 1.5 3.5 1.5H10.5L13.5 4.5V12.5C13.5 13.0523 13.0523 13.5 12.5 13.5H3.5C2.94772 13.5 2.5 13.0523 2.5 12.5V2.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                                    <path d="M5 8.5H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                                    <path d="M5.5 1.5V5.5H10.5V1.5" stroke="currentColor" stroke-width="1.5"/>
                                </svg>
                                Save PNG
                            </button>
                        </div>
                        <div class="diagram-wrapper">
                            <img src="${imageUrl}" alt="PlantUML Diagram">
                        </div>
                    </div>`;
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
                        width: 100vw;
                        height: 100vh;
                        overflow: hidden;
                    }
                    .diagram-container {
                        width: 100%;
                        height: 100%;
                        position: relative;
                        overflow: hidden;
                    }
                    .diagram-wrapper {
                        width: 100%;
                        height: 100%;
                        position: relative;
                        overflow: hidden;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    img {
                        max-width: 100%;
                        max-height: 100%;
                        opacity: 0;
                        transition: opacity 0.3s ease-in-out;
                    }
                    img.loaded {
                        opacity: 1;
                    }
                    .zoom-controls {
                        position: fixed;
                        top: 10px;
                        right: 10px;
                        display: flex;
                        gap: 8px;
                        z-index: 100;
                        background: var(--vscode-editor-background);
                        padding: 4px 8px;
                        border-radius: 4px;
                        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
                    }
                    .zoom-controls .zoom-level {
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        padding: 4px 8px;
                        border-radius: 3px;
                        font-size: 12px;
                        min-width: 60px;
                        height: 28px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        user-select: none;
                    }
                    .zoom-controls .reset-button {
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        border: none;
                        padding: 4px 12px;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 12px;
                        height: 28px;
                        display: flex;
                        align-items: center;
                        white-space: nowrap;
                    }
                    .zoom-controls .reset-button:hover {
                        background: var(--vscode-button-secondaryHoverBackground);
                    }
                    .export-controls {
                        position: fixed;
                        bottom: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        display: flex;
                        gap: 10px;
                        z-index: 100;
                        background: var(--vscode-editor-background);
                        padding: 8px;
                        border-radius: 6px;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                        opacity: 0.8;
                        transition: opacity 0.2s ease-in-out;
                    }
                    .export-controls:hover {
                        opacity: 1;
                    }
                    .export-controls button {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 6px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        min-width: 90px;
                    }
                    .export-controls button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    .export-controls button svg {
                        width: 16px;
                        height: 16px;
                    }
                    .spinner {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        display: flex;
                        gap: 4px;
                    }
                    .spinner > div {
                        width: 12px;
                        height: 12px;
                        background-color: var(--vscode-button-background);
                        border-radius: 100%;
                        display: inline-block;
                        animation: bounce 1.4s infinite ease-in-out both;
                    }
                    .spinner .bounce1 {
                        animation-delay: -0.32s;
                    }
                    .spinner .bounce2 {
                        animation-delay: -0.16s;
                    }
                    @keyframes bounce {
                        0%, 80%, 100% { 
                            transform: scale(0);
                        } 
                        40% { 
                            transform: scale(1.0);
                        }
                    }
                    .error-container {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        text-align: center;
                    }
                    .error-message {
                        color: var(--vscode-errorForeground);
                        font-size: 14px;
                        line-height: 1.6;
                    }
                </style>
                <script src="${panzoomScriptUri}"></script>
            </head>
            <body>
                ${content}
                <script>
                    document.addEventListener('DOMContentLoaded', () => {
                        const vscode = acquireVsCodeApi();
                        const wrapper = document.querySelector('.diagram-wrapper');
                        const img = document.querySelector('img');
                        const zoomLevel = document.querySelector('.zoom-level');

                        if (img) {
                            img.onload = function() {
                                this.classList.add('loaded');
                                const spinner = document.querySelector('.spinner');
                                if (spinner) {
                                    spinner.style.display = 'none';
                                }

                                // Initialize panzoom
                                const instance = window.panzoom(img, {
                                    maxScale: 5,
                                    minScale: 0.1,
                                    zoomSpeed: 0.5, // Much faster zoom speed
                                    smoothScroll: false // Disable smooth scroll for more immediate response
                                });

                                // Update zoom level display
                                function updateZoomLevel(scale) {
                                    zoomLevel.textContent = Math.round(scale * 100) + '%';
                                }

                                // Update zoom level on any transform
                                instance.on('transform', () => {
                                    updateZoomLevel(instance.getTransform().scale);
                                });

                                // Reset button
                                document.getElementById('zoomReset')?.addEventListener('click', () => {
                                    instance.moveTo(0, 0);
                                    instance.zoomAbs(0, 0, 1); // Reset to 100% zoom
                                    updateZoomLevel(1); // Update the display to show 100%
                                });
                            };

                            img.onerror = function() {
                                this.style.display = 'none';
                                const spinner = document.querySelector('.spinner');
                                if (spinner) {
                                    spinner.style.display = 'none';
                                }
                                const errorContainer = document.createElement('div');
                                errorContainer.className = 'error-container';
                                const errorMessage = document.createElement('div');
                                errorMessage.className = 'error-message';
                                errorMessage.innerHTML = 'Failed to load PlantUML diagram.<br>Please check your diagram syntax or server connection.';
                                errorContainer.appendChild(errorMessage);
                                document.body.appendChild(errorContainer);
                            };
                        }

                        // Add export button handlers
                        const exportSVGButton = document.getElementById('exportSVG');
                        const exportPNGButton = document.getElementById('exportPNG');

                        if (exportSVGButton) {
                            exportSVGButton.addEventListener('click', () => {
                                vscode.postMessage({ command: 'exportSVG' });
                            });
                        }

                        if (exportPNGButton) {
                            exportPNGButton.addEventListener('click', () => {
                                vscode.postMessage({ command: 'exportPNG' });
                            });
                        }
                    });
                </script>
            </body>
            </html>`;
    }

    private async _exportWithProgress(title: string, operation: () => Promise<void>): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: title,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });
            try {
                await operation();
                progress.report({ increment: 100 });
            } catch (error) {
                throw error;
            }
        });
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