// [Tambahkan di dekat state Add form yang lain]
const [userTouchedParent, setUserTouchedParent] = useState(false);

// Reset flag ketika tipe/level berubah (pilihan user dianggap “baru”)
useEffect(() => {
  setUserTouchedParent(false);
}, [type, subsystemLevel]);

// [Ganti onChange select Parent di form Add]
<Select
  value={parentId}
  onChange={(e) => {
    setUserTouchedParent(true);
    setParentId(e.target.value);
  }}
  disabled={type === "System"}
>
  {type === "System" ? <option value="">— None (Root) —</option> : null}
  {addParentOptions.map((p) => (
    <option key={p.id} value={p.id}>
      {p.name} ({p.type}{p.type === "Subsystem" && p.level != null ? ` L${p.level}` : ""})
    </option>
  ))}
</Select>

// Auto defaults for parent options on add form (tidak menimpa pilihan user)
useEffect(() => {
  // Jika user sudah memilih parent secara manual, jangan sentuh apa pun
  if (userTouchedParent) return;

  if (type === "Subsystem") {
    const lv = Number(subsystemLevel);
    if (!Number.isFinite(lv) || lv < 1) return;

    const candidates = lv === 1
      ? nodes.filter((n) => n.type === "System")
      : nodes.filter((n) => n.type === "Subsystem" && Number(n.level) === lv - 1);

    // Jika pilihan sekarang masih valid, biarkan
    if (parentId && candidates.some((c) => c.id === parentId)) return;

    // Hanya auto-set jika persis 1 kandidat dan belum ada parent
    if (!parentId && candidates.length === 1) {
      setParentId(candidates[0].id);
    }
    // kalau 0 atau >1 kandidat → biarkan kosong (jangan set "" lagi)
    return;
  }

  if (type === "Component") {
    const candidates = nodes.filter((n) => n.type === "Subsystem" || n.type === "System");

    if (parentId && candidates.some((c) => c.id === parentId)) return;

    if (!parentId && candidates.length === 1) {
      setParentId(candidates[0].id);
    }
    return;
  }

  if (type === "System") {
    if (parentId) setParentId(""); // System selalu root
  }
}, [type, subsystemLevel, nodes]); // sengaja TIDAK memasukkan parentId untuk mencegah loop

function addNode() {
  try {
    const nm = name.trim();
    if (!nm) { alert("Name is required"); return; }

    // Single System
    if (type === "System" && hasSystem) { alert("Only one System is allowed. Delete the existing System first."); return; }

    let parent = nodes.find((n) => n.id === parentId) || null;
    let lvl = null;

    if (type === "Subsystem") {
      if (!subsystemLevel.trim()) { alert("Enter Subsystem Level (number)"); return; }
      const v = Number(subsystemLevel);
      if (!Number.isFinite(v) || v < 1) { alert("Subsystem Level must be a number >= 1"); return; }
      lvl = v;

      const candidates = v === 1
        ? nodes.filter((n) => n.type === "System")
        : nodes.filter((n) => n.type === "Subsystem" && Number(n.level) === v - 1);

      if (parentId) {
        // User SUDAH memilih parent → jangan prompt “Multiple parents…”
        if (!parent) { alert("Selected Parent not found. Please reselect."); return; }
        if (!candidates.some((c) => c.id === parent.id)) {
          alert(v === 1
            ? "Selected Parent must be a System for Subsystem L1"
            : `Selected Parent must be Subsystem L${v - 1} for Subsystem L${v}`
          );
          return;
        }
      } else {
        // User BELUM pilih parent → bantu pilih/beri prompt
        if (candidates.length === 1) { parent = candidates[0]; setParentId(candidates[0].id); }
        else if (candidates.length === 0) { alert(v === 1 ? "Please add a System first." : `Please create Subsystem L${v - 1} first.`); return; }
        else { alert(`Multiple parents found. Please choose a Parent (${v === 1 ? "System" : `Subsystem L${v - 1}`}).`); return; }
      }
    }

    if (type === "Component") {
      const candidates = nodes.filter((n) => n.type === "Subsystem" || n.type === "System");

      if (parentId) {
        if (!parent) { alert("Selected Parent not found. Please reselect."); return; }
        // parent exists → validasi rule di bawah
      } else {
        if (candidates.length === 1) { parent = candidates[0]; setParentId(candidates[0].id); }
        else if (candidates.length === 0) { alert("Please add a System or a Subsystem first."); return; }
        else { alert("Multiple parents found. Please choose a Parent (System or Subsystem)."); return; }
      }
    }

    // Rule check (termasuk Component/System)
    const rule = checkParentRule(type, lvl, parent);
    if (!rule.ok) { alert(rule.err); return; }

    // Duplicate handling (tetap sama seperti sebelumnya)
    const key = { id: "", name: nm, type, level: lvl, parentId: parent ? parent.id : null };
    const dupe = findDuplicateNode(nodes, key);
    if (dupe) {
      const overwrite = confirm(
        `Duplicate detected in the same level (Type/Parent/Name).\n\nName: ${nm}\nType: ${type}${type === "Subsystem" && lvl ? ` L${lvl}` : ""}\nParent: ${parent ? parent.name : "-"}\n\nOK = Overwrite existing, Cancel = Insert with index (e.g., ${nm}(1))`
      );
      if (overwrite) {
        pushHistory();
        setNodes((prev) => prev.map((x) =>
          x.id === dupe.id
            ? { ...x, name: nm, type, parentId: parent ? parent.id : null, level: type === "Subsystem" ? lvl : null, createdAt: safeNow() }
            : x
        ));
        setName(""); if (type !== "Subsystem") setSubsystemLevel("");
        return;
      } else {
        const siblings = nodes
          .filter((x) => {
            if (String(x.type) !== String(type)) return false;
            if (String(x.parentId || "") !== String(parent ? parent.id : "")) return false;
            if (type === "Subsystem" && Number(x.level) !== Number(lvl)) return false;
            return true;
          })
          .map((x) => x.name);
        key.name = nextIndexedName(nm, siblings);
      }
    }

    pushHistory();
    const newNode = {
      id: uid(),
      name: key.name || nm,
      type,
      parentId: parent ? parent.id : null,
      level: type === "Subsystem" ? lvl : null,
      createdAt: safeNow()
    };
    setNodes((prev) => [newNode, ...prev]);
    setName(""); if (type !== "Subsystem") setSubsystemLevel("");
  } catch (err) {
    alert("Failed to add node: " + (err && err.message ? err.message : String(err)));
  }
}
