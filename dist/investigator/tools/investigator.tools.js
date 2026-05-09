"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INVESTIGATOR_TOOLS = void 0;
exports.INVESTIGATOR_TOOLS = [
    {
        name: 'fetch_file',
        description: 'Fetch the complete content of a file from the repo with line numbers prepended. ' +
            'Use this to understand a full file before drilling in. ' +
            'Returns content as "NNNN | <line>" so citations are easy.',
        input_schema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'File path relative to repo root — e.g. "src/auth/auth.service.ts"',
                },
                branch: {
                    type: 'string',
                    description: 'Branch override (optional — defaults to session branch)',
                },
            },
            required: ['path'],
        },
    },
    {
        name: 'list_files',
        description: 'List all files and directories at a given path. ' +
            'Start here when exploring unfamiliar parts of the repo.',
        input_schema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Directory path to list. Empty string or omit for repo root.',
                },
            },
            required: [],
        },
    },
    {
        name: 'search_code',
        description: 'Full-text search across the entire repo. ' +
            'Returns file paths + matching code snippets. ' +
            'Use to find function definitions, usages, patterns, imports.',
        input_schema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search term — function name, class, keyword, pattern, etc.',
                },
                perPage: {
                    type: 'number',
                    description: 'Max results (default 10, max 30)',
                },
            },
            required: ['query'],
        },
    },
    {
        name: 'get_file_range',
        description: 'Get specific lines from a file. ' +
            'Use this instead of fetch_file when you already know which lines matter. ' +
            'Returns the range with line numbers for easy citation.',
        input_schema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'File path relative to repo root',
                },
                startLine: {
                    type: 'number',
                    description: 'First line to return (1-indexed)',
                },
                endLine: {
                    type: 'number',
                    description: 'Last line to return (inclusive)',
                },
            },
            required: ['path', 'startLine', 'endLine'],
        },
    },
];
//# sourceMappingURL=investigator.tools.js.map