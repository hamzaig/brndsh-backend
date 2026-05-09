export interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'dir';
    size?: number;
    sha?: string;
}
export interface CodeSearchResult {
    name: string;
    path: string;
    sha: string;
    url: string;
    score: number;
    repository: {
        full_name: string;
    };
    text_matches?: Array<{
        fragment: string;
        matches: Array<{
            text: string;
            indices: number[];
        }>;
    }>;
}
export interface ExtractedSymbol {
    name: string;
    type: 'function' | 'class' | 'interface' | 'type' | 'const' | 'method' | 'export';
    line: number;
    endLine?: number;
}
export interface RepoTree {
    owner: string;
    repo: string;
    branch: string;
    files: FileNode[];
    totalFiles: number;
}
export interface ParsedRepoUrl {
    owner: string;
    repo: string;
    branch?: string;
}
