import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FileNode,
  CodeSearchResult,
  ExtractedSymbol,
  RepoTree,
  ParsedRepoUrl,
} from './interfaces/github.interfaces';
import { BuildRepoTreeDto } from './dto/list-files.dto';

const RAW_BASE = 'https://raw.githubusercontent.com';
const API_BASE = 'https://api.github.com';

// Dirs that are never useful for code investigation
const DEFAULT_EXCLUDE = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.nyc_output', '__pycache__', '.pytest_cache', 'vendor',
  '.next', '.nuxt', 'out', 'target', '.cargo',
]);

// Symbol extraction patterns — inspired by Aider's repomap tag approach
const SYMBOL_PATTERNS: Array<{ regex: RegExp; type: ExtractedSymbol['type'] }> = [
  { regex: /^export\s+default\s+(?:async\s+)?function\s+(\w+)/, type: 'function' },
  { regex: /^export\s+(?:async\s+)?function\s+(\w+)/, type: 'function' },
  { regex: /^(?:async\s+)?function\s+(\w+)/, type: 'function' },
  { regex: /^export\s+default\s+class\s+(\w+)/, type: 'class' },
  { regex: /^export\s+(?:abstract\s+)?class\s+(\w+)/, type: 'class' },
  { regex: /^(?:abstract\s+)?class\s+(\w+)/, type: 'class' },
  { regex: /^export\s+interface\s+(\w+)/, type: 'interface' },
  { regex: /^interface\s+(\w+)/, type: 'interface' },
  { regex: /^export\s+type\s+(\w+)\s*[=<]/, type: 'type' },
  { regex: /^export\s+(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/, type: 'const' },
  { regex: /^export\s+(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function/, type: 'const' },
  // Python
  { regex: /^def\s+(\w+)\s*\(/, type: 'function' },
  { regex: /^async\s+def\s+(\w+)\s*\(/, type: 'function' },
  { regex: /^class\s+(\w+)[:\(]/, type: 'class' },
  // Class methods (indented)
  { regex: /^\s{2,}(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?:\{|=>|:)/, type: 'method' },
];

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  constructor(private readonly config: ConfigService) {}

  private get headers(): Record<string, string> {
    const token = this.config.get<string>('GITHUB_TOKEN');
    return {
      Accept: 'application/vnd.github.v3+json',
      ...(token ? { Authorization: `token ${token}` } : {}),
    };
  }

  parseRepoUrl(url: string): ParsedRepoUrl {
    const match = url.match(/github\.com\/([^\/\s]+)\/([^\/\s#?]+?)(?:\.git)?(?:\/tree\/([^\/\s]+))?(?:[\/\s#?]|$)/);
    if (!match) {
      throw new HttpException('Invalid GitHub URL. Expected: https://github.com/owner/repo', HttpStatus.BAD_REQUEST);
    }
    return { owner: match[1], repo: match[2], branch: match[3] };
  }

  // Resolves default branch (main vs master vs custom)
  async resolveDefaultBranch(owner: string, repo: string): Promise<string> {
    const url = `${API_BASE}/repos/${owner}/${repo}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      throw new HttpException(`Repo not found: ${owner}/${repo}`, HttpStatus.NOT_FOUND);
    }
    const data = (await res.json()) as { default_branch: string };
    return data.default_branch;
  }

  async fetchFile(
    owner: string,
    repo: string,
    path: string,
    branch = 'main',
  ): Promise<string> {
    const url = `${RAW_BASE}/${owner}/${repo}/${branch}/${path}`;
    const res = await fetch(url);

    if (!res.ok) {
      if (branch === 'main') {
        // Fallback to master before giving up
        return this.fetchFile(owner, repo, path, 'master');
      }
      throw new HttpException(
        `File not found: ${path} (branch: ${branch})`,
        HttpStatus.NOT_FOUND,
      );
    }

    return res.text();
  }

  async listFiles(
    owner: string,
    repo: string,
    path = '',
    branch = 'main',
  ): Promise<FileNode[]> {
    const ref = branch ? `?ref=${branch}` : '';
    const url = `${API_BASE}/repos/${owner}/${repo}/contents/${path}${ref}`;
    const res = await fetch(url, { headers: this.headers });

    if (!res.ok) {
      if (res.status === 404 && branch === 'main') {
        return this.listFiles(owner, repo, path, 'master');
      }
      throw new HttpException(
        `Cannot list path "${path}": ${res.statusText}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const data = (await res.json()) as any[];
    const items = Array.isArray(data) ? data : [data];

    return items.map((item) => ({
      name: item.name as string,
      path: item.path as string,
      type: item.type as 'file' | 'dir',
      size: item.size as number | undefined,
      sha: item.sha as string,
    }));
  }

  async searchCode(
    owner: string,
    repo: string,
    query: string,
    perPage = 10,
  ): Promise<CodeSearchResult[]> {
    const q = `${encodeURIComponent(query)}+repo:${owner}/${repo}`;
    const url = `${API_BASE}/search/code?q=${q}&per_page=${perPage}`;

    const res = await fetch(url, {
      headers: {
        ...this.headers,
        // text-match preview header gives us code snippets
        Accept: 'application/vnd.github.v3.text-match+json',
      },
    });

    if (!res.ok) {
      if (res.status === 403) {
        throw new HttpException(
          'GitHub search rate limit hit. Set GITHUB_TOKEN env var.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new HttpException(`Code search failed: ${res.statusText}`, HttpStatus.BAD_REQUEST);
    }

    const data = (await res.json()) as { items: CodeSearchResult[] };
    return data.items ?? [];
  }

  getFileRange(content: string, startLine: number, endLine: number): string {
    const lines = content.split('\n');
    const start = Math.max(0, startLine - 1);
    const end = Math.min(lines.length, endLine);
    return lines.slice(start, end).join('\n');
  }

  getLineCount(content: string): number {
    return content.split('\n').length;
  }

  // Inspired by Aider repomap — recursively walks the tree, skips noise dirs
  async buildRepoTree(dto: BuildRepoTreeDto): Promise<RepoTree> {
    const { owner, repo, maxDepth = 3, excludeDirs = [] } = dto;
    const branch = dto.branch ?? (await this.resolveDefaultBranch(owner, repo));
    const excluded = new Set([...DEFAULT_EXCLUDE, ...excludeDirs]);

    const files: FileNode[] = [];

    const walk = async (path: string, depth: number) => {
      if (depth > maxDepth) return;

      let entries: FileNode[];
      try {
        entries = await this.listFiles(owner, repo, path, branch);
      } catch {
        this.logger.warn(`Skipping inaccessible path: ${path}`);
        return;
      }

      for (const entry of entries) {
        if (entry.type === 'dir') {
          if (excluded.has(entry.name)) continue;
          files.push(entry);
          await walk(entry.path, depth + 1);
        } else {
          files.push(entry);
        }
      }
    };

    await walk('', 0);

    return { owner, repo, branch, files, totalFiles: files.filter((f) => f.type === 'file').length };
  }

  // Aider-style symbol extraction — regex-based, language-agnostic enough for JS/TS/Python
  extractSymbols(content: string): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      for (const { regex, type } of SYMBOL_PATTERNS) {
        const match = line.match(regex);
        if (match && match[1] && match[1].length > 1) {
          // Skip matches that look like built-in keywords or very short names
          if (['if', 'for', 'while', 'switch', 'catch'].includes(match[1])) break;
          symbols.push({ name: match[1], type, line: index + 1 });
          break;
        }
      }
    });

    return symbols;
  }

  // High-level: fetch file + extract symbols in one shot
  async getFileWithSymbols(
    owner: string,
    repo: string,
    path: string,
    branch = 'main',
  ): Promise<{ content: string; symbols: ExtractedSymbol[]; lineCount: number }> {
    const content = await this.fetchFile(owner, repo, path, branch);
    const symbols = this.extractSymbols(content);
    return { content, symbols, lineCount: this.getLineCount(content) };
  }

  // Renders a compact repo map string similar to Aider's output
  renderRepoMap(tree: RepoTree, symbolMap: Map<string, ExtractedSymbol[]>): string {
    const lines: string[] = [`# ${tree.owner}/${tree.repo} (${tree.branch})\n`];

    for (const file of tree.files) {
      if (file.type === 'dir') {
        lines.push(`📁 ${file.path}/`);
      } else {
        const symbols = symbolMap.get(file.path);
        if (symbols && symbols.length > 0) {
          lines.push(`📄 ${file.path}`);
          for (const sym of symbols) {
            lines.push(`   ${sym.type.padEnd(10)} ${sym.name}  (L${sym.line})`);
          }
        } else {
          lines.push(`📄 ${file.path}`);
        }
      }
    }

    return lines.join('\n');
  }
}
