declare module 'panzoom' {
    interface PanZoomOptions {
        bounds?: boolean;
        boundsPadding?: number;
        minZoom?: number;
        maxZoom?: number;
        smoothScroll?: boolean;
        zoomDoubleClickSpeed?: number;
        beforeWheel?: (e: WheelEvent) => boolean;
        beforeMouseDown?: (e: MouseEvent) => boolean;
    }

    interface Transform {
        x: number;
        y: number;
        scale: number;
    }

    interface PanZoomInstance {
        dispose: () => void;
        getTransform: () => Transform;
        moveTo: (x: number, y: number) => void;
        smoothZoom: (clientX: number, clientY: number, scale: number) => void;
        on: (eventName: string, callback: (e: PanZoomInstance) => void) => void;
    }

    function panzoom(element: HTMLElement, options?: PanZoomOptions): PanZoomInstance;
    export = panzoom;
} 