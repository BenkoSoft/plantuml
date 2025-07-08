import * as vscode from 'vscode';
import * as plantumlEncoder from 'plantuml-encoder';

export class PlantUMLService {
    private readonly serverUrl: string;

    constructor() {
        this.serverUrl = vscode.workspace.getConfiguration('plantumlviewer').get('server', 'https://www.plantuml.com/plantuml');
    }

    public isValidPlantUMLCode(code: string): boolean {
        return code.includes('@startuml') && code.includes('@enduml');
    }

    public generateSVGUrl(code: string): string {
        const encoded = plantumlEncoder.encode(code);
        return `${this.serverUrl}/svg/${encoded}`;
    }

    public generatePNGUrl(code: string): string {
        const encoded = plantumlEncoder.encode(code);
        return `${this.serverUrl}/png/${encoded}`;
    }

    public async generateSVG(code: string): Promise<string> {
        const url = this.generateSVGUrl(code);
        const response = await fetch(url);
        return await response.text();
    }
} 