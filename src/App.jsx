import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Database,
  Globe,
  RotateCcw,
  Save,
  Server,
  ShieldCheck,
} from "lucide-react";

const STORAGE_KEY = "pallet-simple-stock-v3";
const LEGACY_STORAGE_KEY = "pallet-simple-stock-v2";

const initialStock = {
  A: 120,
  B: 90,
};

const seedTransactions = [
  {
    id: "TRX-001",
    date: "2026-06-22",
    movement: "keluar",
    palletType: "A",
    quantity: 24,
    client: "PT Sumber Jaya",
    years: 1,
    condition: "baik",
    note: "Sewa 1 tahun",
  },
  {
    id: "TRX-002",
    date: "2026-06-22",
    movement: "masuk",
    palletType: "B",
    quantity: 12,
    client: "",
    years: "",
    condition: "rusak ringan",
    note: "Masuk repair",
  },
];

const securityControls = [
  {
    icon: Globe,
    title: "Website",
    status: "Headers siap",
    points: ["CSP", "HSTS", "anti clickjacking"],
  },
  {
    icon: Server,
    title: "Server",
    status: "Wajib deploy",
    points: ["HTTPS only", "WAF/rate limit", "patch rutin"],
  },
  {
    icon: Database,
    title: "Database",
    status: "Wajib backend",
    points: ["private network", "role minimum", "backup terenkripsi"],
  },
  {
    icon: Activity,
    title: "Monitoring",
    status: "Wajib operasi",
    points: ["audit log", "alert anomali", "incident response"],
  },
];

const numberFormat = new Intl.NumberFormat("id-ID");

function today() {
  return new Date().toISOString().slice(0, 10);
}

function defaultForm() {
  return {
    date: today(),
    movement: "keluar",
    palletType: "A",
    quantity: 1,
    client: "",
    years: 1,
    condition: "baik",
    note: "",
  };
}

function makeId() {
  return `TRX-${Date.now()}`;
}

function sanitizeText(value, maxLength = 140) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizeTransaction(trx) {
  const movement = ["keluar", "masuk", "laporan_rusak"].includes(trx.movement)
    ? trx.movement
    : "masuk";
  const condition = ["baik", "rusak ringan", "rusak berat"].includes(
    trx.condition,
  )
    ? trx.condition
    : "baik";
  const palletType = ["A", "B"].includes(trx.palletType) ? trx.palletType : "A";
  const quantity = Number(trx.quantity);
  const years = Number(trx.years);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(trx.date) ? trx.date : today();

  return {
    id: sanitizeText(trx.id, 40) || makeId(),
    date,
    movement,
    palletType,
    quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1,
    client: movement === "masuk" ? "" : sanitizeText(trx.client, 80),
    years:
      movement === "keluar" && Number.isInteger(years) && years > 0 ? years : "",
    condition: movement === "keluar" ? "baik" : condition,
    note: sanitizeText(trx.note, 140),
  };
}

function parseTransactions(value) {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) return seedTransactions;
  return parsed.map(normalizeTransaction);
}

function loadTransactions() {
  try {
    const saved =
      localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    return saved ? parseTransactions(saved) : seedTransactions;
  } catch {
    return seedTransactions;
  }
}

function calculateSummary(transactions) {
  const perType = {
    A: {
      ready: initialStock.A,
      in: 0,
      out: 0,
      repairLight: 0,
      repairHeavy: 0,
      clientDamageLight: 0,
      clientDamageHeavy: 0,
    },
    B: {
      ready: initialStock.B,
      in: 0,
      out: 0,
      repairLight: 0,
      repairHeavy: 0,
      clientDamageLight: 0,
      clientDamageHeavy: 0,
    },
  };

  transactions.forEach((trx) => {
    const row = perType[trx.palletType];
    if (!row) return;

    if (trx.movement === "keluar") {
      row.out += trx.quantity;
      row.ready -= trx.quantity;
      return;
    }

    if (trx.movement === "laporan_rusak") {
      row.out -= trx.quantity;

      if (trx.condition === "rusak ringan") {
        row.repairLight += trx.quantity;
        row.clientDamageLight += trx.quantity;
      }

      if (trx.condition === "rusak berat") {
        row.repairHeavy += trx.quantity;
        row.clientDamageHeavy += trx.quantity;
      }

      return;
    }

    row.in += trx.quantity;
    if (trx.condition === "baik") row.ready += trx.quantity;
    if (trx.condition === "rusak ringan") row.repairLight += trx.quantity;
    if (trx.condition === "rusak berat") row.repairHeavy += trx.quantity;
  });

  const totals = Object.values(perType).reduce(
    (acc, row) => ({
      ready: acc.ready + row.ready,
      in: acc.in + row.in,
      out: acc.out + row.out,
      repairLight: acc.repairLight + row.repairLight,
      repairHeavy: acc.repairHeavy + row.repairHeavy,
      clientDamageLight: acc.clientDamageLight + row.clientDamageLight,
      clientDamageHeavy: acc.clientDamageHeavy + row.clientDamageHeavy,
    }),
    {
      ready: 0,
      in: 0,
      out: 0,
      repairLight: 0,
      repairHeavy: 0,
      clientDamageLight: 0,
      clientDamageHeavy: 0,
    },
  );

  return { perType, totals };
}

function movementLabel(movement) {
  if (movement === "keluar") return "Keluar sewa";
  if (movement === "laporan_rusak") return "Rusak client";
  return "Masuk stok";
}

function detailsLabel(trx) {
  if (trx.movement === "keluar") {
    return `${trx.client} - ${trx.years} tahun`;
  }

  if (trx.movement === "laporan_rusak") {
    return `${trx.client} - ${trx.condition}`;
  }

  return trx.condition;
}

export default function App() {
  const [transactions, setTransactions] = useState(loadTransactions);
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState("");

  const summary = useMemo(
    () => calculateSummary(transactions),
    [transactions],
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }, [transactions]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function changeMovement(movement) {
    setForm((current) => ({
      ...current,
      movement,
      condition:
        movement === "laporan_rusak" && current.condition === "baik"
          ? "rusak ringan"
          : current.condition,
    }));
    setMessage("");
  }

  function submitTransaction(event) {
    event.preventDefault();

    const quantity = Number(form.quantity);
    const years = Number(form.years);
    const client = sanitizeText(form.client, 80);
    const note = sanitizeText(form.note, 140);
    const readyStock = summary.perType[form.palletType].ready;
    const outStock = summary.perType[form.palletType].out;

    if (!form.date) {
      setMessage("Tanggal wajib diisi.");
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
      setMessage("Jumlah harus angka bulat 1 sampai 100.000.");
      return;
    }

    if (form.movement === "keluar") {
      if (!client) {
        setMessage("Client wajib diisi untuk pallet keluar sewa.");
        return;
      }

      if (!Number.isInteger(years) || years < 1) {
        setMessage("Durasi sewa minimal 1 tahun.");
        return;
      }

      if (quantity > readyStock) {
        setMessage("Stok siap tidak cukup untuk tipe pallet ini.");
        return;
      }
    }

    if (form.movement === "laporan_rusak") {
      if (!client) {
        setMessage("Client wajib diisi untuk laporan rusak.");
        return;
      }

      if (!["rusak ringan", "rusak berat"].includes(form.condition)) {
        setMessage("Pilih kondisi rusak ringan atau rusak berat.");
        return;
      }

      if (quantity > outStock) {
        setMessage("Jumlah laporan rusak melebihi pallet yang sedang keluar.");
        return;
      }
    }

    const newTransaction = {
      id: makeId(),
      date: form.date,
      movement: form.movement,
      palletType: form.palletType,
      quantity,
      client: form.movement === "masuk" ? "" : client,
      years: form.movement === "keluar" ? years : "",
      condition:
        form.movement === "masuk" || form.movement === "laporan_rusak"
          ? form.condition
          : "baik",
      note,
    };

    setTransactions((current) => [newTransaction, ...current]);
    setForm((current) => ({
      ...defaultForm(),
      movement: current.movement,
      palletType: current.palletType,
      condition:
        current.movement === "laporan_rusak" ? "rusak ringan" : "baik",
    }));
    setMessage(
      form.movement === "laporan_rusak"
        ? "Laporan rusak tersimpan. Jumlah keluar sudah berkurang."
        : "Transaksi tersimpan.",
    );
  }

  function clearData() {
    setTransactions(seedTransactions);
    setForm(defaultForm());
    setMessage("Data contoh dikembalikan.");
  }

  const recentTransactions = transactions.slice(0, 8);
  const repairTotal = summary.totals.repairLight + summary.totals.repairHeavy;
  const clientDamageTotal =
    summary.totals.clientDamageLight + summary.totals.clientDamageHeavy;

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1>Pallet Stok Management</h1>
          <p>Sewa client minimal 1 tahun, stok masuk, stok keluar, dan repair.</p>
        </div>
        <button className="secondary-button" type="button" onClick={clearData}>
          <RotateCcw aria-hidden="true" size={16} />
          Reset
        </button>
      </header>

      <section className="security-strip" aria-label="Keamanan cyber">
        <div className="security-status">
          <ShieldCheck aria-hidden="true" size={22} />
          <div>
            <strong>Cyber security hardening</strong>
            <span>Website, server, database, dan monitoring operasional</span>
          </div>
        </div>
        <div className="security-badges" aria-label="Kontrol keamanan aktif">
          <span>Input filter</span>
          <span>Security headers</span>
          <span>Audit ready</span>
        </div>
      </section>

      <section className="summary-grid" aria-label="Ringkasan stok pallet">
        <SummaryCard label="Total stok siap" value={summary.totals.ready} />
        <SummaryCard label="Keluar disewa" value={summary.totals.out} />
        <SummaryCard label="Masuk pallet" value={summary.totals.in} />
        <SummaryCard label="Perlu repair" value={repairTotal} />
      </section>

      <section className="security-center" aria-label="Cyber security center">
        <div className="panel-title">
          <h2>Cyber Security Center</h2>
          <p>Kontrol pertahanan untuk website, server, database, dan audit.</p>
        </div>

        <div className="security-control-grid">
          {securityControls.map((control) => (
            <SecurityControl key={control.title} control={control} />
          ))}
        </div>
      </section>

      <section className="type-grid" aria-label="Stok per tipe pallet">
        {["A", "B"].map((type) => {
          const row = summary.perType[type];
          return (
            <article className="type-card" key={type}>
              <h2>Tipe Pallet {type}</h2>
              <div className="type-numbers">
                <span>
                  Stok siap
                  <strong>{numberFormat.format(row.ready)}</strong>
                </span>
                <span>
                  Keluar
                  <strong>{numberFormat.format(row.out)}</strong>
                </span>
                <span>
                  Repair
                  <strong>
                    {numberFormat.format(row.repairLight + row.repairHeavy)}
                  </strong>
                </span>
              </div>
              <p>
                Rusak ringan: {numberFormat.format(row.repairLight)} | Rusak
                berat: {numberFormat.format(row.repairHeavy)}
              </p>
            </article>
          );
        })}
      </section>

      <section className="work-area">
        <form className="panel form-panel" onSubmit={submitTransaction}>
          <div className="panel-title">
            <h2>Transaksi Pallet</h2>
            <p>Pilih keluar sewa, masuk stok, atau laporan rusak client.</p>
          </div>

          <div className="mode-switch">
            <button
              className={form.movement === "keluar" ? "active" : ""}
              type="button"
              onClick={() => changeMovement("keluar")}
            >
              Keluar Sewa
            </button>
            <button
              className={form.movement === "masuk" ? "active" : ""}
              type="button"
              onClick={() => changeMovement("masuk")}
            >
              Masuk Stok
            </button>
            <button
              className={form.movement === "laporan_rusak" ? "active" : ""}
              type="button"
              onClick={() => changeMovement("laporan_rusak")}
            >
              Rusak Client
            </button>
          </div>

          <div className="form-grid">
            <label>
              Tanggal
              <input
                required
                type="date"
                value={form.date}
                onChange={(event) => updateForm("date", event.target.value)}
              />
            </label>

            <label>
              Tipe pallet
              <select
                value={form.palletType}
                onChange={(event) =>
                  updateForm("palletType", event.target.value)
                }
              >
                <option value="A">Tipe A</option>
                <option value="B">Tipe B</option>
              </select>
            </label>

            <label>
              Jumlah
              <input
                min="1"
                required
                step="1"
                type="number"
                value={form.quantity}
                onChange={(event) => updateForm("quantity", event.target.value)}
              />
            </label>

            {form.movement === "keluar" && (
              <>
                <label>
                  Client
                  <input
                    maxLength="80"
                    required
                    type="text"
                    placeholder="Nama client"
                    value={form.client}
                    onChange={(event) =>
                      updateForm("client", event.target.value)
                    }
                  />
                </label>

                <label>
                  Durasi sewa
                  <select
                    value={form.years}
                    onChange={(event) => updateForm("years", event.target.value)}
                  >
                    <option value="1">1 tahun</option>
                    <option value="2">2 tahun</option>
                    <option value="3">3 tahun</option>
                    <option value="5">5 tahun</option>
                  </select>
                </label>
              </>
            )}

            {form.movement === "masuk" && (
              <label>
                Kondisi masuk
                <select
                  value={form.condition}
                  onChange={(event) =>
                    updateForm("condition", event.target.value)
                  }
                >
                  <option value="baik">Baik, masuk stok siap</option>
                  <option value="rusak ringan">Rusak ringan, perlu repair</option>
                  <option value="rusak berat">Rusak berat, perlu repair</option>
                </select>
              </label>
            )}

            {form.movement === "laporan_rusak" && (
              <>
                <label>
                  Client pelapor
                  <input
                    maxLength="80"
                    required
                    type="text"
                    placeholder="Nama client"
                    value={form.client}
                    onChange={(event) =>
                      updateForm("client", event.target.value)
                    }
                  />
                </label>

                <label>
                  Kondisi laporan
                  <select
                    value={form.condition}
                    onChange={(event) =>
                      updateForm("condition", event.target.value)
                    }
                  >
                    <option value="rusak ringan">Rusak ringan</option>
                    <option value="rusak berat">Rusak berat</option>
                  </select>
                </label>
              </>
            )}

            <label className="full-field">
              Catatan
              <input
                maxLength="140"
                type="text"
                placeholder="Opsional"
                value={form.note}
                onChange={(event) => updateForm("note", event.target.value)}
              />
            </label>
          </div>

          <button className="primary-button" type="submit">
            <Save aria-hidden="true" size={16} />
            Simpan
          </button>

          {message && <p className="message">{message}</p>}
        </form>

        <section className="panel">
          <div className="panel-title">
            <h2>Riwayat Singkat</h2>
            <p>
              Transaksi terakhir. Laporan rusak client:{" "}
              {numberFormat.format(clientDamageTotal)}
            </p>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Transaksi</th>
                  <th>Tipe</th>
                  <th>Jumlah</th>
                  <th>Client/Kondisi</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((trx) => (
                  <tr key={trx.id}>
                    <td>{trx.date}</td>
                    <td>{movementLabel(trx.movement)}</td>
                    <td>Pallet {trx.palletType}</td>
                    <td>{numberFormat.format(trx.quantity)}</td>
                    <td>{detailsLabel(trx)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

function SecurityControl({ control }) {
  const Icon = control.icon;

  return (
    <article className="security-control">
      <div className="security-control-head">
        <span className="control-icon">
          <Icon aria-hidden="true" size={18} />
        </span>
        <div>
          <h3>{control.title}</h3>
          <strong>{control.status}</strong>
        </div>
      </div>
      <ul>
        {control.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </article>
  );
}

function SummaryCard({ label, value }) {
  return (
    <article className="summary-card">
      <span>{label}</span>
      <strong>{numberFormat.format(value)}</strong>
    </article>
  );
}
