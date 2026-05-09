"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var GithubService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const RAW_BASE = 'https://raw.githubusercontent.com';
const API_BASE = 'https://api.github.com';
const DEFAULT_EXCLUDE = new Set([
    'node_modules', '.git', 'dist', 'build', 'coverage',
    '.nyc_output', '__pycache__', '.pytest_cache', 'vendor',
    '.next', '.nuxt', 'out', 'target', '.cargo',
]);
const SYMBOL_PATTERNS = [
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
    { regex: /^def\s+(\w+)\s*\(/, type: 'function' },
    { regex: /^async\s+def\s+(\w+)\s*\(/, type: 'function' },
    { regex: /^class\s+(\w+)[:\(]/, type: 'class' },
    { regex: /^\s{2,}(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?:\{|=>|:)/, type: 'method' },
];
let GithubService = GithubService_1 = class GithubService {
    config;
    logger = new common_1.Logger(GithubService_1.name);
    constructor(config) {
        this.config = config;
    }
    get headers() {
        const token = this.config.get('GITHUB_TOKEN');
        return {
            Accept: 'application/vnd.github.v3+json',
            ...(token ? { Authorization: `token ${token}` } : {}),
        };
    }
    parseRepoUrl(url) {
        const match = url.match(/github\.com\/([^\/\s]+)\/([^\/\s#?]+?)(?:\.git)?(?:\/tree\/([^\/\s]+))?(?:[\/\s#?]|$)/);
        if (!match) {
            throw new common_1.HttpException('Invalid GitHub URL. Expected: https://github.com/owner/repo', common_1.HttpStatus.BAD_REQUEST);
        }
        return { owner: match[1], repo: match[2], branch: match[3] };
    }
    async resolveDefaultBranch(owner, repo) {
        const url = `${API_BASE}/repos/${owner}/${repo}`;
        const res = await fetch(url, { headers: this.headers });
        if (!res.ok) {
            throw new common_1.HttpException(`Repo not found: ${owner}/${repo}`, common_1.HttpStatus.NOT_FOUND);
        }
        const data = (await res.json());
        return data.default_branch;
    }
    async fetchFile(owner, repo, path, branch = 'main') {
        const url = `${RAW_BASE}/${owner}/${repo}/${branch}/${path}`;
        const res = await fetch(url);
        if (!res.ok) {
            if (branch === 'main') {
                return this.fetchFile(owner, repo, path, 'master');
            }
            throw new common_1.HttpException(`File not found: ${path} (branch: ${branch})`, common_1.HttpStatus.NOT_FOUND);
        }
        return res.text();
    }
    async listFiles(owner, repo, path = '', branch = 'main') {
        const ref = branch ? `?ref=${branch}` : '';
        const url = `${API_BASE}/repos/${owner}/${repo}/contents/${path}${ref}`;
        const res = await fetch(url, { headers: this.headers });
        if (!res.ok) {
            if (res.status === 404 && branch === 'main') {
                return this.listFiles(owner, repo, path, 'master');
            }
            throw new common_1.HttpException(`Cannot list path "${path}": ${res.statusText}`, common_1.HttpStatus.BAD_REQUEST);
        }
        const data = (await res.json());
        const items = Array.isArray(data) ? data : [data];
        return items.map((item) => ({
            name: item.name,
            path: item.path,
            type: item.type,
            size: item.size,
            sha: item.sha,
        }));
    }
    async searchCode(owner, repo, query, perPage = 10) {
        const q = `${encodeURIComponent(query)}+repo:${owner}/${repo}`;
        const url = `${API_BASE}/search/code?q=${q}&per_page=${perPage}`;
        const res = await fetch(url, {
            headers: {
                ...this.headers,
                Accept: 'application/vnd.github.v3.text-match+json',
            },
        });
        if (!res.ok) {
            if (res.status === 403) {
                throw new common_1.HttpException('GitHub search rate limit hit. Set GITHUB_TOKEN env var.', common_1.HttpStatus.TOO_MANY_REQUESTS);
            }
            throw new common_1.HttpException(`Code search failed: ${res.statusText}`, common_1.HttpStatus.BAD_REQUEST);
        }
        const data = (await res.json());
        return data.items ?? [];
    }
    getFileRange(content, startLine, endLine) {
        const lines = content.split('\n');
        const start = Math.max(0, startLine - 1);
        const end = Math.min(lines.length, endLine);
        return lines.slice(start, end).join('\n');
    }
    getLineCount(content) {
        return content.split('\n').length;
    }
    async buildRepoTree(dto) {
        const { owner, repo, maxDepth = 3, excludeDirs = [] } = dto;
        const branch = dto.branch ?? (await this.resolveDefaultBranch(owner, repo));
        const excluded = new Set([...DEFAULT_EXCLUDE, ...excludeDirs]);
        const files = [];
        const walk = async (path, depth) => {
            if (depth > maxDepth)
                return;
            let entries;
            try {
                entries = await this.listFiles(owner, repo, path, branch);
            }
            catch {
                this.logger.warn(`Skipping inaccessible path: ${path}`);
                return;
            }
            for (const entry of entries) {
                if (entry.type === 'dir') {
                    if (excluded.has(entry.name))
                        continue;
                    files.push(entry);
                    await walk(entry.path, depth + 1);
                }
                else {
                    files.push(entry);
                }
            }
        };
        await walk('', 0);
        return { owner, repo, branch, files, totalFiles: files.filter((f) => f.type === 'file').length };
    }
    extractSymbols(content) {
        const symbols = [];
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            for (const { regex, type } of SYMBOL_PATTERNS) {
                const match = line.match(regex);
                if (match && match[1] && match[1].length > 1) {
                    if (['if', 'for', 'while', 'switch', 'catch'].includes(match[1]))
                        break;
                    symbols.push({ name: match[1], type, line: index + 1 });
                    break;
                }
            }
        });
        return symbols;
    }
    async getFileWithSymbols(owner, repo, path, branch = 'main') {
        const content = await this.fetchFile(owner, repo, path, branch);
        const symbols = this.extractSymbols(content);
        return { content, symbols, lineCount: this.getLineCount(content) };
    }
    renderRepoMap(tree, symbolMap) {
        const lines = [`# ${tree.owner}/${tree.repo} (${tree.branch})\n`];
        for (const file of tree.files) {
            if (file.type === 'dir') {
                lines.push(`📁 ${file.path}/`);
            }
            else {
                const symbols = symbolMap.get(file.path);
                if (symbols && symbols.length > 0) {
                    lines.push(`📄 ${file.path}`);
                    for (const sym of symbols) {
                        lines.push(`   ${sym.type.padEnd(10)} ${sym.name}  (L${sym.line})`);
                    }
                }
                else {
                    lines.push(`📄 ${file.path}`);
                }
            }
        }
        return lines.join('\n');
    }
};
exports.GithubService = GithubService;
exports.GithubService = GithubService = GithubService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GithubService);
//# sourceMappingURL=github.service.js.map