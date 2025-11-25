export enum ScanStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface ScanDocument {
  id: string;
  title: string;
  createdAt: number;
  originalContent: string; // Base64
  mimeType: string;
  extractedText: string;
  status: ScanStatus;
  summary?: string; // Enhanced feature
}

export interface AIActionResponse {
  text: string;
}

export type AIActionType = 'summarize' | 'translate' | 'polish';