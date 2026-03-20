import React, { useState, useEffect, useCallback } from 'react';

/**
 * DB MASTER ULTIMATE PRO
 * Desenvolvido por Jean Costa para fins académicos.
 * Focado em Normalização (1FN, 3FN) e Integridade Referencial.
 */

export default function App() {
  // --- 1. ESTADO GLOBAL E PERSISTÊNCIA ---
  const [tables, setTables] = useState(() => {
    const saved = localStorage.getItem('db_master_academic_v28');
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

  // --- 2. FUNÇÃO MESTRA DE RELACIONAMENTO (Mentor) ---
  // Definida no topo para evitar o ReferenceError visualizado na consola
  const findParent = useCallback((colName) => {
    if (!colName) return null;
    const term = colName.replace(/^id/i, '').replace(/^\./, '').replace(/^ID\./, '').toUpperCase();
    return tables.find(t => {
      const cleanTName = t.name.replace('TBL.', '').toUpperCase();
      return cleanTName === term || t.name.toUpperCase() === term;
    });
  }, [tables]);

  // Auditoria de Normalização (1FN / 3FN Académica)
  useEffect(() => {
    let newAlerts = [];
    tables.forEach(t => {
      t.rows.forEach((r, idx) => {
        t.columns.forEach(col => {
          // Validação de 1ª Forma Normal: Valores atómicos
          if (r[col]?.toString().includes(',')) {
            newAlerts.push({ t: t.name, msg: `1FN: Coluna [${col}] na linha ${idx+1} contém valores múltiplos.` });
          }
        });
      });
    });
    setAlerts(newAlerts);
    // Salva no LocalStorage do navegador de Itapevi
    localStorage.setItem('db_master_academic_v28', JSON.stringify(tables));
  }, [tables]);

  // --- 3. LÓGICA DE CONEXÃO DE SETAS (SVG FIXED) ---
  // Ajustado para ignorar o scroll manual e usar apenas coordenadas de ecrã
  const updateLines = useCallback(() => {
    if (!highlighted) return setLines([]);
    const { value, tableId, colName } = highlighted;
    const originTable = tables.find(t => t.id === tableId);
    if (!originTable) return;

    const isPk = originTable.columns[0] === colName;
    const newLines = [];
    
    // Seleciona apenas a célula (TD), ignorando botões de ação
    const originEl = document.querySelector(`td[data-tid="${tableId}"][data-col="${colName}"][data-val="${value}"]`);
    if (!originEl) return;
    
    const oRect = originEl.getBoundingClientRect();

    tables.forEach(targetTable => {
      targetTable.columns.forEach(targetCol => {
        let shouldConnect = false;
        const cleanOrigin = originTable.name.replace('TBL.', '').toUpperCase();

        if (isPk) {
          // Lógica PK -> FK: Se o nome da tabela origem está no nome da coluna destino
          if (targetTable.id !== tableId && targetCol.toUpperCase().includes(cleanOrigin)) shouldConnect = true;
        } else {
          // Lógica FK -> PK: Se a coluna atual refere-se a uma tabela pai
          const parent = findParent(colName);
          if (parent && targetTable.id === parent.id && targetCol === parent.columns[0]) shouldConnect = true;
        }

        if (shouldConnect) {
          const targets = document.querySelectorAll(`td[data-tid="${targetTable.id}"][data-col="${targetCol}"][data-val="${value}"]`);
          targets.forEach(tEl => {
            const tRect = tEl.getBoundingClientRect();
            newLines.push({
              x1: oRect.right, 
              y1: oRect.top + oRect.height / 2,
              x2: tRect.left, 
              y2: tRect.top + tRect.height / 2
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

  // --- 4. FUNÇÕES DE FICHEIRO (Exportar / Importar) ---
  const handleExport = () => {
    const dataStr = JSON.stringify(tables, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `meu_projeto_db_jean.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        setTables(JSON.parse(event.target.result));
        setHighlighted(null);
        setLines([]);
      } catch (err) { alert("JSON Inválido!"); }
      e.target.value = ""; 
    };
    reader.readAsText(file);
  };

  // --- 5. OPERAÇÕES DE DADOS (CRUD) ---
  const createTable = () => {
    if (!tableName || !columnsInput) return;
    const newTable = {
      id: Date.now(),
      name: tableName.toUpperCase(),
      columns: columnsInput.split(',').map(c => c.trim()),
      rows: []
    };
    setTables([...tables, newTable]);
    setTableName('');
    setColumnsInput('');
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
      // Validação de Chave Primária Duplicada
      if (table.rows.some(r => r[pk] === formData[pk])) {
        alert("Erro de PK: Este ID já existe nesta tabela!"); return;
      }
      setTables(tables.map(t => t.id === tableId ? {...t, rows: [...t.rows, formData]} : t));
    }
    setAddingToId(null);
    setFormData({});
  };

  // --- 6. RENDERIZAÇÃO DA INTERFACE ---
  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-900 font-sans pb-20 selection:bg-blue-100">
      {/* Camada SVG: Setas inteligentes e fixas */}
      <svg className="fixed top-0 left-0 w-full h-full pointer-events-none z-[100]">
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
          </marker>
        </defs>
        {lines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="6,4" markerEnd="url(#arrow)" />
        ))}
      </svg>

      {/* NAVBAR: Controlos de Zoom e Ficheiros */}
      <nav className="bg-slate-900 text-white w-full p-4 sticky top-0 z-[60] shadow-xl border-b-2 border-blue-500">
        <div className="w-full flex flex-wrap justify-between items-center px-4 gap-4">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <h1 className="text-xl font-black italic text-blue-400 uppercase tracking-tighter leading-none">DB MASTER PRO</h1>
              <span className="text-[9px] font-bold text-slate-500 tracking-widest uppercase mt-1">Itapevi - Jandira Connection</span>
            </div>
            <div className="flex items-center bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700 gap-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Escala</span>
              <input type="range" min="0.5" max="1.3" step="0.1" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-24 accent-blue-500 cursor-pointer" />
              <span className="text-xs font-mono text-blue-300 font-bold w-10 text-center">{Math.round(zoom * 100)}%</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport} className="bg-slate-800 hover:bg-slate-700 px-5 py-2 rounded-xl text-[10px] font-bold uppercase transition-all shadow-lg border border-slate-700">Exportar</button>
            <label className="bg-blue-600 hover:bg-blue-500 px-5 py-2 rounded-xl text-[10px] font-bold uppercase cursor-pointer text-center flex items-center shadow-lg">
              Importar <input type="file" className="hidden" onChange={handleImport} accept=".json" />
            </label>
            <button onClick={() => {if(confirm("Deseja apagar tudo?")) setTables([]); localStorage.clear();}} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl text-[10px] font-bold uppercase shadow-lg">Zerar</button>
          </div>
        </div>
      </nav>

      {/* CONTAINER PRINCIPAL: Respeita o Zoom */}
      <div className="w-full px-6 mt-8 zoom-container" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', width: `${100 / zoom}%` }}>
        
        {/* MENTOR DE NORMALIZAÇÃO ATIVO */}
        {alerts.length > 0 && (
          <div className="bg-amber-50 border-l-8 border-amber-500 p-5 mb-8 rounded-2xl shadow-lg animate-pulse">
            <h3 className="text-amber-800 font-black text-xs uppercase mb-3 tracking-widest flex items-center gap-2">⚠️ Mentor de Dados:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 text-[10px] text-amber-700 font-bold uppercase">
              {alerts.map((a, i) => <div key={i} className="bg-white p-2 rounded-lg border border-amber-200 shadow-sm">• {a.t}: {a.msg}</div>)}
            </div>
          </div>
        )}

        {/* INPUTS DE CRIAÇÃO: Estilo Premium */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-200 mb-12 flex flex-col lg:flex-row gap-4 items-center">
          <input placeholder="Ex: TBL.CLIENTE" value={tableName} onChange={e => setTableName(e.target.value)} className="w-full lg:w-64 p-4 bg-slate-50 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700" />
          <input placeholder="Colunas: id, nome, email, id_fk" value={columnsInput} onChange={e => setColumnsInput(e.target.value)} className="w-full lg:flex-1 p-4 bg-slate-50 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700" />
          <button onClick={createTable} className="w-full lg:w-auto bg-slate-900 text-white px-12 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-600 transition-all active:scale-95 tracking-widest">+ Criar Tabela</button>
        </div>

        {/* GRID DE TABELAS: Auto-responsivo */}
        <div className="w-full flex flex-wrap gap-10 justify-center lg:justify-start">
          {tables.map(table => (
            <div key={table.id} className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col min-w-[400px] max-w-[550px] flex-grow lg:flex-grow-0 transition-all hover:shadow-blue-500/5 relative group h-fit overflow-hidden">
              
              {/* CABEÇALHO DA TABELA (EDIÇÃO E EXCLUSÃO) */}
              <div className="p-6 flex justify-between items-center border-b-4 border-blue-600 bg-slate-50/50">
                <h2 className="font-black text-slate-800 text-sm tracking-tight uppercase flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span> {table.name}
                </h2>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => {
                    const n = prompt("Novo nome:", table.name);
                    const c = prompt("Novas colunas:", table.columns.join(', '));
                    if(n && c) setTables(tables.map(t => t.id === table.id ? {...t, name: n.toUpperCase(), columns: c.split(',').map(x => x.trim())} : t));
                  }} className="p-2 text-slate-300 hover:text-blue-500 transition-colors" title="Editar Estrutura">✏️</button>
                  <button onClick={() => setTables(tables.filter(t => t.id !== table.id))} className="p-2 text-slate-200 hover:text-red-500 transition-colors">🗑️</button>
                </div>
              </div>

              {/* DADOS DA TABELA (COM LÓGICA DE FK/PK) */}
              <div className="p-2 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-full">
                  <thead>
                    <tr className="bg-slate-900 text-[9px] text-slate-400 font-black uppercase tracking-widest">
                      {table.columns.map(c => <th key={c} className="p-4 border-r border-slate-800">{c}</th>)}
                      <th className="w-10"></th>
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
                              className={`p-4 border-r text-xs cursor-pointer whitespace-nowrap transition-all 
                                ${isH ? 'bg-blue-600 text-white font-black scale-105 z-10 rounded-lg shadow-lg' : 'text-slate-600'} 
                                ${fkErr ? 'bg-red-50 text-red-600 font-bold underline decoration-wavy' : ''}`}
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
                          }} className="text-blue-500 opacity-0 group-hover/row:opacity-100 font-bold text-[9px] hover:underline transition-all">EDIT</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* FORMULÁRIO DE INSERÇÃO/EDIÇÃO (CONTROLE DE INPUTS) */}
              <div className="p-6 bg-slate-50/30 border-t border-slate-100 rounded-b-[2.5rem]">
                {!addingToId ? (
                  <button 
                    onClick={() => {
                      const pk = table.columns[0];
                      const ids = table.rows.map(r => parseInt(r[pk])).filter(v => !isNaN(v));
                      const nid = ids.length > 0 ? Math.max(...ids) + 1 : 1;
                      setAddingToId(table.id);
                      setEditingRow(null);
                      // FIX: Inicializa todas as propriedades para evitar aviso de uncontrolled input
                      const initData = {}; table.columns.forEach(c => initData[c] = "");
                      setFormData({ ...initData, [pk]: nid.toString() });
                    }}
                    className="w-full py-5 bg-emerald-500 text-white rounded-[1.8rem] font-black text-[10px] uppercase shadow-lg shadow-emerald-500/10 hover:bg-emerald-600 transition-all hover:shadow-emerald-500/30 active:scale-95"
                  >
                    + Novo Registro
                  </button>
                ) : addingToId === table.id && (
                  <div className="mt-2 p-6 bg-white rounded-[2rem] border-2 border-blue-100 shadow-inner animate-in fade-in slide-in-from-top-4">
                    <h4 className="text-[10px] font-black text-blue-600 uppercase mb-4 text-center tracking-widest">{editingRow ? "Editar Registro" : "Novo Registro"}</h4>
                    <div className="grid grid-cols-1 gap-4">
                      {table.columns.map((c, i) => (
                        <div key={c}>
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{c}</label>
                          <input 
                            value={formData[c] || ""} 
                            disabled={i === 0 && !editingRow}
                            onChange={e => setFormData({...formData, [c]: e.target.value})}
                            className="w-full p-3 border-none rounded-xl bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-400 shadow-sm" 
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-6">
                      <button onClick={() => saveRow(table.id)} className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95">Gravar</button>
                      <button onClick={() => {setAddingToId(null); setEditingRow(null); setFormData({});}} className="flex-1 bg-slate-200 text-slate-500 py-3 rounded-xl font-black text-[10px] uppercase">Sair</button>
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