import React, { useEffect, useMemo, useState } from "react";

/** @typedef {{id:string,name:string,type:"System"|"Subsystem"|"Component",level:number,parentId:string|null,code?:string,notes?:string,createdAt:string}} Node */

// =====================================
// HARD RESET: No Tailwind, self-styled UI
// =====================================
const STORAGE_KEY = "asrs.v17_14_3.naked_ui";
const BUILD_VERSION = "v7.14.3 — Clean Inline UI";

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

// ============ Inline styles (modern, light) ============
const S = {
  page: { minHeight:'100vh', background:'#f7f9fc', fontFamily:'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial', color:'#111827' },
  container: { maxWidth:1000, margin:'0 auto', padding:24 },
  h1: { fontSize:24, fontWeight:700, margin:0 },
  muted: { fontSize:14, color:'#6b7280', marginTop:6 },
  grid2: { display:'grid', gridTemplateColumns:'1fr', gap:24 },
  card: { background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, boxShadow:'0 1px 2px rgba(0,0,0,0.06)' },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid #e5e7eb' },
  cardTitle: { fontSize:16, fontWeight:600, margin:0 },
  body: { padding:16 },
  label: { fontSize:12, fontWeight:600, color:'#4b5563' },
  input: { width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px 12px', fontSize:14, color:'#111827', background:'#fff' },
  row: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  btn: { borderRadius:8, padding:'8px 14px', fontSize:14, fontWeight:600, border:'1px solid #d1d5db', background:'#fff', color:'#1f2937', cursor:'pointer' },
  btnPri: { background:'#6d28d9', borderColor:'#6d28d9', color:'#fff' },
  btnSubtle: { background:'#f3f4f6' },
  btnDanger: { background:'#dc2626', borderColor:'#dc2626', color:'#fff' },
  toolbar: { display:'flex', flexWrap:'wrap', gap:8, alignItems:'center', marginBottom:12 },
  tableWrap: { border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' },
  th: { background:'#f9fafb', textTransform:'uppercase', fontSize:12, color:'#6b7280', textAlign:'left', padding:8 },
  td: { padding:8, fontSize:14, borderTop:'1px solid #eef2f7' },
  badge: { display:'inline-flex', alignItems:'center', border:'1px solid #d1d5db', borderRadius:999, background:'#f9fafb', padding:'2px 8px', fontSize:12, color:'#374151' },
};

export default function App(){
  const [nodes,setNodes] = useState/** @type {React.SetStateAction<Node[]>} */(()=>{
    try{const raw=localStorage.getItem(STORAGE_KEY); const parsed=raw?JSON.parse(raw):null; if(Array.isArray(parsed)) return parsed; if(Array.isArray(parsed?.nodes)) return parsed.nodes;}catch{} return SAMPLE;
  });
  useEffect(()=>{ localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes)); },[nodes]);

  const [form,setForm] = useState({ id:"", name:"", type/** @type {"System"|"Subsystem"|"Component"} */: "System", level:1, parentId/** @type {string|null} */: null, code:"", notes:"" });
  const [editingId,setEditingId] = useState/** @type {string|null} */(null);
  const [userTouchedParent,setUserTouchedParent] = useState(false);

  const [typeFilter,setTypeFilter] = useState("All Types");
  const [levelFilter,setLevelFilter] = useState("All Levels");
  const [q,setQ] = useState("");
  const [showTree,setShowTree] = useState(true);

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

  const filtered = useMemo(()=>{
    return nodes.filter(n=>{
      const okType = typeFilter==="All Types" || n.type===typeFilter;
      const okLevel = levelFilter==="All Levels" || String(n.level)===String(levelFilter);
      const okQ = !q.trim() || [n.name,n.type,n.id,n.code,n.notes].filter(Boolean).some(s=>String(s).toLowerCase().includes(q.toLowerCase()));
      return okType && okLevel && okQ;
    }).sort(byLevelThenName);
  },[nodes,typeFilter,levelFilter,q]);

  function preSubmitCheck(c /** @type {Node} */){
    if(c.type==="System") return null;
    if(c.type==="Subsystem"){
      const candidates = nodes.filter(n=>n.type==="System");
      if(c.parentId) return null; if(candidates.length===1){ c.parentId=candidates[0].id; return null; }
      if(candidates.length===0) return "Please add a System first."; return "Multiple parents found. Please choose a Parent (System).";
    }
    if(c.type==="Component"){
      const candidates = nodes.filter(n=>n.type==="System"||n.type==="Subsystem");
      if(c.parentId) return null; if(candidates.length===1){ c.parentId=candidates[0].id; return null; }
      if(candidates.length===0) return "Please add a System or a Subsystem first."; return "Multiple parents found. Please choose a Parent (System or Subsystem).";
    }
    return null;
  }

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
    setNodes(prev=>[...prev,candidate]); clearForm();
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
    setNodes(prev=> prev.map(n=> n.id===editingId? {...n,...candidate}: n)); clearForm();
  }

  function removeNode(id){
    const toDelete = new Set([id]); let changed = true;
    while(changed){ changed=false; for(const n of nodes){ if(n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)){ toDelete.add(n.id); changed=true; } } }
    setNodes(prev=> prev.filter(n=> !toDelete.has(n.id))); if(editingId===id) clearForm();
  }

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

  // ===== Render =====
  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={{marginBottom:24}}>
          <h1 style={S.h1}>Module 1 – Asset Registry & Hierarchy <span style={{fontWeight:400,color:'#6b7280'}}>({BUILD_VERSION})</span></h1>
          <p style={S.muted}>Enter asset data, store locally, and display in a table & graphical hierarchy. Subsystem Level starts at 1.</p>
        </div>

        {/* Two columns */}
        <div style={S.grid2}>
          {/* LEFT: Add Node */}
          <div style={S.card}>
            <div style={S.header}><h2 style={S.cardTitle}>Add Node</h2></div>
            <div style={S.body}>
              <div style={{marginBottom:10}}>
                <div style={S.label}>Name</div>
                <input style={S.input} placeholder="e.g. Trainset Series 12 / Brake Unit / Master Controller" value={form.name} onChange={e=> setForm(s=>({...s, name:e.target.value}))} />
              </div>

              <div style={{marginBottom:10}}>
                <div style={S.label}>Type</div>
                <select style={S.input} value={form.type} onChange={e=>{
                  const t = /** @type {"System"|"Subsystem"|"Component"} */(e.target.value);
                  setForm(s=>{ if(t==="System") return {...s, type:t, level:1, parentId:null}; if(t==="Subsystem") return {...s, type:t, level:2, parentId:null}; return {...s, type:t, level: Math.max(3, Number(s.level)||3)}; });
                  setUserTouchedParent(false);
                }}>
                  <option value="System">System</option>
                  <option value="Subsystem">Subsystem</option>
                  <option value="Component">Component</option>
                </select>
              </div>

              <div style={{marginBottom:10}}>
                <div style={S.label}>Subsystem Level (active when Type = Subsystem)</div>
                <input style={S.input} placeholder="e.g. 1, 2, 3" type="number" min={1} step={1} disabled={form.type!=="Subsystem"} value={form.type==="Subsystem"? form.level: ""} onChange={e=> setForm(s=>({...s, level: Number(e.target.value||2)}))} />
              </div>

              <div style={{marginBottom:10}}>
                <div style={S.label}>Parent (auto empty)</div>
                {form.type==="System" ? (
                  <input style={{...S.input, background:'#f9fafb'}} value="— None (Root) —" disabled />
                ) : (
                  <select style={S.input} value={form.parentId ?? ""} onChange={e=>{ setUserTouchedParent(true); setForm(s=>({...s, parentId: e.target.value===""? null : String(e.target.value)})); }}>
                    {parentOptions.length>1 ? <option value="">— None (Root) —</option> : null}
                    {parentOptions.map(p=> (<option key={p.id} value={p.id}>{p.name} [{p.type}]</option>))}
                    {parentOptions.length===0 ? <option value="">(no eligible parent)</option> : null}
                  </select>
                )}
              </div>

              <div style={S.row}>
                <div>
                  <div style={S.label}>Code</div>
                  <input style={S.input} value={form.code} onChange={e=> setForm(s=>({...s, code:e.target.value}))} />
                </div>
                <div>
                  <div style={S.label}>Notes</div>
                  <textarea rows={2} style={S.input} value={form.notes} onChange={e=> setForm(s=>({...s, notes:e.target.value}))} />
                </div>
              </div>

              <div style={{display:'flex',gap:8, marginTop:12}}>
                {editingId ? (
                  <>
                    <button style={{...S.btn, ...S.btnPri}} onClick={saveEdit}>Save</button>
                    <button style={{...S.btn, ...S.btnSubtle}} onClick={clearForm}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button style={{...S.btn, ...S.btnPri}} onClick={addNode}>Add</button>
                    <button style={{...S.btn, ...S.btnDanger}} onClick={()=> setNodes([])}>Clear All</button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Asset Table */}
          <div style={S.card}>
            <div style={S.header}><h2 style={S.cardTitle}>Asset Table</h2></div>
            <div style={S.body}>
              <div style={S.toolbar}>
                <select style={S.input} value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
                  <option>All Types</option>
                  <option>System</option>
                  <option>Subsystem</option>
                  <option>Component</option>
                </select>
                <select style={S.input} value={levelFilter} onChange={e=>setLevelFilter(e.target.value)}>
                  <option>All Levels</option>
                  <option>1</option>
                  <option>2</option>
                  <option>3</option>
                  <option>4</option>
                  <option>5</option>
                </select>
                <input style={{...S.input, minWidth:160, flex:1}} placeholder="Search name/type/ID..." value={q} onChange={e=>setQ(e.target.value)} />
                <button style={S.btn} onClick={()=>setShowTree(s=>!s)}>{showTree?"Hide Tree":"Show Tree"}</button>
                <button style={S.btn} onClick={exportJSON}>Export JSON</button>
                <button style={S.btn} onClick={exportCSV}>Export CSV</button>
                <label style={{display:'inline-flex',alignItems:'center',gap:8}}>
                  <input type="file" accept="application/json" onChange={importJSON} />
                  <button style={S.btn}>Import JSON</button>
                </label>
              </div>

              <div style={S.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th style={S.th}>Name</th>
                      <th style={{...S.th, width:110}}>Type</th>
                      <th style={{...S.th, width:80}}>Level</th>
                      <th style={{...S.th, width:220}}>Parent</th>
                      <th style={{...S.th, width:220}}>ID</th>
                      <th style={{...S.th, width:160}}>Created</th>
                      <th style={{...S.th, width:150}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(n=> (
                      <tr key={n.id}>
                        <td style={S.td}>{n.name}</td>
                        <td style={S.td}>{n.type}</td>
                        <td style={S.td}><span style={S.badge}>L{n.level}</span></td>
                        <td style={S.td}>{n.parentId??"(root)"}</td>
                        <td style={S.td}><span style={{fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas', fontSize:13}}>{n.id}</span></td>
                        <td style={S.td}>{new Date(n.createdAt).toLocaleString()}</td>
                        <td style={S.td}>
                          <div style={{display:'flex',gap:8}}>
                            <button style={{...S.btn, ...S.btnPri}} onClick={()=>{ setEditingId(n.id); setForm({ id:n.id, name:n.name, type:n.type, level:n.level, parentId:n.parentId, code:n.code??"", notes:n.notes??"" }); setUserTouchedParent(false); }}>Edit</button>
                            <button style={{...S.btn, ...S.btnDanger}} onClick={()=>removeNode(n.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filtered.length ? (
                      <tr><td style={{...S.td, color:'#6b7280'}} colSpan={7}>No data yet</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Graphical Tree */}
        <div style={{...S.card, marginTop:24}}>
          <div style={S.header}>
            <h2 style={S.cardTitle}>System Hierarchy (Graphical)</h2>
            <div style={{display:'flex',gap:8}}>
              <button style={S.btn}>Collapse All</button>
              <button style={S.btn}>Expand All</button>
              <button style={S.btn}>Full Screen</button>
              <button style={S.btn} onClick={()=>setShowTree(s=>!s)}>{showTree?"Hide":"Show"}</button>
            </div>
          </div>
          {showTree ? (
            <div style={S.body}>
              {nodes.length ? (
                <ul style={{margin:0,paddingLeft:18, listStyle:'none'}}>
                  {roots.map(r=> (
                    <li key={r.id} style={{marginBottom:6}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={S.badge}>L{r.level}</span>
                        <span style={{fontWeight:600}}>{r.name}</span>
                        <span style={{fontSize:12,color:'#6b7280'}}>[{r.type}]</span>
                      </div>
                      {r.children?.length ? (
                        <div style={{borderLeft:'1px solid #e5e7eb', marginTop:6, paddingLeft:12}}>
                          <ul style={{margin:0, paddingLeft:0, listStyle:'none'}}>
                            {r.children.map(c1 => (
                              <li key={c1.id} style={{marginBottom:6}}>
                                <div style={{display:'flex',alignItems:'center',gap:8}}>
                                  <span style={S.badge}>L{c1.level}</span>
                                  <span>{c1.name}</span>
                                  <span style={{fontSize:12,color:'#6b7280'}}>[{c1.type}]</span>
                                </div>
                                {c1.children?.length ? (
                                  <div style={{borderLeft:'1px solid #e5e7eb', marginTop:6, paddingLeft:12}}>
                                    <ul style={{margin:0, paddingLeft:0, listStyle:'none'}}>
                                      {c1.children.map(c2 => (
                                        <li key={c2.id} style={{marginBottom:6}}>
                                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                                            <span style={S.badge}>L{c2.level}</span>
                                            <span>{c2.name}</span>
                                            <span style={{fontSize:12,color:'#6b7280'}}>[{c2.type}]</span>
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
              ) : (
                <p style={{...S.muted, marginTop:6}}>No nodes yet. Add a System first, then Subsystems/Components.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
