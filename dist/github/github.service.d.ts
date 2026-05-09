import { ConfigService } from '@nestjs/config';
import { FileNode, CodeSearchResult, ExtractedSymbol, RepoTree, ParsedRepoUrl } from './interfaces/github.interfaces';
import { BuildRepoTreeDto } from './dto/list-files.dto';
export declare class GithubService {
    private readonly config;
    private readonly logger;
    constructor(config: ConfigService);
    private get headers();
    parseRepoUrl(url: string): ParsedRepoUrl;
    resolveDefaultBranch(owner: string, repo: string): Promise<string>;
    fetchFile(owner: string, repo: string, path: string, branch?: string): Promise<string>;
    listFiles(owner: string, repo: string, path?: string, branch?: string): Promise<FileNode[]>;
    searchCode(owner: string, repo: string, query: string, perPage?: number): Promise<CodeSearchResult[]>;
    getFileRange(content: string, startLine: number, endLine: number): string;
    getLineCount(content: string): number;
    buildRepoTree(dto: BuildRepoTreeDto): Promise<RepoTree>;
    extractSymbols(content: string): ExtractedSymbol[];
    getFileWithSymbols(owner: string, repo: string, path: string, branch?: string): Promise<{
        content: string;
        symbols: ExtractedSymbol[];
        lineCount: number;
    }>;
    renderRepoMap(tree: RepoTree, symbolMap: Map<string, ExtractedSymbol[]>): string;
}
