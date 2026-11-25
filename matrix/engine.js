// MatrixLab — Exact BigInt Rational Linear Algebra Engine
// Zero floating-point drift. Every operation uses reduced exact fractions p/q.

(function (global) {
  "use strict";

  function bgcd(a, b) {
    a = a < 0n ? -a : a;
    b = b < 0n ? -b : b;
    while (b !== 0n) {
      const t = a % b;
      a = b;
      b = t;
    }
    return a === 0n ? 1n : a;
  }

  class Frac {
    constructor(n, d = 1n) {
      if (typeof n === "number") {
        if (!Number.isFinite(n)) throw new Error("Non-finite number");
        if (Number.isInteger(n)) {
          n = BigInt(n);
        } else {
          const s = n.toString();
          const parts = s.split(".");
          const scale = 10n ** BigInt(parts[1].length);
          n = BigInt(parts[0] + parts[1]);
          d = BigInt(d) * scale;
        }
      }
      if (typeof d === "number") d = BigInt(Math.trunc(d));
      if (d === 0n) throw new Error("Division by zero");
      if (d < 0n) {
        n = -n;
        d = -d;
      }
      const g = bgcd(n, d);
      this.n = n / g;
      this.d = d / g;
    }

    static of(v) {
      if (v instanceof Frac) return v;
      if (typeof v === "bigint") return new Frac(v, 1n);
      if (typeof v === "number") return new Frac(v, 1n);
      if (typeof v === "string") return Frac.parse(v);
      return new Frac(0n, 1n);
    }

    static parse(raw) {
      const s = String(raw ?? "").trim().replace(/\s+/g, "");
      if (!s || s === "-" || s === "+") return Frac.ZERO;
      if (s.includes("/")) {
        const [a, b] = s.split("/");
        if (!a || !b) return Frac.ZERO;
        const fa = Frac.parse(a);
        const fb = Frac.parse(b);
        if (fb.isZero()) return Frac.ZERO;
        return fa.div(fb);
      }
      if (/^[+-]?\d+$/.test(s)) return new Frac(BigInt(s), 1n);
      if (/^[+-]?\d*\.\d+$/.test(s)) {
        const neg = s.startsWith("-");
        const clean = s.replace(/^[+-]/, "");
        const [intPart, decPart] = clean.split(".");
        const scale = 10n ** BigInt(decPart.length);
        const num = BigInt((intPart || "0") + decPart);
        return new Frac(neg ? -num : num, scale);
      }
      const f = Number(s);
      if (Number.isFinite(f)) return new Frac(f, 1n);
      return Frac.ZERO;
    }

    add(o) { o = Frac.of(o); return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { o = Frac.of(o); return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o) { o = Frac.of(o); return new Frac(this.n * o.n, this.d * o.d); }
    div(o) { o = Frac.of(o); if (o.n === 0n) throw new Error("Division by zero"); return new Frac(this.n * o.d, this.d * o.n); }
    neg() { return new Frac(-this.n, this.d); }
    abs() { return new Frac(this.n < 0n ? -this.n : this.n, this.d); }
    inv() { return Frac.ONE.div(this); }
    isZero() { return this.n === 0n; }
    isOne() { return this.n === 1n && this.d === 1n; }
    isNegOne() { return this.n === -1n && this.d === 1n; }
    isNeg() { return this.n < 0n; }
    isInt() { return this.d === 1n; }
    eq(o) { o = Frac.of(o); return this.n === o.n && this.d === o.d; }

    toFloat() {
      return Number(this.n) / Number(this.d);
    }

    toStr(decimalMode = false) {
      if (decimalMode && this.d !== 1n) {
        const val = this.toFloat();
        return Number(val.toFixed(4)).toString();
      }
      return this.d === 1n ? this.n.toString() : `${this.n.toString()}/${this.d.toString()}`;
    }
  }

  Frac.ZERO = new Frac(0n, 1n);
  Frac.ONE = new Frac(1n, 1n);
  Frac.NEG_ONE = new Frac(-1n, 1n);

  // Matrix primitives
  function fromRaw(grid) {
    return grid.map(row => row.map(v => Frac.of(v)));
  }

  function clone(M) {
    return M.map(row => row.slice());
  }

  function zeros(m, n) {
    return Array.from({ length: m }, () => Array.from({ length: n }, () => Frac.ZERO));
  }

  function eye(n) {
    const M = zeros(n, n);
    for (let i = 0; i < n; i++) M[i][i] = Frac.ONE;
    return M;
  }

  function transpose(A) {
    const m = A.length, n = A[0].length;
    const T = zeros(n, m);
    for (let i = 0; i < m; i++)
      for (let j = 0; j < n; j++)
        T[j][i] = A[i][j];
    return T;
  }

  function isSymmetric(A) {
    const m = A.length, n = A[0].length;
    if (m !== n) return false;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (!A[i][j].eq(A[j][i])) return false;
    return true;
  }

  function add(A, B) {
    const m = A.length, n = A[0].length;
    if (B.length !== m || B[0].length !== n) return null;
    return A.map((row, i) => row.map((v, j) => v.add(B[i][j])));
  }

  function sub(A, B) {
    const m = A.length, n = A[0].length;
    if (B.length !== m || B[0].length !== n) return null;
    return A.map((row, i) => row.map((v, j) => v.sub(B[i][j])));
  }

  function mul(A, B) {
    const m = A.length, k1 = A[0].length;
    const k2 = B.length, p = B[0].length;
    if (k1 !== k2) return null;
    const C = zeros(m, p);
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < p; j++) {
        let sum = Frac.ZERO;
        for (let k = 0; k < k1; k++) sum = sum.add(A[i][k].mul(B[k][j]));
        C[i][j] = sum;
      }
    }
    return C;
  }

  function mulVec(A, v) {
    const m = A.length, n = A[0].length;
    const out = [];
    for (let i = 0; i < m; i++) {
      let s = Frac.ZERO;
      for (let j = 0; j < n; j++) s = s.add(A[i][j].mul(v[j]));
      out.push(s);
    }
    return out;
  }

  function pow(A, exp) {
    const n = A.length;
    if (n !== A[0].length) return null;
    if (exp === 0) return eye(n);
    let res = eye(n);
    let base = clone(A);
    let e = exp;
    while (e > 0) {
      if (e & 1) res = mul(res, base);
      base = mul(base, base);
      e >>= 1;
    }
    return res;
  }

  function matEq(A, B) {
    if (!A || !B || A.length !== B.length || A[0].length !== B[0].length) return false;
    for (let i = 0; i < A.length; i++)
      for (let j = 0; j < A[0].length; j++)
        if (!A[i][j].eq(B[i][j])) return false;
    return true;
  }

  // Exact minor submatrix deleting row r and col c
  function minorMatrix(A, r, c) {
    const out = [];
    for (let i = 0; i < A.length; i++) {
      if (i === r) continue;
      const row = [];
      for (let j = 0; j < A[0].length; j++) {
        if (j === c) continue;
        row.push(A[i][j]);
      }
      out.push(row);
    }
    return out;
  }

  // Exact determinant via pivot elimination (fast for any n)
  function det(A) {
    const n = A.length;
    if (n !== A[0].length) throw new Error("Determinant requires square matrix");
    if (n === 1) return A[0][0];
    if (n === 2) return A[0][0].mul(A[1][1]).sub(A[0][1].mul(A[1][0]));
    const M = clone(A);
    let swaps = 0;
    for (let col = 0; col < n; col++) {
      let piv = col;
      while (piv < n && M[piv][col].isZero()) piv++;
      if (piv === n) return Frac.ZERO;
      if (piv !== col) {
        [M[col], M[piv]] = [M[piv], M[col]];
        swaps++;
      }
      const pVal = M[col][col];
      for (let row = col + 1; row < n; row++) {
        if (M[row][col].isZero()) continue;
        const mult = M[row][col].div(pVal);
        for (let k = col; k < n; k++) {
          M[row][k] = M[row][k].sub(mult.mul(M[col][k]));
        }
      }
    }
    let prod = swaps % 2 === 1 ? Frac.NEG_ONE : Frac.ONE;
    for (let i = 0; i < n; i++) prod = prod.mul(M[i][i]);
    return prod;
  }

  // Cofactor entry C_ij = (-1)^(i+j) * det(M_ij)
  function cofactorEntry(A, i, j) {
    const Mij = minorMatrix(A, i, j);
    const d = Mij.length === 0 ? Frac.ONE : det(Mij);
    const sign = (i + j) % 2 === 0 ? Frac.ONE : Frac.NEG_ONE;
    return { minor: Mij, minorDet: d, sign, value: sign.mul(d) };
  }

  function cofactorMatrix(A) {
    const n = A.length;
    const C = zeros(n, n);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        C[i][j] = cofactorEntry(A, i, j).value;
    return C;
  }

  // Full PA = LU factorization with step trace, E_ij, M, and symmetric LDL^T
  function factorizePALU(A) {
    const n = A.length;
    const U = clone(A);
    const L = eye(n);
    const P = eye(n);
    const steps = [];
    const elementaryMatrices = [];
    let swaps = 0;
    let singular = false;

    steps.push({
      op: "Initial matrix A",
      detail: "Starting forward elimination to produce upper triangular U",
      pivot: null,
      targetRow: null,
      matrix: clone(U),
      L: clone(L),
      P: clone(P),
    });

    for (let col = 0; col < n; col++) {
      let piv = col;
      while (piv < n && U[piv][col].isZero()) piv++;
      if (piv === n) {
        singular = true;
        steps.push({
          op: `Zero pivot in column ${col + 1}`,
          detail: "No non-zero entry below diagonal. Matrix is singular (det = 0)",
          pivot: [col, col],
          targetRow: null,
          matrix: clone(U),
          L: clone(L),
          P: clone(P),
        });
        continue;
      }
      if (piv !== col) {
        [U[col], U[piv]] = [U[piv], U[col]];
        [P[col], P[piv]] = [P[piv], P[col]];
        // Swap already computed multipliers strictly left of col in L
        for (let k = 0; k < col; k++) {
          [L[col][k], L[piv][k]] = [L[piv][k], L[col][k]];
        }
        swaps++;
        const Pmat = eye(n);
        [Pmat[col], Pmat[piv]] = [Pmat[piv], Pmat[col]];
        elementaryMatrices.push({ label: `P_${col + 1}${piv + 1}`, matrix: Pmat, isSwap: true });
        steps.push({
          op: `R${col + 1} ↔ R${piv + 1}`,
          detail: `Temporary zero pivot at (${col + 1},${col + 1}). Swapped Row ${col + 1} with Row ${piv + 1}`,
          pivot: [col, col],
          targetRow: piv,
          matrix: clone(U),
          L: clone(L),
          P: clone(P),
        });
      }

      const pVal = U[col][col];
      for (let row = col + 1; row < n; row++) {
        if (U[row][col].isZero()) continue;
        const mult = U[row][col].div(pVal);
        L[row][col] = mult;
        for (let k = col; k < n; k++) {
          U[row][k] = U[row][k].sub(mult.mul(U[col][k]));
        }
        const Eij = eye(n);
        Eij[row][col] = mult.neg();
        elementaryMatrices.push({ label: `E_${row + 1}${col + 1}`, matrix: Eij, mult, isSwap: false });
        const signStr = mult.isNeg() ? `+ (${mult.neg().toStr()})` : `- (${mult.toStr()})`;
        steps.push({
          op: `R${row + 1} ← R${row + 1} ${signStr} R${col + 1}`,
          detail: `Multiplier l_${row + 1}${col + 1} = ${mult.toStr()} using pivot d_${col + 1} = ${pVal.toStr()}`,
          pivot: [col, col],
          targetRow: row,
          multiplier: mult,
          matrix: clone(U),
          L: clone(L),
          P: clone(P),
        });
      }
    }

    // Combined M such that M * A = U
    let M = eye(n);
    for (const em of elementaryMatrices) {
      M = mul(em.matrix, M);
    }

    const pivots = [];
    let detVal = swaps % 2 === 1 ? Frac.NEG_ONE : Frac.ONE;
    for (let i = 0; i < n; i++) {
      pivots.push(U[i][i]);
      detVal = detVal.mul(U[i][i]);
    }

    // Check symmetric S = L D L^T (valid when symmetric, no swaps, non-singular)
    let ldl = null;
    if (isSymmetric(A) && swaps === 0 && !singular) {
      const D = zeros(n, n);
      for (let i = 0; i < n; i++) D[i][i] = U[i][i];
      ldl = { L: clone(L), D, LT: transpose(L) };
    }

    return { P, L, U, M, elementaryMatrices, pivots, swaps, det: detVal, singular, ldl, steps };
  }

  // Forward solve L c = b (L is unit lower triangular)
  function forwardSub(L, b) {
    const n = L.length;
    const c = Array(n).fill(Frac.ZERO);
    const trace = [];
    for (let i = 0; i < n; i++) {
      let rhs = b[i];
      const terms = [];
      for (let j = 0; j < i; j++) {
        if (!L[i][j].isZero()) {
          rhs = rhs.sub(L[i][j].mul(c[j]));
          terms.push(`(${L[i][j].toStr()})(${c[j].toStr()})`);
        }
      }
      c[i] = rhs.div(L[i][i]);
      trace.push({
        idx: i + 1,
        expr: terms.length
          ? `c${i + 1} = ${b[i].toStr()} - [${terms.join(" + ")}] = ${c[i].toStr()}`
          : `c${i + 1} = ${c[i].toStr()}`,
        val: c[i],
      });
    }
    return { c, trace };
  }

  // Backward solve U x = c (U is upper triangular, non-zero diagonal)
  function backwardSub(U, c) {
    const n = U.length;
    const x = Array(n).fill(Frac.ZERO);
    const trace = [];
    for (let i = n - 1; i >= 0; i--) {
      if (U[i][i].isZero()) return null;
      let rhs = c[i];
      const terms = [];
      for (let j = i + 1; j < n; j++) {
        if (!U[i][j].isZero()) {
          rhs = rhs.sub(U[i][j].mul(x[j]));
          terms.push(`(${U[i][j].toStr()})(${x[j].toStr()})`);
        }
      }
      x[i] = rhs.div(U[i][i]);
      const numer = terms.length ? `${c[i].toStr()} - [${terms.join(" + ")}]` : `${c[i].toStr()}`;
      trace.push({
        idx: i + 1,
        expr: U[i][i].isOne()
          ? `x${i + 1} = ${numer} = ${x[i].toStr()}`
          : `x${i + 1} = (${numer}) / (${U[i][i].toStr()}) = ${x[i].toStr()}`,
        val: x[i],
      });
    }
    return { x, trace };
  }

  // Invert triangular matrix via symbolic substitution (c1, c2, ..., cn)
  function invertLowerSymbolic(L) {
    const n = L.length;
    // Each row i expresses y_i as linear combination of c_1..c_n: coeffs[i][k]
    const coeffs = zeros(n, n);
    const equations = [];
    for (let i = 0; i < n; i++) {
      coeffs[i][i] = Frac.ONE;
      for (let j = 0; j < i; j++) {
        if (L[i][j].isZero()) continue;
        for (let k = 0; k <= j; k++) {
          coeffs[i][k] = coeffs[i][k].sub(L[i][j].mul(coeffs[j][k]));
        }
      }
      if (!L[i][i].isOne()) {
        for (let k = 0; k <= i; k++) coeffs[i][k] = coeffs[i][k].div(L[i][i]);
      }
      equations.push({ varName: `y${i + 1}`, row: coeffs[i].slice() });
    }
    return { inverse: coeffs, equations };
  }

  function invertUpperSymbolic(U) {
    const n = U.length;
    const coeffs = zeros(n, n);
    const equations = [];
    for (let i = n - 1; i >= 0; i--) {
      coeffs[i][i] = Frac.ONE;
      for (let j = i + 1; j < n; j++) {
        if (U[i][j].isZero()) continue;
        for (let k = j; k < n; k++) {
          coeffs[i][k] = coeffs[i][k].sub(U[i][j].mul(coeffs[j][k]));
        }
      }
      for (let k = i; k < n; k++) coeffs[i][k] = coeffs[i][k].div(U[i][i]);
      equations.push({ varName: `x${i + 1}`, row: coeffs[i].slice() });
    }
    return { inverse: coeffs, equations };
  }

  function formatSymbolicLinear(coeffs, symPrefix = "c") {
    const parts = [];
    for (let j = 0; j < coeffs.length; j++) {
      const v = coeffs[j];
      if (v.isZero()) continue;
      const absV = v.abs();
      const coefStr = absV.isOne() ? "" : (absV.isInt() ? absV.toStr() : `(${absV.toStr()})`);
      if (parts.length === 0) {
        parts.push((v.isNeg() ? "-" : "") + coefStr + `${symPrefix}${j + 1}`);
      } else {
        parts.push((v.isNeg() ? " - " : " + ") + coefStr + `${symPrefix}${j + 1}`);
      }
    }
    return parts.length ? parts.join("") : "0";
  }

  // Full 5-method inverse bundle
  function invertAllMethods(A) {
    const n = A.length;
    const d = det(A);
    const palu = factorizePALU(A);

    // 1. Gauss-Jordan [A | I] -> [I | A^-1]
    const left = clone(A);
    const right = eye(n);
    const gjSteps = [{
      phase: "Setup",
      op: "Initial augmented matrix [ A | I ]",
      pivot: null,
      targetRow: null,
      left: clone(left),
      right: clone(right),
    }];

    let singular = d.isZero();
    if (!singular) {
      // Forward phase
      for (let col = 0; col < n; col++) {
        let piv = col;
        while (piv < n && left[piv][col].isZero()) piv++;
        if (piv !== col) {
          [left[col], left[piv]] = [left[piv], left[col]];
          [right[col], right[piv]] = [right[piv], right[col]];
          gjSteps.push({
            phase: "Forward",
            op: `R${col + 1} ↔ R${piv + 1}`,
            pivot: [col, col],
            targetRow: piv,
            left: clone(left),
            right: clone(right),
          });
        }
        const pVal = left[col][col];
        for (let row = col + 1; row < n; row++) {
          if (left[row][col].isZero()) continue;
          const mult = left[row][col].div(pVal);
          for (let k = 0; k < n; k++) {
            left[row][k] = left[row][k].sub(mult.mul(left[col][k]));
            right[row][k] = right[row][k].sub(mult.mul(right[col][k]));
          }
          const signStr = mult.isNeg() ? `+ (${mult.neg().toStr()})` : `- (${mult.toStr()})`;
          gjSteps.push({
            phase: "Forward",
            op: `R${row + 1} ← R${row + 1} ${signStr} R${col + 1}`,
            pivot: [col, col],
            targetRow: row,
            left: clone(left),
            right: clone(right),
          });
        }
      }
      // Backward phase (bottom pivot up)
      for (let col = n - 1; col >= 0; col--) {
        const pVal = left[col][col];
        for (let row = col - 1; row >= 0; row--) {
          if (left[row][col].isZero()) continue;
          const mult = left[row][col].div(pVal);
          for (let k = 0; k < n; k++) {
            left[row][k] = left[row][k].sub(mult.mul(left[col][k]));
            right[row][k] = right[row][k].sub(mult.mul(right[col][k]));
          }
          const signStr = mult.isNeg() ? `+ (${mult.neg().toStr()})` : `- (${mult.toStr()})`;
          gjSteps.push({
            phase: "Backward",
            op: `R${row + 1} ← R${row + 1} ${signStr} R${col + 1}`,
            pivot: [col, col],
            targetRow: row,
            left: clone(left),
            right: clone(right),
          });
        }
      }
      // Normalize pivots
      let scaledAny = false;
      for (let i = 0; i < n; i++) {
        if (!left[i][i].isOne()) {
          const pVal = left[i][i];
          for (let k = 0; k < n; k++) {
            left[i][k] = left[i][k].div(pVal);
            right[i][k] = right[i][k].div(pVal);
          }
          scaledAny = true;
        }
      }
      if (scaledAny) {
        gjSteps.push({
          phase: "Normalize",
          op: "Divide each row i by its pivot d_i",
          pivot: null,
          targetRow: null,
          left: clone(left),
          right: clone(right),
        });
      }
    }

    if (singular) {
      const sub = analyzeSubspaces(A);
      return {
        singular: true,
        det: Frac.ZERO,
        witness: sub.specialSolutions[0] || null,
        rank: sub.rank,
        palu,
        gjSteps,
      };
    }

    const inv = right;
    // 2. Factorization route: PA = LU => A^-1 = U^-1 L^-1 P
    const Lsym = invertLowerSymbolic(palu.L);
    const Usym = invertUpperSymbolic(palu.U);
    const Linv = Lsym.inverse;
    const Uinv = Usym.inverse;
    const UinvLinv = mul(Uinv, Linv);

    // 3. System Substitution A x = c -> exact symbolic rows
    const sysInput = A.map((row, i) => ({
      lhs: formatSymbolicLinear(row, "x"),
      rhs: `c${i + 1}`,
    }));
    const sysOutput = inv.map((row, i) => ({
      lhs: `x${i + 1}`,
      rhs: formatSymbolicLinear(row, "c"),
    }));

    // 4. Cofactor / Adjugate route
    const C = cofactorMatrix(A);
    const CT = transpose(C);

    // Verification check
    const checkProd = mul(A, inv);

    return {
      singular: false,
      det: d,
      inverse: inv,
      verified: matEq(checkProd, eye(n)),
      gjSteps,
      luRoute: {
        P: palu.P,
        L: palu.L,
        U: palu.U,
        hasSwaps: palu.swaps > 0,
        Linv,
        Uinv,
        UinvLinv,
        Leq: Lsym.equations,
        Ueq: Usym.equations,
      },
      substitution: { sysInput, sysOutput },
      cofactorRoute: { C, CT, det: d },
    };
  }

  // Determinant breakdown along chosen row or column + Sarrus + Cramer
  function determinantStudio(A, mode = "row", index = 0) {
    const n = A.length;
    const palu = factorizePALU(A);
    const d = palu.det;

    // Auto-find row/col with most zeros
    let bestMode = "row", bestIdx = 0, bestZeros = -1;
    for (let i = 0; i < n; i++) {
      let z = 0;
      for (let j = 0; j < n; j++) if (A[i][j].isZero()) z++;
      if (z > bestZeros) { bestZeros = z; bestMode = "row"; bestIdx = i; }
    }
    for (let j = 0; j < n; j++) {
      let z = 0;
      for (let i = 0; i < n; i++) if (A[i][j].isZero()) z++;
      if (z > bestZeros) { bestZeros = z; bestMode = "col"; bestIdx = j; }
    }

    // Cofactor expansion terms along selected row/col
    const terms = [];
    for (let k = 0; k < n; k++) {
      const r = mode === "row" ? index : k;
      const c = mode === "row" ? k : index;
      const entry = A[r][c];
      const cof = cofactorEntry(A, r, c);
      terms.push({
        r, c, entry,
        sign: cof.sign,
        minor: cof.minor,
        minorDet: cof.minorDet,
        cofactor: cof.value,
        product: entry.mul(cof.value),
      });
    }

    // Sarrus terms for 3x3
    let sarrus = null;
    if (n === 3) {
      const p1 = A[0][0].mul(A[1][1]).mul(A[2][2]);
      const p2 = A[0][1].mul(A[1][2]).mul(A[2][0]);
      const p3 = A[0][2].mul(A[1][0]).mul(A[2][1]);
      const m1 = A[0][2].mul(A[1][1]).mul(A[2][0]);
      const m2 = A[0][1].mul(A[1][0]).mul(A[2][2]);
      const m3 = A[0][0].mul(A[1][2]).mul(A[2][1]);
      sarrus = {
        down: [
          { label: `(${A[0][0].toStr()})(${A[1][1].toStr()})(${A[2][2].toStr()})`, val: p1 },
          { label: `(${A[0][1].toStr()})(${A[1][2].toStr()})(${A[2][0].toStr()})`, val: p2 },
          { label: `(${A[0][2].toStr()})(${A[1][0].toStr()})(${A[2][1].toStr()})`, val: p3 },
        ],
        up: [
          { label: `(${A[0][2].toStr()})(${A[1][1].toStr()})(${A[2][0].toStr()})`, val: m1 },
          { label: `(${A[0][1].toStr()})(${A[1][0].toStr()})(${A[2][2].toStr()})`, val: m2 },
          { label: `(${A[0][0].toStr()})(${A[1][2].toStr()})(${A[2][1].toStr()})`, val: m3 },
        ],
        downSum: p1.add(p2).add(p3),
        upSum: m1.add(m2).add(m3),
      };
    }

    const scale2 = new Frac(2n ** BigInt(n), 1n).mul(d);
    const negDet = (n % 2 === 0 ? Frac.ONE : Frac.NEG_ONE).mul(d);
    const allInt = A.every(row => row.every(v => v.isInt()));
    const integerInverse = allInt && (d.isOne() || d.isNegOne());

    return {
      det: d,
      palu,
      optimal: { mode: bestMode, index: bestIdx, zeros: bestZeros },
      expansion: { mode, index, terms },
      sarrus,
      properties: {
        detT: d,
        detSq: d.mul(d),
        detInv: d.isZero() ? null : d.inv(),
        detNeg: negDet,
        det2A: scale2,
        integerInverse,
      },
    };
  }

  // Cramer's Rule solver for A x = b
  function cramersRule(A, b) {
    const n = A.length;
    const d = det(A);
    const matrices = [];
    for (let j = 0; j < n; j++) {
      const Bj = clone(A);
      for (let i = 0; i < n; i++) Bj[i][j] = b[i];
      const dj = det(Bj);
      matrices.push({
        col: j,
        B: Bj,
        detB: dj,
        x: d.isZero() ? null : dj.div(d),
      });
    }
    return { detA: d, singular: d.isZero(), results: matrices };
  }

  // Rectangular m x n Subspace Analyzer: U, R (RREF), Rank r, Column Space C(A), Nullspace N(A)
  function analyzeSubspaces(A) {
    const m = A.length;
    const n = A[0].length;

    // 1. Row Echelon Form U
    const U = clone(A);
    const pivotCols = [];
    const pivotRows = [];
    let r = 0;
    for (let col = 0; col < n && r < m; col++) {
      let piv = r;
      while (piv < m && U[piv][col].isZero()) piv++;
      if (piv === m) continue;
      if (piv !== r) [U[r], U[piv]] = [U[piv], U[r]];
      const pVal = U[r][col];
      for (let row = r + 1; row < m; row++) {
        if (U[row][col].isZero()) continue;
        const mult = U[row][col].div(pVal);
        for (let k = col; k < n; k++) {
          U[row][k] = U[row][k].sub(mult.mul(U[r][k]));
        }
      }
      pivotCols.push(col);
      pivotRows.push(r);
      r++;
    }

    // 2. Reduced Row Echelon Form R
    const R = clone(U);
    for (let idx = pivotCols.length - 1; idx >= 0; idx--) {
      const pr = pivotRows[idx];
      const pc = pivotCols[idx];
      const pVal = R[pr][pc];
      for (let k = pc; k < n; k++) R[pr][k] = R[pr][k].div(pVal);
      for (let row = pr - 1; row >= 0; row--) {
        if (R[row][pc].isZero()) continue;
        const mult = R[row][pc];
        for (let k = pc; k < n; k++) {
          R[row][k] = R[row][k].sub(mult.mul(R[pr][k]));
        }
      }
    }

    const pivotSet = new Set(pivotCols);
    const freeCols = [];
    for (let j = 0; j < n; j++) if (!pivotSet.has(j)) freeCols.push(j);

    // Column space basis = ORIGINAL pivot columns of A!
    const colSpaceBasis = pivotCols.map(c => A.map(row => row[c]));

    // Nullspace special solutions from R (verified against A)
    const specialSolutions = freeCols.map(fc => {
      const vec = Array(n).fill(Frac.ZERO);
      vec[fc] = Frac.ONE;
      for (let idx = 0; idx < pivotCols.length; idx++) {
        const pc = pivotCols[idx];
        const pr = pivotRows[idx];
        vec[pc] = R[pr][fc].neg();
      }
      return vec;
    });

    const verifiedNull = specialSolutions.every(s => mulVec(A, s).every(v => v.isZero()));

    // Check if C(A) != C(U)
    const uPivotCols = pivotCols.map(c => U.map(row => row[c]));

    return {
      m, n,
      rank: pivotCols.length,
      nullity: freeCols.length,
      U, R,
      pivotCols,
      freeCols,
      colSpaceBasis,
      uPivotCols,
      specialSolutions,
      verifiedNull,
    };
  }

  // Vector & Geometry engine
  function analyzeVectors(u, v, c1, c2) {
    const dim = u.length;
    const comb = u.map((x, i) => c1.mul(x).add(c2.mul(v[i])));
    let dotUV = Frac.ZERO, normSqU = Frac.ZERO, normSqV = Frac.ZERO;
    for (let i = 0; i < dim; i++) {
      dotUV = dotUV.add(u[i].mul(v[i]));
      normSqU = normSqU.add(u[i].mul(u[i]));
      normSqV = normSqV.add(v[i].mul(v[i]));
    }
    const lenU = Math.sqrt(normSqU.toFloat());
    const lenV = Math.sqrt(normSqV.toFloat());
    let angleDeg = null;
    if (lenU > 0 && lenV > 0) {
      const cosT = Math.max(-1, Math.min(1, dotUV.toFloat() / (lenU * lenV)));
      angleDeg = (Math.acos(cosT) * 180) / Math.PI;
    }
    // Check collinearity: u_i * v_j - u_j * v_i == 0 for all i, j
    let collinear = true;
    for (let i = 0; i < dim; i++)
      for (let j = i + 1; j < dim; j++)
        if (!u[i].mul(v[j]).eq(u[j].mul(v[i]))) collinear = false;

    const orthogonal = dotUV.isZero();
    const paraArea2D = dim === 2 ? u[0].mul(v[1]).sub(u[1].mul(v[0])).abs() : null;

    return { comb, dotUV, normSqU, normSqV, lenU, lenV, angleDeg, orthogonal, collinear, paraArea2D };
  }

  function triangleArea(p1, p2, p3) {
    const M3 = [
      [p1[0], p1[1], Frac.ONE],
      [p2[0], p2[1], Frac.ONE],
      [p3[0], p3[1], Frac.ONE],
    ];
    const d3 = det(M3);
    const e1 = [p2[0].sub(p1[0]), p2[1].sub(p1[1])];
    const e2 = [p3[0].sub(p1[0]), p3[1].sub(p1[1])];
    const d2 = e1[0].mul(e2[1]).sub(e1[1].mul(e2[0]));
    return {
      det3: d3,
      edge1: e1,
      edge2: e2,
      det2: d2,
      area: d3.abs().div(new Frac(2n, 1n)),
      collinear: d3.isZero(),
    };
  }

  function boxVolume(origin, a, b, c) {
    const e1 = [a[0].sub(origin[0]), a[1].sub(origin[1]), a[2].sub(origin[2])];
    const e2 = [b[0].sub(origin[0]), b[1].sub(origin[1]), b[2].sub(origin[2])];
    const e3 = [c[0].sub(origin[0]), c[1].sub(origin[1]), c[2].sub(origin[2])];
    const M = [e1, e2, e3];
    const d = det(M);
    return { edges: M, det: d, volume: d.abs(), coplanar: d.isZero() };
  }

  // Strict parser for grading user inputs (returns null on empty/malformed/div-by-zero)
  function tryParseFrac(raw) {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (s.includes("/")) {
      const parts = s.split("/");
      if (parts.length !== 2) return null;
      const a = parts[0].trim(), b = parts[1].trim();
      if (!/^[+-]?\d+$/.test(a) || !/^[+-]?\d+$/.test(b)) return null;
      const q = BigInt(b);
      if (q === 0n) return null;
      return new Frac(BigInt(a), q);
    }
    if (/^[+-]?\d+$/.test(s)) return new Frac(BigInt(s), 1n);
    if (/^[+-]?(\d+\.\d*|\.\d+)$/.test(s)) return Frac.parse(s);
    return null;
  }

  function randInt(lo, hi) {
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  }

  function randNonZero(lo, hi) {
    let v = 0;
    for (let t = 0; t < 40 && v === 0; t++) v = randInt(lo, hi);
    return v === 0 ? 1 : v;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function hasFractionalEntry(M) {
    return M.some(row => row.some(v => v.d > 1n));
  }

  function maxAbsNumDen(M) {
    let maxP = 0n, maxQ = 1n;
    for (const row of M) {
      for (const v of row) {
        const ap = v.n < 0n ? -v.n : v.n;
        if (ap > maxP) maxP = ap;
        if (v.d > maxQ) maxQ = v.d;
      }
    }
    return { maxP: Number(maxP), maxQ: Number(maxQ) };
  }

  // Strictly verified invertible matrix constructor (NEVER singular, matches difficulty)
  function buildVerifiedInverse(n, difficulty = "normal") {
    const diff = ["easy", "normal", "hard"].includes(difficulty) ? difficulty : "normal";

    for (let attempt = 0; attempt < 80; attempt++) {
      let A;
      if (n === 2) {
        const L = [[Frac.ONE, Frac.ZERO], [Frac.of(randNonZero(diff === "easy" ? -2 : -3, diff === "easy" ? 2 : 3)), Frac.ONE]];
        const u12 = Frac.of(randNonZero(diff === "easy" ? -2 : -3, diff === "easy" ? 2 : 3));
        let d1 = 1, d2 = 1;
        if (diff === "easy") {
          d2 = pick([-1, 1]);
        } else if (diff === "normal") {
          d1 = pick([1, 2]);
          d2 = pick([-1, 1]);
        } else {
          d1 = pick([1, 2, 3]);
          d2 = d1 === 1 ? pick([-5, -4, -3, 3, 4, 5]) : pick([-2, 2, -3, 3]);
        }
        const U = [[Frac.of(d1), u12], [Frac.ZERO, Frac.of(d2)]];
        A = mul(L, U);
        if (Math.random() < 0.35) A = [A[1], A[0]]; // occasional row swap for variety
      } else {
        const lim = diff === "easy" ? 1 : (diff === "hard" ? 1 : 2);
        const L = [
          [Frac.ONE, Frac.ZERO, Frac.ZERO],
          [Frac.of(randNonZero(-lim, lim)), Frac.ONE, Frac.ZERO],
          [Frac.of(randInt(-lim, lim)), Frac.of(randNonZero(-lim, lim)), Frac.ONE],
        ];
        let dDiag = [1, 1, 1];
        if (diff === "easy") {
          dDiag = [1, 1, pick([-1, 1])];
        } else if (diff === "normal") {
          dDiag = [1, pick([-1, 1]), pick([-1, 1])];
        } else {
          const k = pick([-3, -2, 2, 3]);
          const pos = pick([0, 1, 2]);
          dDiag[pos] = k;
        }
        const U = [
          [Frac.of(dDiag[0]), Frac.of(randNonZero(-lim, lim)), Frac.of(randInt(-lim, lim))],
          [Frac.ZERO, Frac.of(dDiag[1]), Frac.of(randNonZero(-lim, lim))],
          [Frac.ZERO, Frac.ZERO, Frac.of(dDiag[2])],
        ];
        A = mul(L, U);
      }

      const d = det(A);
      if (d.isZero()) continue;
      const invRes = invertAllMethods(A);
      if (invRes.singular || !invRes.inverse) continue;
      if (!matEq(mul(A, invRes.inverse), eye(n)) || !matEq(mul(invRes.inverse, A), eye(n))) continue;

      const absDet = Number(d.abs().n);
      const aStats = maxAbsNumDen(A);
      const invStats = maxAbsNumDen(invRes.inverse);

      if (diff === "easy") {
        if (absDet !== 1 || hasFractionalEntry(invRes.inverse)) continue;
        if (aStats.maxP > 6 || invStats.maxP > 8) continue;
      } else if (diff === "normal") {
        if (n === 3 && (absDet !== 1 || hasFractionalEntry(invRes.inverse))) continue;
        if (n === 2 && absDet > 2) continue;
        if (aStats.maxP > 10 || invStats.maxP > 14) continue;
      } else {
        if (absDet < 2 || absDet > 5 || !hasFractionalEntry(invRes.inverse)) continue;
        if (aStats.maxP > 12 || invStats.maxP > 24 || invStats.maxQ > 5) continue;
      }
      return { A, inverse: invRes.inverse, det: d };
    }

    // Deterministic verified fallback (mathematically guaranteed invertible)
    const fallbackRaw = n === 2
      ? (diff === "hard" ? [[2, 1], [1, 2]] : diff === "normal" ? [[2, 1], [0, 1]] : [[1, 2], [1, 3]])
      : (diff === "hard" ? [[2, 1, 0], [1, 2, 1], [0, 1, 2]] : [[1, 2, 1], [2, 5, 2], [1, 3, 2]]);
    const A = fromRaw(fallbackRaw);
    const invRes = invertAllMethods(A);
    return { A, inverse: invRes.inverse, det: invRes.det };
  }

  function buildVerifiedLU3(difficulty = "normal") {
    const diff = ["easy", "normal", "hard"].includes(difficulty) ? difficulty : "normal";
    for (let attempt = 0; attempt < 60; attempt++) {
      const lim = diff === "easy" ? 1 : 2;
      const L = [
        [Frac.ONE, Frac.ZERO, Frac.ZERO],
        [Frac.of(randNonZero(-lim, lim)), Frac.ONE, Frac.ZERO],
        [Frac.of(randInt(-lim, lim)), Frac.of(randNonZero(-lim, lim)), Frac.ONE],
      ];
      let U;
      if (diff === "hard") {
        // Introduce one clean fractional multiplier (1/2 or 1/3) while keeping A all-integer!
        const p1 = pick([2, 3]);
        const p2 = pick([2, -2, 3]);
        const p3 = randNonZero(-3, 3);
        const l21 = new Frac(BigInt(pick([-1, 1])), BigInt(p1));
        const l31 = Frac.of(randInt(-1, 1));
        const l32 = Frac.of(randNonZero(-1, 1));
        const Lh = [
          [Frac.ONE, Frac.ZERO, Frac.ZERO],
          [l21, Frac.ONE, Frac.ZERO],
          [l31, l32, Frac.ONE],
        ];
        const Uh = [
          [Frac.of(p1), Frac.of(randNonZero(-2, 2) * p1), Frac.of(randInt(-2, 2) * p1)],
          [Frac.ZERO, Frac.of(p2), Frac.of(randNonZero(-2, 2))],
          [Frac.ZERO, Frac.ZERO, Frac.of(p3)],
        ];
        const Ah = mul(Lh, Uh);
        if (hasFractionalEntry(Ah)) continue;
        const f = factorizePALU(Ah);
        if (f.swaps === 0 && !f.singular && matEq(mul(f.L, f.U), Ah) && maxAbsNumDen(Ah).maxP <= 12) {
          return { A: Ah, L: f.L, U: f.U };
        }
        continue;
      } else {
        const d1 = diff === "easy" ? pick([1, 2]) : randInt(1, 3);
        const d2 = diff === "easy" ? pick([1, 2]) : randNonZero(-3, 3);
        const d3 = diff === "easy" ? pick([-1, 1, 2]) : randNonZero(-3, 3);
        U = [
          [Frac.of(d1), Frac.of(randNonZero(-lim, lim)), Frac.of(randInt(-lim, lim))],
          [Frac.ZERO, Frac.of(d2), Frac.of(randNonZero(-lim, lim))],
          [Frac.ZERO, Frac.ZERO, Frac.of(d3)],
        ];
        const A = mul(L, U);
        const f = factorizePALU(A);
        if (f.swaps === 0 && !f.singular && matEq(mul(f.L, f.U), A) && maxAbsNumDen(A).maxP <= 14) {
          return { A, L: f.L, U: f.U };
        }
      }
    }
    const A = fromRaw([[2, 1, 0], [1, 2, 1], [0, 1, 2]]);
    const f = factorizePALU(A);
    return { A, L: f.L, U: f.U };
  }

  function buildVerifiedNullspace(difficulty = "normal") {
    const diff = ["easy", "normal", "hard"].includes(difficulty) ? difficulty : "normal";
    for (let attempt = 0; attempt < 60; attempt++) {
      let R;
      if (diff === "hard") {
        const f1 = new Frac(BigInt(randNonZero(-3, 3)), BigInt(pick([2, 3])));
        const f2 = new Frac(BigInt(randNonZero(-3, 3)), BigInt(pick([2, 3])));
        R = [[Frac.ONE, Frac.ZERO, f1], [Frac.ZERO, Frac.ONE, f2]];
        const s1 = Frac.of(Number(f1.d));
        const s2 = Frac.of(Number(f2.d));
        const mix = [[s1, Frac.ZERO], [Frac.of(randNonZero(-1, 1) * Number(f1.d)), s2]];
        const A = mul(mix, R);
        if (hasFractionalEntry(A)) continue;
        const sub = analyzeSubspaces(A);
        if (sub.specialSolutions.length === 1 && sub.verifiedNull && hasFractionalEntry([sub.specialSolutions[0]])) {
          return { A, special: sub.specialSolutions[0], freeCol: sub.freeCols[0], sub };
        }
        continue;
      } else {
        const lim = diff === "easy" ? 2 : 3;
        const f1 = randNonZero(-lim, lim), f2 = randNonZero(-lim, lim);
        R = [[Frac.ONE, Frac.ZERO, Frac.of(f1)], [Frac.ZERO, Frac.ONE, Frac.of(f2)]];
        const a1 = diff === "easy" ? 1 : randNonZero(-2, 2);
        const b1 = randNonZero(-2, 2);
        const mix = [[Frac.ONE, Frac.of(a1)], [Frac.of(b1), Frac.of(a1 * b1 + 1)]];
        const A = mul(mix, R);
        const sub = analyzeSubspaces(A);
        if (sub.specialSolutions.length === 1 && sub.verifiedNull && maxAbsNumDen(A).maxP <= 12) {
          return { A, special: sub.specialSolutions[0], freeCol: sub.freeCols[0], sub };
        }
      }
    }
    const A = fromRaw([[1, 2, 5], [2, 3, 8]]);
    const sub = analyzeSubspaces(A);
    return { A, special: sub.specialSolutions[0], freeCol: sub.freeCols[0], sub };
  }

  function buildVerifiedDet(difficulty = "normal") {
    const diff = ["easy", "normal", "hard"].includes(difficulty) ? difficulty : "normal";
    if (diff === "hard" && Math.random() < 0.5) {
      // Zero-rich 4x4 determinant (like HW3 §5.1(4))
      for (let attempt = 0; attempt < 50; attempt++) {
        const A = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => Frac.of(randInt(-3, 3))));
        // Place at least 6 zeros strategically so cofactor expansion is clean by hand
        const zeroRow = randInt(0, 3);
        const keepCol = randInt(0, 3);
        for (let j = 0; j < 4; j++) if (j !== keepCol) A[zeroRow][j] = Frac.ZERO;
        A[zeroRow][keepCol] = Frac.of(randNonZero(-3, 3));
        A[(zeroRow + 1) % 4][(keepCol + 1) % 4] = Frac.ZERO;
        A[(zeroRow + 2) % 4][(keepCol + 2) % 4] = Frac.ZERO;
        const d = det(A);
        const absD = Number(d.abs().n);
        if (absD >= 2 && absD <= 80) return { A, det: d };
      }
    }
    for (let attempt = 0; attempt < 60; attempt++) {
      const lim = diff === "easy" ? 2 : diff === "normal" ? 3 : 4;
      const A = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Frac.of(randInt(-lim, lim))));
      if (diff === "easy") {
        // Guarantee at least 3 zeros for fast expansion
        A[0][2] = Frac.ZERO; A[2][0] = Frac.ZERO; A[randInt(0, 2)][1] = Frac.ZERO;
      } else if (diff === "normal") {
        A[randInt(0, 2)][randInt(0, 2)] = Frac.ZERO;
      }
      const d = det(A);
      const absD = Number(d.abs().n);
      if (diff === "easy" && absD >= 1 && absD <= 18) return { A, det: d };
      if (diff === "normal" && absD >= 2 && absD <= 40) return { A, det: d };
      if (diff === "hard" && absD >= 5 && absD <= 90) return { A, det: d };
    }
    const A = fromRaw([[2, 1, 0], [1, 2, 1], [0, 1, 2]]);
    return { A, det: det(A) };
  }

  function generateDrill(kind, difficulty = "normal") {
    const diff = ["easy", "normal", "hard"].includes(difficulty) ? difficulty : "normal";
    if (kind === "inv2") {
      const { A, inverse, det: d } = buildVerifiedInverse(2, diff);
      const note = hasFractionalEntry(inverse) ? `det(A) = ${d.toStr()} · enter exact fractions like 1/3` : `det(A) = ${d.toStr()} · all entries are integers`;
      return {
        kind, difficulty: diff,
        prompt: `Compute the exact inverse A⁻¹ of this 2×2 matrix (${note})`,
        A,
        expected: inverse,
      };
    }
    if (kind === "inv3") {
      const { A, inverse, det: d } = buildVerifiedInverse(3, diff);
      const note = hasFractionalEntry(inverse) ? `det(A) = ${d.toStr()} · enter exact fractions like 1/2` : `det(A) = ${d.toStr()} · all entries are integers`;
      return {
        kind, difficulty: diff,
        prompt: `Compute the exact inverse A⁻¹ of this 3×3 matrix (${note})`,
        A,
        expected: inverse,
      };
    }
    if (kind === "det3") {
      const { A, det: d } = buildVerifiedDet(diff);
      return {
        kind, difficulty: diff,
        prompt: `Compute the exact scalar determinant det(A) of this ${A.length}×${A.length} matrix`,
        A,
        expectedScalar: d,
      };
    }
    if (kind === "lu3") {
      const { A, L, U } = buildVerifiedLU3(diff);
      return {
        kind, difficulty: diff,
        prompt: "Find the upper triangular factor U in A = LU (no row swaps required)",
        A,
        expected: U,
        expectedL: L,
      };
    }
    const { A, special, freeCol } = buildVerifiedNullspace(diff);
    return {
      kind: "null2x3", difficulty: diff,
      prompt: `Find the special solution vector s to Ax = 0 (setting free variable x${freeCol + 1} = 1)`,
      A,
      expectedVec: special,
    };
  }

  // =========================================================================
  // COMPREHENSIVE EXAM GENERATOR & EXACT GRADER (6 Topics × 20 Sub-types)
  // =========================================================================
  const EXAM_TOPICS = [
    {
      id: "vectors", name: "Vectors & geometry", section: "§1.1–1.2, §3.3",
      subtypes: [
        { id: "vec_dot", label: "Dot product u · v" },
        { id: "vec_comb", label: "Linear combination c₁u + c₂v" },
        { id: "vec_geo", label: "2D triangle area & 3D box volume" },
      ],
    },
    {
      id: "algebra", name: "Matrix algebra", section: "§1.3, §2.4, §2.7",
      subtypes: [
        { id: "mat_mul", label: "Full matrix product AB" },
        { id: "mat_entry", label: "Single product entry (AB)ᵢⱼ" },
        { id: "mat_sym", label: "Symmetric AᵀA and powers A²" },
      ],
    },
    {
      id: "elimination", name: "Elimination & LU", section: "§2.2, §2.6–2.7",
      subtypes: [
        { id: "lu_u", label: "Find upper triangular U (A = LU)" },
        { id: "lu_l", label: "Find lower triangular L (A = LU)" },
        { id: "lu_ldl", label: "Symmetric S = LDLᵀ pivots" },
        { id: "tri_solve", label: "Backward substitution Ux = c" },
      ],
    },
    {
      id: "inverse", name: "Inverses", section: "§2.5, §3.3",
      subtypes: [
        { id: "inv2", label: "2×2 exact inverse A⁻¹" },
        { id: "inv3", label: "3×3 exact inverse A⁻¹" },
        { id: "inv_cof", label: "Single entry (A⁻¹)ᵢⱼ via cofactor" },
      ],
    },
    {
      id: "determinant", name: "Determinants & Cramer", section: "§3.1–3.3",
      subtypes: [
        { id: "det_val", label: "Compute 3×3 / 4×4 det(A)" },
        { id: "det_id", label: "Determinant identities (det 2A, A⁻¹)" },
        { id: "det_cramer", label: "Cramer's rule (find xₖ)" },
        { id: "det_cof_entry", label: "Single cofactor Cᵢⱼ" },
      ],
    },
    {
      id: "subspaces", name: "Column & nullspace", section: "§4.1–4.2",
      subtypes: [
        { id: "null_vec", label: "Nullspace special solution s" },
        { id: "rank_null", label: "Rank r and nullity n − r" },
        { id: "rref_find", label: "Reduced row echelon form R" },
      ],
    },
  ];

  function buildVerifiedSymmetricLDL(difficulty = "normal") {
    const diff = ["easy", "normal", "hard"].includes(difficulty) ? difficulty : "normal";
    for (let attempt = 0; attempt < 60; attempt++) {
      if (diff === "hard") {
        // Tridiagonal or symmetric integer matrix whose pivots produce clean exact fractions (like HW3 §2.7(4): 2, 3/2, 4/3)
        const a = pick([2, 3]);
        const b = pick([-1, 1]);
        const c = pick([2, 3]);
        const d = pick([-1, 1]);
        const e = pick([2, 3]);
        const S = fromRaw([[a, b, 0], [b, c, d], [0, d, e]]);
        const f = factorizePALU(S);
        if (f.swaps === 0 && !f.singular && f.ldl && f.pivots.some(p => p.d > 1n)) {
          const recon = mul(mul(f.ldl.L, f.ldl.D), f.ldl.LT);
          if (matEq(recon, S)) return { S, L: f.ldl.L, D: f.ldl.D, pivots: f.pivots };
        }
        continue;
      }
      const lim = diff === "easy" ? 1 : 2;
      const L = [
        [Frac.ONE, Frac.ZERO, Frac.ZERO],
        [Frac.of(randNonZero(-lim, lim)), Frac.ONE, Frac.ZERO],
        [Frac.of(randInt(-lim, lim)), Frac.of(randNonZero(-lim, lim)), Frac.ONE],
      ];
      const pivots = [
        Frac.of(diff === "easy" ? pick([1, 2]) : randInt(1, 3)),
        Frac.of(diff === "easy" ? pick([1, 2]) : randNonZero(-3, 3)),
        Frac.of(diff === "easy" ? pick([-1, 1, 2]) : randNonZero(-3, 3)),
      ];
      const D = [
        [pivots[0], Frac.ZERO, Frac.ZERO],
        [Frac.ZERO, pivots[1], Frac.ZERO],
        [Frac.ZERO, Frac.ZERO, pivots[2]],
      ];
      const S = mul(mul(L, D), transpose(L));
      const f = factorizePALU(S);
      if (f.swaps === 0 && !f.singular && f.ldl && maxAbsNumDen(S).maxP <= 16) {
        const recon = mul(mul(f.ldl.L, f.ldl.D), f.ldl.LT);
        if (matEq(recon, S)) return { S, L: f.ldl.L, D: f.ldl.D, pivots: f.pivots };
      }
    }
    const S = fromRaw([[2, -1, 0], [-1, 2, -1], [0, -1, 2]]);
    const f = factorizePALU(S);
    return { S, L: f.ldl.L, D: f.ldl.D, pivots: f.pivots };
  }

  function makeQuestion(genId, difficulty) {
    const diff = ["easy", "normal", "hard"].includes(difficulty) ? difficulty : "normal";

    if (genId === "vec_dot") {
      const dim = diff === "easy" ? 2 : 3;
      const lim = diff === "easy" ? 4 : diff === "normal" ? 5 : 6;
      const u = Array.from({ length: dim }, () => Frac.of(randInt(-lim, lim)));
      const v = Array.from({ length: dim }, () => Frac.of(randInt(-lim, lim)));
      if (diff === "hard") {
        u[0] = new Frac(BigInt(randNonZero(-5, 5)), 2n);
        v[1] = new Frac(BigInt(randNonZero(-5, 5)), 2n);
      }
      const va = analyzeVectors(u, v, Frac.ONE, Frac.ONE);
      return {
        genId, topic: "vectors", section: "§1.2", difficulty: diff,
        title: "Dot product",
        prompt: `Compute the exact inner product u · v of these ${dim}D vectors`,
        given: [{ type: "vector", label: "u", data: u }, { type: "vector", label: "v", data: v }],
        answerType: "scalar",
        answerLabel: "u · v",
        expected: va.dotUV,
        hint: "Multiply corresponding components and sum: u₁v₁ + u₂v₂" + (dim === 3 ? " + u₃v₃" : ""),
        explanation: `u · v = ${u.map((x, i) => `(${x.toStr()})(${v[i].toStr()})`).join(" + ")} = ${va.dotUV.toStr()}` + (va.orthogonal ? " (orthogonal)" : ""),
        solverPayload: { mode: "vectors", dim, u, v },
      };
    }

    if (genId === "vec_comb") {
      const dim = diff === "easy" ? 2 : 3;
      const lim = diff === "easy" ? 3 : 4;
      const u = Array.from({ length: dim }, () => Frac.of(randInt(-lim, lim)));
      const v = Array.from({ length: dim }, () => Frac.of(randInt(-lim, lim)));
      const c1 = diff === "hard" ? new Frac(BigInt(randNonZero(-3, 3)), 2n) : Frac.of(randNonZero(-3, 3));
      const c2 = diff === "hard" ? new Frac(BigInt(randNonZero(-3, 3)), BigInt(pick([2, 3]))) : Frac.of(randNonZero(-3, 3));
      const va = analyzeVectors(u, v, c1, c2);
      const sign2 = c2.isNeg() ? ` − ${c2.abs().toStr()}` : ` + ${c2.toStr()}`;
      return {
        genId, topic: "vectors", section: "§1.1", difficulty: diff,
        title: "Linear combination",
        prompt: `Compute the exact linear combination w = (${c1.toStr()})u${sign2}v`,
        given: [{ type: "vector", label: "u", data: u }, { type: "vector", label: "v", data: v }],
        answerType: "vector",
        answerLabel: "w",
        expected: va.comb,
        hint: `Scale every entry of u by ${c1.toStr()}, scale every entry of v by ${c2.toStr()}, and add componentwise`,
        explanation: `w = (${va.comb.map(x => x.toStr()).join(", ")})ᵀ`,
        solverPayload: { mode: "vectors", dim, u, v },
      };
    }

    if (genId === "vec_geo") {
      if (diff === "hard") {
        for (let t = 0; t < 50; t++) {
          const O = [Frac.of(randInt(-1, 2)), Frac.of(randInt(-1, 2)), Frac.of(randInt(-1, 2))];
          const e1 = [Frac.of(randInt(1, 3)), Frac.of(randInt(-2, 2)), Frac.ZERO];
          const e2 = [Frac.of(randInt(-2, 2)), Frac.of(randInt(1, 3)), Frac.of(randInt(-1, 2))];
          const e3 = [Frac.ZERO, Frac.of(randInt(-2, 2)), Frac.of(randInt(1, 3))];
          const a = e1.map((x, i) => x.add(O[i]));
          const b = e2.map((x, i) => x.add(O[i]));
          const c = e3.map((x, i) => x.add(O[i]));
          const bx = boxVolume(O, a, b, c);
          if (!bx.coplanar && Number(bx.volume.n) <= 45) {
            return {
              genId, topic: "vectors", section: "§3.3", difficulty: diff,
              title: "Shifted 3D box volume",
              prompt: `Find the volume of the parallelepiped with base vertex O = (${O.map(x => x.toStr()).join(", ")}) and adjacent corners P1, P2, P3`,
              given: [
                { type: "vector", label: "P1", data: a },
                { type: "vector", label: "P2", data: b },
                { type: "vector", label: "P3", data: c },
              ],
              answerType: "scalar",
              answerLabel: "Volume",
              expected: bx.volume,
              hint: "Shift each corner by subtracting O to get 3 edge vectors, then take |det(edges)|",
              explanation: `Shifted edges form a 3×3 matrix with det = ${bx.det.toStr()}, so Volume = |${bx.det.toStr()}| = ${bx.volume.toStr()}`,
              solverPayload: { mode: "vectors", boxO: O, boxE: [a, b, c] },
            };
          }
        }
      }
      // 2D Triangle area from 3 vertices
      for (let t = 0; t < 50; t++) {
        const lim = diff === "easy" ? 3 : 5;
        const p1 = diff === "easy" ? [Frac.ZERO, Frac.ZERO] : [Frac.of(randInt(-2, 3)), Frac.of(randInt(-2, 3))];
        const p2 = [Frac.of(randInt(-lim, lim)), Frac.of(randInt(-lim, lim))];
        const p3 = [Frac.of(randInt(-lim, lim)), Frac.of(randInt(-lim, lim))];
        const tri = triangleArea(p1, p2, p3);
        if (!tri.collinear && Number(tri.det3.abs().n) <= 30) {
          if (diff === "easy" && tri.area.d > 1n) continue;
          return {
            genId, topic: "vectors", section: "§3.3", difficulty: diff,
            title: "2D triangle area",
            prompt: `Compute the exact area of the triangle with vertices P1 = (${p1[0].toStr()}, ${p1[1].toStr()}), P2 = (${p2[0].toStr()}, ${p2[1].toStr()}), and P3 = (${p3[0].toStr()}, ${p3[1].toStr()})`,
            given: [],
            answerType: "scalar",
            answerLabel: "Area",
            expected: tri.area,
            hint: "Shift P1 to the origin: edges e1 = P2 - P1 and e2 = P3 - P1, then Area = |det([e1; e2])| / 2",
            explanation: `e1 = (${tri.edge1[0].toStr()}, ${tri.edge1[1].toStr()}), e2 = (${tri.edge2[0].toStr()}, ${tri.edge2[1].toStr()}), det = ${tri.det3.toStr()} → Area = |${tri.det3.toStr()}| / 2 = ${tri.area.toStr()}`,
            solverPayload: { mode: "vectors", triP: [p1, p2, p3] },
          };
        }
      }
    }

    if (genId === "mat_mul") {
      const m = 2, k = diff === "easy" ? 2 : 3, p = 2;
      const lim = diff === "easy" ? 3 : diff === "normal" ? 3 : 4;
      const A = Array.from({ length: m }, () => Array.from({ length: k }, () => Frac.of(randInt(-lim, lim))));
      const B = Array.from({ length: k }, () => Array.from({ length: p }, () => Frac.of(randInt(-lim, lim))));
      const AB = mul(A, B);
      return {
        genId, topic: "algebra", section: "§2.4", difficulty: diff,
        title: "Matrix multiplication AB",
        prompt: `Compute the exact ${m}×${p} matrix product AB`,
        given: [{ type: "matrix", label: "A", data: A }, { type: "matrix", label: "B", data: B }],
        answerType: "matrix",
        answerLabel: "AB",
        expected: AB,
        hint: "Entry (i, j) of AB equals (Row i of A) · (Column j of B)",
        explanation: `Computed ${m}×${p} product using dot products of rows of A with columns of B`,
        solverPayload: { mode: "operations", opA: A, opB: B },
      };
    }

    if (genId === "mat_entry") {
      const n = diff === "easy" ? 2 : 3;
      const lim = diff === "easy" ? 3 : diff === "normal" ? 4 : 5;
      const A = Array.from({ length: n }, () => Array.from({ length: n }, () => Frac.of(randInt(-lim, lim))));
      const B = Array.from({ length: n }, () => Array.from({ length: n }, () => Frac.of(randInt(-lim, lim))));
      const i = randInt(0, n - 1), j = randInt(0, n - 1);
      const AB = mul(A, B);
      const val = AB[i][j];
      const terms = [];
      for (let t = 0; t < n; t++) terms.push(`(${A[i][t].toStr()})(${B[t][j].toStr()})`);
      return {
        genId, topic: "algebra", section: "§2.4", difficulty: diff,
        title: `Single entry (AB)_{${i + 1},${j + 1}}`,
        prompt: `Find ONLY the single entry in Row ${i + 1}, Column ${j + 1} of the product AB`,
        given: [{ type: "matrix", label: "A", data: A }, { type: "matrix", label: "B", data: B }],
        answerType: "scalar",
        answerLabel: `(AB)_{${i + 1},${j + 1}}`,
        expected: val,
        hint: `You only need Row ${i + 1} of A dotted with Column ${j + 1} of B`,
        explanation: `(AB)_{${i + 1},${j + 1}} = ${terms.join(" + ")} = ${val.toStr()}`,
        solverPayload: { mode: "operations", opA: A, opB: B, hover: [i, j] },
      };
    }

    if (genId === "mat_sym") {
      const m = diff === "easy" ? 2 : 3;
      const n = 2;
      const lim = diff === "easy" ? 2 : diff === "normal" ? 3 : 4;
      const A = Array.from({ length: m }, () => Array.from({ length: n }, () => Frac.of(randInt(-lim, lim))));
      const ATA = mul(transpose(A), A);
      return {
        genId, topic: "algebra", section: "§2.7", difficulty: diff,
        title: "Symmetric product AᵀA",
        prompt: `Compute the guaranteed symmetric 2×2 matrix AᵀA from this ${m}×${n} matrix A`,
        given: [{ type: "matrix", label: "A", data: A }],
        answerType: "matrix",
        answerLabel: "AᵀA",
        expected: ATA,
        hint: "Entry (i, j) of AᵀA is (Col i of A) · (Col j of A); off-diagonals must be equal and diagonals ≥ 0",
        explanation: `Diagonal entries are ||col₁||² = ${ATA[0][0].toStr()} and ||col₂||² = ${ATA[1][1].toStr()}; off-diagonal col₁ · col₂ = ${ATA[0][1].toStr()}`,
        solverPayload: { mode: "operations", opA: A, opB: transpose(A) },
      };
    }

    if (genId === "lu_u") {
      const { A, L, U } = buildVerifiedLU3(diff);
      return {
        genId, topic: "elimination", section: "§2.6", difficulty: diff,
        title: "LU factorization (find U)",
        prompt: "Eliminate A to upper triangular U in A = LU (zero row swaps needed)",
        given: [{ type: "matrix", label: "A", data: A }],
        answerType: "matrix",
        answerLabel: "U",
        expected: U,
        hint: "Subtract multiples of Row 1 from Rows 2 and 3, then a multiple of the new Row 2 from Row 3",
        explanation: `Forward elimination without swaps gives pivots ${U[0][0].toStr()}, ${U[1][1].toStr()}, ${U[2][2].toStr()} and exact factor U (with L·U = A verified)`,
        solverPayload: { mode: "elimination", A },
      };
    }

    if (genId === "lu_l") {
      const { A, L, U } = buildVerifiedLU3(diff);
      return {
        genId, topic: "elimination", section: "§2.6", difficulty: diff,
        title: "LU factorization (find L)",
        prompt: "Find the unit lower triangular factor L in A = LU (diagonal entries are 1, zero row swaps needed)",
        given: [{ type: "matrix", label: "A", data: A }],
        answerType: "matrix",
        answerLabel: "L",
        expected: L,
        hint: "Record each elimination multiplier ℓᵢⱼ directly into position (i, j) of L with 1s on the diagonal",
        explanation: `Multipliers ℓ₂₁ = ${L[1][0].toStr()}, ℓ₃₁ = ${L[2][0].toStr()}, ℓ₃₂ = ${L[2][1].toStr()} satisfy L·U = A identically`,
        solverPayload: { mode: "elimination", A },
      };
    }

    if (genId === "lu_ldl") {
      const { S, pivots } = buildVerifiedSymmetricLDL(diff);
      return {
        genId, topic: "elimination", section: "§2.7", difficulty: diff,
        title: "Symmetric S = L D Lᵀ pivots",
        prompt: "This symmetric matrix S factors as S = L D Lᵀ without row swaps. Find the 3 diagonal pivot entries d = (d₁, d₂, d₃) of D",
        given: [{ type: "matrix", label: "S", data: S }],
        answerType: "vector",
        answerLabel: "d",
        expected: pivots,
        hint: "Eliminate S to upper triangular U without swaps; the diagonal entries of U are the exact pivots of D",
        explanation: `Symmetric elimination yields pivots d₁ = ${pivots[0].toStr()}, d₂ = ${pivots[1].toStr()}, d₃ = ${pivots[2].toStr()} with S = L D Lᵀ verified`,
        solverPayload: { mode: "elimination", A: S },
      };
    }

    if (genId === "tri_solve") {
      const n = diff === "easy" ? 2 : 3;
      const U = Array.from({ length: n }, () => Array(n).fill(Frac.ZERO));
      for (let i = 0; i < n; i++) {
        U[i][i] = Frac.of(diff === "easy" ? pick([1, 2]) : randNonZero(-3, 3));
        for (let j = i + 1; j < n; j++) U[i][j] = Frac.of(randInt(-3, 3));
      }
      const xTrue = Array.from({ length: n }, (_, idx) => {
        if (diff === "hard" && idx === 0) return new Frac(BigInt(randNonZero(-3, 3)), BigInt(pick([2, 3])));
        return Frac.of(randInt(-3, 3));
      });
      const c = mulVec(U, xTrue);
      const bwd = backwardSub(U, c);
      return {
        genId, topic: "elimination", section: "§2.2", difficulty: diff,
        title: "Backward substitution Ux = c",
        prompt: "Solve this upper-triangular system Ux = c for the exact vector x",
        given: [{ type: "matrix", label: "U", data: U }, { type: "vector", label: "c", data: c }],
        answerType: "vector",
        answerLabel: "x",
        expected: bwd.x,
        hint: `Start from the bottom equation (x${n} = c${n} / u_${n}${n}) and substitute upward`,
        explanation: bwd.trace.map(t => t.expr).join(" · "),
        solverPayload: { mode: "elimination", A: U, b: c },
      };
    }

    if (genId === "inv2") {
      const { A, inverse, det: d } = buildVerifiedInverse(2, diff);
      return {
        genId, topic: "inverse", section: "§2.5", difficulty: diff,
        title: "2×2 matrix inverse",
        prompt: `Compute the exact inverse A⁻¹ of this 2×2 matrix${hasFractionalEntry(inverse) ? " (enter exact fractions like 1/3)" : ""}`,
        given: [{ type: "matrix", label: "A", data: A }],
        answerType: "matrix",
        answerLabel: "A⁻¹",
        expected: inverse,
        hint: "Swap main diagonal entries, negate off-diagonal entries, and divide every entry by det(A) = ad - bc",
        explanation: `det(A) = (${A[0][0].toStr()})(${A[1][1].toStr()}) - (${A[0][1].toStr()})(${A[1][0].toStr()}) = ${d.toStr()} ≠ 0; verified A·A⁻¹ = I`,
        solverPayload: { mode: "inverse", A },
      };
    }

    if (genId === "inv3") {
      const { A, inverse, det: d } = buildVerifiedInverse(3, diff);
      return {
        genId, topic: "inverse", section: "§2.5", difficulty: diff,
        title: "3×3 matrix inverse",
        prompt: `Compute the exact inverse A⁻¹ of this 3×3 matrix (det(A) = ${d.toStr()}${hasFractionalEntry(inverse) ? ", exact fractions" : ", all integers"})`,
        given: [{ type: "matrix", label: "A", data: A }],
        answerType: "matrix",
        answerLabel: "A⁻¹",
        expected: inverse,
        hint: "Use Gauss-Jordan [A | I] → [I | A⁻¹] or A⁻¹ = Cᵀ / det(A)",
        explanation: `Guaranteed invertible with det(A) = ${d.toStr()}; exact inverse verified A·A⁻¹ = I`,
        solverPayload: { mode: "inverse", A },
      };
    }

    if (genId === "inv_cof") {
      const { A, inverse, det: d } = buildVerifiedInverse(3, diff);
      const i = randInt(0, 2), j = randInt(0, 2);
      const cof = cofactorEntry(A, j, i); // Transposed index C_{j,i} for (A^-1)_{i,j}
      const val = cof.value.div(d);
      return {
        genId, topic: "inverse", section: "§3.3", difficulty: diff,
        title: `Single entry (A⁻¹)_{${i + 1},${j + 1}}`,
        prompt: `Without inverting the entire matrix, find ONLY the single entry (A⁻¹)_{${i + 1},${j + 1}} (Row ${i + 1}, Col ${j + 1} of A⁻¹). Hint: det(A) = ${d.toStr()}`,
        given: [{ type: "matrix", label: "A", data: A }],
        answerType: "scalar",
        answerLabel: `(A⁻¹)_{${i + 1},${j + 1}}`,
        expected: inverse[i][j],
        hint: `Remember the transpose: (A⁻¹)ᵢⱼ = Cⱼᵢ / det(A). Cross out Row ${j + 1} and Column ${i + 1} of A and apply sign (-1)^(${j + 1}+${i + 1})`,
        explanation: `Transposed cofactor C_{${j + 1},${i + 1}} = (${cof.sign.isNeg() ? "-1" : "+1"}) · (${cof.minorDet.toStr()}) = ${cof.value.toStr()} → (A⁻¹)_{${i + 1},${j + 1}} = ${cof.value.toStr()} / ${d.toStr()} = ${val.toStr()}`,
        solverPayload: { mode: "inverse", A },
      };
    }

    if (genId === "det_val") {
      const { A, det: d } = buildVerifiedDet(diff);
      const ds = determinantStudio(A, "row", 0);
      return {
        genId, topic: "determinant", section: "§3.2", difficulty: diff,
        title: `${A.length}×${A.length} determinant`,
        prompt: `Compute the exact scalar determinant det(A) of this ${A.length}×${A.length} matrix`,
        given: [{ type: "matrix", label: "A", data: A }],
        answerType: "scalar",
        answerLabel: "det(A)",
        expected: d,
        hint: ds.optimal.zeros > 0
          ? `Expand along ${ds.optimal.mode === "row" ? "Row" : "Col"} ${ds.optimal.index + 1} (${ds.optimal.zeros} zero${ds.optimal.zeros > 1 ? "s" : ""}) or reduce to U`
          : "Eliminate to upper triangular U and multiply pivots with (-1)^swaps",
        explanation: `Pivot product (-1)^${ds.palu.swaps} · (${ds.palu.pivots.map(p => p.toStr()).join(" · ")}) = ${d.toStr()}`,
        solverPayload: { mode: "determinant", A },
      };
    }

    if (genId === "det_id") {
      const n = pick([2, 3, 4]);
      const dVal = Frac.of(randNonZero(diff === "easy" ? -3 : -5, diff === "easy" ? 4 : 6));
      const variants = [
        {
          label: `det(2A)`,
          prompt: `Suppose A is a ${n}×${n} matrix with det(A) = ${dVal.toStr()}. Compute det(2A)`,
          expected: dVal.mul(Frac.of(2 ** n)),
          hint: `Scaling an n×n matrix multiplies every row by c: det(cA) = c^n · det(A)`,
          explanation: `det(2A) = 2^${n} · det(A) = ${2 ** n} · (${dVal.toStr()}) = ${dVal.mul(Frac.of(2 ** n)).toStr()}`,
        },
        {
          label: `det(A⁻¹)`,
          prompt: `Suppose A is an invertible ${n}×${n} matrix with det(A) = ${dVal.toStr()}. Compute det(A⁻¹)`,
          expected: dVal.inv(),
          hint: "Use det(A · A⁻¹) = det(I) = 1",
          explanation: `det(A⁻¹) = 1 / det(A) = ${dVal.inv().toStr()}`,
        },
        {
          label: `det(-A)`,
          prompt: `Suppose A is a ${n}×${n} matrix with det(A) = ${dVal.toStr()}. Compute det(-A)`,
          expected: n % 2 === 1 ? dVal.neg() : dVal,
          hint: "det(-A) = (-1)^n · det(A)",
          explanation: `det(-A) = (-1)^${n} · (${dVal.toStr()}) = ${(n % 2 === 1 ? dVal.neg() : dVal).toStr()}`,
        },
        {
          label: `det(A²)`,
          prompt: `Suppose A is a ${n}×${n} matrix with det(A) = ${dVal.toStr()}. Compute det(A²)`,
          expected: dVal.mul(dVal),
          hint: "Use the product rule det(AB) = det(A) · det(B)",
          explanation: `det(A²) = (det A)² = (${dVal.toStr()})² = ${dVal.mul(dVal).toStr()}`,
        },
      ];
      const chosen = diff === "hard" ? pick([variants[0], variants[1]]) : pick(variants);
      return {
        genId, topic: "determinant", section: "§3.1", difficulty: diff,
        title: "Determinant identity",
        prompt: chosen.prompt,
        given: [],
        answerType: "scalar",
        answerLabel: chosen.label,
        expected: chosen.expected,
        hint: chosen.hint,
        explanation: chosen.explanation,
        solverPayload: null,
      };
    }

    if (genId === "det_cramer") {
      const n = diff === "easy" ? 2 : 3;
      const { A } = buildVerifiedInverse(n, diff === "hard" ? "hard" : "normal");
      const b = Array.from({ length: n }, () => Frac.of(randInt(-2, 3)));
      if (b.every(v => v.isZero())) b[0] = Frac.ONE;
      const cr = cramersRule(A, b);
      const colIdx = randInt(0, n - 1);
      const target = cr.results[colIdx];
      return {
        genId, topic: "determinant", section: "§3.3", difficulty: diff,
        title: `Cramer's rule (find x${colIdx + 1})`,
        prompt: `Using Cramer's rule on Ax = b, find the exact value of x${colIdx + 1}`,
        given: [{ type: "matrix", label: "A", data: A }, { type: "vector", label: "b", data: b }],
        answerType: "scalar",
        answerLabel: `x${colIdx + 1}`,
        expected: target.x,
        hint: `Replace Column ${colIdx + 1} of A with b to form B${colIdx + 1}, then x${colIdx + 1} = det(B${colIdx + 1}) / det(A)`,
        explanation: `det(A) = ${cr.detA.toStr()}, det(B${colIdx + 1}) = ${target.detB.toStr()} → x${colIdx + 1} = ${target.detB.toStr()} / ${cr.detA.toStr()} = ${target.x.toStr()}`,
        solverPayload: { mode: "determinant", A, b, tab: "cramer" },
      };
    }

    if (genId === "det_cof_entry") {
      const lim = diff === "easy" ? 2 : diff === "normal" ? 3 : 4;
      const A = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Frac.of(randInt(-lim, lim))));
      const i = randInt(0, 2), j = randInt(0, 2);
      const cof = cofactorEntry(A, i, j);
      return {
        genId, topic: "determinant", section: "§3.2", difficulty: diff,
        title: `Cofactor C_{${i + 1},${j + 1}}`,
        prompt: `Compute the exact cofactor C_{${i + 1},${j + 1}} = (-1)^(${i + 1}+${j + 1}) det(M_{${i + 1},${j + 1}}) of matrix A`,
        given: [{ type: "matrix", label: "A", data: A }],
        answerType: "scalar",
        answerLabel: `C_{${i + 1},${j + 1}}`,
        expected: cof.value,
        hint: `Cross out Row ${i + 1} and Column ${j + 1} to get the 2×2 minor, compute its determinant, and multiply by ${cof.sign.isNeg() ? "-1" : "+1"}`,
        explanation: `det(M_{${i + 1},${j + 1}}) = ${cof.minorDet.toStr()}, sign (-1)^${i + j + 2} = ${cof.sign.isNeg() ? "-1" : "+1"} → C_{${i + 1},${j + 1}} = ${cof.value.toStr()}`,
        solverPayload: { mode: "determinant", A },
      };
    }

    if (genId === "null_vec") {
      const { A, special, freeCol } = buildVerifiedNullspace(diff);
      return {
        genId, topic: "subspaces", section: "§4.2", difficulty: diff,
        title: "Nullspace special solution",
        prompt: `Find the special solution vector s in N(A) satisfying As = 0 (setting free variable x${freeCol + 1} = 1)`,
        given: [{ type: "matrix", label: "A", data: A }],
        answerType: "vector",
        answerLabel: "s",
        expected: special,
        hint: `Row-reduce A to RREF R, set x${freeCol + 1} = 1, and read off negated entries in column ${freeCol + 1}`,
        explanation: `Verified A·s = 0 with special solution s = (${special.map(v => v.toStr()).join(", ")})`,
        solverPayload: { mode: "subspaces", subA: A },
      };
    }

    if (genId === "rref_find") {
      const { A, sub } = buildVerifiedNullspace(diff);
      return {
        genId, topic: "subspaces", section: "§4.2", difficulty: diff,
        title: "Reduced row echelon form R",
        prompt: `Row-reduce A completely to its Reduced Row Echelon Form R (pivots = 1, zeros above and below pivots)`,
        given: [{ type: "matrix", label: "A", data: A }],
        answerType: "matrix",
        answerLabel: "R",
        expected: sub.R,
        hint: "Eliminate downward to U, scale pivot rows to 1, then eliminate upward above every pivot",
        explanation: `Pivot columns are ${sub.pivotCols.map(c => c + 1).join(", ")} (rank ${sub.rank}); exact RREF R verified`,
        solverPayload: { mode: "subspaces", subA: A },
      };
    }

    // Default: rank_null (Rank r and Nullity n - r)
    const m = diff === "easy" ? 2 : 3;
    const n = diff === "easy" ? 3 : diff === "normal" ? 4 : 5;
    const targetRank = pick([1, 2]);
    let A;
    for (let attempt = 0; attempt < 40; attempt++) {
      const L = Array.from({ length: m }, () => Array.from({ length: targetRank }, () => Frac.of(randInt(-2, 2))));
      const R = Array.from({ length: targetRank }, () => Array.from({ length: n }, () => Frac.of(randInt(-2, 3))));
      const cand = mul(L, R);
      const sub = analyzeSubspaces(cand);
      if (sub.rank === targetRank && maxAbsNumDen(cand).maxP <= 12) {
        A = cand;
        break;
      }
    }
    if (!A) A = fromRaw([[1, 2, 2, 4], [1, 2, 3, 6], [0, 0, 1, 2]]);
    const sub = analyzeSubspaces(A);
    return {
      genId: "rank_null", topic: "subspaces", section: "§4.2", difficulty: diff,
      title: "Rank and nullity",
      prompt: `Find the rank r = dim C(A) and nullity (n − r) = dim N(A) of this ${sub.m}×${sub.n} matrix`,
      given: [{ type: "matrix", label: "A", data: A }],
      answerType: "pair",
      answerLabels: ["Rank r", "Nullity n − r"],
      expected: [Frac.of(sub.rank), Frac.of(sub.nullity)],
      hint: `Eliminate A to echelon form U and count non-zero pivot rows r. Then nullity = ${sub.n} − r`,
      explanation: `Pivot columns are ${sub.pivotCols.map(c => c + 1).join(", ")} → rank r = ${sub.rank}, nullity = ${sub.n} − ${sub.rank} = ${sub.nullity}`,
      solverPayload: { mode: "subspaces", subA: A },
    };
  }

  const TOPIC_GENERATORS = Object.fromEntries(
    EXAM_TOPICS.map(t => [t.id, t.subtypes.map(s => s.id)])
  );

  function generateExam({ topics = null, subtypes = null, count = 8, difficulty = "normal" } = {}) {
    const parsedCount = Number(count);
    const safeCount = Number.isFinite(parsedCount)
      ? Math.max(1, Math.min(30, Math.trunc(parsedCount)))
      : 8;
    const activeTopics = (topics && topics.length) ? topics.filter(t => TOPIC_GENERATORS[t]) : Object.keys(TOPIC_GENERATORS);
    const pool = activeTopics.length ? activeTopics : Object.keys(TOPIC_GENERATORS);

    // Resolve per-topic active sub-type pools (sanitized against TOPIC_GENERATORS)
    const topicPools = {};
    for (const t of pool) {
      const allowed = TOPIC_GENERATORS[t];
      const requested = subtypes && Array.isArray(subtypes[t])
        ? subtypes[t].filter(id => allowed.includes(id))
        : allowed;
      const chosen = requested.length ? requested : allowed;
      topicPools[t] = [...chosen].sort(() => Math.random() - 0.5);
    }

    const shuffledTopics = [...pool].sort(() => Math.random() - 0.5);
    const genOffsets = {};
    for (const t of shuffledTopics) genOffsets[t] = 0;

    const questions = [];
    for (let idx = 0; idx < safeCount; idx++) {
      const topic = shuffledTopics[idx % shuffledTopics.length];
      const gens = topicPools[topic];
      const genId = gens[genOffsets[topic] % gens.length];
      genOffsets[topic]++;
      const q = makeQuestion(genId, difficulty);
      q.index = idx;
      q.id = `q_${idx}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      questions.push(q);
    }
    return questions;
  }

  function gradeExamAnswer(q, rawInput) {
    if (q.answerType === "scalar") {
      const raw = Array.isArray(rawInput) ? (Array.isArray(rawInput[0]) ? rawInput[0][0] : rawInput[0]) : rawInput;
      const parsed = tryParseFrac(raw);
      const ok = parsed !== null && parsed.eq(q.expected);
      return { correct: ok, rightCount: ok ? 1 : 0, totalCount: 1, cellStates: [[ok]], note: "" };
    }
    if (q.answerType === "pair") {
      const arr = Array.isArray(rawInput) ? (Array.isArray(rawInput[0]) ? rawInput[0] : rawInput) : ["", ""];
      const states = [0, 1].map(i => {
        const p = tryParseFrac(arr[i]);
        return p !== null && p.eq(q.expected[i]);
      });
      const right = states.filter(Boolean).length;
      return { correct: right === 2, rightCount: right, totalCount: 2, cellStates: [states], note: "" };
    }
    if (q.answerType === "vector") {
      const arr = Array.isArray(rawInput) ? (Array.isArray(rawInput[0]) ? rawInput[0] : rawInput) : [];
      const n = q.expected.length;
      const parsedVec = [];
      const states = [];
      let right = 0;
      for (let i = 0; i < n; i++) {
        const p = tryParseFrac(arr[i]);
        parsedVec.push(p);
        const ok = p !== null && p.eq(q.expected[i]);
        if (ok) right++;
        states.push(ok);
      }
      let note = "";
      if (right !== n && q.genId === "null_vec" && parsedVec.every(v => v !== null) && !parsedVec.every(v => v.isZero())) {
        const A = q.given[0].data;
        if (mulVec(A, parsedVec).every(v => v.isZero())) {
          note = "Your vector satisfies Ax = 0 (it is a valid scalar multiple in N(A)), but the prompt requested free variable = 1.";
        }
      }
      return { correct: right === n, rightCount: right, totalCount: n, cellStates: [states], note };
    }
    // Matrix
    const m = q.expected.length, n = q.expected[0].length;
    const grid = Array.isArray(rawInput) ? rawInput : [];
    const cellStates = [];
    let right = 0;
    for (let i = 0; i < m; i++) {
      const rowStates = [];
      for (let j = 0; j < n; j++) {
        const p = tryParseFrac(grid[i] && grid[i][j]);
        const ok = p !== null && p.eq(q.expected[i][j]);
        if (ok) right++;
        rowStates.push(ok);
      }
      cellStates.push(rowStates);
    }
    return { correct: right === m * n, rightCount: right, totalCount: m * n, cellStates, note: "" };
  }

  const Engine = {
    Frac,
    tryParseFrac,
    fromRaw,
    clone,
    zeros,
    eye,
    transpose,
    isSymmetric,
    add,
    sub,
    mul,
    mulVec,
    pow,
    matEq,
    minorMatrix,
    det,
    cofactorEntry,
    cofactorMatrix,
    factorizePALU,
    forwardSub,
    backwardSub,
    invertAllMethods,
    determinantStudio,
    cramersRule,
    analyzeSubspaces,
    analyzeVectors,
    triangleArea,
    boxVolume,
    generateDrill,
    EXAM_TOPICS,
    generateExam,
    gradeExamAnswer,
    formatSymbolicLinear,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Engine;
  } else {
    global.MatrixEngine = Engine;
  }
})(typeof window !== "undefined" ? window : globalThis);
