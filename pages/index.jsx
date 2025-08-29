import React, { useEffect, useMemo, useState } from "react";

/** @typedef {{id:string,name:string,type:"System"|"Subsystem"|"Component",level:number,parentId:string|null,code?:string,notes?:string,createdAt:string}} Node */

const STORAGE_KEY = "asrs.v17_14_3.ui_modern";
const BUILD_VERSION = "v7.14.3 – Modern UI";

// Utility
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const cn = (...c)=> c.filter(Boolean).join(" ");

const SAMPLE /** @type {Node[]} */ = [];

function byName(a,b){return a.name.localeCompare(b.name);} 
function byLevelThenName(a,b){return (a.level-b.level)||byName(a,b);} 

function wouldCreateCycle(candidate,nodes){
  let pid = candidate.parentId; 
  while(pid){
    if(pid===candidate.id) return true; 
    const p = nodes.find(n=>n.id===pid); 
    if(!p) break; 
    pid=p.parentId; 
  }
  return false;
}

function nameExistsAtSameParent(nodes,name,parentId,type,excludeId){
  const key = String(name).trim().toLowerCase();
  return nodes.some(n=> n.id!==excludeId && (n.parentId??null)===(parentId??null) && n.type===type && String(n.name).trim().toLowerCase()===key);
}

function validateCandidate(c,nodes){
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

// Small UI components
function Card({className, children}){
  return <div className={cn("rounded-2xl border border-gray-200 bg-white shadow-md", className)}>{children}</div>;
}
function CardHeader({title, children}){
  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <h2 className="font-semibold text-gray-800">{title}</h2>
      {children}
    </div>
  );
}
function Input(props){ return <input {...props} className={cn("w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-400", props.className)} />; }
function Select(props){ return <select {...props} className={cn("w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-400", props.className)} />; }
function Textarea(props){ return <textarea {...props} className={cn("w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-400", props.className)} />; }
function Button({variant="default", className, ...rest}){
  const base = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition";
  const variants = {
    default: "bg-violet-600 text-white hover:bg-violet-700",
    subtle: "bg-gray-100 text-gray-800 hover:bg-gray-200",
    danger: "bg-red-600 text-white hover:bg-red-700",
    outline: "border border-gray-300 text-gray-800 hover:bg-gray-50"
  };
  return <button {...rest} className={cn(base, variants[variant], className)} />;
}
function Badge({children}){ return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 border">{children}</span>; }

export default function App(){
  // — Inject Tailwind CDN + Inter font when Tailwind build pipeline isn't present —
  // This ensures modern styling even if the project hasn't been set up with PostCSS.
  React.useEffect(()=>{
    // Inject Inter font
    if(!document.querySelector('link[data-inter-font]')){
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
      link.setAttribute('data-inter-font','1');
      document.head.appendChild(link);
    }
    // If Tailwind is already present (build pipeline), skip
    if(window.tailwind?.version || document.querySelector('script[data-tailwind-cdn]')) return;
    // Add a minimal config first
    const cfg = document.createElement('script');
    cfg.innerHTML = "window.tailwind=window.tailwind||{};window.tailwind.config={theme:{extend:{}}}";
    const cdn = document.createElement('script');
    cdn.src = 'https://cdn.tailwindcss.com';
    cdn.defer = true;
    cdn.setAttribute('data-tailwind-cdn','1');
    document.head.appendChild(cfg);
    document.head.appendChild(cdn);
  },[]);

  const [nodes,setNodes] = useState(()=>{ try{const raw=localStorage.getItem(STORAGE_KEY); const parsed=raw?JSON.parse(raw):null; if(Array.isArray(parsed)) return parsed; if(Array.isArray(parsed?.nodes)) return parsed.nodes;}catch{} return SAMPLE; });
  useEffect(()=>{ localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes)); },[nodes]);

  const [form,setForm] = useState({ id:"", name:"", type:"System", level:1, parentId:null, code:"", notes:"" });
  const [editingId,setEditingId] = useState(null);
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

  function LevelBadge({level}){ return <Badge>L{level}</Badge>; }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 font-sans antialiased">
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Module 1 – Asset Registry & Hierarchy <span className="text-gray-400 text-lg">({BUILD_VERSION})</span></h1>
          <p className="text-sm text-gray-600 mt-1">Enter asset data, store locally, and display in a table & graphical hierarchy. Subsystem Level starts at 1.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader title="Add Node" />
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-600">Name</label>
                <Input placeholder="e.g. Trainset Series 12 / Brake Unit / Master Controller" value={form.name} onChange={e=> setForm(s=>({...s, name:e.target.value}))} />
              </div>
              <div>
                <label className="text-xs text-gray-600">Type</label>
                <Select value={form.type} onChange={e=> setForm(s=>({...s, type:e.target.value}))}>
                  <option value="System">System</option>
                  <option value="Subsystem">Subsystem</option>
                  <option value="Component">Component</option>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Subsystem Level</label>
                <Input type="number" min={1} disabled={form.type!=="Subsystem"} value={form.type==="Subsystem"? form.level: ""} onChange={e=> setForm(s=>({...s, level:Number(e.target.value||2)}))} />
              </div>
              <div>
                <label className="text-xs text-gray-600">Parent</label>
                {form.type==="System" ? (
                  <Input value="— None (Root) —" disabled />
                ) : (
                  <Select value={form.parentId ?? ""} onChange={e=> setForm(s=>({...s,parentId:e.target.value||null}))}>
                    {parentOptions.map(p=> (<option key={p.id} value={p.id}>{p.name} [{p.type}]</option>))}
                  </Select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600">Code</label>
                  <Input value={form.code} onChange={e=> setForm(s=>({...s, code:e.target.value}))} />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Notes</label>
                  <Textarea rows={2} value={form.notes} onChange={e=> setForm(s=>({...s, notes:e.target.value}))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={()=>{}}>Add</Button>
                <Button variant="danger" onClick={()=> setNodes([])}>Clear All</Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Asset Table" />
            <div className="p-4">
              <div className="flex flex-wrap gap-2 mb-3">
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
                </Select>
                <Input placeholder="Search..." value={q} onChange={e=>setQ(e.target.value)} />
                <Button variant="outline">Export JSON</Button>
                <Button variant="outline">Export CSV</Button>
              </div>
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs text-gray-600 uppercase">
                      <th className="p-2">Name</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Level</th>
                      <th className="p-2">Parent</th>
                      <th className="p-2">ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!filtered.length ? <tr><td className="p-3 text-gray-500" colSpan={5}>No data yet</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="System Hierarchy (Graphical)" />
          <div className="p-4">
            {nodes.length ? "render tree" : <p className="text-gray-500 text-sm">No nodes yet. Add a System first, then Subsystems/Components.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
