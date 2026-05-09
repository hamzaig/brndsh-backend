"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
let SessionService = class SessionService {
    store = new Map();
    create(dto) {
        const session = {
            id: (0, crypto_1.randomUUID)(),
            owner: dto.owner,
            repo: dto.repo,
            branch: dto.branch,
            messages: [],
            seenFiles: new Set(),
            repoTree: dto.repoTree,
            log: {
                turns: [],
                establishedFacts: [],
                contradictions: [],
                openQuestions: [],
            },
            turnCount: 0,
            createdAt: new Date(),
            lastActiveAt: new Date(),
        };
        this.store.set(session.id, session);
        return session;
    }
    get(id) {
        const session = this.store.get(id);
        if (!session)
            throw new common_1.NotFoundException(`Session ${id} not found`);
        return session;
    }
    list() {
        return [...this.store.values()].map(({ messages: _, ...rest }) => ({
            ...rest,
            seenFiles: rest.seenFiles,
        }));
    }
    delete(id) {
        if (!this.store.has(id))
            throw new common_1.NotFoundException(`Session ${id} not found`);
        this.store.delete(id);
    }
    snapshot(id) {
        const s = this.get(id);
        return {
            id: s.id,
            owner: s.owner,
            repo: s.repo,
            branch: s.branch,
            turnCount: s.turnCount,
            seenFiles: [...s.seenFiles],
            createdAt: s.createdAt,
            lastActiveAt: s.lastActiveAt,
            history: s.messages
                .filter((m) => typeof m.content === 'string' || Array.isArray(m.content))
                .map((m) => ({
                role: m.role,
                content: Array.isArray(m.content)
                    ? m.content
                        .filter((b) => b.type === 'text')
                        .map((b) => b.text)
                        .join('')
                    : m.content,
            }))
                .filter((m) => m.content),
        };
    }
};
exports.SessionService = SessionService;
exports.SessionService = SessionService = __decorate([
    (0, common_1.Injectable)()
], SessionService);
//# sourceMappingURL=session.service.js.map