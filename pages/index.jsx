  function addNode() {
    try {
      const nm = name.trim();
      if (!nm) { alert("Name is required"); return; }

      // Only one System
      if (type === "System" && hasSystem) {
        alert("Only one System is allowed. Delete the existing System first.");
        return;
      }

      const selectedParentId = (parentId || "").trim();
      let parent = selectedParentId ? (nodes.find((n) => String(n.id) === String(selectedParentId)) || null) : null;

      let lvl = null;

      if (type === "Subsystem") {
        if (!String(subsystemLevel).trim()) { alert("Enter Subsystem Level (number)"); return; }
        const v = Number(subsystemLevel);
        if (!Number.isFinite(v) || v < 1) { alert("Subsystem Level must be a number >= 1"); return; }
        lvl = v;

        // Kandidat parent sesuai aturan level
        const candidates = v === 1
          ? nodes.filter((n) => n.type === "System")
          : nodes.filter((n) => n.type === "Subsystem" && Number(n.level) === v - 1);

        if (selectedParentId) {
          // User sudah pilih parent → pastikan parent eksis & valid
          if (!parent) {
            alert("Selected Parent not found (maybe removed). Please reselect.");
            return;
          }
          if (!candidates.some((c) => c.id === parent.id)) {
            alert(v === 1
              ? "Selected Parent must be a System for Subsystem L1"
              : `Selected Parent must be Subsystem L${v - 1} for Subsystem L${v}`);
            return;
          }
        } else {
          // User belum pilih parent → bantu pilih otomatis bila unik
          if (candidates.length === 1) {
            parent = candidates[0];
            try { setParentId(parent.id); } catch {}
          } else if (candidates.length === 0) {
            alert(v === 1 ? "Please add a System first." : `Please create Subsystem L${v - 1} first.`);
            return;
          } else {
            // Banyak kandidat & user belum pilih → minta pilih manual
            alert(`Multiple parents found. Please choose a Parent (${v === 1 ? "System" : `Subsystem L${v - 1}`}).`);
            return;
          }
        }
      }

      if (type === "Component") {
        // Component wajib punya parent (System atau Subsystem)
        if (!selectedParentId) {
          alert("Please choose a Parent (System or Subsystem) for Component.");
          return;
        }
        if (!parent) {
          alert("Selected Parent not found (maybe removed). Please reselect.");
          return;
        }
      }

      // Duplikasi (Type + Parent + Name [+ Level untuk Subsystem])
      const key = { id: "", name: nm, type, level: lvl, parentId: parent ? parent.id : null };
      const dupe = findDuplicateNode(nodes, key);

      if (dupe) {
        const overwrite = confirm(
          `Duplicate detected in the same level (Type/Parent/Name).\n\n` +
          `Name: ${nm}\nType: ${type}${type === "Subsystem" && lvl ? ` L${lvl}` : ""}\n` +
          `Parent: ${parent ? parent.name : "-"}\n\n` +
          `OK = Overwrite existing, Cancel = Insert with index (e.g., ${nm}(1))`
        );
        if (overwrite) {
          pushHistory();
          setNodes((prev) => prev.map((x) =>
            x.id === dupe.id
              ? { ...x, name: nm, type, parentId: parent ? parent.id : null, level: type === "Subsystem" ? lvl : null, createdAt: safeNow() }
              : x
          ));
          setName("");
          if (type !== "Subsystem") setSubsystemLevel("");
          return;
        } else {
          // Auto-index name among siblings
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

      // Cek aturan parent akhirnya
      const rule = checkParentRule(type, lvl, parent);
      if (!rule.ok) { alert(rule.err); return; }

      // Simpan
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

      // Reset form
      setName("");
      if (type !== "Subsystem") setSubsystemLevel("");
    } catch (err) {
      alert("Failed to add node: " + (err && err.message ? err.message : String(err)));
    }
  }
