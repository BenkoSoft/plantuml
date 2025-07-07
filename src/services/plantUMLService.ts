import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { encode } from 'plantuml-encoder';

export class PlantUMLService {
    private getServerUrl(): string {
        const config = vscode.workspace.getConfiguration('plantumlviewer');
        return config.get<string>('server') || 'https://www.plantuml.com/plantuml';
    }

    public generateImageUrl(plantUMLCode: string, format: 'svg' | 'png' = 'svg'): string {
        const encoded = encode(plantUMLCode);
        const serverUrl = this.getServerUrl();
        return `${serverUrl}/${format}/${encoded}`;
    }

    public generateSVGUrl(plantUMLCode: string): string {
        return this.generateImageUrl(plantUMLCode, 'svg');
    }

    public generatePNGUrl(plantUMLCode: string): string {
        return this.generateImageUrl(plantUMLCode, 'png');
    }

    public async generateSVG(plantUMLCode: string): Promise<string> {
        const url = this.generateSVGUrl(plantUMLCode);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.text();
        } catch (error) {
            throw new Error(`Failed to generate SVG: ${error}`);
        }
    }

    public isValidPlantUMLCode(code: string): boolean {
        const trimmedCode = code.trim();
        return trimmedCode.includes('@startuml') && trimmedCode.includes('@enduml');
    }
} 