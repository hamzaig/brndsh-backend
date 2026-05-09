import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Session, CreateSessionDto } from './interfaces/session.interfaces';

// Sessions live in-memory. No DB needed — investigation sessions are ephemeral.
@Injectable()
export class SessionService {
  private readonly store = new Map<string, Session>();

  create(dto: CreateSessionDto): Session {
    const session: Session = {
      id: randomUUID(),
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

  get(id: string): Session {
    const session = this.store.get(id);
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    return session;
  }

  list(): Omit<Session, 'messages'>[] {
    return [...this.store.values()].map(({ messages: _, ...rest }) => ({
      ...rest,
      seenFiles: rest.seenFiles, // kept as Set — controller serializes it
    }));
  }

  delete(id: string): void {
    if (!this.store.has(id)) throw new NotFoundException(`Session ${id} not found`);
    this.store.delete(id);
  }

  // Serializable snapshot for GET /sessions/:id
  snapshot(id: string) {
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
      // Return only user/assistant text turns (not raw tool blocks) for readability
      history: s.messages
        .filter((m) => typeof m.content === 'string' || Array.isArray(m.content))
        .map((m) => ({
          role: m.role,
          content: Array.isArray(m.content)
            ? m.content
                .filter((b: any) => b.type === 'text')
                .map((b: any) => b.text)
                .join('')
            : m.content,
        }))
        .filter((m) => m.content),
    };
  }
}
