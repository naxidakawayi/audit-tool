
import * as XLSX from 'xlsx';
import { FileItem, MergeOptions } from '../types';

export const readExcelFile = async (fileItem: FileItem, sheetIndex: number = 0): Promise<{ data: any[], headers: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error("No data read from file.");
        }
        
        // Use 'array' type for ArrayBuffer data, which is more robust for binary Excel files
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[sheetIndex];
        
        if (!sheetName) {
          throw new Error(`Sheet at index ${sheetIndex} not found. Available sheets: ${workbook.SheetNames.join(', ')}`);
        }

        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        // Extract headers from the first row or sheet keys
        const headers = jsonData.length > 0 ? Object.keys(jsonData[0] as object) : [];
        
        resolve({ data: jsonData, headers });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(new Error("File reading failed."));
    // Switched to readAsArrayBuffer to avoid encoding-related decompression issues
    reader.readAsArrayBuffer(fileItem.file);
  });
};

export const mergeFiles = async (
  files: FileItem[],
  options: MergeOptions
): Promise<Uint8Array> => {
  const allData: any[] = [];
  
  for (const fileItem of files) {
    if (fileItem.status !== 'done' || !fileItem.data) continue;
    
    const processedData = fileItem.data.map(row => {
      const newRow = { ...row };
      if (options.addSourceColumn) {
        // Use full path instead of just name for better traceability in subfolders
        newRow[options.sourceColumnName] = fileItem.path;
      }
      return newRow;
    });
    
    allData.push(...processedData);
  }

  if (allData.length === 0) {
    throw new Error("No data to merge.");
  }

  const worksheet = XLSX.utils.json_to_sheet(allData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "MergedData");
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(excelBuffer);
};

export const downloadBlob = (data: Uint8Array, fileName: string) => {
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
