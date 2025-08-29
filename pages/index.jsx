import React, { useEffect, useMemo, useState } from "react";

/** @typedef {{id:string,name:string,type:"System"|"Subsystem"|"Component",level:number,parentId:string|null,code?:string,notes?:string,createdAt:string}} Node */

const STORAGE_KEY = "asrs.v17_14_1.ui_match";
const BUILD_VERSION = "v7.14.1 (UI‑Match)";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const SAMPLE /** @type {Node[]} */ = [];

function byName(a,b){return a.name.localeCompare(b.name);} 
function byLevelThenName(a,b){return (a.level-b.level)||byName(a,b);} 

function wouldCreateCycle(candidate /** @type {Node} */, nodes /** @type {Node[]} */){
  let pid = candidate.parentId; while(pid){ if(pid===candidate.id) return true; const p = nodes.find(n=>n.id===pid); if(!p) break; pid=p.parentId; } return false;
}

function nameExistsAtSameParent(nodes,name,parentId,type,excludeId){
  const key = String(name).trim().toLowerCase();
  return nodes.some(n=> n.id!==excludeId && (n.parentId??null)===(parentId??null) && n.type===type && String(n.name).trim().toLowerCase()===key);
}

function validateCandidate(c /** @type {Node} */, nodes /** @type {Node[]} */){
  if(!String(c.name).trim()) return "Name is required";
  const lvl = Number(c.level);
  if(!Number.isInteger(lvl)||lvl<1) return "Level must be an integer ≥ 1";
  const parent = c.parentId ? nodes.find(n=>n.id===c.parentId) : null;

  if(c.type==="System"){ if(lvl!==1) return "System must be at Level 1"; if(c.parentId!==null) return "System must not have a parent"; }
  else if(c.type==="Subsystem"){ if(lvl!==2) return "Subsystem must be at Level 2"; if(!parent) return "Choose a parent (System)"; if(parent.type!=="System") return "Parent of Subsystem must be a System"; }
  else if(c.type==="Component"){ if(!parent) return "Choose a parent (System or Subsystem)"; if(!(parent.type==="System"||parent.type==="Subsystem")) return "Parent of Component must be a System or a Subsystem"; if(lvl<3) return "Component should be at Level 3 or deeper"; }
  else return "Invalid node type";

  if(wouldCreateCycle(c,nodes)) return "Invalid parent: would create a cycle";
  if(nameExistsAtSameParent(nodes,c.name,c.parentId,c.type,c.id)) return "Duplicate name under the same parent";
  return null;
}

export default function App(){
  // ===== DATA =====
  const [nodes,setNodes] = useState/** @type {React.SetStateAction<Node[]>} */(()=>{
    try{const raw=localStorage.getItem(STORAGE_KEY); const parsed=raw?JSON.parse(raw):null; if(Array.isArray(parsed)) return parsed; if(Array.isArray(parsed?.nodes)) return parsed.nodes;}catch{} return SAMPLE;
  });
  useEffect(()=>{ localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes)); },[nodes]);

  // ===== ADD/EDIT FORM =====
  const [form,setForm] = useState({ id:"", name:"", type/** @type {"System"|"Subsystem"|"Component"} */: "System", level:1, parentId/** @type {string|null} */: null, code:"", notes:"" });
  const [editingId,setEditingId] = useState/** @type {string|null} */(null);
  const [userTouchedParent,setUserTouchedParent] = useState(false);

  // ===== FILTERS / TABLE =====
  const [typeFilter,setTypeFilter] = useState("All Types");
  const [levelFilter,setLevelFilter] = useState("All Levels");
  const [q,setQ] = useState("");
  const [showTree,setShowTree] = useState(true);

  // ===== PARENT OPTIONS (Add/Edit) =====
  const parentOptions = useMemo(()=>{
    if(form.type==="System") return [];
    if(form.type==="Subsystem") return nodes.filter(n=>n.type==="System").sort(byName);
    if(form.type==="Component") return nodes.filter(n=>n.type==="System"||n.type==="Subsystem").sort(byLevelThenName);
    return [];
  },[form.type,nodes]);

  useEffect(()=>{ setUserTouchedParent(false); },[form.type,form.level]);

  useEffect(()=>{
    if(userTouchedParent) return;
    if(form.type==="System"){ if(form.level!==1||form.parentId!==null) setForm(s=>({...s, level:1, parentId:null})); return; }
    if(form.type==="Subsystem"){ if(form.level!==2) setForm(s=>({...s, level:2})); if(form.parentId && !parentOptions.some(p=>p.id===form.parentId)) setForm(s=>({...s,parentId:null})); if(!form.parentId && parentOptions.length===1) setForm(s=>({...s,parentId:parentOptions[0].id})); return; }
    if(form.type==="Component"){ if(form.level<3) setForm(s=>({...s, level:3})); if(form.parentId && !parentOptions.some(p=>p.id===form.parentId)) setForm(s=>({...s,parentId:null})); if(!form.parentId && parentOptions.length===1) setForm(s=>({...s,parentId:parentOptions[0].id})); return; }
  },[form.type,form.level,form.parentId,parentOptions,userTouchedParent]);

  // ===== ROOTS (Tree) =====
  const roots = useMemo(()=>{
    const map = new Map(nodes.map(n=>[n.id,{...n,children:[]} ]));
    const out = [];
    for(const n of map.values()){
      if(n.parentId){ const p=map.get(n.parentId); if(p) p.children.push(n); }
      else out.push(n);
    }
    const sortRec = (arr)=>{ arr.sort(byLevelThenName); for(const x of arr) sortRec(x.children); };
    sortRec(out); return out;
  },[nodes]);

  // ===== FILTERED TABLE =====
  const filtered = useMemo(()=>{
    return nodes.filter(n=>{
      const okType = typeFilter==="All Types" || n.type===typeFilter;
      const okLevel = levelFilter==="All Levels" || String(n.level)===String(levelFilter);
      const okQ = !q.trim() || [n.name,n.type,n.id,n.code,n.notes].filter(Boolean).some(s=>String(s).toLowerCase().includes(q.toLowerCase()));
      return okType && okLevel && okQ;
    }).sort(byLevelThenName);
  },[nodes,typeFilter,levelFilter,q]);

  // ===== PRE-SUBMIT CHECK (avoid confusing alerts) =====
  function preSubmitCheck(c /** @type {Node} */){
    if(c.type==="System") return null;
    if(c.type==="Subsystem"){
      const candidates = nodes.filter(n=>n.type==="System");
      if(c.parentId) return null; // user picked
      if(candidates.length===1){ c.parentId=candidates[0].id; return null; }
      if(candidates.length===0) return "Please add a System first.";
      return "Multiple parents found. Please choose a Parent (System).";
    }
    if(c.type==="Component"){
      const candidates = nodes.filter(n=>n.type==="System"||n.type==="Subsystem");
      if(c.parentId) return null;
      if(candidates.length===1){ c.parentId=candidates[0].id; return null; }
      if(candidates.length===0) return "Please add a System or a Subsystem first.";
      return "Multiple parents found. Please choose a Parent (System or Subsystem).";
    }
    return null;
  }

  // ===== CRUD =====
  function clearForm(){ setEditingId(null); setForm({ id:"", name:"", type:"System", level:1, parentId:null, code:"", notes:"" }); setUserTouchedParent(false); }

  function addNode(){
    const candidate /** @type {Node} */ = {
      id: `N-${uid()}`,
      name: String(form.name||"").trim(),
      type: form.type,
      level: Number(form.level)|| (form.type==="System"?1: form.type==="Subsystem"?2:3),
      parentId: form.parentId ?? null,
      code: form.code?.trim()||"",
      notes: form.notes?.trim()||"",
      createdAt: new Date().toISOString()
    };
    const pre = preSubmitCheck(candidate); if(pre){ alert(pre); return; }
    const err = validateCandidate(candidate,nodes); if(err){ alert(err); return; }
    setNodes(prev=>[...prev,candidate]);
    clearForm();
  }

  function saveEdit(){
    if(!editingId) return;
    const candidate /** @type {Node} */ = {
      id: editingId,
      name: String(form.name||"").trim(),
      type: form.type,
      level: Number(form.level)|| (form.type==="System"?1: form.type==="Subsystem"?2:3),
      parentId: form.parentId ?? null,
      code: form.code?.trim()||"",
      notes: form.notes?.trim()||"",
      createdAt: nodes.find(n=>n.id===editingId)?.createdAt || new Date().toISOString()
    };
    const pre = preSubmitCheck(candidate); if(pre){ alert(pre); return; }
    const err = validateCandidate(candidate,nodes); if(err){ alert(err); return; }
    setNodes(prev=> prev.map(n=> n.id===editingId? {...n,...candidate}: n));
    clearForm();
  }

  function removeNode(id){
    const toDelete = new Set([id]);
    let changed = true;
    while(changed){
      changed=false;
      for(const n of nodes){
        if(n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)){ toDelete.add(n.id); changed=true; }
      }
    }
    setNodes(prev=> prev.filter(n=> !toDelete.has(n.id)));
    if(editingId===id) clearForm();
  }

  // ===== CSV/JSON HELPERS =====
  function csvFromNodes(list /** @type {Node[]} */){
    const header = ["id","name","type","level","parentId","code","notes","createdAt"]; 
    const rows = list.map(n=> header.map(h=> (n[h]??"").toString().replaceAll('"','""')));
    // IMPORTANT: newline must be "\n" to avoid unterminated string constant
    return [header.join(","), ...rows.map(r=> r.map(v=>`"${v}"`).join(","))].join("\n");
  }

  // ===== EXPORT/IMPORT =====
  function exportJSON(){
    const blob = new Blob([JSON.stringify({version:BUILD_VERSION, nodes}, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`module1-assets-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
  }
  function exportCSV(){
    const csv = csvFromNodes(nodes);
    const blob = new Blob([csv], {type:"text/csv"});
    const url = URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`module1-assets-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  function importJSON(e){
    const file = e.target.files?.[0]; if(!file) return; const reader=new FileReader();
    reader.onload=()=>{ try{ const data=JSON.parse(String(reader.result||"")); const list = Array.isArray(data)?data: (Array.isArray(data?.nodes)?data.nodes: null); if(!Array.isArray(list)) throw new Error("Invalid file");
      const clean = list.map(x=>({ id:String(x.id||`N-${uid()}`), name:String(x.name||"Unnamed"), type: x.type==="System"||x.type==="Subsystem"||x.type==="Component"? x.type: "Component", level:Number(x.level)||3, parentId: x.parentId??null, code:String(x.code||""), notes:String(x.notes||""), createdAt: x.createdAt || new Date().toISOString() }));
      setNodes(clean);
    }catch{ alert("Invalid JSON file"); }
    (e.target).value=""; };
    reader.readAsText(file);
  }

  // ===== DEV SMOKE TESTS =====
  function runCsvSmokeTests(){
    try{
      const sample /** @type {Node[]} */ = [
        {id:"SYS-A", name:"Foo, Inc", type:"System", level:1, parentId:null, code:'C"1', notes:"Line1\nLine2", createdAt:"2025-01-01T00:00:00Z"},
        {id:"SUB-B", name:"Bar", type:"Subsystem", level:2, parentId:"SYS-A", code:"X", notes:"", createdAt:"2025-01-02T00:00:00Z"},
      ];
      const csv = csvFromNodes(sample);
      console.assert(csv.includes('"Foo, Inc"'), 'CSV should quote commas');
      console.assert(csv.includes('C""1'), 'CSV should escape quotes');
      console.assert(csv.split("\n").length >= 2, 'CSV should contain header + rows');
    }catch(err){ console.warn('[CSV tests] skipped or failed:', err); }
  }
  useEffect(()=>{ runCsvSmokeTests(); },[]);

  // ===== SMALL UI HELPERS =====
  function LevelBadge({level}){ return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 border">L{level}</span>; }

  // ===== RENDER =====
  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Module 1 – Asset Registry & Hierarchy ({BUILD_VERSION})</h1>
          <p className="text-sm text-gray-500">Enter asset data, store locally, and display in a table & graphical hierarchy. Subsystem Level starts at 1.</p>
        </div>

        {/* Two columns */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* LEFT: Add Node */}
          <div className="bg-white rounded-2xl shadow-sm border p-4">
            <h2 className="font-semibold mb-3">Add Node</h2>

            <div className="space-y-3">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs text-gray-600">Name</label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g. Trainset Series 12 / Brake Unit / Master Controller"
                  value={form.name}
                  onChange={e=> setForm(s=>({...s, name:e.target.value}))}
                />
              </div>

              {/* Type */}
              <div className="space-y-1">
                <label className="text-xs text-gray-600">Type</label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={form.type}
                  onChange={e=>{
                    const t = /** @type {"System"|"Subsystem"|"Component"} */(e.target.value);
                    setForm(s=>{
                      if(t==="System") return {...s, type:t, level:1, parentId:null};
                      if(t==="Subsystem") return {...s, type:t, level:2, parentId:null};
                      return {...s, type:t, level: Math.max(3, Number(s.level)||3)};
                    });
                    setUserTouchedParent(false);
                  }}
                >
                  <option value="System">System</option>
                  <option value="Subsystem">Subsystem</option>
                  <option value="Component">Component</option>
                </select>
              </div>

              {/* Subsystem Level helper (only visible for Subsystem) */}
              <div className="space-y-1">
                <label className="text-xs text-gray-600">Subsystem Level (active when Type = Subsystem)</label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-50"
                  placeholder="e.g. 1, 2, 3"
                  type="number"
                  min={1}
                  step={1}
                  disabled={form.type!=="Subsystem"}
                  value={form.type==="Subsystem"? form.level: ""}
                  onChange={e=> setForm(s=>({...s, level: Number(e.target.value||2)}))}
                />
              </div>

              {/* Parent */}
              <div className="space-y-1">
                <label className="text-xs text-gray-600">Parent (auto empty)</label>
                {form.type==="System" ? (
                  <input className="w-full border rounded px-3 py-2 text-sm bg-gray-50" value="— None (Root) —" disabled />
                ) : (
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={form.parentId ?? ""}
                    onChange={e=>{ setUserTouchedParent(true); setForm(s=>({...s, parentId: e.target.value===""? null : String(e.target.value)})); }}
                  >
                    {parentOptions.length>1 ? <option value="">— None (Root) —</option> : null}
                    {parentOptions.map(p=> (
                      <option key={p.id} value={p.id}>{p.name} [{p.type}]</option>
                    ))}
                    {parentOptions.length===0 ? <option value="">(no eligible parent)</option> : null}
                  </select>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-1">
                {editingId ? (
                  <>
                    <button className="px-4 py-2 rounded-lg bg-violet-600 text-white" onClick={saveEdit}>Save</button>
                    <button className="px-4 py-2 rounded-lg bg-gray-100" onClick={clearForm}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="px-4 py-2 rounded-lg bg-violet-600 text-white" onClick={addNode}>Add</button>
                    <button className="px-4 py-2 rounded-lg bg-red-50 text-red-600" onClick={()=> setNodes([])}>Clear All</button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Asset Table */}
          <div className="bg-white rounded-2xl shadow-sm border p-4">
            <h2 className="font-semibold mb-3">Asset Table</h2>

            {/* Toolbar */}
            <div className="flex flex-wrap gap-2 items-center mb-3">
              <select className="border rounded px-3 py-2 text-sm" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
                <option>All Types</option>
                <option>System</option>
                <option>Subsystem</option>
                <option>Component</option>
              </select>
              <select className="border rounded px-3 py-2 text-sm" value={levelFilter} onChange={e=>setLevelFilter(e.target.value)}>
                <option>All Levels</option>
                <option>1</option>
                <option>2</option>
                <option>3</option>
                <option>4</option>
                <option>5</option>
              </select>
              <input className="border rounded px-3 py-2 text-sm flex-1 min-w-[160px]" placeholder="Search name/type/ID..." value={q} onChange={e=>setQ(e.target.value)} />
              <button className="px-3 py-2 rounded-lg bg-gray-100" onClick={()=>setShowTree(s=>!s)}>{showTree?"Hide Tree":"Show Tree"}</button>
              <button className="px-3 py-2 rounded-lg bg-gray-100" onClick={exportJSON}>Export JSON</button>
              <button className="px-3 py-2 rounded-lg bg-gray-100" onClick={exportCSV}>Export CSV</button>
              <label className="px-3 py-2 rounded-lg bg-gray-100 cursor-pointer">Import JSON<input type="file" accept="application/json" className="hidden" onChange={importJSON}/></label>
            </div>

            {/* Table */}
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 text-left text-xs uppercase">
                  <tr>
                    <th className="p-2">Name</th>
                    <th className="p-2 w-28">Type</th>
                    <th className="p-2 w-20">Level</th>
                    <th className="p-2 w-56">Parent</th>
                    <th className="p-2 w-56">ID</th>
                    <th className="p-2 w-40">Created</th>
                    <th className="p-2 w-32">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(n=> (
                    <tr key={n.id} className="border-b">
                      <td className="p-2 text-sm">{n.name}</td>
                      <td className="p-2 text-sm">{n.type}</td>
                      <td className="p-2 text-sm"><LevelBadge level={n.level}/></td>
                      <td className="p-2 text-sm">{n.parentId??"(root)"}</td>
                      <td className="p-2 text-sm">{n.id}</td>
                      <td className="p-2 text-sm">{new Date(n.createdAt).toLocaleString()}</td>
                      <td className="p-2 text-sm">
                        <div className="flex gap-2">
                          <button className="px-2 py-1 text-xs rounded bg-blue-600 text-white" onClick={()=>{
                            setEditingId(n.id); setForm({ id:n.id, name:n.name, type:n.type, level:n.level, parentId:n.parentId, code:n.code??"", notes:n.notes??"" }); setUserTouchedParent(false);
                          }}>Edit</button>
                          <button className="px-2 py-1 text-xs rounded bg-red-600 text-white" onClick={()=>removeNode(n.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filtered.length ? (
                    <tr><td className="p-3 text-sm text-gray-500" colSpan={7}>No data yet</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Graphical Tree */}
        <div className="bg-white rounded-2xl shadow-sm border p-4 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">System Hierarchy (Graphical)</h2>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded bg-gray-100">Collapse All</button>
              <button className="px-3 py-1.5 rounded bg-gray-100">Expand All</button>
              <button className="px-3 py-1.5 rounded bg-gray-100">Full Screen</button>
              <button className="px-3 py-1.5 rounded bg-gray-100" onClick={()=>setShowTree(s=>!s)}>{showTree?"Hide":"Show"}</button>
            </div>
          </div>

          {showTree ? (
            nodes.length ? (
              <div className="mt-3 text-sm">
                {/* simple recursive render */}
                <ul>
                  {roots.map(r=> (
                    <li key={r.id} className="mb-1">
                      <div className="flex items-center gap-2">
                        <LevelBadge level={r.level}/>
                        <span className="font-medium">{r.name}</span>
                        <span className="text-xs text-gray-500">[{r.type}]</span>
                      </div>
                      {r.children?.length ? (
                        <div className="pl-5 border-l mt-1">
                          <ul>
                            {r.children.map(c1 => (
                              <li key={c1.id} className="mb-1">
                                <div className="flex items-center gap-2">
                                  <LevelBadge level={c1.level}/>
                                  <span>{c1.name}</span>
                                  <span className="text-xs text-gray-500">[{c1.type}]</span>
                                </div>
                                {c1.children?.length ? (
                                  <div className="pl-5 border-l mt-1">
                                    <ul>
                                      {c1.children.map(c2 => (
                                        <li key={c2.id} className="mb-1">
                                          <div className="flex items-center gap-2">
                                            <LevelBadge level={c2.level}/>
                                            <span>{c2.name}</span>
                                            <span className="text-xs text-gray-500">[{c2.type}]</span>
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-500">No nodes yet. Add a System first, then Subsystems/Components.</p>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
