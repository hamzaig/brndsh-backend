import { GithubService } from './github.service';
export declare class GithubController {
    private readonly github;
    constructor(github: GithubService);
    fetchFile(owner: string, repo: string, path: string, branch?: string): Promise<{
        path: string;
        lineCount: number;
        content: string;
    }>;
    fetchFileRange(owner: string, repo: string, path: string, start: string, end: string, branch?: string): Promise<{
        path: string;
        startLine: number;
        endLine: number;
        snippet: string;
    }>;
    listFiles(owner: string, repo: string, path?: string, branch?: string): Promise<import("./interfaces/github.interfaces").FileNode[]>;
    searchCode(owner: string, repo: string, query: string, perPage?: string): Promise<import("./interfaces/github.interfaces").CodeSearchResult[]>;
    buildTree(body: {
        owner: string;
        repo: string;
        branch?: string;
        maxDepth?: number;
        excludeDirs?: string[];
    }): Promise<import("./interfaces/github.interfaces").RepoTree>;
    parseUrl(url: string): import("./interfaces/github.interfaces").ParsedRepoUrl;
    extractSymbols(owner: string, repo: string, path: string, branch?: string): Promise<{
        content: string;
        symbols: import("./interfaces/github.interfaces").ExtractedSymbol[];
        lineCount: number;
    }>;
}
