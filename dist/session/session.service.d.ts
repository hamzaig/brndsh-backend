import { Session, CreateSessionDto } from './interfaces/session.interfaces';
export declare class SessionService {
    private readonly store;
    create(dto: CreateSessionDto): Session;
    get(id: string): Session;
    list(): Omit<Session, 'messages'>[];
    delete(id: string): void;
    snapshot(id: string): {
        id: string;
        owner: string;
        repo: string;
        branch: string;
        turnCount: number;
        seenFiles: string[];
        createdAt: Date;
        lastActiveAt: Date;
        history: {
            role: "user" | "assistant";
            content: string;
        }[];
    };
}
