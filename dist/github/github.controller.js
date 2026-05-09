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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubController = void 0;
const common_1 = require("@nestjs/common");
const github_service_1 = require("./github.service");
let GithubController = class GithubController {
    github;
    constructor(github) {
        this.github = github;
    }
    async fetchFile(owner, repo, path, branch) {
        const content = await this.github.fetchFile(owner, repo, path, branch);
        return { path, lineCount: this.github.getLineCount(content), content };
    }
    async fetchFileRange(owner, repo, path, start, end, branch) {
        const content = await this.github.fetchFile(owner, repo, path, branch);
        const snippet = this.github.getFileRange(content, Number(start), Number(end));
        return { path, startLine: Number(start), endLine: Number(end), snippet };
    }
    async listFiles(owner, repo, path, branch) {
        return this.github.listFiles(owner, repo, path, branch);
    }
    async searchCode(owner, repo, query, perPage) {
        return this.github.searchCode(owner, repo, query, perPage ? Number(perPage) : undefined);
    }
    async buildTree(body) {
        return this.github.buildRepoTree(body);
    }
    parseUrl(url) {
        return this.github.parseRepoUrl(url);
    }
    async extractSymbols(owner, repo, path, branch) {
        return this.github.getFileWithSymbols(owner, repo, path, branch);
    }
};
exports.GithubController = GithubController;
__decorate([
    (0, common_1.Get)('file'),
    __param(0, (0, common_1.Query)('owner')),
    __param(1, (0, common_1.Query)('repo')),
    __param(2, (0, common_1.Query)('path')),
    __param(3, (0, common_1.Query)('branch')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], GithubController.prototype, "fetchFile", null);
__decorate([
    (0, common_1.Get)('file/range'),
    __param(0, (0, common_1.Query)('owner')),
    __param(1, (0, common_1.Query)('repo')),
    __param(2, (0, common_1.Query)('path')),
    __param(3, (0, common_1.Query)('start')),
    __param(4, (0, common_1.Query)('end')),
    __param(5, (0, common_1.Query)('branch')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], GithubController.prototype, "fetchFileRange", null);
__decorate([
    (0, common_1.Get)('files'),
    __param(0, (0, common_1.Query)('owner')),
    __param(1, (0, common_1.Query)('repo')),
    __param(2, (0, common_1.Query)('path')),
    __param(3, (0, common_1.Query)('branch')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], GithubController.prototype, "listFiles", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)('owner')),
    __param(1, (0, common_1.Query)('repo')),
    __param(2, (0, common_1.Query)('q')),
    __param(3, (0, common_1.Query)('perPage')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], GithubController.prototype, "searchCode", null);
__decorate([
    (0, common_1.Post)('tree'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GithubController.prototype, "buildTree", null);
__decorate([
    (0, common_1.Post)('parse-url'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)('url')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], GithubController.prototype, "parseUrl", null);
__decorate([
    (0, common_1.Get)('symbols'),
    __param(0, (0, common_1.Query)('owner')),
    __param(1, (0, common_1.Query)('repo')),
    __param(2, (0, common_1.Query)('path')),
    __param(3, (0, common_1.Query)('branch')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], GithubController.prototype, "extractSymbols", null);
exports.GithubController = GithubController = __decorate([
    (0, common_1.Controller)('github'),
    __metadata("design:paramtypes", [github_service_1.GithubService])
], GithubController);
//# sourceMappingURL=github.controller.js.map