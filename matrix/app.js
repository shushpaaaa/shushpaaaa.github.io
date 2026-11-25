// MatrixLab — Interactive UI Controller (Zero-dependency, offline-first)

(function () {
  "use strict";

  const E = window.MatrixEngine;
  const { Frac } = E;

  // Global Application State
  const state = {
    mode: "inverse",
    decimal: false,
    theme: "light",

    // Primary square matrix A (used in Inverse, Elimination, Determinant)
    n: 3,
    A: [
      ["1", "2", "1"],
      ["2", "5", "2"],
      ["1", "3", "2"],
    ],
    b: ["1", "0", "0"],

    // Inverse sub-state
    invTab: "gj",
    gjStep: 0,
    cofCell: [0, 0], // [i, j] in A^-1 (uses C_ji)

    // Elimination sub-state
    elimStep: 0,

    // Determinant sub-state
    detTab: "cofactor",
    detExpMode: "row",
    detExpIdx: 0,

    // Subspaces rectangular matrix (m x n)
    subM: 3,
    subN: 5,
    subA: [
      ["1", "2", "2", "4", "6"],
      ["1", "2", "3", "6", "9"],
      ["0", "0", "1", "2", "3"],
    ],

    // Matrix Algebra dual matrices
    opM: 3, opK: 3, opP: 2,
    opA: [
      ["1", "2", "3"],
      ["5", "6", "4"],
      ["7", "8", "9"],
    ],
    opB: [
      ["2", "0"],
      ["3", "1"],
      ["4", "2"],
    ],
    opTab: "AB",
    opHover: [0, 0],
    opPowExp: 2,

    // Vectors & Geometry
    vecDim: 2,
    vecU: ["3", "2"],
    vecV: ["1", "4"],
    vecC1: "1",
    vecC2: "1",
    triP: [["2", "1"], ["3", "4"], ["0", "5"]],
    boxO: ["0", "0", "0"],
    boxE: [["3", "1", "1"], ["1", "3", "1"], ["1", "1", "3"]],

    // Practice Drills
    drillKind: "inv3",
    drillDiff: "normal",
    drill: null,
    drillInputs: [],
    drillChecked: false,
    drillReveal: false,

    // Full-Screen Dedicated Exam Mode
    exam: {
      open: false,
      phase: "setup", // "setup" | "active" | "summary"
      topics: E.EXAM_TOPICS.map(t => t.id),
      subtypes: Object.fromEntries(E.EXAM_TOPICS.map(t => [t.id, t.subtypes.map(s => s.id)])),
      openTopicMenu: null,
      difficulty: "normal",
      count: 8,
      customCountOpen: false,
      gradingMode: "instant", // "instant" | "end"
      timerMin: 0, // 0 = off, 15, 30, or custom integer 1..120
      customTimerOpen: false,
      questions: [],
      answers: [],
      checked: [],
      grades: [],
      flagged: [],
      hintsOpen: [],
      current: 0,
      startTime: 0,
      elapsedSec: 0,
      confirmExit: false,
    },
  };

  const MODE_META = {
    inverse: { title: "Inverse finder", subtitle: "Compare Gauss-Jordan, LU, substitution and cofactor routes" },
    elimination: { title: "Elimination and LU", subtitle: "Step through PA = LU, elementary matrices and symmetric LDL^T" },
    determinant: { title: "Determinants and Cramer", subtitle: "Pivot formula, optimal cofactor expansion, Sarrus and Cramer's rule" },
    subspaces: { title: "Column and nullspace", subtitle: "Rectangular reduction A to U to R, rank, pivot columns and special solutions" },
    operations: { title: "Matrix algebra", subtitle: "Products, non-commutativity, transposes and interactive four-views inspector" },
    vectors: { title: "Vectors and geometry", subtitle: "Linear combinations, dot products, 2D areas and 3D box volumes" },
    drills: { title: "Practice drills", subtitle: "Clean integer no-calculator problems with cell-by-cell verification" },
  };

  const PRESETS = [
    {
      name: "Tridiagonal 2, -1, 0",
      meta: "HW3 §2.7(4) · Symmetric LDL^T",
      apply() {
        state.n = 3;
        state.A = [["2", "-1", "0"], ["-1", "2", "-1"], ["0", "-1", "2"]];
        state.b = ["1", "0", "0"];
        state.gjStep = 0; state.elimStep = 0; state.cofCell = [0, 0];
      },
    },
    {
      name: "Row-swap inverse",
      meta: "Tutorials p.17 · Zero pivot at (2,2)",
      apply() {
        state.n = 3;
        state.A = [["1", "1", "0"], ["2", "2", "1"], ["1", "3", "1"]];
        state.b = ["1", "2", "3"];
        state.gjStep = 0; state.elimStep = 0; state.cofCell = [0, 0];
      },
    },
    {
      name: "HW3 4x4 elimination",
      meta: "HW3 §5.1(4) · det = 36",
      apply() {
        state.n = 4;
        state.A = [["1", "2", "3", "0"], ["2", "6", "6", "1"], ["-1", "0", "0", "3"], ["0", "2", "0", "7"]];
        state.b = ["1", "0", "0", "0"];
        state.gjStep = 0; state.elimStep = 0; state.cofCell = [0, 0]; state.detExpIdx = 0;
        if (state.mode === "subspaces" || state.mode === "vectors" || state.mode === "operations") state.mode = "determinant";
      },
    },
    {
      name: "HW3 Cramer system",
      meta: "HW3 §5.3(1) · x = 3/4, -1/2, 1/4",
      apply() {
        state.n = 3;
        state.A = [["2", "1", "0"], ["1", "2", "1"], ["0", "1", "2"]];
        state.b = ["1", "0", "0"];
        state.mode = "determinant";
        state.detTab = "cramer";
      },
    },
    {
      name: "L26 3x5 nullspace",
      meta: "§4.2 · Rank 2, 3 free columns",
      apply() {
        state.subM = 3; state.subN = 5;
        state.subA = [
          ["1", "2", "2", "4", "6"],
          ["1", "2", "3", "6", "9"],
          ["0", "0", "1", "2", "3"],
        ];
        state.mode = "subspaces";
      },
    },
    {
      name: "Pascal matrix P3",
      meta: "L14 · All pivots 1, P = L L^T",
      apply() {
        state.n = 3;
        state.A = [["1", "1", "1"], ["1", "2", "3"], ["1", "3", "6"]];
        state.b = ["1", "2", "4"];
        state.gjStep = 0; state.elimStep = 0;
      },
    },
  ];

  // Utility helpers
  function fmt(f) {
    return f.toStr(state.decimal);
  }

  function parseGrid(rawGrid) {
    return rawGrid.map(row => row.map(cell => Frac.parse(cell)));
  }

  function resizeRawGrid(grid, newM, newN, fillIdentity = false) {
    const out = [];
    for (let i = 0; i < newM; i++) {
      const row = [];
      for (let j = 0; j < newN; j++) {
        if (grid[i] && grid[i][j] !== undefined) row.push(grid[i][j]);
        else row.push(fillIdentity && i === j ? "1" : "0");
      }
      out.push(row);
    }
    return out;
  }

  function resizeVec(vec, newN) {
    const out = [];
    for (let i = 0; i < newN; i++) out.push(vec[i] !== undefined ? vec[i] : "0");
    return out;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Render static bracketed matrix HTML
  function renderMatrix(M, opts = {}) {
    const m = M.length, n = M[0].length;
    const {
      label = "",
      pivotCell = null,
      highlightRow = null,
      highlightCol = null,
      pivotCols = null,
      freeCols = null,
      crossRow = null,
      crossCol = null,
      clickableId = null,
      selectedCell = null,
      hoverId = null,
    } = opts;

    const cells = [];
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        const val = M[i][j];
        const cls = ["mat-cell"];
        if (val.isZero()) cls.push("zero");
        if (pivotCell && pivotCell[0] === i && pivotCell[1] === j) cls.push("pivot");
        if (highlightRow === i) cls.push("highlight-row");
        if (highlightCol === j) cls.push("highlight-accent");
        if (pivotCols && pivotCols.includes(j) && !val.isZero()) cls.push("pivot");
        if (freeCols && freeCols.includes(j)) cls.push("free-col");
        if (crossRow !== null && crossCol !== null) {
          if (i === crossRow || j === crossCol) cls.push("crossed");
          else cls.push("minor-alive");
        }
        if (clickableId) cls.push("clickable");
        if (selectedCell && selectedCell[0] === i && selectedCell[1] === j) cls.push("pivot");
        const attrs = [];
        if (clickableId) attrs.push(`data-click-mat="${clickableId}" data-r="${i}" data-c="${j}"`);
        if (hoverId) attrs.push(`data-hover-mat="${hoverId}" data-r="${i}" data-c="${j}"`);
        cells.push(`<span class="${cls.join(" ")}" ${attrs.join(" ")}>${escapeHtml(fmt(val))}</span>`);
      }
    }
    const lblHtml = label ? `<span class="mat-label">${label} =</span>` : "";
    return `<div class="mat-wrap">${lblHtml}<div class="mat-frame" style="grid-template-columns: repeat(${n}, auto);">${cells.join("")}</div></div>`;
  }

  function renderVector(v, label = "") {
    return renderMatrix(v.map(x => [x]), { label });
  }

  function renderAugmented(L, R, pivotCell = null, targetRow = null) {
    const m = L.length, n1 = L[0].length, n2 = R[0].length;
    const renderSide = (M, isLeft) => {
      const cells = [];
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < M[0].length; j++) {
          const val = M[i][j];
          const cls = ["mat-cell"];
          if (val.isZero()) cls.push("zero");
          if (isLeft && pivotCell && pivotCell[0] === i && pivotCell[1] === j) cls.push("pivot");
          else if (targetRow === i) cls.push("highlight-row");
          cells.push(`<span class="${cls.join(" ")}">${escapeHtml(fmt(val))}</span>`);
        }
      }
      return `<div class="mat-aug-grid" style="grid-template-columns: repeat(${M[0].length}, auto);">${cells.join("")}</div>`;
    };
    return `<div class="mat-augmented">${renderSide(L, true)}<div class="mat-aug-divider"></div>${renderSide(R, false)}</div>`;
  }

  // Render editable matrix grid
  function renderEditableMatrix(grid, gridId, label = "A") {
    const m = grid.length, n = grid[0].length;
    const inputs = [];
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        inputs.push(
          `<input type="text" class="mat-cell-input" data-grid="${gridId}" data-r="${i}" data-c="${j}" value="${escapeHtml(grid[i][j])}" aria-label="${label} row ${i + 1} col ${j + 1}">`
        );
      }
    }
    return `<div class="mat-wrap"><span class="mat-label">${label} =</span><div class="mat-frame" style="grid-template-columns: repeat(${n}, 60px);">${inputs.join("")}</div></div>`;
  }

  function renderEditableVector(vec, vecId, label = "b") {
    const inputs = vec.map((v, i) =>
      `<input type="text" class="mat-cell-input" data-vec="${vecId}" data-i="${i}" value="${escapeHtml(v)}" aria-label="${label} entry ${i + 1}">`
    );
    return `<div class="mat-wrap"><span class="mat-label">${label} =</span><div class="mat-frame" style="grid-template-columns: 60px;">${inputs.join("")}</div></div>`;
  }

  // Shared Square Matrix Input Card (for Inverse, Elimination, Determinant)
  function renderSquareInputCard(includeB = false) {
    const sizeBtns = [2, 3, 4, 5].map(k =>
      `<button class="seg-btn ${state.n === k ? "active" : ""}" data-set-n="${k}">${k}×${k}</button>`
    ).join("");

    return `
      <section class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Input matrix</h2>
            <p class="card-caption">Enter integers or fractions such as 3/2 or -1/4</p>
          </div>
          <div class="matrix-editor-bar">
            <div class="segmented" role="group" aria-label="Matrix size">${sizeBtns}</div>
            <button class="btn" data-action="eye">Identity</button>
            <button class="btn" data-action="transpose">Transpose</button>
            <button class="btn" data-action="rand-unimod">Random det=1</button>
            <button class="btn" data-action="save-matrix">Save</button>
            <button class="btn" data-action="zero">Clear</button>
          </div>
        </div>
        <div class="eq-flow">
          ${renderEditableMatrix(state.A, "A", "A")}
          ${includeB ? `<span class="op-symbol">·</span>${renderEditableVector(state.b, "b", "b")}` : ""}
        </div>
      </section>
    `;
  }

  // =========================================================================
  // MODE 1: MULTI-METHOD INVERSE FINDER (§2.5 & §3.3)
  // =========================================================================
  function renderInverseMode() {
    const A = parseGrid(state.A);
    const res = E.invertAllMethods(A);
    const n = A.length;
    state.gjStep = Math.min(state.gjStep, res.gjSteps.length - 1);

    const statusHtml = res.singular
      ? `<span class="status-pill neg"><span class="dot"></span>Singular · det(A) = 0</span>`
      : `<span class="status-pill pos"><span class="dot"></span>Invertible · det(A) = ${escapeHtml(fmt(res.det))} · AA⁻¹ = I verified</span>`;

    let bodyHtml = "";
    if (res.singular) {
      bodyHtml = `
        <section class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Matrix is singular (no inverse exists)</h2>
              <p class="card-caption">Rank ${res.rank} of ${n} — fewer than ${n} non-zero pivots</p>
            </div>
            ${statusHtml}
          </div>
          <div class="info-banner" style="margin-bottom: 16px;">
            <strong>Proof of singularity:</strong> An invertible matrix can only satisfy Ax = 0 when x = 0. Below is a non-zero nullspace witness vector x such that Ax = 0.
          </div>
          <div class="eq-flow">
            ${renderMatrix(A, { label: "A" })}
            <span class="op-symbol">·</span>
            ${res.witness ? renderVector(res.witness, "x") : ""}
            <span class="op-symbol">=</span>
            ${renderVector(Array(n).fill(Frac.ZERO), "0")}
          </div>
        </section>
      `;
    } else {
      const tabs = [
        { id: "gj", label: "Gauss-Jordan [A | I]" },
        { id: "lu", label: "Factorization U⁻¹L⁻¹" },
        { id: "sub", label: "Substitution Ax = c" },
        { id: "cof", label: "Cofactor Cᵀ / det(A)" },
      ];
      if (n === 2) tabs.push({ id: "f2", label: "2×2 formula" });
      if (!tabs.some(t => t.id === state.invTab)) state.invTab = "gj";

      let tabContent = "";
      if (state.invTab === "gj") {
        const cur = res.gjSteps[state.gjStep];
        const rowsHtml = res.gjSteps.map((s, idx) => `
          <div class="step-row ${idx === state.gjStep ? "active" : ""}" data-gj-step="${idx}">
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="step-idx">${idx}</span>
              <span class="scrubber-op" style="font-size:13px;">${escapeHtml(s.op)}</span>
            </div>
            <span class="status-pill neutral">${s.phase}</span>
          </div>
        `).join("");

        tabContent = `
          <div class="scrubber-bar">
            <div>
              <div class="scrubber-op">Step ${state.gjStep} of ${res.gjSteps.length - 1}: ${escapeHtml(cur.op)}</div>
              <div class="scrubber-detail">Phase: ${cur.phase}</div>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn" data-gj-delta="-1" ${state.gjStep === 0 ? "disabled" : ""}>Prev</button>
              <button class="btn btn-primary" data-gj-delta="1" ${state.gjStep === res.gjSteps.length - 1 ? "disabled" : ""}>Next</button>
              <button class="btn" data-gj-step="${res.gjSteps.length - 1}">Final</button>
            </div>
          </div>
          <div class="grid-asymmetric">
            <div style="overflow-x:auto;padding:8px 0;">
              ${renderAugmented(cur.left, cur.right, cur.pivot, cur.targetRow)}
            </div>
            <div class="step-timeline">${rowsHtml}</div>
          </div>
        `;
      } else if (state.invTab === "lu") {
        const r = res.luRoute;
        tabContent = `
          <div class="info-banner" style="margin-bottom: 16px;">
            <strong>Reverse-order rule:</strong> ${r.hasSwaps ? "Because row swaps were needed, PA = LU implies A⁻¹ = U⁻¹ L⁻¹ P." : "Since A = LU without row swaps, A⁻¹ = U⁻¹ L⁻¹ (socks-and-shoes order reversal)."}
          </div>
          <div class="eq-flow" style="margin-bottom: 16px;">
            ${r.hasSwaps ? renderMatrix(r.P, { label: "P" }) : ""}
            ${renderMatrix(r.L, { label: "L" })}
            ${renderMatrix(r.U, { label: "U" })}
          </div>
          <div class="eq-flow">
            ${renderMatrix(r.Uinv, { label: "U⁻¹" })}
            <span class="op-symbol">·</span>
            ${renderMatrix(r.Linv, { label: "L⁻¹" })}
            ${r.hasSwaps ? `<span class="op-symbol">·</span>${renderMatrix(r.P, { label: "P" })}` : ""}
            <span class="op-symbol">=</span>
            ${renderMatrix(res.inverse, { label: "A⁻¹" })}
          </div>
        `;
      } else if (state.invTab === "sub") {
        const inLines = res.substitution.sysInput.map(e => `${e.lhs} = ${e.rhs}`).join("\n");
        const outLines = res.substitution.sysOutput.map(e => `${e.lhs} = ${e.rhs}`).join("\n");
        tabContent = `
          <div class="info-banner" style="margin-bottom: 16px;">
            <strong>Algebraic meaning of A⁻¹:</strong> Solve Ax = c symbolically for x₁, ..., xₙ in terms of c₁, ..., cₙ. The coefficients of c₁, ..., cₙ read off the exact rows of A⁻¹.
          </div>
          <div class="grid-2" style="margin-bottom: 16px;">
            <div>
              <div class="stat-label" style="margin-bottom: 6px;">Original system Ax = c</div>
              <pre class="mono-block">${escapeHtml(inLines)}</pre>
            </div>
            <div>
              <div class="stat-label" style="margin-bottom: 6px;">Solved system x = A⁻¹c</div>
              <pre class="mono-block">${escapeHtml(outLines)}</pre>
            </div>
          </div>
          <div class="eq-flow">${renderMatrix(res.inverse, { label: "A⁻¹" })}</div>
        `;
      } else if (state.invTab === "cof") {
        const cr = res.cofactorRoute;
        const [ci, cj] = [Math.min(state.cofCell[0], n - 1), Math.min(state.cofCell[1], n - 1)];
        // Entry (ci, cj) of A^-1 comes from cofactor C_{cj, ci} (transposed indices!)
        const cofInfo = E.cofactorEntry(A, cj, ci);
        const signCh = cofInfo.sign.isNeg() ? "-" : "+";
        const invEntry = cofInfo.value.div(cr.det);

        tabContent = `
          <div class="info-banner" style="margin-bottom: 16px;">
            <strong>Interactive cofactor inspector:</strong> Click any entry of A⁻¹ below to strike out its transposed row j and column i in A and inspect the surviving minor submatrix. Remember (A⁻¹)ᵢⱼ = Cⱼᵢ / det(A).
          </div>
          <div class="grid-asymmetric" style="margin-bottom: 16px;">
            <div class="eq-flow">
              ${renderMatrix(A, { label: "A", crossRow: cj, crossCol: ci })}
              <span class="op-symbol">→</span>
              ${renderMatrix(cofInfo.minor, { label: `M_${cj + 1}${ci + 1}` })}
            </div>
            <div class="mono-block">${[
              `Target entry: (A⁻¹)_{${ci + 1},${cj + 1}}`,
              `Transposed cofactor: C_{${cj + 1},${ci + 1}}`,
              `Sign (-1)^(${cj + 1}+${ci + 1}) = ${signCh}1`,
              `det(M_${cj + 1}${ci + 1}) = ${fmt(cofInfo.minorDet)}`,
              `C_{${cj + 1},${ci + 1}} = ${fmt(cofInfo.value)}`,
              `(A⁻¹)_{${ci + 1},${cj + 1}} = (${fmt(cofInfo.value)}) / (${fmt(cr.det)}) = ${fmt(invEntry)}`,
            ].join("\n")}</div>
          </div>
          <div class="eq-flow">
            ${renderMatrix(cr.C, { label: "C" })}
            ${renderMatrix(cr.CT, { label: "Cᵀ" })}
            ${renderMatrix(res.inverse, { label: "A⁻¹", clickableId: "cof-inv", selectedCell: [ci, cj] })}
          </div>
        `;
      } else if (state.invTab === "f2" && n === 2) {
        const a = A[0][0], b = A[0][1], c = A[1][0], d = A[1][1];
        tabContent = `
          <div class="mono-block" style="margin-bottom: 16px;">${[
            `det(A) = (${fmt(a)})(${fmt(d)}) - (${fmt(b)})(${fmt(c)}) = ${fmt(res.det)}`,
            `A⁻¹ = (1 / ${fmt(res.det)}) · [ ${fmt(d)}  ${fmt(b.neg())} ; ${fmt(c.neg())}  ${fmt(a)} ]`,
          ].join("\n")}</div>
          <div class="eq-flow">${renderMatrix(res.inverse, { label: "A⁻¹" })}</div>
        `;
      }

      bodyHtml = `
        <section class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Computed inverse A⁻¹</h2>
              <p class="card-caption">Switch methods below to compare exact derivations on the same matrix</p>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              ${statusHtml}
              <button class="btn" data-action="copy-inv-to-a">Load A⁻¹ into A</button>
            </div>
          </div>
          <div class="eq-flow" style="margin-bottom: 16px;">
            ${renderMatrix(res.inverse, { label: "A⁻¹" })}
          </div>
          <div class="tabs">
            ${tabs.map(t => `<button class="tab-btn ${state.invTab === t.id ? "active" : ""}" data-inv-tab="${t.id}">${t.label}</button>`).join("")}
          </div>
          <div class="tab-panel">${tabContent}</div>
        </section>
      `;
    }

    return renderSquareInputCard(false) + bodyHtml;
  }

  // =========================================================================
  // MODE 2: ELIMINATION & LU / LDL^T / PA=LU (§2.2, §2.3, §2.6, §2.7)
  // =========================================================================
  function renderEliminationMode() {
    const A = parseGrid(state.A);
    const b = state.b.map(v => Frac.parse(v));
    const f = E.factorizePALU(A);
    state.elimStep = Math.min(state.elimStep, f.steps.length - 1);
    const cur = f.steps[state.elimStep];

    // Two-step triangular solve if non-singular
    let solveHtml = "";
    if (!f.singular) {
      const Pb = E.mulVec(f.P, b);
      const fwd = E.forwardSub(f.L, Pb);
      const bwd = E.backwardSub(f.U, fwd.c);
      solveHtml = `
        <section class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Two-step triangular solver (${f.swaps > 0 ? "Lc = Pb then Ux = c" : "Lc = b then Ux = c"})</h2>
              <p class="card-caption">O(n²) forward and backward substitution without computing A⁻¹</p>
            </div>
          </div>
          <div class="grid-2" style="margin-bottom: 16px;">
            <div>
              <div class="stat-label" style="margin-bottom: 6px;">1. Forward substitution (top to bottom)</div>
              <pre class="mono-block">${escapeHtml(fwd.trace.map(t => t.expr).join("\n"))}</pre>
            </div>
            <div>
              <div class="stat-label" style="margin-bottom: 6px;">2. Backward substitution (bottom to top)</div>
              <pre class="mono-block">${escapeHtml(bwd.trace.map(t => t.expr).join("\n"))}</pre>
            </div>
          </div>
          <div class="eq-flow">
            ${renderVector(fwd.c, "c")}
            <span class="op-symbol">→</span>
            ${renderVector(bwd.x, "x")}
          </div>
        </section>
      `;
    }

    const ldlHtml = f.ldl ? `
      <section class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Symmetric factorization S = L D Lᵀ</h2>
            <p class="card-caption">Detected symmetric A = Aᵀ with zero row exchanges</p>
          </div>
          <span class="status-pill pos"><span class="dot"></span>Symmetric</span>
        </div>
        <div class="eq-flow">
          ${renderMatrix(f.ldl.L, { label: "L" })}
          ${renderMatrix(f.ldl.D, { label: "D" })}
          ${renderMatrix(f.ldl.LT, { label: "Lᵀ" })}
        </div>
      </section>
    ` : "";

    const elemHtml = f.elementaryMatrices.length ? `
      <div style="margin-top: 16px;">
        <div class="stat-label" style="margin-bottom: 8px;">Elementary row matrices and combined elimination matrix M (MA = U)</div>
        <div class="eq-flow">
          ${f.elementaryMatrices.map(em => renderMatrix(em.matrix, { label: em.label })).join("")}
          <span class="op-symbol">→</span>
          ${renderMatrix(f.M, { label: "M" })}
        </div>
      </div>
    ` : "";

    return `
      ${renderSquareInputCard(true)}
      <div class="stat-row">
        <div class="stat-card">
          <span class="stat-label">Pivots</span>
          <span class="stat-value accent" style="font-size:18px;">${f.pivots.map(fmt).join(", ")}</span>
          <span class="stat-note">Diagonal of U</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Row exchanges</span>
          <span class="stat-value">${f.swaps}</span>
          <span class="stat-note">${f.swaps === 0 ? "A = LU directly" : "Requires PA = LU"}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Determinant</span>
          <span class="stat-value ${f.det.isZero() ? "neg" : ""}">${escapeHtml(fmt(f.det))}</span>
          <span class="stat-note">(-1)^${f.swaps} · product of pivots</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Status</span>
          <span class="stat-value ${f.singular ? "neg" : "pos"}" style="font-size:18px;">${f.singular ? "Singular" : "Full rank"}</span>
          <span class="stat-note">${f.ldl ? "Symmetric LDLᵀ ready" : "Non-symmetric or swapped"}</span>
        </div>
      </div>

      <section class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Step-by-step elimination playback</h2>
            <p class="card-caption">Use Prev / Next buttons or [ and ] keys to step through elimination</p>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn" data-elim-delta="-1" ${state.elimStep === 0 ? "disabled" : ""}>Prev</button>
            <button class="btn btn-primary" data-elim-delta="1" ${state.elimStep === f.steps.length - 1 ? "disabled" : ""}>Next</button>
            <button class="btn" data-elim-step="${f.steps.length - 1}">Final U</button>
          </div>
        </div>
        <div class="scrubber-bar">
          <div>
            <div class="scrubber-op">Step ${state.elimStep} of ${f.steps.length - 1}: ${escapeHtml(cur.op)}</div>
            <div class="scrubber-detail">${escapeHtml(cur.detail)}</div>
          </div>
        </div>
        <div class="grid-asymmetric">
          <div class="eq-flow">
            ${f.swaps > 0 ? renderMatrix(cur.P, { label: "P" }) : ""}
            ${renderMatrix(cur.L, { label: "L" })}
            ${renderMatrix(cur.matrix, { label: state.elimStep === f.steps.length - 1 ? "U" : "Step", pivotCell: cur.pivot, highlightRow: cur.targetRow })}
          </div>
          <div class="step-timeline">
            ${f.steps.map((s, idx) => `
              <div class="step-row ${idx === state.elimStep ? "active" : ""}" data-elim-step="${idx}">
                <span class="step-idx">${idx}</span>
                <span class="scrubber-op" style="font-size:13px;flex:1;">${escapeHtml(s.op)}</span>
              </div>
            `).join("")}
          </div>
        </div>
        ${elemHtml}
      </section>

      ${ldlHtml}
      ${solveHtml}
    `;
  }

  // =========================================================================
  // MODE 3: DETERMINANTS & CRAMER'S RULE STUDIO (§3.1 – §3.3)
  // =========================================================================
  function renderDeterminantMode() {
    const A = parseGrid(state.A);
    const b = state.b.map(v => Frac.parse(v));
    const n = A.length;
    if (state.detExpIdx >= n) state.detExpIdx = 0;

    const ds = E.determinantStudio(A, state.detExpMode, state.detExpIdx);
    const tabs = [
      { id: "cofactor", label: "Cofactor expansion" },
      { id: "pivot", label: "Pivot formula" },
      { id: "cramer", label: "Cramer's rule Ax = b" },
    ];
    if (n === 3) tabs.splice(2, 0, { id: "sarrus", label: "Big formula / Sarrus" });
    if (!tabs.some(t => t.id === state.detTab)) state.detTab = "cofactor";

    let tabHtml = "";
    if (state.detTab === "cofactor") {
      const rowBtns = Array.from({ length: n }, (_, i) => {
        const isOpt = ds.optimal.mode === "row" && ds.optimal.index === i && ds.optimal.zeros > 0;
        const act = state.detExpMode === "row" && state.detExpIdx === i;
        return `<button class="seg-btn ${act ? "active" : ""}" data-det-exp="row:${i}">Row ${i + 1}${isOpt ? " · best" : ""}</button>`;
      }).join("");
      const colBtns = Array.from({ length: n }, (_, j) => {
        const isOpt = ds.optimal.mode === "col" && ds.optimal.index === j && ds.optimal.zeros > 0;
        const act = state.detExpMode === "col" && state.detExpIdx === j;
        return `<button class="seg-btn ${act ? "active" : ""}" data-det-exp="col:${j}">Col ${j + 1}${isOpt ? " · best" : ""}</button>`;
      }).join("");

      const termCards = ds.expansion.terms.map(t => `
        <div class="stat-card" style="gap:8px;">
          <div class="stat-label">a_${t.r + 1}${t.c + 1} · C_${t.r + 1}${t.c + 1}</div>
          <div style="font-family:var(--font-mono);font-size:13px;color:var(--text-secondary);">
            (${fmt(t.entry)}) · (${t.sign.isNeg() ? "-" : "+"}${fmt(t.minorDet)}) = <strong style="color:var(--text-primary);">${fmt(t.product)}</strong>
          </div>
          ${t.entry.isZero() ? `<span class="stat-note">Skipped (entry is zero)</span>` : `<div style="overflow-x:auto;">${renderMatrix(t.minor)}</div>`}
        </div>
      `).join("");

      tabHtml = `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
          <div class="segmented">${rowBtns}</div>
          <div class="segmented">${colBtns}</div>
        </div>
        <div class="eq-flow" style="margin-bottom: 16px;">
          ${renderMatrix(A, {
            label: "A",
            highlightRow: state.detExpMode === "row" ? state.detExpIdx : null,
            highlightCol: state.detExpMode === "col" ? state.detExpIdx : null,
          })}
          <span class="op-symbol">⇒</span>
          <div class="mono-block">det(A) = ${ds.expansion.terms.map(t => `(${fmt(t.product)})`).join(" + ")} = ${fmt(ds.det)}</div>
        </div>
        <div class="stat-row">${termCards}</div>
      `;
    } else if (state.detTab === "pivot") {
      const f = ds.palu;
      tabHtml = `
        <div class="info-banner" style="margin-bottom:16px;">
          <strong>Pivot formula:</strong> det(A) = (-1)^s · d₁ · d₂ · ... · dₙ, where s = ${f.swaps} is the number of row exchanges performed during elimination.
        </div>
        <div class="eq-flow" style="margin-bottom:16px;">
          ${renderMatrix(f.U, { label: "U" })}
          <span class="op-symbol">⇒</span>
          <div class="mono-block">det(A) = (${f.swaps % 2 === 1 ? "-1" : "+1"}) · ${f.pivots.map(p => `(${fmt(p)})`).join(" · ")} = ${fmt(ds.det)}</div>
        </div>
      `;
    } else if (state.detTab === "sarrus" && ds.sarrus) {
      const s = ds.sarrus;
      tabHtml = `
        <div class="info-banner" style="margin-bottom:16px;">
          <strong>3×3 Big Formula (Sarrus):</strong> Sum the 3 downward diagonal products and subtract the 3 upward diagonal products. Valid strictly for 3×3 matrices.
        </div>
        <div class="grid-2">
          <div class="mono-block">Downward (+)
${s.down.map(d => `  ${d.label} = ${fmt(d.val)}`).join("\n")}
Sum (+) = ${fmt(s.downSum)}</div>
          <div class="mono-block">Upward (-)
${s.up.map(u => `  ${u.label} = ${fmt(u.val)}`).join("\n")}
Sum (-) = ${fmt(s.upSum)}</div>
        </div>
        <div class="mono-block" style="margin-top:12px;">det(A) = (${fmt(s.downSum)}) - (${fmt(s.upSum)}) = ${fmt(ds.det)}</div>
      `;
    } else if (state.detTab === "cramer") {
      const cr = E.cramersRule(A, b);
      tabHtml = cr.singular ? `
        <div class="info-banner">Cramer's rule requires det(A) ≠ 0. Current matrix is singular (det(A) = 0).</div>
      ` : `
        <div class="info-banner" style="margin-bottom:16px;">
          <strong>Cramer's rule:</strong> Matrix Bⱼ replaces Column j of A with vector b. Then xⱼ = det(Bⱼ) / det(A).
        </div>
        <div class="grid-2">
          ${cr.results.map(r => `
            <div class="stat-card" style="gap:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span class="card-title" style="font-size:14px;">x_${r.col + 1} = det(B_${r.col + 1}) / det(A)</span>
                <span class="status-pill pos">x_${r.col + 1} = ${escapeHtml(fmt(r.x))}</span>
              </div>
              <div class="eq-flow">
                ${renderMatrix(r.B, { label: `B_${r.col + 1}`, highlightCol: r.col })}
              </div>
              <div class="stat-note" style="font-family:var(--font-mono);">det(B_${r.col + 1}) = ${fmt(r.detB)} → ${fmt(r.detB)} / ${fmt(cr.detA)} = ${fmt(r.x)}</div>
            </div>
          `).join("")}
        </div>
      `;
    }

    const p = ds.properties;
    return `
      ${renderSquareInputCard(state.detTab === "cramer")}
      <div class="stat-row">
        <div class="stat-card">
          <span class="stat-label">det(A)</span>
          <span class="stat-value ${ds.det.isZero() ? "neg" : "accent"}">${escapeHtml(fmt(ds.det))}</span>
          <span class="stat-note">${ds.det.isZero() ? "Singular" : "Invertible"}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">det(A²)</span>
          <span class="stat-value">${escapeHtml(fmt(p.detSq))}</span>
          <span class="stat-note">(det A)²</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">det(A⁻¹)</span>
          <span class="stat-value">${p.detInv ? escapeHtml(fmt(p.detInv)) : "None"}</span>
          <span class="stat-note">1 / det(A)</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">det(2A)</span>
          <span class="stat-value">${escapeHtml(fmt(p.det2A))}</span>
          <span class="stat-note">2^${n} · det(A)</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">det(-A)</span>
          <span class="stat-value">${escapeHtml(fmt(p.detNeg))}</span>
          <span class="stat-note">(-1)^${n} · det(A)</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Integer inverse</span>
          <span class="stat-value ${p.integerInverse ? "pos" : ""}" style="font-size:18px;">${p.integerInverse ? "Yes" : "No"}</span>
          <span class="stat-note">Requires det = ±1</span>
        </div>
      </div>

      <section class="card">
        <div class="tabs">
          ${tabs.map(t => `<button class="tab-btn ${state.detTab === t.id ? "active" : ""}" data-det-tab="${t.id}">${t.label}</button>`).join("")}
        </div>
        <div class="tab-panel">${tabHtml}</div>
      </section>
    `;
  }

  // =========================================================================
  // MODE 4: SUBSPACES — COLUMN SPACE C(A) & NULLSPACE N(A) (§4.1 – §4.2)
  // =========================================================================
  function renderSubspacesMode() {
    const A = parseGrid(state.subA);
    const s = E.analyzeSubspaces(A);

    const rowOpts = [1, 2, 3, 4, 5].map(k => `<option value="${k}" ${state.subM === k ? "selected" : ""}>${k} rows</option>`).join("");
    const colOpts = [2, 3, 4, 5, 6].map(k => `<option value="${k}" ${state.subN === k ? "selected" : ""}>${k} cols</option>`).join("");

    const colSpaceHtml = s.colSpaceBasis.length
      ? s.colSpaceBasis.map((v, i) => renderVector(v, `a_${s.pivotCols[i] + 1}`)).join(`<span class="op-symbol">,</span>`)
      : `<span class="stat-note">Only the zero vector {0}</span>`;

    const nullSpaceHtml = s.specialSolutions.length
      ? s.specialSolutions.map((v, i) => renderVector(v, `s_${i + 1}`)).join(`<span class="op-symbol">,</span>`)
      : `<span class="status-pill neutral">Only trivial solution x = 0 (no free variables)</span>`;

    return `
      <section class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Rectangular matrix A (${s.m} × ${s.n})</h2>
            <p class="card-caption">Pivot columns highlighted in blue · free columns shaded neutral</p>
          </div>
          <div class="matrix-editor-bar">
            <select class="dim-select" data-sub-dim="m" aria-label="Rows">${rowOpts}</select>
            <span class="op-symbol">×</span>
            <select class="dim-select" data-sub-dim="n" aria-label="Columns">${colOpts}</select>
            <button class="btn" data-action="sub-l26">Load L26 3×5</button>
            <button class="btn" data-action="sub-rank1">Rank-1 example</button>
          </div>
        </div>
        <div class="eq-flow">${renderEditableMatrix(state.subA, "subA", "A")}</div>
      </section>

      <div class="stat-row">
        <div class="stat-card">
          <span class="stat-label">Rank r</span>
          <span class="stat-value accent">${s.rank}</span>
          <span class="stat-note">Pivot cols: ${s.pivotCols.length ? s.pivotCols.map(c => c + 1).join(", ") : "none"}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Nullity (n - r)</span>
          <span class="stat-value">${s.nullity}</span>
          <span class="stat-note">Free vars: ${s.freeCols.length ? s.freeCols.map(c => `x${c + 1}`).join(", ") : "none"}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Counting theorem</span>
          <span class="stat-value" style="font-size:20px;">${s.rank} + ${s.nullity} = ${s.n}</span>
          <span class="stat-note">r + (n - r) = n columns</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Ambient spaces</span>
          <span class="stat-value" style="font-size:18px;">C(A)⊆ℝ^${s.m}, N(A)⊆ℝ^${s.n}</span>
          <span class="stat-note">${s.verifiedNull ? "All A·s_k = 0 verified" : "Check"}</span>
        </div>
      </div>

      <section class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Row reduction chain: A → U (echelon) → R (reduced row echelon)</h2>
            <p class="card-caption">Row operations preserve N(A) = N(U) = N(R), but change C(A)</p>
          </div>
        </div>
        <div class="eq-flow">
          ${renderMatrix(s.U, { label: "U", pivotCols: s.pivotCols, freeCols: s.freeCols })}
          <span class="op-symbol">→</span>
          ${renderMatrix(s.R, { label: "R", pivotCols: s.pivotCols, freeCols: s.freeCols })}
        </div>
      </section>

      <div class="grid-2">
        <section class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Column space C(A) ⊆ ℝ^${s.m}</h2>
              <p class="card-caption">Span of the ORIGINAL pivot columns of A (never U)</p>
            </div>
            <span class="status-pill neutral">dim = ${s.rank}</span>
          </div>
          <div class="eq-flow">${colSpaceHtml}</div>
          <div class="info-banner" style="margin-top:14px;">
            <strong>Solvability:</strong> Ax = b has a solution if and only if b lies in this ${s.rank}-dimensional subspace of ℝ^${s.m}.${s.rank === s.m ? " Because r = m, C(A) fills all of ℝ^" + s.m + " and Ax = b is solvable for every b." : ""}
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Nullspace N(A) ⊆ ℝ^${s.n}</h2>
              <p class="card-caption">All combinations c₁s₁ + ... + c_k s_k of special solutions</p>
            </div>
            <span class="status-pill pos"><span class="dot"></span>dim = ${s.nullity}</span>
          </div>
          <div class="eq-flow">${nullSpaceHtml}</div>
          <div class="info-banner" style="margin-top:14px;">
            <strong>Instant RREF read-off:</strong> Set each free variable x_f = 1 (other free variables = 0). Each pivot entry equals the negated entry in the free column of R.
          </div>
        </section>
      </div>
    `;
  }

  // =========================================================================
  // MODE 5: MATRIX ALGEBRA & 4-VIEWS INSPECTOR (§1.3, §2.4, §2.7)
  // =========================================================================
  function renderOperationsMode() {
    const A = parseGrid(state.opA);
    const B = parseGrid(state.opB);
    const AB = E.mul(A, B);
    const BA = E.mul(B, A);
    const sumAB = E.add(A, B);
    const diffAB = E.sub(A, B);
    const AT = E.transpose(A);
    const ATA = E.mul(AT, A);
    const AAT = E.mul(A, AT);

    const optList = [1, 2, 3, 4].map(k => k);
    const mkSel = (attr, cur) => `<select class="dim-select" data-op-dim="${attr}">${optList.map(k => `<option value="${k}" ${cur === k ? "selected" : ""}>${k}</option>`).join("")}</select>`;

    const [hi, hj] = [
      Math.min(state.opHover[0], AB ? AB.length - 1 : 0),
      Math.min(state.opHover[1], AB ? AB[0].length - 1 : 0),
    ];

    let dotBreakdown = "";
    if (AB) {
      const terms = [];
      for (let k = 0; k < A[0].length; k++) {
        terms.push(`(${fmt(A[hi][k])})(${fmt(B[k][hj])})`);
      }
      dotBreakdown = `(AB)_{${hi + 1},${hj + 1}} = (Row ${hi + 1} of A) · (Col ${hj + 1} of B) = ${terms.join(" + ")} = ${fmt(AB[hi][hj])}`;
    }

    let tabBody = "";
    if (state.opTab === "AB") {
      tabBody = AB ? `
        <div class="info-banner" style="margin-bottom:14px;">
          <strong>Interactive four-views inspector:</strong> Click any entry of AB below to highlight Row i of A and Column j of B and inspect its exact dot-product arithmetic.
        </div>
        <div class="eq-flow" style="margin-bottom:14px;">
          ${renderMatrix(A, { label: "A", highlightRow: hi })}
          <span class="op-symbol">·</span>
          ${renderMatrix(B, { label: "B", highlightCol: hj })}
          <span class="op-symbol">=</span>
          ${renderMatrix(AB, { label: "AB", clickableId: "op-ab", selectedCell: [hi, hj] })}
        </div>
        <div class="mono-block">${escapeHtml(dotBreakdown)}</div>
      ` : `<div class="info-banner">Inner dimensions do not match for AB.</div>`;
    } else if (state.opTab === "BA") {
      tabBody = BA ? `
        <div class="eq-flow" style="margin-bottom:14px;">
          ${renderMatrix(BA, { label: "BA" })}
          ${AB && E.matEq(AB, BA) ? `<span class="status-pill pos">AB = BA (commute)</span>` : `<span class="status-pill neg">AB ≠ BA (non-commutative)</span>`}
        </div>
        ${AB && BA && AB.length === BA.length && AB[0].length === BA[0].length ? `<div class="eq-flow">${renderMatrix(E.sub(AB, BA), { label: "[A,B] = AB - BA" })}</div>` : ""}
      ` : `<div class="info-banner">BA is undefined because B is ${B.length}×${B[0].length} and A is ${A.length}×${A[0].length} (inner dimensions ${B[0].length} ≠ ${A.length}).</div>`;
    } else if (state.opTab === "sym") {
      tabBody = `
        <div class="info-banner" style="margin-bottom:14px;">
          <strong>Guaranteed symmetry (§2.7):</strong> For any m × n matrix A, both AᵀA (n × n) and AAᵀ (m × m) are always symmetric with non-negative diagonal entries.
        </div>
        <div class="eq-flow">
          ${renderMatrix(AT, { label: "Aᵀ" })}
          ${renderMatrix(ATA, { label: "AᵀA" })}
          ${renderMatrix(AAT, { label: "AAᵀ" })}
        </div>
      `;
    } else if (state.opTab === "sum") {
      tabBody = sumAB ? `
        <div class="eq-flow">
          ${renderMatrix(sumAB, { label: "A + B" })}
          ${renderMatrix(diffAB, { label: "A - B" })}
        </div>
      ` : `<div class="info-banner">A + B and A - B require identical dimensions (currently A is ${A.length}×${A[0].length} and B is ${B.length}×${B[0].length}).</div>`;
    } else if (state.opTab === "pow") {
      const Ap = E.pow(A, state.opPowExp);
      tabBody = Ap ? `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
          <span class="stat-label">Power k:</span>
          <div class="segmented">${[2, 3, 4].map(e => `<button class="seg-btn ${state.opPowExp === e ? "active" : ""}" data-op-pow="${e}">A^${e}</button>`).join("")}</div>
        </div>
        <div class="eq-flow">${renderMatrix(Ap, { label: `A^${state.opPowExp}` })}</div>
      ` : `<div class="info-banner">Matrix powers A^k require a square matrix A (set m = k).</div>`;
    }

    return `
      <section class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Dual matrix workspace</h2>
            <p class="card-caption">A is m × k and B is k × p so AB is always conformable</p>
          </div>
          <div class="matrix-editor-bar">
            <span class="stat-label">m</span>${mkSel("m", state.opM)}
            <span class="stat-label">k</span>${mkSel("k", state.opK)}
            <span class="stat-label">p</span>${mkSel("p", state.opP)}
            <button class="btn" data-action="op-square">Make 2×2 square</button>
          </div>
        </div>
        <div class="eq-flow">
          ${renderEditableMatrix(state.opA, "opA", "A")}
          ${renderEditableMatrix(state.opB, "opB", "B")}
        </div>
      </section>

      <section class="card">
        <div class="tabs">
          <button class="tab-btn ${state.opTab === "AB" ? "active" : ""}" data-op-tab="AB">Product AB</button>
          <button class="tab-btn ${state.opTab === "BA" ? "active" : ""}" data-op-tab="BA">Reverse BA &amp; commutator</button>
          <button class="tab-btn ${state.opTab === "sym" ? "active" : ""}" data-op-tab="sym">Aᵀ, AᵀA &amp; AAᵀ</button>
          <button class="tab-btn ${state.opTab === "sum" ? "active" : ""}" data-op-tab="sum">A + B &amp; A - B</button>
          <button class="tab-btn ${state.opTab === "pow" ? "active" : ""}" data-op-tab="pow">Powers A^k</button>
        </div>
        <div class="tab-panel">${tabBody}</div>
      </section>
    `;
  }

  // =========================================================================
  // MODE 6: VECTORS & GEOMETRY + 2D DRAFTING CANVAS (§1.1, §1.2, §3.3)
  // =========================================================================
  function renderVectorsMode() {
    const u = state.vecU.map(v => Frac.parse(v));
    const v = state.vecV.map(v => Frac.parse(v));
    const c1 = Frac.parse(state.vecC1);
    const c2 = Frac.parse(state.vecC2);
    const va = E.analyzeVectors(u, v, c1, c2);

    const tri = E.triangleArea(
      state.triP[0].map(Frac.parse),
      state.triP[1].map(Frac.parse),
      state.triP[2].map(Frac.parse)
    );
    const box = E.boxVolume(
      state.boxO.map(Frac.parse),
      state.boxE[0].map(Frac.parse),
      state.boxE[1].map(Frac.parse),
      state.boxE[2].map(Frac.parse)
    );

    const lhsCS = Math.abs(va.dotUV.toFloat());
    const rhsCS = va.lenU * va.lenV;
    const cosTheta = rhsCS > 1e-12 ? (va.dotUV.toFloat() / rhsCS) : null;

    return `
      <div class="grid-asymmetric" style="align-items:stretch;">
        <section class="card" style="display:flex;flex-direction:column;">
          <div class="card-header">
            <div>
              <h2 class="card-title">Vector combination and inner product</h2>
              <p class="card-caption">Exact dot product, lengths, angle and parallelogram span</p>
            </div>
            <div class="segmented">
              <button class="seg-btn ${state.vecDim === 2 ? "active" : ""}" data-vec-dim="2">2D</button>
              <button class="seg-btn ${state.vecDim === 3 ? "active" : ""}" data-vec-dim="3">3D</button>
            </div>
          </div>

          <div class="eq-flow" style="margin-bottom:16px;">
            <input type="text" class="mat-cell-input" style="width:48px;" data-scalar="vecC1" value="${escapeHtml(state.vecC1)}" aria-label="Scalar c1">
            ${renderEditableVector(state.vecU, "vecU", "u")}
            <span class="op-symbol">+</span>
            <input type="text" class="mat-cell-input" style="width:48px;" data-scalar="vecC2" value="${escapeHtml(state.vecC2)}" aria-label="Scalar c2">
            ${renderEditableVector(state.vecV, "vecV", "v")}
            <span class="op-symbol">=</span>
            ${renderVector(va.comb, "w")}
          </div>

          <div class="stat-row" style="margin-bottom:16px;">
            <div class="stat-card">
              <span class="stat-label">Dot product u · v</span>
              <span class="stat-value ${va.orthogonal ? "pos" : "accent"}">${escapeHtml(fmt(va.dotUV))}</span>
              <span class="stat-note">${va.orthogonal ? "Orthogonal (90°)" : "Not perpendicular"}</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Lengths</span>
              <span class="stat-value" style="font-size:16px;">√${fmt(va.normSqU)}, √${fmt(va.normSqV)}</span>
              <span class="stat-note">${va.lenU.toFixed(3)} and ${va.lenV.toFixed(3)}</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Angle θ</span>
              <span class="stat-value" style="font-size:20px;">${va.angleDeg !== null ? va.angleDeg.toFixed(1) + "°" : "—"}</span>
              <span class="stat-note">${va.collinear ? "Collinear (same line)" : "Independent"}</span>
            </div>
          </div>

          <div class="mono-block" style="margin-top:auto;">${[
            `Cauchy-Schwarz: |u · v| = ${lhsCS.toFixed(3)} ≤ ||u||·||v|| = ${rhsCS.toFixed(3)}`,
            `cos(θ) = (u · v) / (||u||·||v||) = ${cosTheta !== null ? cosTheta.toFixed(4) : "undefined"}`,
            `Linear combination w = (${va.comb.map(fmt).join(", ")})`,
          ].join("\n")}</div>
        </section>

        <section class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Coordinate drafting view</h2>
              <p class="card-caption">${state.vecDim === 2 ? `Parallelogram area = |det| = ${fmt(va.paraArea2D)}` : "Projection of x and y components"}</p>
            </div>
          </div>
          <div class="canvas-shell"><canvas id="vec-canvas"></canvas></div>
          <div class="canvas-legend">
            <span><span class="legend-swatch" style="background:var(--accent);"></span>u</span>
            <span><span class="legend-swatch" style="background:var(--text-primary);"></span>v</span>
            <span><span class="legend-swatch" style="background:var(--pos);"></span>c₁u + c₂v</span>
          </div>
        </section>
      </div>

      <div class="grid-2">
        <section class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">2D triangle area (3 vertices)</h2>
              <p class="card-caption">HW3 §5.3(3a) · Shift-to-origin and 3×3 determinant formula</p>
            </div>
            <span class="status-pill pos">Area = ${escapeHtml(fmt(tri.area))}</span>
          </div>
          <div class="eq-flow" style="margin-bottom:12px;">
            ${[0, 1, 2].map(i => `
              <div style="display:flex;align-items:center;gap:4px;">
                <span class="mat-label">P${i + 1}</span>
                <input type="text" class="mat-cell-input" style="width:48px;" data-tri="${i}:0" value="${escapeHtml(state.triP[i][0])}">
                <input type="text" class="mat-cell-input" style="width:48px;" data-tri="${i}:1" value="${escapeHtml(state.triP[i][1])}">
              </div>
            `).join("")}
          </div>
          <div class="mono-block">Shifted edges from P1: e1 = (${fmt(tri.edge1[0])}, ${fmt(tri.edge1[1])}), e2 = (${fmt(tri.edge2[0])}, ${fmt(tri.edge2[1])})
det = ${fmt(tri.det3)}  →  Area = |${fmt(tri.det3)}| / 2 = ${fmt(tri.area)}${tri.collinear ? " (points are collinear)" : ""}</div>
        </section>

        <section class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">3D box volume (parallelepiped)</h2>
              <p class="card-caption">HW3 §5.3(3c) &amp; shifted-origin boxes</p>
            </div>
            <span class="status-pill pos">Volume = ${escapeHtml(fmt(box.volume))}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span class="mat-label" style="min-width:52px;">Base O</span>
              ${[0, 1, 2].map(j => `<input type="text" class="mat-cell-input" style="width:48px;" data-boxo="${j}" value="${escapeHtml(state.boxO[j])}">`).join("")}
            </div>
            ${[0, 1, 2].map(i => `
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span class="mat-label" style="min-width:52px;">End ${i + 1}</span>
                ${[0, 1, 2].map(j => `<input type="text" class="mat-cell-input" style="width:48px;" data-boxe="${i}:${j}" value="${escapeHtml(state.boxE[i][j])}">`).join("")}
              </div>
            `).join("")}
          </div>
          <div class="mono-block">det(edges) = ${fmt(box.det)}  →  Volume = |${fmt(box.det)}| = ${fmt(box.volume)}${box.coplanar ? " (coplanar edges)" : ""}</div>
        </section>
      </div>
    `;
  }

  // Draw crisp 2D drafting-paper canvas
  function drawVectorCanvas() {
    const canvas = document.getElementById("vec-canvas");
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(200, Math.floor(rect.width * dpr));
    canvas.height = Math.max(200, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const w = rect.width, h = rect.height;
    const cs = getComputedStyle(document.documentElement);
    const gridCol = cs.getPropertyValue("--canvas-grid").trim();
    const axisCol = cs.getPropertyValue("--canvas-axis").trim();
    const accentCol = cs.getPropertyValue("--accent").trim();
    const accentSoft = cs.getPropertyValue("--accent-soft").trim();
    const textCol = cs.getPropertyValue("--text-primary").trim();
    const posCol = cs.getPropertyValue("--pos").trim();
    const mutedCol = cs.getPropertyValue("--text-muted").trim();

    const ux = Frac.parse(state.vecU[0]).toFloat();
    const uy = Frac.parse(state.vecU[1] || "0").toFloat();
    const vx = Frac.parse(state.vecV[0]).toFloat();
    const vy = Frac.parse(state.vecV[1] || "0").toFloat();
    const c1 = Frac.parse(state.vecC1).toFloat();
    const c2 = Frac.parse(state.vecC2).toFloat();
    const wx = c1 * ux + c2 * vx;
    const wy = c1 * uy + c2 * vy;

    const maxCoord = Math.max(5, Math.abs(ux), Math.abs(uy), Math.abs(vx), Math.abs(vy), Math.abs(wx), Math.abs(wy), Math.abs(ux + vx), Math.abs(uy + vy)) * 1.25;
    const scale = Math.min(w, h) / (2 * maxCoord);
    const cx = w / 2, cy = h / 2;
    const toX = x => cx + x * scale;
    const toY = y => cy - y * scale;

    ctx.clearRect(0, 0, w, h);

    // Subtle drafting grid
    const step = maxCoord > 12 ? 2 : 1;
    ctx.strokeStyle = gridCol;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -Math.ceil(maxCoord); x <= Math.ceil(maxCoord); x += step) {
      const px = Math.round(toX(x)) + 0.5;
      ctx.moveTo(px, 0); ctx.lineTo(px, h);
    }
    for (let y = -Math.ceil(maxCoord); y <= Math.ceil(maxCoord); y += step) {
      const py = Math.round(toY(y)) + 0.5;
      ctx.moveTo(0, py); ctx.lineTo(w, py);
    }
    ctx.stroke();

    // Axes
    ctx.strokeStyle = axisCol;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
    ctx.stroke();

    // Parallelogram shaded span (in 2D)
    if (state.vecDim === 2) {
      ctx.fillStyle = accentSoft;
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(0));
      ctx.lineTo(toX(ux), toY(uy));
      ctx.lineTo(toX(ux + vx), toY(uy + vy));
      ctx.lineTo(toX(vx), toY(vy));
      ctx.closePath();
      ctx.fill();
    }

    function arrow(x, y, color, label) {
      if (Math.hypot(x, y) < 1e-9) return;
      const ex = toX(x), ey = toY(y);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      const ang = Math.atan2(ey - cy, ex - cx);
      const len = 9;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - len * Math.cos(ang - 0.35), ey - len * Math.sin(ang - 0.35));
      ctx.lineTo(ex - len * Math.cos(ang + 0.35), ey - len * Math.sin(ang + 0.35));
      ctx.closePath();
      ctx.fill();

      ctx.font = "500 12px IBM Plex Mono, monospace";
      ctx.fillText(label, ex + 7, ey - 6);
    }

    arrow(ux, uy, accentCol, "u");
    arrow(vx, vy, textCol, "v");
    arrow(wx, wy, posCol, "w");

    ctx.fillStyle = mutedCol;
    ctx.font = "400 11px IBM Plex Mono, monospace";
    ctx.fillText("x", w - 14, cy - 6);
    ctx.fillText("y", cx + 6, 14);
  }

  // =========================================================================
  // MODE 7: NO-CALCULATOR PRACTICE DRILLS + EXAM LAUNCH
  // =========================================================================
  const DIFF_NOTES = {
    easy: "Easy · det = ±1 pure integer inverses and zero-rich matrices",
    normal: "Normal · course exam level (integers and clean halves, 3×3 inverses integer)",
    hard: "Hard · exact fractions like 1/3 and 2/5 in 2×2 and 3×3 inverses, 4×4 dets",
  };

  function ensureDrill(forceNew = false) {
    if (!state.drill || forceNew) {
      state.drill = E.generateDrill(state.drillKind, state.drillDiff);
      state.drillChecked = false;
      state.drillReveal = false;
      if (state.drill.expected) {
        const m = state.drill.expected.length, n = state.drill.expected[0].length;
        state.drillInputs = Array.from({ length: m }, () => Array(n).fill(""));
      } else if (state.drill.expectedVec) {
        state.drillInputs = [Array(state.drill.expectedVec.length).fill("")];
      } else {
        state.drillInputs = [[""]];
      }
    }
  }

  function renderDrillsMode() {
    ensureDrill(false);
    const d = state.drill;

    const kinds = [
      { id: "inv2", label: "2×2 inverse" },
      { id: "inv3", label: "3×3 inverse" },
      { id: "det3", label: "Determinant" },
      { id: "lu3", label: "A = LU (find U)" },
      { id: "null2x3", label: "Nullspace" },
    ];

    const diffs = [
      { id: "easy", label: "Easy" },
      { id: "normal", label: "Normal" },
      { id: "hard", label: "Hard" },
    ];

    let inputArea = "";
    let allCorrect = false;
    let totalCells = 0, rightCells = 0;

    if (d.expected) {
      const m = d.expected.length, n = d.expected[0].length;
      const cells = [];
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
          totalCells++;
          const raw = state.drillInputs[i][j];
          const parsed = E.tryParseFrac(raw);
          const ok = parsed !== null && parsed.eq(d.expected[i][j]);
          if (ok) rightCells++;
          const cls = state.drillChecked ? (ok ? "mat-cell-input correct" : "mat-cell-input wrong") : "mat-cell-input";
          cells.push(`<input type="text" class="${cls}" data-drill="${i}:${j}" value="${escapeHtml(raw)}">`);
        }
      }
      inputArea = `<div class="mat-wrap"><span class="mat-label">Your answer =</span><div class="mat-frame" style="grid-template-columns: repeat(${n}, 60px);">${cells.join("")}</div></div>`;
    } else if (d.expectedVec) {
      const n = d.expectedVec.length;
      const cells = [];
      for (let i = 0; i < n; i++) {
        totalCells++;
        const raw = state.drillInputs[0][i];
        const parsed = E.tryParseFrac(raw);
        const ok = parsed !== null && parsed.eq(d.expectedVec[i]);
        if (ok) rightCells++;
        const cls = state.drillChecked ? (ok ? "mat-cell-input correct" : "mat-cell-input wrong") : "mat-cell-input";
        cells.push(`<input type="text" class="${cls}" data-drill="0:${i}" value="${escapeHtml(raw)}">`);
      }
      inputArea = `<div class="mat-wrap"><span class="mat-label">s =</span><div class="mat-frame" style="grid-template-columns: 60px;">${cells.join("")}</div></div>`;
    } else {
      totalCells = 1;
      const raw = state.drillInputs[0][0];
      const parsed = E.tryParseFrac(raw);
      const ok = parsed !== null && parsed.eq(d.expectedScalar);
      if (ok) rightCells = 1;
      const cls = state.drillChecked ? (ok ? "mat-cell-input correct" : "mat-cell-input wrong") : "mat-cell-input";
      inputArea = `<div class="mat-wrap"><span class="mat-label">det(A) =</span><input type="text" class="${cls}" style="width:96px;" data-drill="0:0" value="${escapeHtml(raw)}"></div>`;
    }
    allCorrect = state.drillChecked && rightCells === totalCells;

    let revealHtml = "";
    if (state.drillReveal) {
      if (d.expected) {
        revealHtml = `<div class="eq-flow" style="margin-top:16px;">${renderMatrix(d.expected, { label: d.kind === "lu3" ? "U" : "A⁻¹" })}${d.expectedL ? renderMatrix(d.expectedL, { label: "L" }) : ""}</div>`;
      } else if (d.expectedVec) {
        revealHtml = `<div class="eq-flow" style="margin-top:16px;">${renderVector(d.expectedVec, "s")}</div>`;
      } else {
        revealHtml = `<div class="mono-block" style="margin-top:16px;">det(A) = ${fmt(d.expectedScalar)}</div>`;
      }
    }

    return `
      <section class="exam-launch-card">
        <div class="exam-launch-copy">
          <h2 class="exam-launch-title">Full-screen exam mode</h2>
          <p class="exam-launch-sub">Hides the sidebar and opens a dedicated test workspace. Pick mixed or single topics across §1.1–§4.2, Easy / Normal / Hard difficulty, and step-by-step or end-of-exam grading.</p>
        </div>
        <button class="btn btn-primary btn-lg" data-action="open-exam-setup">
          <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <span>Take an Exam</span>
        </button>
      </section>

      <section class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">No-calculator quick trainer</h2>
            <p class="card-caption">${escapeHtml(d.prompt)}</p>
          </div>
          <div class="drill-controls">
            <div class="segmented" role="group" aria-label="Drill difficulty">
              ${diffs.map(df => `<button class="seg-btn ${state.drillDiff === df.id ? "active" : ""}" data-drill-diff="${df.id}">${df.label}</button>`).join("")}
            </div>
            <div class="segmented" role="group" aria-label="Drill problem type">
              ${kinds.map(k => `<button class="seg-btn ${state.drillKind === k.id ? "active" : ""}" data-drill-kind="${k.id}">${k.label}</button>`).join("")}
            </div>
          </div>
        </div>

        <div class="eq-flow" style="margin: 16px 0 20px 0; gap: 28px;">
          ${renderMatrix(d.A, { label: "A" })}
          ${inputArea}
        </div>

        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-primary" data-action="drill-check">Verify answer</button>
          <button class="btn" data-action="drill-reveal">${state.drillReveal ? "Hide solution" : "Reveal solution"}</button>
          <button class="btn" data-action="drill-new">New problem</button>
          <button class="btn" data-action="drill-open-solver">Open in workspace</button>
          ${state.drillChecked ? `<span class="status-pill ${allCorrect ? "pos" : "neg"}"><span class="dot"></span>${allCorrect ? "Exact match" : `${rightCells} of ${totalCells} cells correct`}</span>` : ""}
        </div>
        ${revealHtml}
      </section>
    `;
  }

  // =========================================================================
  // FULL-SCREEN DEDICATED EXAM OVERLAY
  // =========================================================================
  let examTimerId = null;

  function loadExamHistory() {
    try {
      const raw = localStorage.getItem("matrixlab-exam-history");
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function saveExamAttempt(entry) {
    try {
      const list = loadExamHistory();
      list.unshift(entry);
      localStorage.setItem("matrixlab-exam-history", JSON.stringify(list.slice(0, 6)));
    } catch (_) {}
  }

  function formatDuration(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function stopExamTimer() {
    if (examTimerId !== null) {
      clearInterval(examTimerId);
      examTimerId = null;
    }
  }

  function startExamTimer() {
    stopExamTimer();
    examTimerId = window.setInterval(() => {
      const ex = state.exam;
      if (!ex.open || ex.phase !== "active") { stopExamTimer(); return; }
      ex.elapsedSec = Math.floor((Date.now() - ex.startTime) / 1000);
      const timerEl = document.getElementById("exam-timer-val");
      if (ex.timerMin > 0) {
        const rem = ex.timerMin * 60 - ex.elapsedSec;
        if (timerEl) {
          timerEl.textContent = formatDuration(rem);
          timerEl.classList.toggle("warn", rem <= 60);
        }
        if (rem <= 0) {
          finishExam();
        }
      } else if (timerEl) {
        timerEl.textContent = formatDuration(ex.elapsedSec);
      }
    }, 500);
  }

  function emptyAnswerFor(q) {
    if (q.answerType === "scalar") return [[""]];
    if (q.answerType === "pair") return [["", ""]];
    if (q.answerType === "vector") return [Array(q.expected.length).fill("")];
    return Array.from({ length: q.expected.length }, () => Array(q.expected[0].length).fill(""));
  }

  function hasAnyInput(raw) {
    if (!Array.isArray(raw)) return String(raw || "").trim() !== "";
    return raw.some(row => Array.isArray(row) ? row.some(v => String(v || "").trim() !== "") : String(row || "").trim() !== "");
  }

  function openExamOverlay(phase = "setup") {
    state.exam.open = true;
    state.exam.phase = phase;
    state.exam.confirmExit = false;
    document.body.classList.add("exam-open");
    const el = document.getElementById("exam-overlay");
    el.hidden = false;
    el.classList.remove("entering");
    void el.offsetWidth;
    el.classList.add("entering");
    el.addEventListener("animationend", () => el.classList.remove("entering"), { once: true });
    renderExamOverlay();
  }

  function closeExamOverlay() {
    stopExamTimer();
    state.exam.open = false;
    state.exam.confirmExit = false;
    document.body.classList.remove("exam-open");
    const el = document.getElementById("exam-overlay");
    el.hidden = true;
    el.innerHTML = "";
  }

  const EXAM_COUNT_MIN = 1, EXAM_COUNT_MAX = 30;
  const EXAM_TIMER_MIN = 1, EXAM_TIMER_MAX = 120;

  function clampInt(raw, lo, hi, fallback) {
    const cleaned = String(raw ?? "").trim().replace(/[^\d-]/g, "");
    const n = parseInt(cleaned, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(lo, Math.min(hi, n));
  }

  function startExamSession(overrideTopics = null) {
    const ex = state.exam;
    if (overrideTopics && overrideTopics.length) ex.topics = [...overrideTopics];
    ex.openTopicMenu = null;
    // Hard-clamp both values at launch so DOM tampering or floats can never break the app
    ex.count = clampInt(ex.count, EXAM_COUNT_MIN, EXAM_COUNT_MAX, 8);
    ex.timerMin = ex.timerMin === 0 ? 0 : clampInt(ex.timerMin, EXAM_TIMER_MIN, EXAM_TIMER_MAX, 20);
    ex.questions = E.generateExam({
      topics: ex.topics,
      subtypes: ex.subtypes,
      count: ex.count,
      difficulty: ex.difficulty,
    });
    ex.answers = ex.questions.map(emptyAnswerFor);
    ex.checked = ex.questions.map(() => false);
    ex.grades = ex.questions.map(() => null);
    ex.flagged = ex.questions.map(() => false);
    ex.hintsOpen = ex.questions.map(() => false);
    ex.current = 0;
    ex.startTime = Date.now();
    ex.elapsedSec = 0;
    ex.confirmExit = false;
    ex.phase = "active";
    startExamTimer();
    renderExamOverlay({ animateStage: true });
  }

  function checkCurrentQuestion() {
    const ex = state.exam;
    const i = ex.current;
    const q = ex.questions[i];
    ex.grades[i] = E.gradeExamAnswer(q, ex.answers[i]);
    ex.checked[i] = true;
    renderExamOverlay();
  }

  function finishExam() {
    const ex = state.exam;
    stopExamTimer();
    ex.elapsedSec = Math.floor((Date.now() - ex.startTime) / 1000);
    for (let i = 0; i < ex.questions.length; i++) {
      if (!ex.checked[i]) {
        ex.grades[i] = E.gradeExamAnswer(ex.questions[i], ex.answers[i]);
        ex.checked[i] = true;
      }
    }
    const right = ex.grades.filter(g => g && g.correct).length;
    const total = ex.questions.length;
    const topicLabel = ex.topics.length === E.EXAM_TOPICS.length
      ? "Mixed (all topics)"
      : ex.topics.map(id => (E.EXAM_TOPICS.find(t => t.id === id) || {}).name || id).join(", ");
    saveExamAttempt({
      date: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      topics: topicLabel,
      difficulty: ex.difficulty,
      score: right,
      total,
      pct: Math.round((right / Math.max(1, total)) * 100),
      duration: formatDuration(ex.elapsedSec),
    });
    ex.phase = "summary";
    ex.confirmExit = false;
    renderExamOverlay({ animateStage: true });
  }

  function openExamQuestionInWorkspace(q) {
    if (!q || !q.solverPayload) return;
    const p = q.solverPayload;
    closeExamOverlay();
    if (p.mode === "inverse" || p.mode === "elimination" || p.mode === "determinant") {
      state.n = p.A.length;
      state.A = p.A.map(r => r.map(v => v.toStr()));
      if (p.b) state.b = p.b.map(v => v.toStr());
      else state.b = resizeVec(state.b, state.n);
      state.gjStep = 0; state.elimStep = 0; state.cofCell = [0, 0]; state.detExpIdx = 0;
      if (p.tab) state.detTab = p.tab;
      state.mode = p.mode;
    } else if (p.mode === "subspaces") {
      state.subM = p.subA.length; state.subN = p.subA[0].length;
      state.subA = p.subA.map(r => r.map(v => v.toStr()));
      state.mode = "subspaces";
    } else if (p.mode === "operations") {
      state.opM = p.opA.length; state.opK = p.opA[0].length; state.opP = p.opB[0].length;
      state.opA = p.opA.map(r => r.map(v => v.toStr()));
      state.opB = p.opB.map(r => r.map(v => v.toStr()));
      state.opHover = p.hover || [0, 0];
      state.opTab = "AB";
      state.mode = "operations";
    } else if (p.mode === "vectors") {
      if (p.u && p.v) {
        state.vecDim = p.dim || p.u.length;
        state.vecU = p.u.map(v => v.toStr());
        state.vecV = p.v.map(v => v.toStr());
      }
      if (p.triP) state.triP = p.triP.map(pt => pt.map(v => v.toStr()));
      if (p.boxO && p.boxE) {
        state.boxO = p.boxO.map(v => v.toStr());
        state.boxE = p.boxE.map(pt => pt.map(v => v.toStr()));
      }
      state.mode = "vectors";
    }
    if (window.location.hash !== "#" + state.mode) history.replaceState(null, "", "#" + state.mode);
    render({ animate: true });
  }

  function renderExamTopbar() {
    const ex = state.exam;
    let centerHtml = "";
    if (ex.phase === "active") {
      const timeStr = ex.timerMin > 0 ? formatDuration(ex.timerMin * 60 - ex.elapsedSec) : formatDuration(ex.elapsedSec);
      const isWarn = ex.timerMin > 0 && (ex.timerMin * 60 - ex.elapsedSec) <= 60;
      centerHtml = `
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="stat-label" style="font-family:var(--font-mono);">Question ${ex.current + 1} / ${ex.questions.length}</span>
          <span class="exam-timer ${isWarn ? "warn" : ""}" id="exam-timer-val">${timeStr}</span>
        </div>
      `;
    }

    const exitControl = ex.confirmExit
      ? `<div style="display:flex;align-items:center;gap:8px;">
           <button class="btn" data-exam-action="cancel-exit">Keep going</button>
           <button class="btn btn-primary" data-exam-action="force-exit">Confirm exit</button>
         </div>`
      : `<button class="btn" data-exam-action="exit">Exit exam</button>`;

    return `
      <header class="exam-topbar">
        <button type="button" class="exam-brand" data-exam-action="exit" aria-label="Return to MatrixLab home">
          <div class="brand-mark">[A]</div>
          <span class="page-title">MatrixLab · Exam</span>
        </button>
        ${centerHtml}
        <div class="topbar-actions">
          <div class="segmented" role="group" aria-label="Number display format">
            <button class="seg-btn ${!state.decimal ? "active" : ""}" data-exam-fmt="frac">Exact p/q</button>
            <button class="seg-btn ${state.decimal ? "active" : ""}" data-exam-fmt="dec">Decimal</button>
          </div>
          <button class="btn btn-icon theme-toggle-btn" data-exam-action="toggle-theme" title="Toggle light or dark theme" aria-label="Toggle theme">
            <svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            <svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
          </button>
          ${exitControl}
        </div>
      </header>
    `;
  }

  function renderRulerSlider({ kind, value, min, max, tickStep, majorStep, unit }) {
    const pct = ((value - min) / (max - min)) * 100;
    const ticks = [];
    // Always include min, then every tickStep up to max
    const marks = [min];
    for (let v = tickStep; v <= max; v += tickStep) {
      if (v > min) marks.push(v);
    }
    if (marks[marks.length - 1] !== max) marks.push(max);

    for (const v of marks) {
      const pos = ((v - min) / (max - min)) * 100;
      const isMajor = v === min || v === max || v % majorStep === 0;
      const isAt = Math.abs(v - value) < (tickStep === 1 ? 0.5 : tickStep / 2);
      const isPassed = v <= value;
      const cls = ["ruler-tick"];
      if (isMajor) cls.push("major");
      if (isPassed) cls.push("passed");
      if (isAt) cls.push("at-needle");
      const lbl = isMajor ? `<span class="ruler-tick-label" data-ruler-snap="${kind}:${v}">${v}</span>` : "";
      ticks.push(`<span class="${cls.join(" ")}" data-tick-val="${v}" style="left:${pos.toFixed(3)}%;">${lbl}</span>`);
    }

    return `
      <div class="custom-slider-row" data-ruler-wrap="${kind}">
        <div class="ruler-head">
          <div class="ruler-readout">
            <span class="ruler-live-val" data-ruler-val="${kind}">${value}</span>
            <span class="custom-unit">${escapeHtml(unit)}</span>
          </div>
          <div class="ruler-stepper">
            <button type="button" class="ruler-step-btn" data-ruler-step="${kind}:-1" aria-label="Decrease ${kind}">−</button>
            <input type="text" inputmode="numeric" class="custom-num-input" value="${value}" data-exam-num="${kind}" aria-label="Custom ${kind} value">
            <button type="button" class="ruler-step-btn" data-ruler-step="${kind}:1" aria-label="Increase ${kind}">+</button>
          </div>
        </div>
        <div class="ruler-track-area" data-ruler-track="${kind}" data-min="${min}" data-max="${max}" data-tick-step="${tickStep}" tabindex="0" role="slider" aria-label="Custom ${kind}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${value}">
          <div class="ruler-rail">
            <div class="ruler-fill" data-ruler-fill="${kind}" style="width:${pct.toFixed(3)}%;"></div>
          </div>
          <div class="ruler-needle" data-ruler-needle="${kind}" style="left:${pct.toFixed(3)}%;"></div>
          <div class="ruler-ticks" data-ruler-ticks="${kind}">${ticks.join("")}</div>
        </div>
      </div>
    `;
  }

  function updateRulerDOM(exHost, kind, val, pulse = true) {
    const min = kind === "count" ? EXAM_COUNT_MIN : EXAM_TIMER_MIN;
    const max = kind === "count" ? EXAM_COUNT_MAX : EXAM_TIMER_MAX;
    const tickStep = kind === "count" ? 1 : 5;
    const safeVal = clampInt(val, min, max, kind === "count" ? 8 : 20);
    const prev = kind === "count" ? state.exam.count : state.exam.timerMin;

    if (kind === "count") state.exam.count = safeVal;
    else state.exam.timerMin = safeVal;

    const pct = ((safeVal - min) / (max - min)) * 100;
    const fill = exHost.querySelector(`[data-ruler-fill="${kind}"]`);
    const needle = exHost.querySelector(`[data-ruler-needle="${kind}"]`);
    const valEl = exHost.querySelector(`[data-ruler-val="${kind}"]`);
    const numInput = exHost.querySelector(`input[data-exam-num="${kind}"]`);
    const track = exHost.querySelector(`[data-ruler-track="${kind}"]`);
    const ticksHost = exHost.querySelector(`[data-ruler-ticks="${kind}"]`);

    if (fill) fill.style.width = `${pct.toFixed(3)}%`;
    if (needle) needle.style.left = `${pct.toFixed(3)}%`;
    if (valEl) valEl.textContent = String(safeVal);
    if (numInput && document.activeElement !== numInput) numInput.value = String(safeVal);
    if (track) track.setAttribute("aria-valuenow", String(safeVal));

    if (ticksHost) {
      ticksHost.querySelectorAll(".ruler-tick").forEach(tk => {
        const tv = Number(tk.dataset.tickVal);
        tk.classList.toggle("passed", tv <= safeVal);
        tk.classList.toggle("at-needle", Math.abs(tv - safeVal) < (tickStep === 1 ? 0.5 : tickStep / 2));
      });
    }

    if (pulse && safeVal !== prev) {
      if (valEl) {
        valEl.classList.remove("tick-pop");
        void valEl.offsetWidth;
        valEl.classList.add("tick-pop");
        clearTimeout(valEl._popT);
        valEl._popT = setTimeout(() => valEl.classList.remove("tick-pop"), 95);
      }
      if (needle) {
        needle.classList.remove("tick-kick");
        void needle.offsetWidth;
        needle.classList.add("tick-kick");
        clearTimeout(needle._kickT);
        needle._kickT = setTimeout(() => needle.classList.remove("tick-kick"), 95);
      }
    }

    if (kind === "count") {
      const hint = document.getElementById("exam-count-hint");
      if (hint) hint.textContent = `${safeVal} exact integer question${safeVal === 1 ? "" : "s"} balanced across your selected topics`;
    } else {
      const hint = document.getElementById("exam-timer-hint");
      if (hint) hint.textContent = `Counts down from ${safeVal} minute${safeVal === 1 ? "" : "s"} and submits automatically at 00:00`;
    }
  }

  const CHECK_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>`;
  const CHEV_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;

  function syncTopicSetupUI() {
    const exHost = document.getElementById("exam-overlay");
    if (!exHost) return;
    const ex = state.exam;
    const totalAllSubtypes = E.EXAM_TOPICS.reduce((acc, t) => acc + t.subtypes.length, 0);
    const activeSubtypeCount = ex.topics.reduce((acc, tid) => {
      const t = E.EXAM_TOPICS.find(x => x.id === tid);
      if (!t) return acc;
      const chosen = ex.subtypes[tid] || t.subtypes.map(s => s.id);
      return acc + chosen.length;
    }, 0);
    const allSelected = ex.topics.length === E.EXAM_TOPICS.length && activeSubtypeCount === totalAllSubtypes;

    const titleEl = exHost.querySelector("[data-exam-topics-title]");
    if (titleEl) titleEl.textContent = `Topics (${ex.topics.length} of ${E.EXAM_TOPICS.length} selected · ${activeSubtypeCount} question types)`;
    const resetBtn = exHost.querySelector('[data-exam-action="select-all-topics"]');
    if (resetBtn) resetBtn.textContent = allSelected ? "All types active" : "Reset all (mixed)";

    E.EXAM_TOPICS.forEach(t => {
      const wrap = exHost.querySelector(`[data-topic-wrap="${t.id}"]`);
      if (!wrap) return;
      const sel = ex.topics.includes(t.id);
      const chosen = ex.subtypes[t.id] || t.subtypes.map(s => s.id);
      const isAll = sel && chosen.length === t.subtypes.length;
      const isFiltered = sel && chosen.length < t.subtypes.length;
      const isOpen = ex.openTopicMenu === t.id;

      const chip = wrap.querySelector(".topic-chip");
      if (chip) chip.classList.toggle("selected", sel);

      const mark = wrap.querySelector("[data-topic-mark]");
      if (mark) {
        mark.textContent = sel ? "✓" : "";
        mark.style.color = sel ? "var(--accent)" : "var(--text-muted)";
      }

      const trig = wrap.querySelector(`[data-exam-menu="${t.id}"]`);
      if (trig) {
        trig.classList.toggle("filtered", isFiltered);
        trig.classList.toggle("open", isOpen);
        trig.setAttribute("aria-expanded", isOpen ? "true" : "false");
        const labelSpan = trig.querySelector("[data-trigger-label]");
        if (labelSpan) {
          labelSpan.textContent = !sel
            ? `Choose from ${t.subtypes.length} types`
            : (isAll ? `All ${t.subtypes.length} types` : `${chosen.length} of ${t.subtypes.length} types`);
        }
      }

      const dd = wrap.querySelector(".topic-dropdown");
      if (dd) {
        dd.classList.toggle("open", isOpen);
        dd.setAttribute("aria-hidden", isOpen ? "false" : "true");
        const masterChk = dd.querySelector(`[data-exam-sub-all="${t.id}"] .dd-check`);
        if (masterChk) {
          masterChk.classList.toggle("checked", isAll);
          masterChk.innerHTML = isAll ? CHECK_SVG : "";
        }
        t.subtypes.forEach(s => {
          const checked = sel && chosen.includes(s.id);
          const chk = dd.querySelector(`[data-exam-sub="${t.id}:${s.id}"] .dd-check`);
          if (chk) {
            chk.classList.toggle("checked", checked);
            chk.innerHTML = checked ? CHECK_SVG : "";
          }
        });
      }
    });
  }

  function renderExamSetup() {
    const ex = state.exam;
    const totalAllSubtypes = E.EXAM_TOPICS.reduce((acc, t) => acc + t.subtypes.length, 0);
    const activeSubtypeCount = ex.topics.reduce((acc, tid) => {
      const t = E.EXAM_TOPICS.find(x => x.id === tid);
      if (!t) return acc;
      const chosen = ex.subtypes[tid] || t.subtypes.map(s => s.id);
      return acc + chosen.length;
    }, 0);
    const allSelected = ex.topics.length === E.EXAM_TOPICS.length && activeSubtypeCount === totalAllSubtypes;
    const history = loadExamHistory();

    const topicChips = E.EXAM_TOPICS.map(t => {
      const sel = ex.topics.includes(t.id);
      const chosen = ex.subtypes[t.id] || t.subtypes.map(s => s.id);
      const isAll = sel && chosen.length === t.subtypes.length;
      const isFiltered = sel && chosen.length < t.subtypes.length;
      const isOpen = ex.openTopicMenu === t.id;
      const triggerText = !sel
        ? `Choose from ${t.subtypes.length} types`
        : (isAll ? `All ${t.subtypes.length} types` : `${chosen.length} of ${t.subtypes.length} types`);

      const dropdownHtml = `
        <div class="topic-dropdown ${isOpen ? "open" : ""}" role="menu" aria-hidden="${isOpen ? "false" : "true"}" aria-label="${escapeHtml(t.name)} question types">
          <button type="button" class="topic-dd-item master" data-exam-sub-all="${t.id}">
            <span class="dd-check ${isAll ? "checked" : ""}">${isAll ? CHECK_SVG : ""}</span>
            <span>All ${t.subtypes.length} types</span>
          </button>
          <div class="topic-dd-divider"></div>
          ${t.subtypes.map(s => {
            const checked = sel && chosen.includes(s.id);
            return `
              <button type="button" class="topic-dd-item" data-exam-sub="${t.id}:${s.id}">
                <span class="dd-check ${checked ? "checked" : ""}">${checked ? CHECK_SVG : ""}</span>
                <span>${escapeHtml(s.label)}</span>
              </button>
            `;
          }).join("")}
        </div>
      `;

      return `
        <div class="topic-card-wrap" data-topic-wrap="${t.id}">
          <div class="topic-chip ${sel ? "selected" : ""}">
            <button type="button" class="topic-chip-main" data-exam-topic="${t.id}">
              <span class="topic-chip-head">
                <span>${escapeHtml(t.name)}</span>
                <span data-topic-mark style="font-family:var(--font-mono);font-size:12px;color:${sel ? "var(--accent)" : "var(--text-muted)"};">${sel ? "✓" : ""}</span>
              </span>
              <span class="topic-chip-meta">${escapeHtml(t.section)}</span>
            </button>
            <button type="button" class="topic-sub-trigger ${isFiltered ? "filtered" : ""} ${isOpen ? "open" : ""}" data-exam-menu="${t.id}" aria-expanded="${isOpen ? "true" : "false"}">
              <span data-trigger-label>${triggerText}</span>
              ${CHEV_SVG}
            </button>
          </div>
          ${dropdownHtml}
        </div>
      `;
    }).join("");

    const historyHtml = history.length ? `
      <section class="card">
        <div class="card-header" style="margin-bottom:8px;">
          <h2 class="card-title">Recent exams</h2>
          <button class="btn" data-exam-action="clear-history">Clear history</button>
        </div>
        <table class="data-table">
          <thead>
            <tr><th>Date</th><th>Topics</th><th>Difficulty</th><th style="text-align:right;">Score</th><th style="text-align:right;">Time</th></tr>
          </thead>
          <tbody>
            ${history.map(h => `
              <tr>
                <td>${escapeHtml(h.date)}</td>
                <td>${escapeHtml(h.topics)}</td>
                <td style="text-transform:capitalize;">${escapeHtml(h.difficulty)}</td>
                <td class="num">${h.score} / ${h.total} (${h.pct}%)</td>
                <td class="num">${escapeHtml(h.duration)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </section>
    ` : "";

    return `
      <div class="exam-stage">
        <div>
          <h1 class="exam-heading">Configure your exam</h1>
          <p class="exam-lead">Choose mixed topics or open any topic menu to pick exact question types. Every inverse and linear system is algebraically verified before starting.</p>
        </div>

        <section class="card" style="display:flex;flex-direction:column;gap:20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div>
              <h2 class="card-title" data-exam-topics-title>Topics (${ex.topics.length} of ${E.EXAM_TOPICS.length} selected · ${activeSubtypeCount} question types)</h2>
              <p class="card-caption">Click a card to toggle the chapter, or open its dropdown to filter exact sub-types</p>
            </div>
            <button class="btn" data-exam-action="select-all-topics">${allSelected ? "All types active" : "Reset all (mixed)"}</button>
          </div>
          <div class="topic-grid">${topicChips}</div>

          <div class="exam-config-row">
            <div class="config-group">
              <span class="config-label">Difficulty</span>
              <div class="segmented" role="group" aria-label="Exam difficulty">
                ${["easy", "normal", "hard"].map(df => `<button class="seg-btn ${ex.difficulty === df ? "active" : ""}" data-exam-diff="${df}" style="text-transform:capitalize;">${df}</button>`).join("")}
              </div>
              <span class="config-hint">${escapeHtml(DIFF_NOTES[ex.difficulty])}</span>
            </div>

            <div class="config-group">
              <span class="config-label">Number of questions</span>
              <div class="segmented" role="group" aria-label="Question count">
                ${[5, 8, 12].map(n => `<button class="seg-btn ${!ex.customCountOpen && ex.count === n ? "active" : ""}" data-exam-count="${n}">${n}</button>`).join("")}
                <button class="seg-btn ${ex.customCountOpen ? "active" : ""}" data-exam-count-custom="1">Custom</button>
              </div>
              ${ex.customCountOpen ? renderRulerSlider({
                kind: "count",
                value: ex.count,
                min: EXAM_COUNT_MIN,
                max: EXAM_COUNT_MAX,
                tickStep: 1,
                majorStep: 5,
                unit: ex.count === 1 ? "question" : "questions",
              }) : ""}
              <span class="config-hint" id="exam-count-hint">${ex.count} exact integer question${ex.count === 1 ? "" : "s"} balanced across your selected topics</span>
            </div>
          </div>

          <div class="exam-config-row">
            <div class="config-group">
              <span class="config-label">Feedback style</span>
              <div class="segmented" role="group" aria-label="Grading style">
                <button class="seg-btn ${ex.gradingMode === "instant" ? "active" : ""}" data-exam-grading="instant">Step-by-step</button>
                <button class="seg-btn ${ex.gradingMode === "end" ? "active" : ""}" data-exam-grading="end">Grade at end</button>
              </div>
              <span class="config-hint">${ex.gradingMode === "instant" ? "Check each question immediately and see the exact derivation before moving on" : "Navigate freely between all questions and grade everything together at the end"}</span>
            </div>

            <div class="config-group">
              <span class="config-label">Timer</span>
              <div class="segmented" role="group" aria-label="Exam timer">
                <button class="seg-btn ${!ex.customTimerOpen && ex.timerMin === 0 ? "active" : ""}" data-exam-timer="0">No limit</button>
                <button class="seg-btn ${!ex.customTimerOpen && ex.timerMin === 15 ? "active" : ""}" data-exam-timer="15">15 min</button>
                <button class="seg-btn ${!ex.customTimerOpen && ex.timerMin === 30 ? "active" : ""}" data-exam-timer="30">30 min</button>
                <button class="seg-btn ${ex.customTimerOpen ? "active" : ""}" data-exam-timer-custom="1">Custom</button>
              </div>
              ${ex.customTimerOpen ? renderRulerSlider({
                kind: "timer",
                value: ex.timerMin || 20,
                min: EXAM_TIMER_MIN,
                max: EXAM_TIMER_MAX,
                tickStep: 5,
                majorStep: 30,
                unit: (ex.timerMin || 20) === 1 ? "minute" : "minutes",
              }) : ""}
              <span class="config-hint" id="exam-timer-hint">${ex.timerMin === 0 ? "Tracks elapsed time quietly without cutting you off" : `Counts down from ${ex.timerMin} minute${ex.timerMin === 1 ? "" : "s"} and submits automatically at 00:00`}</span>
            </div>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:16px;border-top:1px solid var(--hairline);flex-wrap:wrap;">
            <span class="config-hint">Tip: enter exact fractions like <code style="font-family:var(--font-mono);">1/3</code> or <code style="font-family:var(--font-mono);">-2/5</code>; use <code style="font-family:var(--font-mono);">Tab</code> and arrow keys across matrix cells</span>
            <button class="btn btn-primary btn-lg" data-exam-action="start">Start exam</button>
          </div>
        </section>

        ${historyHtml}
      </div>
    `;
  }

  function renderExpectedSolution(q) {
    if (q.answerType === "scalar") {
      return `<div class="mono-block">${escapeHtml(q.answerLabel || "Answer")} = ${escapeHtml(fmt(q.expected))}</div>`;
    }
    if (q.answerType === "pair") {
      return `<div class="mono-block">${escapeHtml(q.answerLabels[0])} = ${escapeHtml(fmt(q.expected[0]))}  ·  ${escapeHtml(q.answerLabels[1])} = ${escapeHtml(fmt(q.expected[1]))}</div>`;
    }
    if (q.answerType === "vector") {
      return renderVector(q.expected, q.answerLabel || "x");
    }
    return renderMatrix(q.expected, { label: q.answerLabel || "Answer" });
  }

  function renderExamAnswerInputs(q, raw, checked, grade) {
    const ro = checked ? "readonly" : "";
    if (q.answerType === "scalar") {
      const val = (raw && raw[0] && raw[0][0]) || "";
      const cls = checked && grade ? (grade.cellStates[0][0] ? "mat-cell-input correct" : "mat-cell-input wrong") : "mat-cell-input";
      return `
        <div class="mat-wrap">
          <span class="mat-label">${escapeHtml(q.answerLabel || "Answer")} =</span>
          <input type="text" class="${cls}" style="width:112px;" data-exam-cell="0:0" value="${escapeHtml(val)}" placeholder="e.g. 3/2" ${ro}>
        </div>
      `;
    }
    if (q.answerType === "pair") {
      const arr = (raw && raw[0]) || ["", ""];
      return `
        <div class="eq-flow">
          ${[0, 1].map(idx => {
            const cls = checked && grade ? (grade.cellStates[0][idx] ? "mat-cell-input correct" : "mat-cell-input wrong") : "mat-cell-input";
            return `
              <div class="mat-wrap">
                <span class="mat-label">${escapeHtml(q.answerLabels[idx])} =</span>
                <input type="text" class="${cls}" style="width:72px;" data-exam-cell="0:${idx}" value="${escapeHtml(arr[idx] || "")}" ${ro}>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }
    if (q.answerType === "vector") {
      const n = q.expected.length;
      const arr = (raw && raw[0]) || Array(n).fill("");
      const cells = [];
      for (let i = 0; i < n; i++) {
        const cls = checked && grade ? (grade.cellStates[0][i] ? "mat-cell-input correct" : "mat-cell-input wrong") : "mat-cell-input";
        cells.push(`<input type="text" class="${cls}" data-exam-cell="0:${i}" value="${escapeHtml(arr[i] || "")}" aria-label="Entry ${i + 1}" ${ro}>`);
      }
      return `
        <div class="mat-wrap">
          <span class="mat-label">${escapeHtml(q.answerLabel || "x")} =</span>
          <div class="mat-frame" style="grid-template-columns: 60px;">${cells.join("")}</div>
        </div>
      `;
    }
    // Matrix
    const m = q.expected.length, n = q.expected[0].length;
    const cells = [];
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        const val = (raw && raw[i] && raw[i][j]) || "";
        const cls = checked && grade ? (grade.cellStates[i][j] ? "mat-cell-input correct" : "mat-cell-input wrong") : "mat-cell-input";
        cells.push(`<input type="text" class="${cls}" data-exam-cell="${i}:${j}" value="${escapeHtml(val)}" aria-label="Row ${i + 1} col ${j + 1}" ${ro}>`);
      }
    }
    return `
      <div class="mat-wrap">
        <span class="mat-label">${escapeHtml(q.answerLabel || "Answer")} =</span>
        <div class="mat-frame" style="grid-template-columns: repeat(${n}, 60px);">${cells.join("")}</div>
      </div>
    `;
  }

  function renderExamActive() {
    const ex = state.exam;
    const idx = ex.current;
    const q = ex.questions[idx];
    const total = ex.questions.length;
    const checked = ex.checked[idx];
    const grade = ex.grades[idx];
    const topicObj = E.EXAM_TOPICS.find(t => t.id === q.topic) || { name: q.topic };

    const completedCount = ex.gradingMode === "instant"
      ? ex.checked.filter(Boolean).length
      : ex.answers.filter(hasAnyInput).length;
    const pct = Math.round((completedCount / Math.max(1, total)) * 100);

    const pills = ex.questions.map((_, i) => {
      const cls = ["q-pill"];
      if (i === idx) cls.push("current");
      if (ex.checked[i] && ex.grades[i]) cls.push(ex.grades[i].correct ? "correct" : "wrong");
      else if (hasAnyInput(ex.answers[i])) cls.push("answered");
      if (ex.flagged[i]) cls.push("flagged");
      return `<button class="${cls.join(" ")}" data-exam-jump="${i}" aria-label="Question ${i + 1}">${i + 1}</button>`;
    }).join("");

    const givenHtml = q.given && q.given.length ? `
      <div class="eq-flow">
        ${q.given.map(g => g.type === "vector" ? renderVector(g.data, g.label) : renderMatrix(g.data, { label: g.label })).join("")}
      </div>
    ` : "";

    const hintHtml = ex.hintsOpen[idx] ? `
      <div class="info-banner"><strong>Hint:</strong> ${escapeHtml(q.hint)}</div>
    ` : "";

    let feedbackHtml = "";
    if (checked && grade) {
      feedbackHtml = `
        <div style="display:flex;flex-direction:column;gap:12px;padding-top:16px;border-top:1px solid var(--hairline);">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <span class="status-pill ${grade.correct ? "pos" : "neg"}"><span class="dot"></span>${grade.correct ? "Exact match" : `${grade.rightCount} of ${grade.totalCount} entries correct`}</span>
            ${grade.note ? `<span class="config-hint">${escapeHtml(grade.note)}</span>` : ""}
          </div>
          ${!grade.correct ? `<div class="eq-flow"><span class="stat-label">Exact answer:</span>${renderExpectedSolution(q)}</div>` : ""}
          <div class="info-banner"><strong>Derivation:</strong> ${escapeHtml(q.explanation)}</div>
        </div>
      `;
    }

    let primaryCta = "";
    if (ex.gradingMode === "instant") {
      if (!checked) {
        primaryCta = `<button class="btn btn-primary" data-exam-action="check-q">Check answer</button>`;
      } else if (idx < total - 1) {
        primaryCta = `<button class="btn btn-primary" data-exam-action="next-q">Next question</button>`;
      } else {
        primaryCta = `<button class="btn btn-primary" data-exam-action="finish">View exam results</button>`;
      }
    } else {
      primaryCta = idx < total - 1
        ? `<button class="btn btn-primary" data-exam-action="next-q">Next question</button>`
        : `<button class="btn btn-primary" data-exam-action="finish">Finish &amp; grade exam</button>`;
    }

    return `
      <div class="exam-stage">
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div class="exam-progress-track"><div class="exam-progress-fill" style="width:${pct}%;"></div></div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div class="q-nav-strip">${pills}</div>
            ${ex.gradingMode === "end" ? `<button class="btn" data-exam-action="finish">Submit exam (${completedCount}/${total})</button>` : ""}
          </div>
        </div>

        <section class="exam-q-card">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="status-pill neutral">${escapeHtml(q.section)} · ${escapeHtml(topicObj.name)}</span>
              <span class="status-pill neutral" style="text-transform:capitalize;">${escapeHtml(q.difficulty)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <button class="btn" data-exam-action="toggle-hint">${ex.hintsOpen[idx] ? "Hide hint" : "Hint"}</button>
              <button class="btn" data-exam-action="toggle-flag">${ex.flagged[idx] ? "Flagged" : "Flag"}</button>
            </div>
          </div>

          <h2 class="exam-q-prompt">${idx + 1}. ${escapeHtml(q.prompt)}</h2>
          ${givenHtml}

          <div class="exam-answer-box">
            <span class="stat-label">Your answer (exact integer or fraction such as -3/2)</span>
            ${renderExamAnswerInputs(q, ex.answers[idx], checked, grade)}
          </div>

          ${hintHtml}
          ${feedbackHtml}

          <div class="exam-actions-bar">
            <button class="btn" data-exam-action="prev-q" ${idx === 0 ? "disabled" : ""}>Previous</button>
            <div style="display:flex;align-items:center;gap:8px;">
              ${ex.gradingMode === "instant" && !checked && idx < total - 1 ? `<button class="btn" data-exam-action="next-q">Skip for now</button>` : ""}
              ${primaryCta}
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function renderExamSummary() {
    const ex = state.exam;
    const total = ex.questions.length;
    const right = ex.grades.filter(g => g && g.correct).length;
    const pct = Math.round((right / Math.max(1, total)) * 100);

    // Topic breakdown
    const byTopic = {};
    ex.questions.forEach((q, i) => {
      if (!byTopic[q.topic]) byTopic[q.topic] = { total: 0, right: 0 };
      byTopic[q.topic].total++;
      if (ex.grades[i] && ex.grades[i].correct) byTopic[q.topic].right++;
    });

    const topicRows = Object.entries(byTopic).map(([tid, stats]) => {
      const meta = E.EXAM_TOPICS.find(t => t.id === tid) || { name: tid, section: "" };
      const tPct = Math.round((stats.right / stats.total) * 100);
      return { id: tid, name: meta.name, section: meta.section, ...stats, pct: tPct };
    });

    const missedTopics = topicRows.filter(r => r.right < r.total).map(r => r.id);
    const weakest = [...topicRows].sort((a, b) => a.pct - b.pct)[0];
    const strongest = [...topicRows].sort((a, b) => b.pct - a.pct)[0];

    const reviewCards = ex.questions.map((q, i) => {
      const g = ex.grades[i];
      const ok = g && g.correct;
      const meta = E.EXAM_TOPICS.find(t => t.id === q.topic) || { name: q.topic };
      const raw = ex.answers[i];
      let userText = "No answer entered";
      if (hasAnyInput(raw)) {
        if (q.answerType === "scalar") userText = raw[0][0];
        else if (q.answerType === "pair") userText = `${q.answerLabels[0]} = ${raw[0][0] || "—"}, ${q.answerLabels[1]} = ${raw[0][1] || "—"}`;
        else if (q.answerType === "vector") userText = `[ ${raw[0].map(v => v || "—").join(", ")} ]ᵀ`;
        else userText = raw.map(r => `[ ${r.map(v => v || "—").join("  ")} ]`).join("\n");
      }

      return `
        <div class="review-item ${ok ? "is-correct" : "is-wrong"}">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="status-pill ${ok ? "pos" : "neg"}"><span class="dot"></span>Q${i + 1} · ${ok ? "Correct" : "Incorrect"}</span>
              <span class="status-pill neutral">${escapeHtml(q.section)} · ${escapeHtml(meta.name)}</span>
            </div>
            ${q.solverPayload ? `<button class="btn" data-exam-open-solver="${i}">Open in workspace</button>` : ""}
          </div>
          <p class="exam-q-prompt" style="font-size:14px;">${escapeHtml(q.prompt)}</p>
          ${q.given && q.given.length ? `<div class="eq-flow">${q.given.map(item => item.type === "vector" ? renderVector(item.data, item.label) : renderMatrix(item.data, { label: item.label })).join("")}</div>` : ""}
          <div class="grid-2">
            <div>
              <div class="stat-label" style="margin-bottom:6px;">Your answer</div>
              <div class="mono-block">${escapeHtml(userText)}</div>
            </div>
            <div>
              <div class="stat-label" style="margin-bottom:6px;">Exact solution</div>
              <div class="eq-flow">${renderExpectedSolution(q)}</div>
            </div>
          </div>
          <div class="info-banner"><strong>Derivation:</strong> ${escapeHtml(q.explanation)}</div>
        </div>
      `;
    }).join("");

    const diffCap = ex.difficulty.charAt(0).toUpperCase() + ex.difficulty.slice(1);
    const hasStrong = strongest && strongest.right > 0;

    return `
      <div class="exam-stage wide">
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;">
          <div>
            <h1 class="exam-heading">Exam complete</h1>
            <p class="exam-lead">${escapeHtml(diffCap)} difficulty · ${total} questions · ${formatDuration(ex.elapsedSec)}</p>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${missedTopics.length ? `<button class="btn btn-primary" data-exam-action="retake-missed">Practice missed topics</button>` : ""}
            <button class="btn ${missedTopics.length ? "" : "btn-primary"}" data-exam-action="new-setup">Configure new exam</button>
            <button class="btn" data-exam-action="force-exit">Return to MatrixLab</button>
          </div>
        </div>

        <div class="stat-row">
          <div class="stat-card">
            <span class="stat-label">Score</span>
            <span class="stat-value ${pct >= 80 ? "pos" : (pct < 50 ? "neg" : "accent")}">${right} / ${total}</span>
            <span class="stat-note">${pct}% exact accuracy</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Time</span>
            <span class="stat-value">${formatDuration(ex.elapsedSec)}</span>
            <span class="stat-note">~${Math.round(ex.elapsedSec / Math.max(1, total))}s per question</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Strongest topic</span>
            <span class="stat-value" style="font-size:16px;">${hasStrong ? escapeHtml(strongest.name) : "None yet"}</span>
            <span class="stat-note">${hasStrong ? `${strongest.right}/${strongest.total} (${strongest.pct}%)` : "No correct answers yet"}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Needs review</span>
            <span class="stat-value" style="font-size:16px;">${weakest && weakest.pct < 100 ? escapeHtml(weakest.name) : "None"}</span>
            <span class="stat-note">${weakest && weakest.pct < 100 ? `${weakest.right}/${weakest.total} (${weakest.pct}%)` : "Perfect across all topics"}</span>
          </div>
        </div>

        <section class="card">
          <div class="card-header" style="margin-bottom:8px;">
            <h2 class="card-title">Topic breakdown</h2>
          </div>
          <table class="data-table">
            <thead>
              <tr><th>Topic</th><th>Section</th><th style="text-align:right;">Correct</th><th style="text-align:right;">Accuracy</th></tr>
            </thead>
            <tbody>
              ${topicRows.map(r => `
                <tr>
                  <td>${escapeHtml(r.name)}</td>
                  <td style="font-family:var(--font-mono);color:var(--text-muted);">${escapeHtml(r.section)}</td>
                  <td class="num">${r.right} / ${r.total}</td>
                  <td class="num">${r.pct}%</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </section>

        <div style="display:flex;flex-direction:column;gap:12px;">
          <h2 class="card-title">Question-by-question review</h2>
          ${reviewCards}
        </div>
      </div>
    `;
  }

  function renderExamOverlay(opts = {}) {
    const { animateStage = false } = opts;
    const host = document.getElementById("exam-overlay");
    if (!state.exam.open) return;
    let body = "";
    if (state.exam.phase === "setup") body = renderExamSetup();
    else if (state.exam.phase === "active") body = renderExamActive();
    else body = renderExamSummary();

    host.innerHTML = renderExamTopbar() + body;
    if (animateStage) {
      const stage = host.querySelector(".exam-stage");
      if (stage) stage.classList.add("panel-enter");
    }
    if (state.exam.phase === "active" && !state.exam.checked[state.exam.current]) {
      const firstInput = host.querySelector("input[data-exam-cell]");
      if (firstInput && animateStage) firstInput.focus();
    }
  }

  // =========================================================================
  // PERSONAL BROWSER MEMORY (Auto-saved workspace + Saved matrices + Backup)
  // =========================================================================
  const WORKSPACE_STORAGE_KEY = "matrixlab-workspace-v1";
  const SAVED_MATRICES_KEY = "matrixlab-saved-matrices";
  const EXAM_HISTORY_KEY = "matrixlab-exam-history";
  const PERSISTED_KEYS = [
    "mode", "decimal",
    "n", "A", "b", "invTab", "detTab", "detExpMode", "detExpIdx",
    "subM", "subN", "subA",
    "opM", "opK", "opP", "opA", "opB", "opTab", "opPowExp",
    "vecDim", "vecU", "vecV", "vecC1", "vecC2", "triP", "boxO", "boxE",
    "drillKind", "drillDiff",
  ];

  function extractWorkspaceSnapshot() {
    const snap = {};
    for (const k of PERSISTED_KEYS) {
      snap[k] = JSON.parse(JSON.stringify(state[k]));
    }
    return snap;
  }

  const DEFAULT_WORKSPACE = extractWorkspaceSnapshot();
  let saveStateTimer = null;

  function setMemoryStatus(msg) {
    const el = document.getElementById("memory-status");
    if (!el) return;
    el.textContent = msg;
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.textContent = "Auto-saved locally in this browser";
    }, 2400);
  }

  function schedulePersistWorkspace() {
    clearTimeout(saveStateTimer);
    saveStateTimer = setTimeout(() => {
      try {
        localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(extractWorkspaceSnapshot()));
      } catch (_) {}
    }, 120);
  }

  function applyWorkspaceSnapshot(snap) {
    if (!snap || typeof snap !== "object") return;
    for (const k of PERSISTED_KEYS) {
      if (snap[k] !== undefined) {
        if (k === "mode" && !MODE_META[snap[k]]) continue;
        state[k] = JSON.parse(JSON.stringify(snap[k]));
      }
    }
    // Defensive sanity bounds
    if (!Number.isInteger(state.n) || state.n < 2 || state.n > 5) state.n = 3;
    state.A = resizeRawGrid(Array.isArray(state.A) ? state.A : [], state.n, state.n, true);
    state.b = resizeVec(Array.isArray(state.b) ? state.b : [], state.n);
    if (!Number.isInteger(state.subM) || state.subM < 2 || state.subM > 5) state.subM = 3;
    if (!Number.isInteger(state.subN) || state.subN < 2 || state.subN > 6) state.subN = 5;
    state.subA = resizeRawGrid(Array.isArray(state.subA) ? state.subA : [], state.subM, state.subN, false);
    if (!Number.isInteger(state.opM) || state.opM < 2 || state.opM > 5) state.opM = 3;
    if (!Number.isInteger(state.opK) || state.opK < 2 || state.opK > 5) state.opK = 3;
    if (!Number.isInteger(state.opP) || state.opP < 2 || state.opP > 5) state.opP = 2;
    state.opA = resizeRawGrid(Array.isArray(state.opA) ? state.opA : [], state.opM, state.opK, true);
    state.opB = resizeRawGrid(Array.isArray(state.opB) ? state.opB : [], state.opK, state.opP, true);
    state.gjStep = 0;
    state.elimStep = 0;
    state.cofCell = [0, 0];
  }

  function restoreWorkspaceFromMemory() {
    try {
      const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (!raw) return;
      applyWorkspaceSnapshot(JSON.parse(raw));
    } catch (_) {}
  }

  function loadSavedMatrices() {
    try {
      const raw = localStorage.getItem(SAVED_MATRICES_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function persistSavedMatrices(list) {
    try {
      localStorage.setItem(SAVED_MATRICES_KEY, JSON.stringify(list.slice(0, 24)));
    } catch (_) {}
  }

  function saveCurrentMatrixA(customName = "") {
    const list = loadSavedMatrices();
    const nextNum = list.length ? Math.max(...list.map(x => x.num || 0)) + 1 : 1;
    const trimmed = String(customName || "").trim();

    if (state.mode === "subspaces") {
      const M = parseGrid(state.subA);
      const sub = E.analyzeSubspaces(M);
      list.unshift({
        id: `m_${Date.now()}`,
        num: nextNum,
        kind: "subspaces",
        name: trimmed || `Subspace #${nextNum}`,
        m: state.subM,
        n: state.subN,
        meta: `${state.subM}×${state.subN} · rank ${sub.rank}`,
        subA: state.subA.map(r => [...r]),
      });
    } else if (state.mode === "operations") {
      list.unshift({
        id: `m_${Date.now()}`,
        num: nextNum,
        kind: "operations",
        name: trimmed || `Algebra #${nextNum}`,
        m: state.opM,
        k: state.opK,
        p: state.opP,
        meta: `${state.opM}×${state.opK} · ${state.opK}×${state.opP}`,
        opA: state.opA.map(r => [...r]),
        opB: state.opB.map(r => [...r]),
      });
    } else {
      const A = parseGrid(state.A);
      const d = E.det(A);
      list.unshift({
        id: `m_${Date.now()}`,
        num: nextNum,
        kind: "square",
        name: trimmed || `Matrix #${nextNum}`,
        n: state.n,
        det: d.toStr(),
        meta: `${state.n}×${state.n} · det ${d.toStr()}`,
        A: state.A.map(r => [...r]),
        b: [...state.b],
      });
    }

    persistSavedMatrices(list);
    renderSavedMatrices();
    setMemoryStatus(`Saved "${list[0].name}"`);
  }

  function renderSavedMatrices() {
    const host = document.getElementById("saved-list");
    if (!host) return;
    const list = loadSavedMatrices();
    if (!list.length) {
      host.innerHTML = `<div class="saved-empty">No saved matrices yet. Save your active matrix to keep it in this browser.</div>`;
      return;
    }
    host.innerHTML = list.map((item, idx) => {
      const metaText = item.meta || `${item.n}×${item.n} · det ${item.det}`;
      return `
        <div class="saved-row">
          <button type="button" class="saved-load-btn" data-saved-load="${idx}" title="Load ${escapeHtml(item.name)}">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.name)}</span>
            <span class="saved-meta">${escapeHtml(metaText)}</span>
          </button>
          <button type="button" class="saved-del-btn" data-saved-del="${idx}" aria-label="Remove ${escapeHtml(item.name)}">×</button>
        </div>
      `;
    }).join("");
  }

  function exportPersonalMemory() {
    let examHistory = [];
    try {
      const raw = localStorage.getItem(EXAM_HISTORY_KEY);
      if (raw) examHistory = JSON.parse(raw);
    } catch (_) {}
    const bundle = {
      app: "MatrixLab",
      version: 1,
      exportedAt: new Date().toISOString(),
      theme: state.theme,
      workspace: extractWorkspaceSnapshot(),
      savedMatrices: loadSavedMatrices(),
      examHistory,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "matrixlab-memory.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMemoryStatus("Exported matrixlab-memory.json");
  }

  function importPersonalMemory(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || "{}"));
        if (Array.isArray(data.savedMatrices)) {
          persistSavedMatrices(data.savedMatrices);
        }
        if (Array.isArray(data.examHistory)) {
          localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(data.examHistory.slice(0, 30)));
        }
        if (data.workspace && typeof data.workspace === "object") {
          applyWorkspaceSnapshot(data.workspace);
          schedulePersistWorkspace();
        }
        if (data.theme === "dark" || data.theme === "light") {
          applyTheme(data.theme);
        }
        renderSavedMatrices();
        syncFormatButtons();
        render({ animate: true });
        setMemoryStatus(`Imported ${(data.savedMatrices || []).length} saved matrices`);
      } catch (_) {
        setMemoryStatus("Invalid backup JSON file");
      }
    };
    reader.readAsText(file);
  }

  function syncFormatButtons() {
    const fBtn = document.getElementById("fmt-frac");
    const dBtn = document.getElementById("fmt-dec");
    if (fBtn) fBtn.classList.toggle("active", !state.decimal);
    if (dBtn) dBtn.classList.toggle("active", state.decimal);
  }

  function render(opts = {}) {
    const { animate = false, animateTab = false } = opts;
    const meta = MODE_META[state.mode];
    document.getElementById("page-title").textContent = meta.title;
    document.getElementById("page-subtitle").textContent = meta.subtitle;

    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.mode === state.mode);
    });

    const ws = document.getElementById("workspace");
    if (state.mode === "inverse") ws.innerHTML = renderInverseMode();
    else if (state.mode === "elimination") ws.innerHTML = renderEliminationMode();
    else if (state.mode === "determinant") ws.innerHTML = renderDeterminantMode();
    else if (state.mode === "subspaces") ws.innerHTML = renderSubspacesMode();
    else if (state.mode === "operations") ws.innerHTML = renderOperationsMode();
    else if (state.mode === "vectors") {
      ws.innerHTML = renderVectorsMode();
      drawVectorCanvas();
    } else if (state.mode === "drills") ws.innerHTML = renderDrillsMode();

    schedulePersistWorkspace();

    if (animate) {
      ws.classList.remove("panel-enter");
      void ws.offsetWidth;
      ws.classList.add("panel-enter");
      ws.addEventListener("animationend", () => ws.classList.remove("panel-enter"), { once: true });
    } else if (animateTab) {
      const panel = ws.querySelector(".tab-panel");
      if (panel) {
        panel.classList.add("panel-enter");
        panel.addEventListener("animationend", () => panel.classList.remove("panel-enter"), { once: true });
      }
    }
  }

  function applyTheme(nextTheme) {
    state.theme = nextTheme;
    document.documentElement.setAttribute("data-theme", state.theme);
    try { localStorage.setItem("matrixlab-theme", state.theme); } catch (_) {}
    if (state.mode === "vectors") drawVectorCanvas();
  }

  function toggleThemeSeamless() {
    const nextTheme = state.theme === "light" ? "dark" : "light";
    const root = document.documentElement;
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Clean any residual entrance class before capturing View Transition snapshot
    const exEl = document.getElementById("exam-overlay");
    if (exEl) exEl.classList.remove("entering");

    if (typeof document.startViewTransition === "function" && !reduced) {
      root.classList.add("theme-switching");
      const vt = document.startViewTransition(() => {
        applyTheme(nextTheme);
      });
      vt.finished.finally(() => {
        root.classList.remove("theme-switching");
      });
    } else if (!reduced) {
      root.classList.add("theme-transitioning");
      applyTheme(nextTheme);
      window.setTimeout(() => root.classList.remove("theme-transitioning"), 240);
    } else {
      root.classList.add("theme-switching");
      applyTheme(nextTheme);
      requestAnimationFrame(() => root.classList.remove("theme-switching"));
    }
  }

  // Debounced input preservation (keeps cursor focus while recomputing live!)
  function attachEvents() {
    const brandHome = document.getElementById("brand-home");
    if (brandHome) {
      brandHome.addEventListener("click", () => {
        const changed = state.mode !== "inverse";
        state.mode = "inverse";
        if (window.location.hash !== "#inverse") history.replaceState(null, "", "#inverse");
        document.getElementById("sidebar").classList.remove("open");
        window.scrollTo({ top: 0, behavior: "smooth" });
        render({ animate: changed });
      });
    }

    document.getElementById("nav-list").addEventListener("click", e => {
      const btn = e.target.closest(".nav-item");
      if (!btn) return;
      const changed = state.mode !== btn.dataset.mode;
      state.mode = btn.dataset.mode;
      if (window.location.hash !== "#" + state.mode) history.replaceState(null, "", "#" + state.mode);
      document.getElementById("sidebar").classList.remove("open");
      render({ animate: changed });
    });

    const saveBtn = document.getElementById("save-matrix-btn");
    const saveNameInput = document.getElementById("save-matrix-name");
    const triggerSidebarSave = () => {
      saveCurrentMatrixA(saveNameInput ? saveNameInput.value : "");
      if (saveNameInput) saveNameInput.value = "";
    };
    if (saveBtn) saveBtn.addEventListener("click", triggerSidebarSave);
    if (saveNameInput) {
      saveNameInput.addEventListener("keydown", e => {
        if (e.key === "Enter") {
          e.preventDefault();
          triggerSidebarSave();
        }
      });
    }

    const exportBtn = document.getElementById("memory-export-btn");
    const importBtn = document.getElementById("memory-import-btn");
    const importFile = document.getElementById("memory-import-file");
    const resetBtn = document.getElementById("memory-reset-btn");
    if (exportBtn) exportBtn.addEventListener("click", exportPersonalMemory);
    if (importBtn && importFile) {
      importBtn.addEventListener("click", () => importFile.click());
      importFile.addEventListener("change", () => {
        if (importFile.files && importFile.files[0]) {
          importPersonalMemory(importFile.files[0]);
          importFile.value = "";
        }
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        applyWorkspaceSnapshot(DEFAULT_WORKSPACE);
        schedulePersistWorkspace();
        syncFormatButtons();
        render({ animate: true });
        setMemoryStatus("Workspace reset (saved list kept)");
      });
    }

    const savedList = document.getElementById("saved-list");
    if (savedList) {
      savedList.addEventListener("click", e => {
        const del = e.target.closest("[data-saved-del]");
        if (del) {
          const list = loadSavedMatrices();
          list.splice(Number(del.dataset.savedDel), 1);
          persistSavedMatrices(list);
          renderSavedMatrices();
          setMemoryStatus("Removed from saved list");
          return;
        }
        const load = e.target.closest("[data-saved-load]");
        if (load) {
          const item = loadSavedMatrices()[Number(load.dataset.savedLoad)];
          if (!item) return;
          if (item.kind === "subspaces" && Array.isArray(item.subA)) {
            state.subM = item.m;
            state.subN = item.n;
            state.subA = item.subA.map(r => [...r]);
            state.mode = "subspaces";
          } else if (item.kind === "operations" && Array.isArray(item.opA) && Array.isArray(item.opB)) {
            state.opM = item.m;
            state.opK = item.k;
            state.opP = item.p;
            state.opA = item.opA.map(r => [...r]);
            state.opB = item.opB.map(r => [...r]);
            state.mode = "operations";
          } else {
            state.n = item.n;
            state.A = item.A.map(r => [...r]);
            state.b = item.b ? [...item.b] : resizeVec(state.b, state.n);
            state.gjStep = 0; state.elimStep = 0; state.cofCell = [0, 0]; state.detExpIdx = 0;
            if (!["inverse", "elimination", "determinant"].includes(state.mode)) state.mode = "inverse";
          }
          document.getElementById("sidebar").classList.remove("open");
          render({ animate: true });
          setMemoryStatus(`Loaded "${item.name}"`);
        }
      });
    }

    const sideExamBtn = document.getElementById("sidebar-exam-btn");
    if (sideExamBtn) {
      sideExamBtn.addEventListener("click", () => {
        document.getElementById("sidebar").classList.remove("open");
        openExamOverlay("setup");
      });
    }

    document.getElementById("mobile-menu-btn").addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
    });

    document.querySelectorAll("[data-fmt]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.decimal = btn.dataset.fmt === "dec";
        document.getElementById("fmt-frac").classList.toggle("active", !state.decimal);
        document.getElementById("fmt-dec").classList.toggle("active", state.decimal);
        render();
      });
    });

    document.getElementById("theme-toggle").addEventListener("click", () => {
      toggleThemeSeamless();
    });

    const ws = document.getElementById("workspace");

    // Smart zero-clearing on workspace matrix/vector/scalar inputs (never produces "06"; restores "0" if left empty)
    function isWorkspaceNumericCell(el) {
      return el && el.classList && el.classList.contains("mat-cell-input")
        && !el.readOnly && !el.dataset.drill && !el.dataset.examCell;
    }

    ws.addEventListener("focusin", e => {
      const el = e.target;
      if (!isWorkspaceNumericCell(el)) return;
      if (el.value.trim() === "0") {
        el.dataset.wasZero = "1";
        el.placeholder = "0";
        el.value = "";
      }
    });

    ws.addEventListener("focusout", e => {
      const el = e.target;
      if (!isWorkspaceNumericCell(el)) return;
      const wasZero = el.dataset.wasZero === "1";
      delete el.dataset.wasZero;
      if (el.value.trim() === "") {
        el.value = "0";
        el.placeholder = "";
        if (!wasZero) {
          // User deliberately cleared a non-zero cell -> commit "0" to state and recompute
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } else {
        el.placeholder = "";
      }
    });

    // Live cell editing without destroying focus (commit on blur/Enter or live recompute for non-focused)
    ws.addEventListener("change", e => {
      const el = e.target;
      // If user focused a "0" cell, typed nothing, and moved away -> restore "0" cleanly with zero re-render
      if (el.dataset && el.dataset.wasZero === "1" && el.value.trim() === "") {
        el.value = "0";
        el.placeholder = "";
        delete el.dataset.wasZero;
        return;
      }
      if (el.dataset) delete el.dataset.wasZero;
      if (el.dataset.grid) {
        const r = Number(el.dataset.r), c = Number(el.dataset.c);
        state[el.dataset.grid][r][c] = el.value.trim() || "0";
        state.gjStep = 0; state.elimStep = 0;
        render();
      } else if (el.dataset.vec) {
        state[el.dataset.vec][Number(el.dataset.i)] = el.value.trim() || "0";
        render();
      } else if (el.dataset.scalar) {
        state[el.dataset.scalar] = el.value.trim() || "0";
        render();
      } else if (el.dataset.tri) {
        const [i, j] = el.dataset.tri.split(":").map(Number);
        state.triP[i][j] = el.value.trim() || "0";
        render();
      } else if (el.dataset.boxo !== undefined) {
        state.boxO[Number(el.dataset.boxo)] = el.value.trim() || "0";
        render();
      } else if (el.dataset.boxe) {
        const [i, j] = el.dataset.boxe.split(":").map(Number);
        state.boxE[i][j] = el.value.trim() || "0";
        render();
      } else if (el.dataset.drill) {
        const [i, j] = el.dataset.drill.split(":").map(Number);
        state.drillInputs[i][j] = el.value.trim();
        state.drillChecked = false;
      } else if (el.dataset.subDim) {
        if (el.dataset.subDim === "m") state.subM = Number(el.value);
        if (el.dataset.subDim === "n") state.subN = Number(el.value);
        state.subA = resizeRawGrid(state.subA, state.subM, state.subN, false);
        render();
      } else if (el.dataset.opDim) {
        const val = Number(el.value);
        if (el.dataset.opDim === "m") state.opM = val;
        if (el.dataset.opDim === "k") state.opK = val;
        if (el.dataset.opDim === "p") state.opP = val;
        state.opA = resizeRawGrid(state.opA, state.opM, state.opK, false);
        state.opB = resizeRawGrid(state.opB, state.opK, state.opP, false);
        state.opHover = [0, 0];
        render();
      }
    });

    ws.addEventListener("input", e => {
      const el = e.target;
      if (el.dataset.drill) {
        const [i, j] = el.dataset.drill.split(":").map(Number);
        state.drillInputs[i][j] = el.value;
      }
    });

    // Arrow key navigation inside matrix grids
    ws.addEventListener("keydown", e => {
      const el = e.target;
      if (!el.classList.contains("mat-cell-input")) return;
      if (e.key === "Enter") {
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      if (!el.dataset.grid) return;
      const r = Number(el.dataset.r), c = Number(el.dataset.c);
      let nr = r, nc = c;
      if (e.key === "ArrowUp") nr--;
      else if (e.key === "ArrowDown") nr++;
      else if (e.key === "ArrowLeft" && el.selectionStart === 0) nc--;
      else if (e.key === "ArrowRight" && el.selectionEnd === el.value.length) nc++;
      else return;
      const next = ws.querySelector(`input[data-grid="${el.dataset.grid}"][data-r="${nr}"][data-c="${nc}"]`);
      if (next) {
        e.preventDefault();
        next.focus();
        next.select();
      }
    });

    // Global [ and ] keyboard stepping for elimination & Gauss-Jordan
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && state.exam.open && state.exam.openTopicMenu) {
        state.exam.openTopicMenu = null;
        syncTopicSetupUI();
        return;
      }
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
      if (e.key === "[" || e.key === "]") {
        const delta = e.key === "]" ? 1 : -1;
        if (state.mode === "inverse" && state.invTab === "gj") {
          state.gjStep = Math.max(0, state.gjStep + delta);
          render();
        } else if (state.mode === "elimination") {
          state.elimStep = Math.max(0, state.elimStep + delta);
          render();
        }
      }
    });

    ws.addEventListener("click", e => {
      const t = e.target.closest("button, [data-click-mat], [data-gj-step], [data-elim-step]");
      if (!t) return;

      if (t.dataset.setN) {
        state.n = Number(t.dataset.setN);
        state.A = resizeRawGrid(state.A, state.n, state.n, true);
        state.b = resizeVec(state.b, state.n);
        state.gjStep = 0; state.elimStep = 0; state.cofCell = [0, 0]; state.detExpIdx = 0;
        render();
      } else if (t.dataset.action === "eye") {
        state.A = Array.from({ length: state.n }, (_, i) => Array.from({ length: state.n }, (_, j) => (i === j ? "1" : "0")));
        state.gjStep = 0; state.elimStep = 0; render();
      } else if (t.dataset.action === "save-matrix") {
        const nameEl = document.getElementById("save-matrix-name");
        saveCurrentMatrixA(nameEl ? nameEl.value : "");
        if (nameEl) nameEl.value = "";
      } else if (t.dataset.action === "zero") {
        state.A = Array.from({ length: state.n }, () => Array(state.n).fill("0"));
        state.gjStep = 0; state.elimStep = 0; render();
      } else if (t.dataset.action === "transpose") {
        const T = E.transpose(parseGrid(state.A));
        state.A = T.map(row => row.map(v => v.toStr()));
        state.gjStep = 0; state.elimStep = 0; render();
      } else if (t.dataset.action === "rand-unimod") {
        const n = state.n;
        const L = E.eye(n), U = E.eye(n);
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < i; j++) L[i][j] = Frac.of(Math.floor(Math.random() * 5) - 2);
          for (let j = i + 1; j < n; j++) U[i][j] = Frac.of(Math.floor(Math.random() * 5) - 2);
        }
        const M = E.mul(L, U);
        state.A = M.map(row => row.map(v => v.toStr()));
        state.gjStep = 0; state.elimStep = 0; render();
      } else if (t.dataset.action === "copy-inv-to-a") {
        const inv = E.invertAllMethods(parseGrid(state.A)).inverse;
        if (inv) {
          state.A = inv.map(row => row.map(v => v.toStr()));
          state.gjStep = 0; state.elimStep = 0; render();
        }
      } else if (t.dataset.invTab) {
        const changed = state.invTab !== t.dataset.invTab;
        state.invTab = t.dataset.invTab; render({ animateTab: changed });
      } else if (t.dataset.gjDelta) {
        state.gjStep = Math.max(0, state.gjStep + Number(t.dataset.gjDelta)); render();
      } else if (t.dataset.gjStep !== undefined) {
        state.gjStep = Number(t.dataset.gjStep); render();
      } else if (t.dataset.elimDelta) {
        state.elimStep = Math.max(0, state.elimStep + Number(t.dataset.elimDelta)); render();
      } else if (t.dataset.elimStep !== undefined) {
        state.elimStep = Number(t.dataset.elimStep); render();
      } else if (t.dataset.detTab) {
        const changed = state.detTab !== t.dataset.detTab;
        state.detTab = t.dataset.detTab; render({ animateTab: changed });
      } else if (t.dataset.detExp) {
        const [m, idx] = t.dataset.detExp.split(":");
        state.detExpMode = m; state.detExpIdx = Number(idx); render();
      } else if (t.dataset.clickMat === "cof-inv") {
        state.cofCell = [Number(t.dataset.r), Number(t.dataset.c)]; render();
      } else if (t.dataset.clickMat === "op-ab") {
        state.opHover = [Number(t.dataset.r), Number(t.dataset.c)]; render();
      } else if (t.dataset.opTab) {
        const changed = state.opTab !== t.dataset.opTab;
        state.opTab = t.dataset.opTab; render({ animateTab: changed });
      } else if (t.dataset.opPow) {
        state.opPowExp = Number(t.dataset.opPow); render();
      } else if (t.dataset.action === "op-square") {
        state.opM = 2; state.opK = 2; state.opP = 2;
        state.opA = [["1", "0"], ["2", "1"]];
        state.opB = [["1", "3"], ["0", "1"]];
        state.opHover = [0, 0]; render();
      } else if (t.dataset.action === "sub-l26") {
        state.subM = 3; state.subN = 5;
        state.subA = [["1", "2", "2", "4", "6"], ["1", "2", "3", "6", "9"], ["0", "0", "1", "2", "3"]];
        render();
      } else if (t.dataset.action === "sub-rank1") {
        state.subM = 3; state.subN = 3;
        state.subA = [["1", "3", "10"], ["2", "6", "20"], ["3", "9", "30"]];
        render();
      } else if (t.dataset.vecDim) {
        state.vecDim = Number(t.dataset.vecDim);
        state.vecU = resizeVec(state.vecU, state.vecDim);
        state.vecV = resizeVec(state.vecV, state.vecDim);
        render();
      } else if (t.dataset.drillKind) {
        state.drillKind = t.dataset.drillKind;
        ensureDrill(true); render();
      } else if (t.dataset.drillDiff) {
        state.drillDiff = t.dataset.drillDiff;
        ensureDrill(true); render();
      } else if (t.dataset.action === "open-exam-setup") {
        openExamOverlay("setup");
      } else if (t.dataset.action === "drill-check") {
        state.drillChecked = true; render();
      } else if (t.dataset.action === "drill-reveal") {
        state.drillReveal = !state.drillReveal; render();
      } else if (t.dataset.action === "drill-new") {
        ensureDrill(true); render();
      } else if (t.dataset.action === "drill-open-solver") {
        const d = state.drill;
        if (d.kind === "null2x3") {
          state.subM = d.A.length; state.subN = d.A[0].length;
          state.subA = d.A.map(r => r.map(v => v.toStr()));
          state.mode = "subspaces";
        } else {
          state.n = d.A.length;
          state.A = d.A.map(r => r.map(v => v.toStr()));
          state.gjStep = 0; state.elimStep = 0;
          state.mode = d.kind === "det3" ? "determinant" : (d.kind === "lu3" ? "elimination" : "inverse");
        }
        render();
      }
    });

    // Full-screen Exam Overlay Event Delegation
    const exHost = document.getElementById("exam-overlay");

    // 120fps direct pointer scrubbing on precision ruler sliders
    let activeRuler = null;
    function scrubRulerFromPointer(track, clientX) {
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const min = Number(track.dataset.min);
      const max = Number(track.dataset.max);
      const val = Math.round(min + ratio * (max - min));
      updateRulerDOM(exHost, track.dataset.rulerTrack, val, true);
    }

    exHost.addEventListener("pointerdown", e => {
      const snapLbl = e.target.closest("[data-ruler-snap]");
      if (snapLbl) {
        const [kind, vStr] = snapLbl.dataset.rulerSnap.split(":");
        updateRulerDOM(exHost, kind, Number(vStr), true);
        return;
      }
      const track = e.target.closest("[data-ruler-track]");
      if (!track) return;
      e.preventDefault();
      activeRuler = track;
      track.classList.add("dragging");
      if (track.setPointerCapture) track.setPointerCapture(e.pointerId);
      scrubRulerFromPointer(track, e.clientX);
    });

    exHost.addEventListener("pointermove", e => {
      if (!activeRuler) return;
      scrubRulerFromPointer(activeRuler, e.clientX);
    });

    const endRulerDrag = () => {
      if (!activeRuler) return;
      activeRuler.classList.remove("dragging");
      activeRuler = null;
    };
    exHost.addEventListener("pointerup", endRulerDrag);
    exHost.addEventListener("pointercancel", endRulerDrag);

    exHost.addEventListener("input", e => {
      const el = e.target;
      if (el.dataset.examCell) {
        const [r, c] = el.dataset.examCell.split(":").map(Number);
        const cur = state.exam.answers[state.exam.current];
        if (cur && cur[r]) cur[r][c] = el.value;
      } else if (el.dataset.examNum === "count" || el.dataset.examNum === "timer") {
        // Strip decimals and non-digits live so floats like 5.1 can never be entered
        const digits = el.value.replace(/\D/g, "");
        if (el.value !== digits) el.value = digits;
        if (digits !== "") updateRulerDOM(exHost, el.dataset.examNum, digits, true);
      }
    });

    exHost.addEventListener("change", e => {
      const el = e.target;
      if (el.dataset.examNum === "count" || el.dataset.examNum === "timer") {
        updateRulerDOM(exHost, el.dataset.examNum, el.value, true);
        el.value = String(el.dataset.examNum === "count" ? state.exam.count : state.exam.timerMin);
      }
    });

    exHost.addEventListener("keydown", e => {
      const el = e.target;
      if (el.dataset && el.dataset.rulerTrack) {
        const kind = el.dataset.rulerTrack;
        const step = e.shiftKey ? 5 : 1;
        const cur = kind === "count" ? state.exam.count : state.exam.timerMin;
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          updateRulerDOM(exHost, kind, cur + step, true);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          updateRulerDOM(exHost, kind, cur - step, true);
        }
        return;
      }
      if (!el.dataset || !el.dataset.examCell) return;
      if (e.key === "Enter") {
        e.preventDefault();
        const ex = state.exam;
        if (ex.phase !== "active") return;
        if (ex.gradingMode === "instant") {
          if (!ex.checked[ex.current]) checkCurrentQuestion();
          else if (ex.current < ex.questions.length - 1) {
            ex.current++;
            renderExamOverlay({ animateStage: true });
          } else {
            finishExam();
          }
        } else if (ex.current < ex.questions.length - 1) {
          ex.current++;
          renderExamOverlay({ animateStage: true });
        }
        return;
      }
      const [r, c] = el.dataset.examCell.split(":").map(Number);
      let nr = r, nc = c;
      if (e.key === "ArrowUp") nr--;
      else if (e.key === "ArrowDown") nr++;
      else if (e.key === "ArrowLeft" && el.selectionStart === 0) nc--;
      else if (e.key === "ArrowRight" && el.selectionEnd === el.value.length) nc++;
      else return;
      const next = exHost.querySelector(`input[data-exam-cell="${nr}:${nc}"]`);
      if (next) {
        e.preventDefault();
        next.focus();
        next.select();
      }
    });

    exHost.addEventListener("click", e => {
      const ex = state.exam;
      const t = e.target.closest("button");

      // Close open topic dropdown smoothly in-place when clicking outside
      if (ex.openTopicMenu && !e.target.closest(".topic-card-wrap")) {
        ex.openTopicMenu = null;
        syncTopicSetupUI();
        if (!t) return;
      }
      if (!t) return;

      if (t.dataset.rulerStep) {
        const [kind, deltaStr] = t.dataset.rulerStep.split(":");
        const cur = kind === "count" ? ex.count : ex.timerMin;
        updateRulerDOM(exHost, kind, cur + Number(deltaStr), true);
        return;
      }

      if (t.dataset.examMenu) {
        const tid = t.dataset.examMenu;
        ex.openTopicMenu = ex.openTopicMenu === tid ? null : tid;
        syncTopicSetupUI();
      } else if (t.dataset.examSubAll) {
        const tid = t.dataset.examSubAll;
        const meta = E.EXAM_TOPICS.find(x => x.id === tid);
        if (meta) {
          if (!ex.topics.includes(tid)) ex.topics = [...ex.topics, tid];
          ex.subtypes[tid] = meta.subtypes.map(s => s.id);
        }
        syncTopicSetupUI();
      } else if (t.dataset.examSub) {
        const [tid, sid] = t.dataset.examSub.split(":");
        const meta = E.EXAM_TOPICS.find(x => x.id === tid);
        if (meta) {
          if (!ex.topics.includes(tid)) {
            ex.topics = [...ex.topics, tid];
            ex.subtypes[tid] = [sid];
          } else {
            const cur = ex.subtypes[tid] || meta.subtypes.map(s => s.id);
            if (cur.includes(sid)) {
              const next = cur.filter(x => x !== sid);
              if (next.length > 0) {
                ex.subtypes[tid] = next;
              } else if (ex.topics.length > 1) {
                ex.topics = ex.topics.filter(x => x !== tid);
                ex.subtypes[tid] = meta.subtypes.map(s => s.id);
              }
            } else {
              ex.subtypes[tid] = [...cur, sid];
            }
          }
        }
        syncTopicSetupUI();
      } else if (t.dataset.examTopic) {
        const tid = t.dataset.examTopic;
        const meta = E.EXAM_TOPICS.find(x => x.id === tid);
        if (ex.topics.includes(tid)) {
          if (ex.topics.length > 1) ex.topics = ex.topics.filter(x => x !== tid);
        } else {
          ex.topics = [...ex.topics, tid];
          if (meta && (!ex.subtypes[tid] || !ex.subtypes[tid].length)) {
            ex.subtypes[tid] = meta.subtypes.map(s => s.id);
          }
        }
        syncTopicSetupUI();
      } else if (t.dataset.examDiff) {
        ex.difficulty = t.dataset.examDiff;
        renderExamOverlay();
      } else if (t.dataset.examCount) {
        ex.customCountOpen = false;
        ex.count = clampInt(t.dataset.examCount, EXAM_COUNT_MIN, EXAM_COUNT_MAX, 8);
        renderExamOverlay();
      } else if (t.dataset.examCountCustom) {
        ex.customCountOpen = true;
        ex.count = clampInt(ex.count, EXAM_COUNT_MIN, EXAM_COUNT_MAX, 10);
        renderExamOverlay();
      } else if (t.dataset.examGrading) {
        ex.gradingMode = t.dataset.examGrading;
        renderExamOverlay();
      } else if (t.dataset.examTimer !== undefined) {
        ex.customTimerOpen = false;
        ex.timerMin = Number(t.dataset.examTimer) === 0 ? 0 : clampInt(t.dataset.examTimer, EXAM_TIMER_MIN, EXAM_TIMER_MAX, 15);
        renderExamOverlay();
      } else if (t.dataset.examTimerCustom) {
        ex.customTimerOpen = true;
        ex.timerMin = ex.timerMin > 0 ? clampInt(ex.timerMin, EXAM_TIMER_MIN, EXAM_TIMER_MAX, 20) : 20;
        renderExamOverlay();
      } else if (t.dataset.examFmt) {
        state.decimal = t.dataset.examFmt === "dec";
        document.getElementById("fmt-frac").classList.toggle("active", !state.decimal);
        document.getElementById("fmt-dec").classList.toggle("active", state.decimal);
        renderExamOverlay();
      } else if (t.dataset.examJump !== undefined) {
        ex.current = Number(t.dataset.examJump);
        renderExamOverlay({ animateStage: true });
      } else if (t.dataset.examOpenSolver !== undefined) {
        openExamQuestionInWorkspace(ex.questions[Number(t.dataset.examOpenSolver)]);
      } else if (t.dataset.examAction === "select-all-topics") {
        ex.topics = E.EXAM_TOPICS.map(x => x.id);
        ex.subtypes = Object.fromEntries(E.EXAM_TOPICS.map(x => [x.id, x.subtypes.map(s => s.id)]));
        ex.openTopicMenu = null;
        syncTopicSetupUI();
      } else if (t.dataset.examAction === "start") {
        startExamSession();
      } else if (t.dataset.examAction === "check-q") {
        checkCurrentQuestion();
      } else if (t.dataset.examAction === "next-q") {
        if (ex.current < ex.questions.length - 1) {
          ex.current++;
          renderExamOverlay({ animateStage: true });
        }
      } else if (t.dataset.examAction === "prev-q") {
        if (ex.current > 0) {
          ex.current--;
          renderExamOverlay({ animateStage: true });
        }
      } else if (t.dataset.examAction === "toggle-hint") {
        ex.hintsOpen[ex.current] = !ex.hintsOpen[ex.current];
        renderExamOverlay();
      } else if (t.dataset.examAction === "toggle-flag") {
        ex.flagged[ex.current] = !ex.flagged[ex.current];
        renderExamOverlay();
      } else if (t.dataset.examAction === "finish") {
        finishExam();
      } else if (t.dataset.examAction === "retake-missed") {
        const missed = [...new Set(ex.questions.filter((_, i) => !ex.grades[i] || !ex.grades[i].correct).map(q => q.topic))];
        startExamSession(missed.length ? missed : null);
      } else if (t.dataset.examAction === "new-setup") {
        ex.phase = "setup";
        ex.confirmExit = false;
        renderExamOverlay({ animateStage: true });
      } else if (t.dataset.examAction === "clear-history") {
        try { localStorage.removeItem("matrixlab-exam-history"); } catch (_) {}
        renderExamOverlay();
      } else if (t.dataset.examAction === "toggle-theme") {
        toggleThemeSeamless();
      } else if (t.dataset.examAction === "exit") {
        if (ex.phase === "active") {
          ex.confirmExit = true;
          renderExamOverlay();
        } else {
          closeExamOverlay();
        }
      } else if (t.dataset.examAction === "cancel-exit") {
        ex.confirmExit = false;
        renderExamOverlay();
      } else if (t.dataset.examAction === "force-exit") {
        closeExamOverlay();
      }
    });

    window.addEventListener("resize", () => {
      if (state.mode === "vectors") requestAnimationFrame(drawVectorCanvas);
    });
  }

  function syncFromHash() {
    const raw = (window.location.hash || "").replace(/^#/, "");
    const [modePart, subPart] = raw.split(":");
    if (modePart === "exam") {
      state.mode = "drills";
    } else if (MODE_META[modePart]) {
      state.mode = modePart;
    }
    if (subPart) {
      if (state.mode === "inverse" && ["gj", "lu", "sub", "cof", "f2"].includes(subPart)) state.invTab = subPart;
      if (state.mode === "determinant" && ["cofactor", "pivot", "sarrus", "cramer"].includes(subPart)) state.detTab = subPart;
      if (state.mode === "operations" && ["AB", "BA", "sym", "sum", "pow"].includes(subPart)) state.opTab = subPart;
    }
    if (window.location.search.includes("theme=dark")) state.theme = "dark";
    else {
      try {
        const saved = localStorage.getItem("matrixlab-theme");
        if (saved === "dark" || saved === "light") state.theme = saved;
      } catch (_) {}
    }
    document.documentElement.setAttribute("data-theme", state.theme);
    if (modePart === "exam") {
      if (subPart === "custom") {
        state.exam.customCountOpen = true;
        state.exam.count = 15;
        state.exam.customTimerOpen = true;
        state.exam.timerMin = 45;
      } else if (subPart === "lu-menu") {
        state.exam.openTopicMenu = "elimination";
        state.exam.subtypes.elimination = ["lu_u", "lu_ldl"];
      }
      openExamOverlay("setup");
      if (subPart === "active") startExamSession();
      else if (subPart === "summary") { startExamSession(); finishExam(); }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    restoreWorkspaceFromMemory();
    syncFromHash();
    syncFormatButtons();
    renderSavedMatrices();
    attachEvents();
    render();
    window.addEventListener("hashchange", () => { syncFromHash(); render(); });
  });
})();
