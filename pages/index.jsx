import React, { useEffect, useMemo, useState } from "react";

/** @typedef {{id:string,name:string,type:"System"|"Subsystem"|"Component",level:number,parentId:string|null,code?:string,notes?:string}} Node */

const STORAGE_KEY = "asrs.v17_14_1_patch_parent";
const BUILD_VERSION = "v17.14.1-patch-parent";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const SAMPLE /** @type {Node[]} */ = [
  { id: "SYS-1", name: "Railway System", type: "System", level: 1, parentId: null, code: "SYS" },
  { id: "SUB-1", name: "Signalling", type: "Subsystem", level: 2, parentId: "SYS-1", code: "SIG" },
  { id: "SUB-2", name: "Power Supply", type: "Subsystem", level: 2, parentId: "SYS-1", code: "PS" },
];

function byName(a, b){ return a.name.localeCompare(b.name); }
function byLevelThenName(a, b){ return (a.level - b.level) || byName(a,b); }

function wouldCreateCycle(candidate /** @type {Node} */, nodes /** @type {Node[]} */){
  let pid = candidate.parentId;
  while (pid){
    if (pid === candidate.id) return true;
    const p = nodes.find(n => n.id === pid);
    if (!p) break;
    pid = p.parentId;
  }
  return false;
}

function nameExistsAtSameParent(nodes, name, parentId, type, excludeId){
  const key = String(name).trim().toLowerCase();
  return nodes.some(n =>
    n.id !== excludeId &&
    (n.parentId ?? null) === (parentId ?? null) &&
    n.type === type &&
    String(n.name).trim().toLowerCase() === key
  );
}

function validateCandidate(c /** @type {Node} */, nodes /** @type {Node[]} */){
  if (!String(c.name).trim()) return "Name is required";

  const lvl = Number(c.level);
  if (!Number.isInteger(lvl) || lvl < 1) return "Level must be an integer ≥ 1";

  const parent = c.parentId ? nodes.find(n => n.id === c.parentId) : null;

  if (c.type === "System"){
    if (lvl !== 1) return "System must be at Level 1";
    if (c.parentId !== null) return "System must not have a parent";
  } else if (c.type === "Subsystem"){
    if (lvl !== 2) return "Subsystem must be at Level 2";
    if (!parent) return "Choose a parent (System)";
    if (parent.type !== "System") return "Parent of Subsystem must be a System";
  } else if (c.type === "Component"){
    if (!parent) return "Choose a parent (System or Subsystem)";
    if (!(parent.type === "System" || parent.type === "Subsystem")){
      return "Parent of Component must be a System or a Subsystem";
    }
    // OPTIONAL: enforce minimal level for Component
    // if (lvl < 3) return "Component should be at Level 3 or deeper";
  } else {
    return "Invalid node type";
  }

  if (wouldCreateCycle(c, nodes)) return "Invalid parent: would create a cycle";

  if (nameExistsAtSameParent(nodes, c.name, c.parentId, c.type, c.id)) {
    return "Duplicate name under the same parent";
  }
  return null;
}

export default function IndexApp(){
  // ===== Data =====
  const [nodes, setNodes] = useState/** @type {React.SetStateAction<Node[]>} */(()=>{
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.nodes)) return parsed.nodes;
    }catch{}
    return SAMPLE;
  });

  // ===== Add/Edit Form State =====
  const [form, setForm] = useState({
    id: "",
    name: "",
    type: /** @type {"System"|"Subsystem"|"Component"} */ ("Subsystem"),
    level: 2,
    parentId: /** @type {string|null} */ (null),
    code: "",
    notes: ""
  });
  const [editingId, setEditingId] = useState/** @type {string|null} */(null);

  // Hormati pilihan user di parent select
  const [userTouchedParent, setUserTouchedParent] = useState(false);

  // Undo stack sederhana
  const [history, setHistory] = useState/** @type {Node[][]} */([]);

  useEffect(()=>{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
  }, [nodes]);

  const roots = useMemo(()=>{
    const map = new Map(nodes.map(n => [n.id, {...n, children: []}]));
    const out = [];
    for (const n of map.values()){
      if (n.parentId){
        const p = map.get(n.parentId);
        if (p) p.children.push(n);
      } else {
        out.push(n);
      }
    }
    const sortRec = (arr)=>{ arr.sort(byLevelThenName); for (const x of arr) sortRec(x.children); };
    sortRec(out);
    return out;
  }, [nodes]);

  const filtered = useMemo(()=>{
    return nodes.slice().sort(byLevelThenName);
  }, [nodes]);

  // Opsi parent valid tergantung type
  const parentOptions = useMemo(()=>{
    if (form.type === "System") return [];
    if (form.type === "Subsystem") {
      return nodes.filter(n => n.type === "System").sort(byName);
    }
    if (form.type === "Component") {
      return nodes.filter(n => n.type === "System" || n.type === "Subsystem").sort(byLevelThenName);
    }
    return [];
  }, [form.type, nodes]);

  // Reset flag sentuhan parent saat konteks berubah
  useEffect(()=>{
    setUserTouchedParent(false);
  }, [form.type, form.level]);

  // Auto-default parent HANYA jika user belum memilih
  useEffect(()=>{
    if (userTouchedParent) return;

    if (form.type === "System"){
      if (form.parentId !== null) setForm(s => ({...s, parentId: null}));
      if (form.level !== 1) setForm(s => ({...s, level: 1}));
      return;
    }

    if (form.type === "Subsystem"){
      if (form.level !== 2) setForm(s => ({...s, level: 2}));
      // jika parent invalid → kosongkan
      if (form.parentId && !parentOptions.some(p => p.id === form.parentId)){
        setForm(s => ({...s, parentId: null}));
        return;
      }
      // satu kandidat → auto pilih
      if (!form.parentId && parentOptions.length === 1){
        setForm(s => ({...s, parentId: parentOptions[0].id}));
      }
      return;
    }

    if (form.type === "Component"){
      if (form.level < 3) setForm(s => ({...s, level: 3}));
      if (form.parentId && !parentOptions.some(p => p.id === form.parentId)){
        setForm(s => ({...s, parentId: null}));
        return;
      }
      if (!form.parentId && parentOptions.length === 1){
        setForm(s => ({...s, parentId: parentOptions[0].id}));
      }
      return;
    }
  }, [form.type, form.level, form.parentId, parentOptions, userTouchedParent]);

  function pushHistory(){ setHistory(h => [...h, nodes]); }
  function undo(){
    setHistory(h => {
      if (!h.length) return h;
      const last = h[h.length - 1];
      setNodes(last);
      return h.slice(0, -1);
    });
  }

  function LevelBadge({ level }){
    return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 border">L{level}</span>;
  }

  // Pre-check untuk menghindari alert yang membingungkan
  function preSubmitCheck(c /** @type {Node} */){
    // System tidak butuh parent
    if (c.type === "System") return null;

    // Subsystem → parent harus System
    if (c.type === "Subsystem"){
      const candidates = nodes.filter(n => n.type === "System");
      if (c.parentId){
        // jika user sudah pilih, biarkan (validasi detail di validateCandidate)
        return null;
      }
      if (candidates.length === 1){
        c.parentId = candidates[0].id;
        return null;
      }
      if (candidates.length === 0) return "Please add a System first.";
      return "Multiple parents found. Please choose a Parent (System).";
    }

    // Component → parent harus System/Subsystem
    if (c.type === "Component"){
      const candidates = nodes.filter(n => n.type === "System" || n.type === "Subsystem");
      if (c.parentId){
        return null;
      }
      if (candidates.length === 1){
        c.parentId = candidates[0].id;
        return null;
      }
      if (candidates.length === 0) return "Please add a System or a Subsystem first.";
      return "Multiple parents found. Please choose a Parent (System or Subsystem).";
    }
    return null;
  }

  function startAdd(type /** @type {"System"|"Subsystem"|"Component"} */){
    setEditingId(null);
    setForm({
      id: "",
      name: "",
      type,
      level: type === "System" ? 1 : type === "Subsystem" ? 2 : 3,
      parentId: type === "System" ? null : null,
      code: "",
      notes: ""
    });
    setUserTouchedParent(false);
  }

  function startEdit(id){
    const n = nodes.find(x => x.id === id);
    if (!n) return;
    setEditingId(id);
    setForm({
      id: n.id,
      name: n.name,
      type: n.type,
      level: n.level,
      parentId: n.parentId,
      code: n.code ?? "",
      notes: n.notes ?? ""
    });
    setUserTouchedParent(false);
  }

  function onChangeField(k, v){
    setForm(s => ({...s, [k]: v}));
  }

  function addNode(){
    const candidate /** @type {Node} */ = {
      id: `N-${uid()}`,
      name: String(form.name || "").trim(),
      type: form.type,
      level: Number(form.level) || (form.type === "System" ? 1 : form.type === "Subsystem" ? 2 : 3),
      parentId: form.parentId ?? null,
      code: form.code?.trim() || "",
      notes: form.notes?.trim() || ""
    };

    const pre = preSubmitCheck(candidate);
    if (pre){ alert(pre); return; }

    const err = validateCandidate(candidate, nodes);
    if (err){ alert(err); return; }

    pushHistory();
    setNodes(prev => [...prev, candidate]);
    setForm({ id:"", name:"", type:"Subsystem", level:2, parentId:null, code:"", notes:"" });
    setUserTouchedParent(false);
  }

  function saveEdit(){
    if (!editingId) return;
    const candidate /** @type {Node} */ = {
      id: editingId,
      name: String(form.name || "").trim(),
      type: form.type,
      level: Number(form.level) || (form.type === "System" ? 1 : form.type === "Subsystem" ? 2 : 3),
      parentId: form.parentId ?? null,
      code: form.code?.trim() || "",
      notes: form.notes?.trim() || ""
    };

    const pre = preSubmitCheck(candidate);
    if (pre){ alert(pre); return; }

    const err = validateCandidate(candidate, nodes);
    if (err){ alert(err); return; }

    pushHistory();
    setNodes(prev => prev.map(n => n.id === editingId ? {...n, ...candidate} : n));
    setEditingId(null);
    setForm({ id:"", name:"", type:"Subsystem", level:2, parentId:null, code:"", notes:"" });
    setUserTouchedParent(false);
  }

  function removeNode(id){
    const target = nodes.find(n => n.id === id);
    if (!target) return;
    // Hapus turunannya juga
    const toDelete = new Set([id]);
    let changed = true;
    while (changed){
      changed = false;
      for (const n of nodes){
        if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)){
          toDelete.add(n.id);
          changed = true;
        }
      }
    }
    pushHistory();
    setNodes(prev => prev.filter(n => !toDelete.has(n.id)));
    if (editingId === id) setEditingId(null);
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">Asset Registry & Hierarchy</h1>
          <p className="text-xs text-gray-500">{BUILD_VERSION} • Parent/type validation fixed</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 rounded bg-gray-200" onClick={undo} disabled={!history.length}>Undo</button>
          <button
            className="px-3 py-1.5 rounded bg-amber-200"
            onClick={()=>{
              pushHistory();
              setNodes(SAMPLE);
            }}
          >Reset Sample</button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        {/* Left: Tree */}
        <div className="border rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Hierarchy</h2>
            <span className="text-xs text-gray-500">{nodes.length} item(s)</span>
          </div>
          <ul className="text-sm">
            {roots.map(r => (
              <li key={r.id} className="mb-1">
                <div className="flex items-center gap-2">
                  <LevelBadge level={r.level} />
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-gray-500">[{r.type}]</span>
                </div>
                {r.children?.length ? (
                  <div className="pl-5 border-l mt-1">
                    <ul>
                      {r.children.map(c1 => (
                        <li key={c1.id} className="mb-1">
                          <div className="flex items-center gap-2">
                            <LevelBadge level={c1.level} />
                            <span>{c1.name}</span>
                            <span className="text-xs text-gray-500">[{c1.type}]</span>
                          </div>
                          {c1.children?.length ? (
                            <div className="pl-5 border-l mt-1">
                              <ul>
                                {c1.children.map(c2 => (
                                  <li key={c2.id} className="mb-1">
                                    <div className="flex items-center gap-2">
                                      <LevelBadge level={c2.level} />
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

        {/* Right: Table + Form */}
        <div className="space-y-4">
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 text-left text-xs uppercase">
                <tr>
                  <th className="p-2 w-16">Lvl</th>
                  <th className="p-2">Name</th>
                  <th className="p-2 w-28">Type</th>
                  <th className="p-2 w-48">Parent</th>
                  <th className="p-2 w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(n => (
                  <tr key={n.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 text-sm whitespace-nowrap"><LevelBadge level={n.level} /></td>
                    <td className="p-2 text-sm">{n.name}</td>
                    <td className="p-2 text-sm">{n.type}</td>
                    <td className="p-2 text-sm">{n.parentId ?? "(root)"}</td>
                    <td className="p-2 text-sm">
                      <div className="flex gap-2">
                        <button className="px-2 py-1 text-xs rounded bg-blue-600 text-white" onClick={()=>startEdit(n.id)}>Edit</button>
                        <button className="px-2 py-1 text-xs rounded bg-red-600 text-white" onClick={()=>removeNode(n.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length ? (
                  <tr><td className="p-3 text-sm text-gray-500" colSpan={5}>No items</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="border rounded-xl p-3">
            <h3 className="font-semibold mb-2">{editingId ? "Edit Node" : "Add Node"}</h3>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-600">Name</label>
                <input className="border rounded px-3 py-2 text-sm w-full" value={form.name} onChange={e=>onChangeField("name", e.target.value)} />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-600">Type</label>
                <select
                  className="border rounded px-3 py-2 text-sm w-full"
                  value={form.type}
                  onChange={e=>{
                    const t = /** @type {"System"|"Subsystem"|"Component"} */(e.target.value);
                    setForm(s=>{
                      const base = {...s, type: t};
                      if (t === "System") return {...base, level: 1, parentId: null};
                      if (t === "Subsystem") return {...base, level: 2, parentId: null};
                      return {...base, level: Math.max(3, Number(s.level)||3), parentId: s.parentId ?? null};
                    });
                    setUserTouchedParent(false);
                  }}
                >
                  <option value="System">System</option>
                  <option value="Subsystem">Subsystem</option>
                  <option value="Component">Component</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-600">Level</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="border rounded px-3 py-2 text-sm w-full"
                  value={form.level}
                  onChange={e=>onChangeField("level", Number(e.target.value || 1))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-600">Parent</label>
                {form.type === "System" ? (
                  <input className="border rounded px-3 py-2 text-sm w-full bg-gray-50" value="(root)" disabled />
                ) : (
                  <select
                    className="border rounded px-3 py-2 text-sm w-full"
                    value={form.parentId ?? ""}
                    onChange={e=>{ setUserTouchedParent(true); onChangeField("parentId", e.target.value === "" ? null : String(e.target.value)); }}
                  >
                    {parentOptions.length > 1 ? <option value="">— Choose Parent —</option> : null}
                    {parentOptions.map(p => (
                      <option key={p.id} value={p.id}>{p.name} [{p.type}]</option>
                    ))}
                    {parentOptions.length === 0 ? <option value="">(no eligible parent)</option> : null}
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-600">Code</label>
                <input className="border rounded px-3 py-2 text-sm w-full" value={form.code} onChange={e=>onChangeField("code", e.target.value)} />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs text-gray-600">Notes</label>
                <textarea rows={3} className="border rounded px-3 py-2 text-sm w-full" value={form.notes} onChange={e=>onChangeField("notes", e.target.value)} />
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              {editingId ? (
                <>
                  <button className="px-3 py-1.5 rounded bg-blue-600 text-white" onClick={saveEdit}>Save</button>
                  <button className="px-3 py-1.5 rounded bg-gray-200" onClick={()=>{
                    setEditingId(null);
                    setForm({ id:"", name:"", type:"Subsystem", level:2, parentId:null, code:"", notes:"" });
                    setUserTouchedParent(false);
                  }}>Cancel</button>
                </>
              ) : (
                <>
                  <button className="px-3 py-1.5 rounded bg-blue-600 text-white" onClick={addNode}>Add</button>
                  <button className="px-3 py-1.5 rounded bg-gray-200" onClick={()=>startAdd("System")}>New System</button>
                  <button className="px-3 py-1.5 rounded bg-gray-200" onClick={()=>startAdd("Subsystem")}>New Subsystem</button>
                  <button className="px-3 py-1.5 rounded bg-gray-200" onClick={()=>startAdd("Component")}>New Component</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 text-xs text-gray-500">
        <p>Build: <span className="font-mono">{BUILD_VERSION}</span></p>
      </div>
    </div>
  );
}
