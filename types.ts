
export interface FileItem {
  id: string;
  file: File;
  name: string;
  path: string;
  size: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  data?: any[];
  headers?: string[];
  errorMessage?: string;
}

export interface MergeOptions {
  addSourceColumn: boolean;
  sourceColumnName: string;
  useSmartMapping: boolean;
  sheetIndex: number;
  outputFileName: string;
  filterKeyword: string; // New field for filename filtering
}

export interface MappingResult {
  sourceHeader: string;
  targetHeader: string;
}
