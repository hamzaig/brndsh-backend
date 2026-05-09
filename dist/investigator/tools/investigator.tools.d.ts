import Anthropic from '@anthropic-ai/sdk';
export type ToolName = 'fetch_file' | 'list_files' | 'search_code' | 'get_file_range';
export declare const INVESTIGATOR_TOOLS: Anthropic.Tool[];
