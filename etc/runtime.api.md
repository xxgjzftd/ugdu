## API Report File for "@ugdu/runtime"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

// @public
export interface Runtime {
    base: string;
    load(mn: string): Promise<any>;
    modules: RuntimeModule[];
    register(name: string, predicate: (pathname: string) => boolean, load: () => Promise<any>): void;
    start(rms: RuntimeModule[], base: string): Promise<any>;
    unload(mn: string): void;
}

// @public
export interface RuntimeModule {
    css?: string;
    // (undocumented)
    id: string;
    imports: string[];
    js: string;
}

// @public
export interface UserApp {
    mount(): Promise<any>;
    unmount(): Promise<any>;
}

```