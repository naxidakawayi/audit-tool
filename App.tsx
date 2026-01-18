
import React, { useState, useMemo, useRef } from 'react';
import { FileItem, MergeOptions } from './types';
import { Icons } from './components/Icon';
import { readExcelFile, mergeFiles, downloadBlob } from './services/excelService';

const App: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [options, setOptions] = useState<MergeOptions>({
    addSourceColumn: true,
    sourceColumnName: '来源路径',
    useSmartMapping: true,
    sheetIndex: 0,
    outputFileName: '合并结果_' + new Date().toISOString().split('T')[0],
    filterKeyword: '' 
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Filter files based on keyword
  const filteredFiles = useMemo(() => {
    if (!options.filterKeyword.trim()) return files;
    const kw = options.filterKeyword.toLowerCase();
    return files.filter(f => f.name.toLowerCase().includes(kw));
  }, [files, options.filterKeyword]);

  // Grouping logic for identical names (still useful as an alternative view)
  const groupedFiles = useMemo(() => {
    const groups: Record<string, FileItem[]> = {};
    filteredFiles.forEach(file => {
      if (!groups[file.name]) groups[file.name] = [];
      groups[file.name].push(file);
    });
    return groups;
  }, [filteredFiles]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;

    const newItems: FileItem[] = Array.from(selectedFiles)
      .filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv'))
      .map(file => ({
        id: Math.random().toString(36).substring(7),
        file,
        name: file.name,
        path: (file as any).webkitRelativePath || file.name,
        size: file.size,
        status: 'pending' as const,
      }));

    setFiles(prev => [...prev, ...newItems]);
    processFiles(newItems);
    
    // Reset inputs so the same folder can be re-selected if needed
    event.target.value = '';
  };

  const processFiles = async (items: FileItem[]) => {
    setIsProcessing(true);
    for (const item of items) {
      try {
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'processing' } : f));
        const { data, headers } = await readExcelFile(item, options.sheetIndex);
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'done', data, headers } : f));
      } catch (err: any) {
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', errorMessage: err.message } : f));
      }
    }
    setIsProcessing(false);
  };

  const handleMergeAllMatched = async () => {
    const readyFiles = filteredFiles.filter(f => f.status === 'done');
    if (readyFiles.length === 0) {
      alert("没有可合并的文件。请确保文件解析成功。");
      return;
    }

    setIsProcessing(true);
    try {
      const mergedBytes = await mergeFiles(readyFiles, options);
      const finalName = options.outputFileName || 'merged_result';
      downloadBlob(mergedBytes, finalName);
    } catch (err) {
      alert(`合并失败: ` + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearFiles = () => {
    setFiles([]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-100 p-3 rounded-xl">
            <Icons.Excel className="text-emerald-600 w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Excel Multi-Merge Pro</h1>
            <p className="text-slate-500 text-sm">本地浏览器构建与下载合并文件</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={clearFiles} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-red-600 transition-colors">
            清空列表
          </button>
          <button 
            disabled={isProcessing || filteredFiles.length === 0}
            onClick={handleMergeAllMatched}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all flex items-center gap-2"
          >
            {isProcessing ? <Icons.Loading className="animate-spin w-5 h-5" /> : <Icons.Download className="w-5 h-5" />}
            构建并下载结果
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-6">
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Icons.Settings className="w-4 h-4" /> 提取与构建设置
            </h2>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">文件名包含关键字</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={options.filterKeyword}
                    onChange={e => setOptions({...options, filterKeyword: e.target.value})}
                    className="w-full pl-3 pr-10 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-slate-50"
                    placeholder="提取包含此字段的文件..."
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
                    {options.filterKeyword ? <Icons.Close className="w-4 h-4 cursor-pointer hover:text-slate-500" onClick={() => setOptions({...options, filterKeyword: ''})} /> : null}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">保存的文件名</label>
                <input 
                  type="text" 
                  value={options.outputFileName}
                  onChange={e => setOptions({...options, outputFileName: e.target.value})}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>

              <div className="pt-4 space-y-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">在结果中添加路径列</span>
                  <input 
                    type="checkbox"
                    checked={options.addSourceColumn}
                    onChange={e => setOptions({...options, addSourceColumn: e.target.checked})}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Sheet 索引 (默认 0)</span>
                  <input 
                    type="number" 
                    min="0"
                    value={options.sheetIndex}
                    onChange={e => setOptions({...options, sheetIndex: parseInt(e.target.value) || 0})}
                    className="w-16 px-2 py-1 border border-slate-200 rounded-md text-xs"
                  />
                </div>
              </div>
            </div>
          </section>

          <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 text-blue-700 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Icons.Alert className="w-4 h-4" /> 说明
            </div>
            <p className="text-xs leading-relaxed">
              输入关键字（如 "报表"）后，程序将仅合并文件名中带有 "报表" 的文件。
              点击 <strong>构建并下载</strong> 即可直接获得合并后的本地文件。
            </p>
          </div>
        </aside>

        <main className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="group bg-white border-2 border-dashed border-slate-200 hover:border-emerald-400 p-6 rounded-2xl flex items-center gap-5 transition-all hover:bg-emerald-50/30 text-left"
            >
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                {/* Changed Icons.Plus to Icons.Add to fix property reference error */}
                <Icons.Add className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">选择文件</h3>
                <p className="text-xs text-slate-500 mt-0.5">单个或多个 Excel/CSV</p>
              </div>
              <input type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            </button>

            <button 
              onClick={() => folderInputRef.current?.click()}
              className="group bg-white border-2 border-dashed border-slate-200 hover:border-blue-400 p-6 rounded-2xl flex items-center gap-5 transition-all hover:bg-blue-50/30 text-left"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                <Icons.Folder className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">选择文件夹</h3>
                <p className="text-xs text-slate-500 mt-0.5">穿透扫描所有子目录</p>
              </div>
              <input type="file" {...({ webkitdirectory: "", directory: "" } as any)} className="hidden" ref={folderInputRef} onChange={handleFileUpload} />
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-700">
                待构建文件 ({filteredFiles.length} / {files.length})
              </h3>
              {options.filterKeyword && (
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 font-bold uppercase">
                  已应用提取规则
                </span>
              )}
            </div>
            
            <div className="overflow-x-auto">
              {filteredFiles.length === 0 ? (
                <div className="p-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                    <Icons.Excel className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="text-slate-400 font-medium">
                    {files.length === 0 ? "尚未添加任何文件" : "没有符合关键字提取规则的文件"}
                  </p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">文件名</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">路径</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">大小</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">状态</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">移除</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredFiles.map((file) => (
                      <tr key={file.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Icons.Excel className="w-5 h-5 text-emerald-500 shrink-0" />
                            <span className="text-sm font-semibold text-slate-700 truncate max-w-[200px]">{file.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[150px] block" title={file.path}>
                            {file.path}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[10px] text-slate-500 font-medium">
                          {formatSize(file.size)}
                        </td>
                        <td className="px-6 py-4">
                          {file.status === 'processing' && <Icons.Loading className="animate-spin w-4 h-4 text-blue-500" />}
                          {file.status === 'done' && <Icons.Success className="w-4 h-4 text-emerald-500" />}
                          {file.status === 'error' && <Icons.Alert className="w-4 h-4 text-red-500" />}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => removeFile(file.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                            <Icons.Delete className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </main>
      </div>

      <footer className="text-center py-8 text-slate-300 text-xs">
        Excel Multi-Merge Pro • 专注本地极速构建与直接下载
      </footer>
    </div>
  );
};

export default App;
