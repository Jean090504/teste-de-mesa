import React, { useState, useEffect, useCallback } from 'react';

export default function App() {
  const [tables, setTables] = useState(() => {
    const saved = localStorage.getItem('db_master_v18_beauty');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [zoom, setZoom] = useState(1);
  const [tableName, setTableName] = useState('');
  const [columnsInput, setColumnsInput] = useState('');
  const [highlighted, setHighlighted] = useState(null);
  const [lines, setLines] = useState([]);
  const [addingToId, setAddingToId] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [formData, setFormData] = useState({});
  const [alerts, setAlerts] = useState([]);

  const findParent = useCallback((colName) => {
    if (!colName) return null;
    const term = colName.replace(/^id/i, '').replace(/^\./, '').replace(/^ID\./, '').toUpperCase();
    return tables.find(t => {
      const cleanTName = t.name.replace('TBL.', '').toUpperCase();
      return cleanTName === term || t.name.toUpperCase() === term;
    });
  }, [tables]);

  useEffect(() => {
    localStorage.setItem('db_master_v18_beauty', JSON.stringify(tables));
    let newAlerts = [];
    tables.forEach(t => {
      t.rows.forEach((r, idx) => {
        t.columns.forEach(col => {
          if (r[col]?.toString().includes(',')) {
            newAlerts.push({ t: t.name, msg: `1FN: [${col}] linha ${idx+1} não atômica.` });
          }
        });
      });
    });
    setAlerts(newAlerts);
  }, [tables]);

  const updateLines = useCallback(() => {
    if (!highlighted) return setLines([]);
    const { value, tableId, colName } = highlighted;
    const originTable = tables.find(t => t.id === tableId);
    if (!originTable) return;

    const isPk = originTable.columns[0] === colName;
    const newLines = [];
    const originEl = document.querySelector(`[data-tid="${tableId}"][data-col="${colName}"][data-val="${value}"]`);
    if (!originEl) return;
    
    const oRect = originEl.getBoundingClientRect();
    const scrollX = window.scrollX; const scrollY = window.scrollY;

    tables.forEach(targetTable => {
      targetTable.columns.forEach(targetCol => {
        let shouldConnect = false;
        const cleanOrigin = originTable.name.replace('TBL.', '').toUpperCase();

        if (isPk) {
          if (targetTable.id !== tableId && targetCol.toUpperCase().includes(cleanOrigin)) shouldConnect = true;
        } else {
          const parent = findParent(colName);
          if (parent && targetTable.id === parent.id && targetCol === parent.columns[0]) shouldConnect = true;
        }

        if (shouldConnect) {
          const targets = document.querySelectorAll(`[data-tid="${targetTable.id}"][data-col="${targetCol}"][data-val="${value}"]`);
          targets.forEach(tEl => {
            const tRect = tEl.getBoundingClientRect();
            newLines.push({
              x1: oRect.right + scrollX, y1: oRect.top + oRect.height / 2 + scrollY,
              x2: tRect.left + scrollX, y2: tRect.top + tRect.height / 2 + scrollY
            });
          });
        }
      });
    });
    setLines(newLines);
  }, [highlighted, tables, findParent]);

  useEffect(() => {
    updateLines();
    window.addEventListener('resize', updateLines);
    window.addEventListener('scroll', updateLines);
    return () => {
      window.removeEventListener('resize', updateLines);
      window.removeEventListener('scroll', updateLines);
    };
  }, [updateLines, zoom]);

  const exportData = () => {
    const dataStr = JSON.stringify(tables, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `db_ultimate_export.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        setTables(JSON.parse(event.target.result));
        setHighlighted(null);
        setLines([]);
      } catch (err) { alert("Erro no JSON!"); }
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const createTable = () => {
    if (!tableName || !columnsInput) return;
    setTables([...tables, { id: Date.now(), name: tableName.toUpperCase(), columns: columnsInput.split(',').map(c => c.trim()), rows: [] }]);
    setTableName(''); setColumnsInput('');
  };

  const saveRow = (tableId) => {
    if (editingRow) {
      setTables(tables.map(t => {
        if (t.id === tableId) {
          const newRows = [...t.rows];
          newRows[editingRow.rowIndex] = formData;
          return { ...t, rows: newRows };
        }
        return t;
      }));
      setEditingRow(null);
    } else {
      const table = tables.find(t => t.id === tableId);
      const pk = table.columns[0];
      if (table.rows.some(r => r[pk] === formData[pk])) {
        alert("ID Duplicado!"); return;
      }
      setTables(tables.map(t => t.id === tableId ? {...t, rows: [...t.rows, formData]} : t));
    }
    setAddingToId(null);
    setFormData({});
  };

  return (
    <div className="min-h-screen text-slate-900 font-sans selection:bg-blue-100">
      {/* Camada SVG das Setas */}
      <svg className="fixed top-0 left-0 w-full h-full pointer-events-none z-50">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
            <feOffset dx="0" dy="1" result="offsetblur" />
            <feComponentTransfer><feFuncA type="linear" slope="0.3"/></feComponentTransfer>
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="arrow" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
          </marker>
        </defs>
        {lines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="8,5" markerEnd="url(#arrow)" filter="url(#shadow)" />
        ))}
      </svg>

      {/* NAVBAR FUTURISTA */}
      <nav className="bg-slate-900/95 backdrop-blur-md text-white border-b border-slate-800 sticky top-0 z-[60] px-6 py-4 shadow-xl">
        <div className="max-w-[98%] mx-auto flex flex-wrap justify-between items-center gap-6">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-1xl font-black tracking-tighter bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent uppercase">SIMULADOR DE BANCO DE DADOS LÓGICO</span>
              <span className="text-[10px] font-bold text-slate-500 tracking-[0.2em] -mt-1 uppercase">DESENVOLVIDO POR JEAN</span>
            </div>
            
            <div className="h-8 w-[1px] bg-slate-800 hidden md:block"></div>

            <div className="hidden lg:flex items-center bg-slate-800/50 rounded-full px-4 py-1.5 border border-slate-700 gap-4">
              <span className="text-[9px] font-black text-slate-500 uppercase">Scale View</span>
              <input type="range" min="0.5" max="1.3" step="0.1" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-24 accent-blue-500" />
              <span className="text-xs font-mono text-blue-400 font-bold">{Math.round(zoom * 100)}%</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={exportData} className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all hover:shadow-lg hover:shadow-blue-500/10 active:scale-95 border border-slate-700">Exportar</button>
            <label className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg shadow-blue-500/20 active:scale-95 text-center">
              Importar <input type="file" className="hidden" onChange={importData} accept=".json" />
            </label>
            <button onClick={() => {if(confirm("Deseja apagar tudo?")) setTables([]);}} className="bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border border-slate-700">Zerar</button>
          </div>
        </div>
      </nav>

      <div className="max-w-[98%] mx-auto px-6 py-10 zoom-container" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
        
        {/* PAINEL DE ALERTAS ESTILO NOTIFICAÇÃO */}
        {alerts.length > 0 && (
          <div className="bg-white/70 backdrop-blur-xl border border-amber-200 p-5 mb-10 rounded-3xl shadow-xl shadow-amber-500/5 flex flex-col gap-4">
            <h3 className="text-amber-700 font-extrabold text-xs uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping"></span> Mentor de Normalização Ativo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {alerts.map((a, i) => (
                <div key={i} className="bg-amber-50/50 p-3 rounded-2xl border border-amber-100/50 text-[10px] font-semibold text-amber-800 uppercase leading-relaxed">
                  <span className="opacity-50">[{a.t}]</span><br/>{a.msg}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ÁREA DE INPUT MINIMALISTA */}
        <div className="bg-white p-2 rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-white mb-16 flex flex-col lg:flex-row gap-2 items-center group">
          <input placeholder="Ex: TBL.CLIENTE" value={tableName} onChange={e => setTableName(e.target.value)} className="w-full lg:flex-1 p-5 bg-transparent border-none rounded-3xl outline-none font-semibold text-slate-700 placeholder:text-slate-300" />
          <div className="hidden lg:block w-[1px] h-8 bg-slate-100"></div>
          <input placeholder="Colunas: id, nome, email, id_endereco" value={columnsInput} onChange={e => setColumnsInput(e.target.value)} className="w-full lg:flex-[2.5] p-5 bg-transparent border-none rounded-3xl outline-none font-semibold text-slate-700 placeholder:text-slate-300" />
          <button onClick={createTable} className="w-full lg:w-auto bg-slate-900 text-white px-10 py-5 rounded-[2rem] font-black text-xs uppercase hover:bg-blue-600 transition-all shadow-xl active:scale-95 tracking-widest">Criar Tabela</button>
        </div>

        {/* GRID DE TABELAS ESTILO CARDS PREMIUM */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-10">
          {tables.map(table => (
            <div key={table.id} className="bg-white/80 backdrop-blur-sm p-1 rounded-[3rem] shadow-xl border border-white relative group transition-all hover:shadow-2xl hover:-translate-y-1">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6 px-2">
                  <h2 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center gap-2 uppercase">
                    <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span> {table.name}
                  </h2>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => {
                      const n = prompt("Novo nome:", table.name);
                      const c = prompt("Novas colunas:", table.columns.join(', '));
                      if(n && c) setTables(tables.map(t => t.id === table.id ? {...t, name: n.toUpperCase(), columns: c.split(',').map(x => x.trim())} : t));
                    }} className="p-2 text-slate-300 hover:text-blue-500">✏️</button>
                    <button onClick={() => setTables(tables.filter(t => t.id !== table.id))} className="p-2 text-slate-200 hover:text-red-500">🗑️</button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[2rem] border border-slate-50 mb-6 bg-slate-50/30">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-[9px] text-slate-400 font-black uppercase tracking-widest">
                        {table.columns.map(c => <th key={c} className="p-4">{c}</th>)}
                        <th className="w-10 p-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {table.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-blue-50/50 group/row transition-colors">
                          {table.columns.map(col => {
                            const isH = highlighted?.value === row[col] && highlighted?.tableId === table.id && highlighted?.colName === col;
                            const parent = findParent(col);
                            const fkErr = parent && !parent.rows.some(pr => pr[parent.columns[0]] === row[col]);
                            return (
                              <td 
                                key={col} 
                                data-tid={table.id} data-col={col} data-val={row[col]}
                                onClick={() => setHighlighted(isH ? null : { value: row[col], tableId: table.id, colName: col })}
                                className={`p-4 text-xs cursor-pointer transition-all border-r border-white/20
                                  ${isH ? 'bg-blue-600 text-white font-black scale-105 rounded-xl shadow-lg z-10' : 'text-slate-600'} 
                                  ${fkErr ? 'bg-red-50 text-red-600 font-bold' : ''}`}
                              >
                                {row[col]} {fkErr && "⚠️"}
                              </td>
                            );
                          })}
                          <td className="p-4 text-center">
                            <button onClick={() => {
                                setEditingRow({ tableId: table.id, rowIndex: rIdx });
                                setFormData(row);
                                setAddingToId(table.id);
                            }} className="text-blue-500 opacity-0 group-row/row:opacity-100 font-bold text-[10px] hover:underline">EDIT</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!addingToId && (
                  <button 
                    onClick={() => {
                      const pk = table.columns[0];
                      const ids = table.rows.map(r => parseInt(r[pk])).filter(v => !isNaN(v));
                      const nid = ids.length > 0 ? Math.max(...ids) + 1 : 1;
                      setAddingToId(table.id);
                      setEditingRow(null);
                      const initData = {}; table.columns.forEach(c => initData[c] = "");
                      setFormData({ ...initData, [pk]: nid.toString() });
                    }}
                    className="w-full py-5 bg-emerald-500 text-white rounded-[1.8rem] font-black text-[10px] uppercase shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all hover:shadow-emerald-500/40 active:scale-95"
                  >
                    + Novo Registro
                  </button>
                )}

                {addingToId === table.id && (
                  <div className="mt-2 p-6 bg-slate-900 rounded-[2rem] shadow-2xl animate-in fade-in slide-in-from-top-4">
                    <h4 className="text-[9px] font-black text-blue-400 uppercase mb-5 tracking-widest">{editingRow ? "Editar Dados" : "Novo Registro"}</h4>
                    <div className="space-y-4 mb-6">
                      {table.columns.map((c, i) => (
                        <div key={c}>
                          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">{c}</label>
                          <input 
                            value={formData[c] || ""} 
                            disabled={i === 0 && !editingRow}
                            onChange={e => setFormData({...formData, [c]: e.target.value})}
                            className="w-full p-3 bg-slate-800 border-none rounded-xl outline-none text-xs font-bold text-white focus:ring-1 focus:ring-blue-500 transition-all" 
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveRow(table.id)} className="flex-2 bg-blue-600 text-white py-3 px-6 rounded-xl font-black text-[10px] uppercase shadow-lg active:scale-95">Salvar</button>
                      <button onClick={() => {setAddingToId(null); setEditingRow(null);}} className="flex-1 bg-slate-800 text-slate-400 py-3 rounded-xl font-black text-[10px] uppercase">Sair</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}