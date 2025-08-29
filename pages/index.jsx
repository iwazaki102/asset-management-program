import React, { useEffect, useMemo, useState } from "react";

/** @typedef {{id:string,name:string,type:"System"|"Subsystem"|"Component",level:number,parentId:string|null,code?:string,notes?:string,createdAt:string}} Node */

// ===============================
// App Metadata
// ===============================
const STORAGE_KEY = "asrs.v17_14_2.ui_refresh";
const BUILD_VERSION = "v7.14.2 – Tailwind Refresh";
const APP_TITLE = "Module 1 – Asset Registry & Hierarchy";

// ===============================
// Utils & Helpers
// ===============================
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const cn = (...c)=> c.filter(Boolean).join(" ");

/** Starter sample (empty by default) */
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

// ===============================
// Tiny UI Primitives (modern Tailwind)
// ===============================
function Card({className, children}){
  return <div className={cn("bg-white/90 backdrop-blur rounded-2xl border border-gray-200/60 shadow-sm", className)}>{children}</div>;
}
function CardHeader({title, actions}){
  return (
    <div className="px-4 py-3 border-b border-gray-200/60 flex items-center justify-between">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      <div className="flex gap-2">{actions}</div>
    </div>
  );
}
function SectionTitle({children}){ return <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{children}</h1>; }
function Muted({children}){ return <p className="text-sm text-gray-500">{children}</p>; }
function Label({children}){ return <label className="text-xs font-medium text-gray-600">{children}</label>; }
function Input(props){ return <input {...props} className={cn("w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-xs placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:bg-gray-50 disabled:text-gray-500", props.className)} />; }
function Textarea(props){ return <textarea {...props} className={cn("w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-xs placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:bg-gray-50 disabled:text-gray-500", props.className)} />; }
function Select(props){ return <select {...props} className={cn("w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:bg-gray-50 disabled:text-gray-500", props.className)} />; }
function Button({variant="default", className, ...rest}){
  const base = "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition";
  const variants = {
    default: "bg-violet-600 text-white hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
    subtle: "bg-gray-100 text-gray-900 hover:bg-gray-200",
    ghost: "bg-transparent text-gray-700 hover:bg-gray-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
    warning: "bg-amber-100 text-amber-900 hover:bg-amber-200",
    outline: "border border-gray-300 text-gray-800 hover:bg-gray-50"
  };
  return <button {...rest} className={cn(base, variants[variant], className)} />;
}
function Badge({children}){ return <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs text-gray-700">{children}</span>; }

// ===============================
// App Component
// ===============================
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

  // ===== CSV/JSON HELPERS + Smoke Tests =====
  function csvFromNodes(list /** @type {Node[]} */){
    const header = ["id","name","type","level","parentId","code","notes","createdAt"]; 
    const rows = list.map(n=> header.map(h=> (n[h]??"").toString().replaceAll('"','""')));
    return [header.join(","), ...rows.map(r=> r.map(v=>`"${v}"`).join(","))].join("\n");
  }
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
  function LevelBadge({level}){ return <Badge>L{level}</Badge>; }

  // ===============================
  // Render
  // ===============================
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <SectionTitle>{APP_TITLE} <span className="text-gray-400 font-normal">({BUILD_VERSION})</span></SectionTitle>
          <Muted>Enter asset data, store locally, and display in a table & graphical hierarchy. Subsystem Level starts at 1.</Muted>
        </div>

        {/* Two columns */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* LEFT: Add Node */}
          <Card>
            <CardHeader title="Add Node" actions={null} />
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input placeholder="e.g. Trainset Series 12 / Brake Unit / Master Controller" value={form.name} onChange={e=> setForm(s=>({...s, name:e.target.value}))} />
              </div>

              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.type} onChange={e=>{
                  const t = /** @type {"System"|"Subsystem"|"Component"} */(e.target.value);
                  setForm(s=>{
                    if(t==="System") return {...s, type:t, level:1, parentId:null};
                    if(t==="Subsystem") return {...s, type:t, level:2, parentId:null};
                    return {...s, type:t, level: Math.max(3, Number(s.level)||3)};
                  });
                  setUserTouchedParent(false);
                }}>
                  <option value="System">System</option>
                  <option value="Subsystem">Subsystem</option>
                  <option value="Component">Component</option>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Subsystem Level (active when Type = Subsystem)</Label>
                <Input type="number" min={1} step={1} disabled={form.type!=="Subsystem"} value={form.type==="Subsystem"? form.level: ""} onChange={e=> setForm(s=>({...s, level: Number(e.target.value||2)}))} />
              </div>

              <div className="space-y-1">
                <Label>Parent (auto empty)</Label>
                {form.type==="System" ? (
                  <Input value="— None (Root) —" disabled />
                ) : (
                  <Select value={form.parentId ?? ""} onChange={e=>{ setUserTouchedParent(true); setForm(s=>({...s, parentId: e.target.value===""? null : String(e.target.value)})); }}>
                    {parentOptions.length>1 ? <option value="">— None (Root) —</option> : null}
                    {parentOptions.map(p=> (<option key={p.id} value={p.id}>{p.name} [{p.type}]</option>))}
                    {parentOptions.length===0 ? <option value="">(no eligible parent)</option> : null}
                  </Select>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Code</Label>
                  <Input value={form.code} onChange={e=> setForm(s=>({...s, code:e.target.value}))} />
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Textarea rows={2} value={form.notes} onChange={e=> setForm(s=>({...s, notes:e.target.value}))} />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                {editingId ? (
                  <>
                    <Button onClick={saveEdit}>Save</Button>
                    <Button variant="subtle" onClick={clearForm}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <Button onClick={addNode}>Add</Button>
                    <Button variant="danger" onClick={()=> setNodes([])}>Clear All</Button>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* RIGHT: Asset Table */}
          <Card>
            <CardHeader title="Asset Table" actions={null} />
            <div className="p-4">
              <div className="flex flex-wrap gap-2 items-center mb-3">
                <Select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
                  <option>All Types</option>
                  <option>System</option>
                  <option>Subsystem</option>
                  <option>Component</option>
                </Select>
                <Select value={levelFilter} onChange={e=>setLevelFilter(e.target.value)}>
                  <option>All Levels</option>
                  <option>1</option>
                  <option>2</option>
                  <option>3</option>
                  <option>4</option>
                  <option>5</option>
                </Select>
                <Input placeholder="Search name/type/ID..." value={q} onChange={e=>setQ(e.target.value)} />
                <Button variant="subtle" onClick={()=>setShowTree(s=>!s)}>{showTree?"Hide Tree":"Show Tree"}</Button>
                <Button variant="outline" onClick={exportJSON}>Export JSON</Button>
                <Button variant="outline" onClick={exportCSV}>Export CSV</Button>
                <label className="inline-flex items-center">
                  <input type="file" accept="application/json" className="hidden" onChange={importJSON}/>
                  <Button variant="subtle" as="span">Import JSON</Button>
                </label>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50/80 text-left text-xs uppercase text-gray-600">
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
                      <tr key={n.id} className="border-b last:border-b-0 hover:bg-gray-50/60">
                        <td className="p-2 text-sm text-gray-900">{n.name}</td>
                        <td className="p-2 text-sm text-gray-700">{n.type}</td>
                        <td className="p-2 text-sm"><LevelBadge level={n.level}/></td>
                        <td className="p-2 text-sm text-gray-700">{n.parentId??"(root)"}</td>
                        <td className="p-2 text-sm font-mono text-gray-700">{n.id}</td>
                        <td className="p-2 text-sm text-gray-700">{new Date(n.createdAt).toLocaleString()}</td>
                        <td className="p-2 text-sm">
                          <div className="flex gap-2">
                            <Button className="px-2 py-1" onClick={()=>{ setEditingId(n.id); setForm({ id:n.id, name:n.name, type:n.type, level:n.level, parentId:n.parentId, code:n.code??"", notes:n.notes??"" }); setUserTouchedParent(false); }}>Edit</Button>
                            <Button variant="danger" className="px-2 py-1" onClick={()=>removeNode(n.id)}>Delete</Button>
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
          </Card>
        </div>

        {/* Graphical Tree */}
        <Card className="mt-6">
          <CardHeader title="System Hierarchy (Graphical)" actions={
            <div className="flex gap-2">
              <Button variant="subtle">Collapse All</Button>
              <Button variant="subtle">Expand All</Button>
              <Button variant="subtle">Full Screen</Button>
              <Button variant="subtle" onClick={()=>setShowTree(s=>!s)}>{showTree?"Hide":"Show"}</Button>
            </div>
          }/>
          {showTree ? (
            <div className="p-4">
              {nodes.length ? (
                <div className="text-sm">
                  <ul>
                    {roots.map(r=> (
                      <li key={r.id} className="mb-1">
                        <div className="flex items-center gap-2">
                          <LevelBadge level={r.level}/>
                          <span className="font-medium text-gray-900">{r.name}</span>
                          <span className="text-xs text-gray-500">[{r.type}]</span>
                        </div>
                        {r.children?.length ? (
                          <div className="pl-5 border-l mt-1">
                            <ul>
                              {r.children.map(c1 => (
                                <li key={c1.id} className="mb-1">
                                  <div className="flex items-center gap-2">
                                    <LevelBadge level={c1.level}/>
                                    <span className="text-gray-900">{c1.name}</span>
                                    <span className="text-xs text-gray-500">[{c1.type}]</span>
                                  </div>
                                  {c1.children?.length ? (
                                    <div className="pl-5 border-l mt-1">
                                      <ul>
                                        {c1.children.map(c2 => (
                                          <li key={c2.id} className="mb-1">
                                            <div className="flex items-center gap-2">
                                              <LevelBadge level={c2.level}/>
                                              <span className="text-gray-900">{c2.name}</span>
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
                <p className="text-sm text-gray-500">No nodes yet. Add a System first, then Subsystems/Components.</p>
              )}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
