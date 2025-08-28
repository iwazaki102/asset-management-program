"use client";
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";

// ===== Module 1 – Asset Registry & Hierarchy (Clean Build v7.14.1) =====
// Fixes: Component parent System/Subsystem, Subsystem strict level rules,
//        no false "Multiple parents…" when already selected.
//        Export JSON safe for Next.js.

// ——————————————————————————————————————————————————————————
// Local Storage keys
const LS_KEY = "module1_asset_nodes";
const LS_PREF = {
  showTree: "module1_pref_show_tree",
  activeTab: "module1_pref_active_tab",
  collapsed: "module1_pref_collapsed_ids",
  importPolicy: "module1_pref_import_policy",
};

// ——————————————————————————————————————————————————————————
// Helpers
function uid() { return Math.random().toString(36).slice(2, 10); }
function safeNow() { try { return Date.now(); } catch { return new Date().getTime(); } }
function readKey(key) {
  try { if (typeof window === "undefined") return null; return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function readArray(key) {
  try { if (typeof window === "undefined") return null; const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function save(nodes) { try { if (typeof window !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(nodes)); } catch {} }
function loadInitial() { const arr = readArray(LS_KEY); return arr || []; }

function toTree(nodes) {
  const map = new Map(); nodes.forEach((n) => map.set(n.id, { ...n, children: [] }));
  const roots = [];
  map.forEach((n) => { if (n.parentId && map.has(n.parentId)) map.get(n.parentId).children.push(n); else roots.push(n); });
  return roots;
}
function getDescendantIds(id, list) {
  const out = [id]; list.filter((a) => a.parentId === id).forEach((c) => out.push(...getDescendantIds(c.id, list))); return out;
}
function getAllWithChildrenIds(tree) {
  const ids = []; function walk(n) { if (n.children.length) ids.push(n.id); n.children.forEach(walk); } tree.forEach(walk); return ids;
}

// Rules
function checkParentRule(childType, lvl, parent) {
  if (childType === "System") return { ok: true };
  if (childType === "Subsystem") {
    if (!parent) return { ok: false, err: "Subsystem requires a parent" };
    if (lvl === 1) return parent.type === "System" ? { ok: true } : { ok: false, err: "Parent of L1 must be System" };
    if (parent.type !== "Subsystem" || Number(parent.level) !== lvl - 1)
      return { ok: false, err: `Parent of L${lvl} must be Subsystem L${lvl - 1}` };
    return { ok: true };
  }
  if (childType === "Component") {
    return parent && (parent.type === "System" || parent.type === "Subsystem")
      ? { ok: true } : { ok: false, err: "Parent of Component must be System or Subsystem" };
  }
  return { ok: false, err: "Unknown type" };
}
function findDuplicateNode(list, key, ignoreId = null) {
  const nm = String(key.name).trim().toLowerCase();
  return list.find((x) => {
    if (ignoreId && x.id === ignoreId) return false;
    if (x.type !== key.type) return false;
    if (String(x.parentId || "") !== String(key.parentId || "")) return false;
    if (x.type === "Subsystem" && Number(x.level) !== Number(key.level)) return false;
    return x.name.trim().toLowerCase() === nm;
  }) || null;
}
function nextIndexedName(base, siblings) {
  const root = base.replace(/\(\d+\)$/, "");
  const used = new Set();
  siblings.forEach((s) => {
    const m = s.match(new RegExp("^" + root + "(?:\\((\\d+)\\))?$"));
    if (m) used.add(m[1] ? Number(m[1]) : 0);
  });
  let n = 1; while (used.has(n)) n++; return `${root}(${n})`;
}

// ——————————————————————————————————————————————————————————
// UI atoms
function Button({ children, className = "", ...p }) {
  return <button {...p} className={"px-3 py-1.5 border rounded-xl " + className}>{children}</button>;
}
function Label({ children }) { return <label className="text-xs text-slate-700">{children}</label>; }
function TextInput({ ...p }) { return <input {...p} className="w-full border rounded px-2 py-1" />; }
function Select({ children, ...p }) { return <select {...p} className="w-full border rounded px-2 py-1">{children}</select>; }
function Card({ children }) { return <div className="p-5 rounded-2xl border bg-white shadow">{children}</div>; }

function Tree({ nodes, collapsed, onToggle }) {
  return (
    <ul className="pl-4">
      {nodes.map((n) => {
        const hasChild = n.children.length > 0;
        const isCollapsed = collapsed.has(n.id);
        return (
          <li key={n.id}>
            <div className="flex items-center gap-2">
              {hasChild ? (
                <button onClick={() => onToggle(n.id)} className="w-6 h-6 border rounded-full text-xs">
                  {isCollapsed ? "+" : "−"}
                </button>
              ) : <span className="w-6 h-6" />}
              <span className="font-medium">{n.name}{n.type === "Subsystem" ? ` (L${n.level})` : ""}</span>
              <span className="text-xs text-slate-500">{n.type}</span>
            </div>
            {hasChild && !isCollapsed && (
              <div className="pl-5 border-l">
                <Tree nodes={n.children} collapsed={collapsed} onToggle={onToggle} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ——————————————————————————————————————————————————————————
// Page Component
function HomePage() {
  const [nodes, setNodes] = useState([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("System");
  const [parentId, setParentId] = useState("");
  const [subsystemLevel, setSubsystemLevel] = useState("");

  useEffect(() => { setNodes(loadInitial()); }, []);
  useEffect(() => { save(nodes); }, [nodes]);

  const hasSystem = nodes.some((n) => n.type === "System");
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const tree = toTree(nodes);

  function addNode() {
    try {
      const nm = name.trim(); if (!nm) { alert("Name required"); return; }
      if (type === "System" && hasSystem) { alert("Only one System allowed"); return; }

      let parent = parentId ? nodes.find((n) => n.id === parentId) : null;
      if (parentId && !parent) { alert("Selected Parent not found. Reselect."); return; }

      let lvl = null;
      if (type === "Subsystem") {
        if (!subsystemLevel.trim()) { alert("Enter Level"); return; }
        lvl = Number(subsystemLevel);
        if (!Number.isFinite(lvl) || lvl < 1) { alert("Level must be >=1"); return; }
        const candidates = lvl === 1 ? nodes.filter((n) => n.type === "System")
          : nodes.filter((n) => n.type === "Subsystem" && Number(n.level) === lvl - 1);
        if (parent) {
          if (!candidates.some((c) => c.id === parent.id)) {
            alert(lvl === 1 ? "Parent must be System" : `Parent must be Subsystem L${lvl - 1}`);
            return;
          }
        } else {
          if (candidates.length === 1) parent = candidates[0];
          else { alert("Please choose a Parent manually"); return; }
        }
      }
      if (type === "Component") {
        if (!parent) { alert("Choose a Parent (System/Subsystem)"); return; }
      }

      const rule = checkParentRule(type, lvl, parent);
      if (!rule.ok) { alert(rule.err); return; }

      const key = { id: "", name: nm, type, level: lvl, parentId: parent ? parent.id : null };
      const dupe = findDuplicateNode(nodes, key);
      let finalName = nm;
      if (dupe) {
        const ow = confirm("Duplicate. OK=Overwrite, Cancel=Index");
        if (ow) {
          setNodes(nodes.map((x) => x.id === dupe.id ? { ...x, name: nm, level: lvl } : x));
          setName(""); setSubsystemLevel(""); return;
        } else {
          const sibs = nodes.filter((x) => x.type === type && x.parentId === (parent ? parent.id : null)).map((x) => x.name);
          finalName = nextIndexedName(nm, sibs);
        }
      }

      const newNode = { id: uid(), name: finalName, type, parentId: parent ? parent.id : null, level: type === "Subsystem" ? lvl : null, createdAt: safeNow() };
      setNodes([newNode, ...nodes]);
      setName(""); setSubsystemLevel("");
    } catch (e) { alert("Add failed: " + e.message); }
  }

  return (
    <>
      <Head><meta charSet="utf-8" /><script src="https://cdn.tailwindcss.com"></script></Head>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Asset Registry & Hierarchy</h1>
        <Card>
          <h2 className="font-semibold mb-2">Add Node</h2>
          <Label>Name</Label>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          <Label>Type</Label>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="System" disabled={hasSystem}>System</option>
            <option value="Subsystem">Subsystem</option>
            <option value="Component">Component</option>
          </Select>
          {type === "Subsystem" && (
            <>
              <Label>Level</Label>
              <TextInput type="number" value={subsystemLevel} onChange={(e) => setSubsystemLevel(e.target.value)} />
            </>
          )}
          {type !== "System" && (
            <>
              <Label>Parent</Label>
              <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">-- Choose --</option>
                {nodes.filter((n) =>
                  type === "Subsystem"
                    ? (Number(n.level) === Number(subsystemLevel) - 1 && n.type === "Subsystem") || (Number(subsystemLevel) === 1 && n.type === "System")
                    : (n.type === "System" || n.type === "Subsystem")
                ).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.type}{p.level ? " L" + p.level : ""})</option>
                ))}
              </Select>
            </>
          )}
          <Button className="mt-3 bg-indigo-600 text-white" onClick={addNode}>Add</Button>
        </Card>

        <Card className="mt-5">
          <h2 className="font-semibold mb-2">Hierarchy</h2>
          {tree.length === 0 ? <p>No nodes</p> : <Tree nodes={tree} collapsed={new Set()} onToggle={() => {}} />}
        </Card>
      </div>
    </>
  );
}

export default HomePage;
