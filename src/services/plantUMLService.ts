import * as vscode from 'vscode';
import fetch from 'node-fetch';
import * as plantumlEncoder from 'plantuml-encoder';
import * as https from 'https';

export class PlantUMLService {
    private readonly serverUrl: string;

    constructor(serverUrl: string = 'https://www.plantuml.com/plantuml') {
        this.serverUrl = serverUrl;
    }

    public generateImageUrl(plantUMLCode: string, format: 'svg' | 'png' = 'svg'): string {
        const encoded = plantumlEncoder.encode(plantUMLCode);
        return `${this.serverUrl}/${format}/${encoded}`;
    }

    public generateSVGUrl(plantUMLCode: string): string {
        const encoded = plantumlEncoder.encode(plantUMLCode);
        return `${this.serverUrl}/svg/${encoded}`;
    }

    public generatePNGUrl(plantUMLCode: string): string {
        const encoded = plantumlEncoder.encode(plantUMLCode);
        return `${this.serverUrl}/png/${encoded}`;
    }

    public async generateSVG(plantUMLCode: string): Promise<string> {
        const url = this.generateSVGUrl(plantUMLCode);
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve(data));
                res.on('error', (err) => reject(err));
            }).on('error', (err) => reject(err));
        });
    }

    public isValidPlantUMLCode(plantUMLCode: string): boolean {
        return plantUMLCode.includes('@startuml') && plantUMLCode.includes('@enduml');
    }
} 