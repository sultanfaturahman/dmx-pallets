import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ClipboardList,
  Database,
  Edit3,
  Globe,
  LayoutDashboard,
  Plus,
  RotateCcw,
  Save,
  Search,
  Server,
  ShieldCheck,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";

const STORAGE_KEY = "pallet-simple-stock-v3";
const LEGACY_STORAGE_KEY = "pallet-simple-stock-v2";
const CLIENT_STORAGE_KEY = "pallet-clients-v1";

const initialStock = {
  A: 120,
  B: 90,
};

const seedClients = [
  {
    id: "CL-001",
    name: "PT Sumber Jaya",
    pic: "Budi Santoso",
    phone: "+62 812 1000 2000",
    email: "ops@sumberjaya.co.id",
    address: "Jakarta",
    status: "aktif",
    note: "Client prioritas untuk sewa tahunan.",
  },
  {
    id: "CL-002",
    name: "PT Lintas Gudang",
    pic: "Maya Putri",
    phone: "+62 813 3000 4000",
    email: "warehouse@lintasgudang.co.id",
    address: "Bekasi",
    status: "aktif",
    note: "Siap untuk kontrak berikutnya.",
  },
];

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

const pages = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "data", label: "Data", icon: ClipboardList },
  { id: "clients", label: "Client", icon: Users },
  { id: "repair", label: "Repair", icon: Wrench },
  { id: "security", label: "Security", icon: ShieldCheck },
];

const numberFormat = new Intl.NumberFormat("id-ID");

function today() {
  return new Date().toISOString().slice(0, 10);
}

function defaultTransactionForm() {
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

function defaultClientForm() {
  return {
    name: "",
    pic: "",
    phone: "",
    email: "",
    address: "",
    status: "aktif",
    note: "",
  };
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}`;
}

function sanitizeText(value, maxLength = 140) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

function clientKey(value) {
  return sanitizeText(value, 80).toLowerCase().replace(/\s+/g, " ");
}

function rentalKey(client, palletType) {
  return `${clientKey(client)}::${palletType}`;
}

function normalizeClient(client) {
  const status = client.status === "nonaktif" ? "nonaktif" : "aktif";

  return {
    id: sanitizeText(client.id, 40) || makeId("CL"),
    name: sanitizeText(client.name, 80),
    pic: sanitizeText(client.pic, 80),
    phone: sanitizeText(client.phone, 40),
    email: sanitizeText(client.email, 80),
    address: sanitizeText(client.address, 120),
    status,
    note: sanitizeText(client.note, 160),
  };
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
    id: sanitizeText(trx.id, 40) || makeId("TRX"),
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

function parseList(value, fallback, normalizer) {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) return fallback;
  return parsed.map(normalizer).filter((item) => item.name !== "");
}

function loadTransactions() {
  try {
    const saved =
      localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    return saved
      ? JSON.parse(saved).map(normalizeTransaction)
      : seedTransactions.map(normalizeTransaction);
  } catch {
    return seedTransactions.map(normalizeTransaction);
  }
}

function loadClients() {
  try {
    const saved = localStorage.getItem(CLIENT_STORAGE_KEY);
    return saved
      ? parseList(saved, seedClients, normalizeClient)
      : seedClients.map(normalizeClient);
  } catch {
    return seedClients.map(normalizeClient);
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

function summarizeRentalYears(buckets) {
  const perYear = new Map();

  buckets.forEach((bucket) => {
    if (bucket.quantity < 1) return;

    const years = bucket.years || "-";
    perYear.set(years, (perYear.get(years) || 0) + bucket.quantity);
  });

  return Array.from(perYear.entries())
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(
      ([years, quantity]) =>
        `${years} tahun (${numberFormat.format(quantity)} pallet)`,
    )
    .join(", ");
}

function calculateClientRentals(transactions) {
  const rentals = new Map();

  function getRow(trx) {
    const key = rentalKey(trx.client, trx.palletType);
    const existing = rentals.get(key);
    if (existing) return existing;

    const next = {
      client: trx.client,
      palletType: trx.palletType,
      buckets: [],
      activeQuantity: 0,
      yearsSummary: "",
    };
    rentals.set(key, next);
    return next;
  }

  [...transactions].reverse().forEach((trx) => {
    if (!trx.client || !["keluar", "laporan_rusak"].includes(trx.movement)) {
      return;
    }

    const row = getRow(trx);

    if (trx.movement === "keluar") {
      row.client = trx.client;
      row.buckets.push({
        years: trx.years,
        quantity: trx.quantity,
      });
      row.activeQuantity += trx.quantity;
      return;
    }

    let remaining = trx.quantity;
    row.buckets.forEach((bucket) => {
      if (remaining < 1 || bucket.quantity < 1) return;

      const taken = Math.min(bucket.quantity, remaining);
      bucket.quantity -= taken;
      remaining -= taken;
      row.activeQuantity -= taken;
    });
  });

  rentals.forEach((row, key) => {
    row.activeQuantity = Math.max(0, row.activeQuantity);
    row.yearsSummary = summarizeRentalYears(row.buckets);

    if (row.activeQuantity < 1) {
      rentals.delete(key);
    }
  });

  return rentals;
}

function getClientRentalsByName(rentals, clientName) {
  return Array.from(rentals.values()).filter(
    (row) => clientKey(row.client) === clientKey(clientName),
  );
}

function findClientRental(rentals, client, palletType) {
  if (!client) return null;
  return rentals.get(rentalKey(client, palletType)) || null;
}

function findRegisteredClient(clients, name) {
  return clients.find((client) => clientKey(client.name) === clientKey(name));
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
  const [activePage, setActivePage] = useState("dashboard");
  const [transactions, setTransactions] = useState(loadTransactions);
  const [clients, setClients] = useState(loadClients);
  const [form, setForm] = useState(defaultTransactionForm);
  const [clientForm, setClientForm] = useState(defaultClientForm);
  const [editingClientId, setEditingClientId] = useState("");
  const [dataFilters, setDataFilters] = useState({
    search: "",
    movement: "all",
    palletType: "all",
  });
  const [message, setMessage] = useState("");

  const summary = useMemo(
    () => calculateSummary(transactions),
    [transactions],
  );
  const clientRentals = useMemo(
    () => calculateClientRentals(transactions),
    [transactions],
  );
  const damageRental = useMemo(
    () => findClientRental(clientRentals, form.client, form.palletType),
    [clientRentals, form.client, form.palletType],
  );
  const activeClients = useMemo(
    () =>
      clients
        .filter((client) => client.status === "aktif")
        .sort((left, right) => left.name.localeCompare(right.name)),
    [clients],
  );
  const clientStats = useMemo(
    () =>
      clients.map((client) => {
        const rentals = getClientRentalsByName(clientRentals, client.name);
        const activeQuantity = rentals.reduce(
          (total, rental) => total + rental.activeQuantity,
          0,
        );

        return {
          ...client,
          activeQuantity,
          rentalSummary:
            rentals
              .map(
                (rental) =>
                  `Tipe ${rental.palletType}: ${numberFormat.format(
                    rental.activeQuantity,
                  )} pallet (${rental.yearsSummary})`,
              )
              .join(" | ") || "Tidak ada sewa aktif",
        };
      }),
    [clients, clientRentals],
  );
  const filteredTransactions = useMemo(() => {
    const search = dataFilters.search.toLowerCase().trim();

    return transactions.filter((trx) => {
      const matchesSearch =
        !search ||
        [trx.id, trx.date, trx.client, trx.note, trx.condition, trx.palletType]
          .join(" ")
          .toLowerCase()
          .includes(search);
      const matchesMovement =
        dataFilters.movement === "all" || trx.movement === dataFilters.movement;
      const matchesType =
        dataFilters.palletType === "all" ||
        trx.palletType === dataFilters.palletType;

      return matchesSearch && matchesMovement && matchesType;
    });
  }, [dataFilters, transactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(clients));
  }, [clients]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateClientForm(field, value) {
    setClientForm((current) => ({ ...current, [field]: value }));
  }

  function updateFilter(field, value) {
    setDataFilters((current) => ({ ...current, [field]: value }));
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
    const rawClient = sanitizeText(form.client, 80);
    const registeredClient = findRegisteredClient(clients, rawClient);
    const client =
      form.movement === "masuk" ? "" : sanitizeText(registeredClient?.name || rawClient, 80);
    const note = sanitizeText(form.note, 140);
    const readyStock = summary.perType[form.palletType].ready;

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

      if (!registeredClient || registeredClient.status !== "aktif") {
        setMessage("Client harus terdaftar dan aktif di halaman Manage Client.");
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

      if (!registeredClient || registeredClient.status !== "aktif") {
        setMessage("Client pelapor harus terdaftar dan aktif.");
        return;
      }

      if (!["rusak ringan", "rusak berat"].includes(form.condition)) {
        setMessage("Pilih kondisi rusak ringan atau rusak berat.");
        return;
      }

      if (!damageRental) {
        setMessage(
          `Client belum tercatat menyewa pallet tipe ${form.palletType}.`,
        );
        return;
      }

      if (quantity > damageRental.activeQuantity) {
        setMessage(
          `Client hanya punya sewa aktif ${numberFormat.format(
            damageRental.activeQuantity,
          )} pallet tipe ${form.palletType}.`,
        );
        return;
      }
    }

    const newTransaction = {
      id: makeId("TRX"),
      date: form.date,
      movement: form.movement,
      palletType: form.palletType,
      quantity,
      client,
      years: form.movement === "keluar" ? years : "",
      condition:
        form.movement === "masuk" || form.movement === "laporan_rusak"
          ? form.condition
          : "baik",
      note,
    };

    setTransactions((current) => [newTransaction, ...current]);
    setForm((current) => ({
      ...defaultTransactionForm(),
      movement: current.movement,
      palletType: current.palletType,
      condition:
        current.movement === "laporan_rusak" ? "rusak ringan" : "baik",
    }));
    setMessage(
      form.movement === "laporan_rusak"
        ? `Laporan rusak tersimpan. Validasi sewa ${damageRental.client}: ${numberFormat.format(
            damageRental.activeQuantity,
          )} pallet, ${damageRental.yearsSummary}.`
        : "Transaksi tersimpan.",
    );
  }

  function submitClient(event) {
    event.preventDefault();

    const nextClient = normalizeClient({
      ...clientForm,
      id: editingClientId || makeId("CL"),
    });

    if (!nextClient.name) {
      setMessage("Nama client wajib diisi.");
      return;
    }

    const duplicate = clients.find(
      (client) =>
        client.id !== editingClientId &&
        clientKey(client.name) === clientKey(nextClient.name),
    );

    if (duplicate) {
      setMessage("Nama client sudah terdaftar.");
      return;
    }

    setClients((current) => {
      if (!editingClientId) return [nextClient, ...current];
      return current.map((client) =>
        client.id === editingClientId ? nextClient : client,
      );
    });
    setClientForm(defaultClientForm());
    setEditingClientId("");
    setMessage(editingClientId ? "Data client diperbarui." : "Client baru tersimpan.");
  }

  function editClient(client) {
    setClientForm({
      name: client.name,
      pic: client.pic,
      phone: client.phone,
      email: client.email,
      address: client.address,
      status: client.status,
      note: client.note,
    });
    setEditingClientId(client.id);
    setActivePage("clients");
    setMessage("");
  }

  function removeClient(client) {
    const rentals = getClientRentalsByName(clientRentals, client.name);
    const activeQuantity = rentals.reduce(
      (total, rental) => total + rental.activeQuantity,
      0,
    );

    if (activeQuantity > 0) {
      setMessage(
        `Client masih punya sewa aktif ${numberFormat.format(
          activeQuantity,
        )} pallet. Nonaktifkan saja atau selesaikan sewa lebih dulu.`,
      );
      return;
    }

    setClients((current) => current.filter((item) => item.id !== client.id));
    setMessage("Client dihapus.");
  }

  function cancelClientEdit() {
    setClientForm(defaultClientForm());
    setEditingClientId("");
    setMessage("");
  }

  function clearData() {
    setTransactions(seedTransactions.map(normalizeTransaction));
    setClients(seedClients.map(normalizeClient));
    setForm(defaultTransactionForm());
    setClientForm(defaultClientForm());
    setEditingClientId("");
    setMessage("Data contoh dikembalikan.");
  }

  const recentTransactions = transactions.slice(0, 8);
  const repairTransactions = transactions.filter(
    (trx) =>
      trx.condition === "rusak ringan" ||
      trx.condition === "rusak berat" ||
      trx.movement === "laporan_rusak",
  );
  const repairTotal = summary.totals.repairLight + summary.totals.repairHeavy;
  const clientDamageTotal =
    summary.totals.clientDamageLight + summary.totals.clientDamageHeavy;

  return (
    <main className="page">
      <header className="header app-header">
        <div>
          <h1>Pallet Stok Management</h1>
          <p>Sewa client minimal 1 tahun, stok masuk, stok keluar, dan repair.</p>
        </div>
        <button className="secondary-button" type="button" onClick={clearData}>
          <RotateCcw aria-hidden="true" size={16} />
          Reset
        </button>
      </header>

      <nav className="page-nav" aria-label="Navigasi halaman">
        {pages.map((page) => {
          const Icon = page.icon;
          return (
            <button
              className={activePage === page.id ? "active" : ""}
              key={page.id}
              type="button"
              onClick={() => setActivePage(page.id)}
            >
              <Icon aria-hidden="true" size={16} />
              {page.label}
            </button>
          );
        })}
      </nav>

      {message && <p className="message global-message">{message}</p>}

      {activePage === "dashboard" && (
        <DashboardPage
          activeClients={activeClients}
          clientDamageTotal={clientDamageTotal}
          clientRentals={clientRentals}
          damageRental={damageRental}
          form={form}
          recentTransactions={recentTransactions}
          repairTotal={repairTotal}
          summary={summary}
          onChangeMovement={changeMovement}
          onSubmitTransaction={submitTransaction}
          onUpdateForm={updateForm}
        />
      )}

      {activePage === "data" && (
        <DataPage
          filters={dataFilters}
          transactions={filteredTransactions}
          onUpdateFilter={updateFilter}
        />
      )}

      {activePage === "clients" && (
        <ClientsPage
          clientForm={clientForm}
          clients={clientStats}
          editingClientId={editingClientId}
          onCancelEdit={cancelClientEdit}
          onEditClient={editClient}
          onRemoveClient={removeClient}
          onSubmitClient={submitClient}
          onUpdateClientForm={updateClientForm}
        />
      )}

      {activePage === "repair" && (
        <RepairPage
          clientDamageTotal={clientDamageTotal}
          repairTotal={repairTotal}
          transactions={repairTransactions}
        />
      )}

      {activePage === "security" && <SecurityPage />}
    </main>
  );
}

function DashboardPage({
  activeClients,
  clientDamageTotal,
  clientRentals,
  damageRental,
  form,
  recentTransactions,
  repairTotal,
  summary,
  onChangeMovement,
  onSubmitTransaction,
  onUpdateForm,
}) {
  const activeRentalRows = Array.from(clientRentals.values());

  return (
    <>
      <section className="summary-grid" aria-label="Ringkasan stok pallet">
        <SummaryCard label="Total stok siap" value={summary.totals.ready} />
        <SummaryCard label="Keluar disewa" value={summary.totals.out} />
        <SummaryCard label="Masuk pallet" value={summary.totals.in} />
        <SummaryCard label="Perlu repair" value={repairTotal} />
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
        <TransactionForm
          activeClients={activeClients}
          damageRental={damageRental}
          form={form}
          onChangeMovement={onChangeMovement}
          onSubmit={onSubmitTransaction}
          onUpdateForm={onUpdateForm}
        />

        <section className="panel">
          <div className="panel-title">
            <h2>Riwayat Singkat</h2>
            <p>
              Transaksi terakhir. Laporan rusak client:{" "}
              {numberFormat.format(clientDamageTotal)}
            </p>
          </div>
          <TransactionsTable transactions={recentTransactions} />
        </section>
      </section>

      <section className="panel page-section">
        <div className="panel-title">
          <h2>Sewa Aktif</h2>
          <p>Daftar client yang masih menyewa pallet.</p>
        </div>
        <div className="compact-list">
          {activeRentalRows.length === 0 ? (
            <p>Belum ada sewa aktif.</p>
          ) : (
            activeRentalRows.map((rental) => (
              <div className="compact-row" key={rentalKey(rental.client, rental.palletType)}>
                <span>{rental.client}</span>
                <strong>
                  Tipe {rental.palletType} -{" "}
                  {numberFormat.format(rental.activeQuantity)} pallet
                </strong>
                <small>{rental.yearsSummary}</small>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}

function TransactionForm({
  activeClients,
  damageRental,
  form,
  onChangeMovement,
  onSubmit,
  onUpdateForm,
}) {
  return (
    <form className="panel form-panel" onSubmit={onSubmit}>
      <div className="panel-title">
        <h2>Transaksi Pallet</h2>
        <p>Pilih keluar sewa, masuk stok, atau laporan rusak client.</p>
      </div>

      <div className="mode-switch">
        <button
          className={form.movement === "keluar" ? "active" : ""}
          type="button"
          onClick={() => onChangeMovement("keluar")}
        >
          Keluar Sewa
        </button>
        <button
          className={form.movement === "masuk" ? "active" : ""}
          type="button"
          onClick={() => onChangeMovement("masuk")}
        >
          Masuk Stok
        </button>
        <button
          className={form.movement === "laporan_rusak" ? "active" : ""}
          type="button"
          onClick={() => onChangeMovement("laporan_rusak")}
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
            onChange={(event) => onUpdateForm("date", event.target.value)}
          />
        </label>

        <label>
          Tipe pallet
          <select
            value={form.palletType}
            onChange={(event) => onUpdateForm("palletType", event.target.value)}
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
            onChange={(event) => onUpdateForm("quantity", event.target.value)}
          />
        </label>

        {form.movement === "keluar" && (
          <>
            <ClientField
              label="Client"
              value={form.client}
              onChange={(value) => onUpdateForm("client", value)}
            />

            <label>
              Durasi sewa
              <select
                value={form.years}
                onChange={(event) => onUpdateForm("years", event.target.value)}
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
              onChange={(event) => onUpdateForm("condition", event.target.value)}
            >
              <option value="baik">Baik, masuk stok siap</option>
              <option value="rusak ringan">Rusak ringan, perlu repair</option>
              <option value="rusak berat">Rusak berat, perlu repair</option>
            </select>
          </label>
        )}

        {form.movement === "laporan_rusak" && (
          <>
            <ClientField
              label="Client pelapor"
              value={form.client}
              onChange={(value) => onUpdateForm("client", value)}
            />

            <label>
              Kondisi laporan
              <select
                value={form.condition}
                onChange={(event) => onUpdateForm("condition", event.target.value)}
              >
                <option value="rusak ringan">Rusak ringan</option>
                <option value="rusak berat">Rusak berat</option>
              </select>
            </label>

            <RentalValidation
              client={form.client}
              palletType={form.palletType}
              rental={damageRental}
            />
          </>
        )}

        <label className="full-field">
          Catatan
          <input
            maxLength="140"
            type="text"
            placeholder="Opsional"
            value={form.note}
            onChange={(event) => onUpdateForm("note", event.target.value)}
          />
        </label>
      </div>

      <datalist id="active-client-list">
        {activeClients.map((client) => (
          <option key={client.id} value={client.name} />
        ))}
      </datalist>

      <button className="primary-button" type="submit">
        <Save aria-hidden="true" size={16} />
        Simpan
      </button>
    </form>
  );
}

function ClientField({ label, onChange, value }) {
  return (
    <label>
      {label}
      <input
        list="active-client-list"
        maxLength="80"
        required
        type="text"
        placeholder="Pilih client aktif"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function DataPage({ filters, onUpdateFilter, transactions }) {
  return (
    <section className="panel page-section">
      <div className="panel-title section-title-row">
        <div>
          <h2>Data Transaksi</h2>
          <p>Filter dan audit data pallet masuk, keluar, dan rusak client.</p>
        </div>
        <strong>{numberFormat.format(transactions.length)} data</strong>
      </div>

      <div className="filter-grid">
        <label className="search-field">
          Cari data
          <span>
            <Search aria-hidden="true" size={16} />
            <input
              type="text"
              placeholder="Client, catatan, tipe, tanggal"
              value={filters.search}
              onChange={(event) => onUpdateFilter("search", event.target.value)}
            />
          </span>
        </label>

        <label>
          Transaksi
          <select
            value={filters.movement}
            onChange={(event) => onUpdateFilter("movement", event.target.value)}
          >
            <option value="all">Semua</option>
            <option value="keluar">Keluar sewa</option>
            <option value="masuk">Masuk stok</option>
            <option value="laporan_rusak">Rusak client</option>
          </select>
        </label>

        <label>
          Tipe pallet
          <select
            value={filters.palletType}
            onChange={(event) => onUpdateFilter("palletType", event.target.value)}
          >
            <option value="all">Semua tipe</option>
            <option value="A">Tipe A</option>
            <option value="B">Tipe B</option>
          </select>
        </label>
      </div>

      <TransactionsTable transactions={transactions} showNote />
    </section>
  );
}

function ClientsPage({
  clientForm,
  clients,
  editingClientId,
  onCancelEdit,
  onEditClient,
  onRemoveClient,
  onSubmitClient,
  onUpdateClientForm,
}) {
  return (
    <section className="client-layout">
      <form className="panel form-panel" onSubmit={onSubmitClient}>
        <div className="panel-title">
          <h2>{editingClientId ? "Edit Client" : "Manage Client"}</h2>
          <p>Tambah client, PIC, kontak, status, dan catatan operasional.</p>
        </div>

        <div className="form-grid">
          <label>
            Nama client
            <input
              maxLength="80"
              required
              type="text"
              value={clientForm.name}
              onChange={(event) => onUpdateClientForm("name", event.target.value)}
            />
          </label>
          <label>
            PIC
            <input
              maxLength="80"
              type="text"
              value={clientForm.pic}
              onChange={(event) => onUpdateClientForm("pic", event.target.value)}
            />
          </label>
          <label>
            Telepon
            <input
              maxLength="40"
              type="text"
              value={clientForm.phone}
              onChange={(event) => onUpdateClientForm("phone", event.target.value)}
            />
          </label>
          <label>
            Email
            <input
              maxLength="80"
              type="email"
              value={clientForm.email}
              onChange={(event) => onUpdateClientForm("email", event.target.value)}
            />
          </label>
          <label>
            Status
            <select
              value={clientForm.status}
              onChange={(event) => onUpdateClientForm("status", event.target.value)}
            >
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
          </label>
          <label>
            Alamat
            <input
              maxLength="120"
              type="text"
              value={clientForm.address}
              onChange={(event) =>
                onUpdateClientForm("address", event.target.value)
              }
            />
          </label>
          <label className="full-field">
            Catatan
            <input
              maxLength="160"
              type="text"
              value={clientForm.note}
              onChange={(event) => onUpdateClientForm("note", event.target.value)}
            />
          </label>
        </div>

        <div className="button-row">
          <button className="primary-button" type="submit">
            {editingClientId ? (
              <Edit3 aria-hidden="true" size={16} />
            ) : (
              <Plus aria-hidden="true" size={16} />
            )}
            {editingClientId ? "Update" : "Tambah"}
          </button>
          {editingClientId && (
            <button className="secondary-button" type="button" onClick={onCancelEdit}>
              Batal
            </button>
          )}
        </div>
      </form>

      <section className="panel">
        <div className="panel-title">
          <h2>Daftar Client</h2>
          <p>Client aktif dipakai untuk validasi sewa dan laporan rusak.</p>
        </div>

        <div className="client-list">
          {clients.map((client) => (
            <article className="client-card" key={client.id}>
              <div>
                <h3>{client.name}</h3>
                <p>{client.pic || "PIC belum diisi"}</p>
              </div>
              <span className={`status-pill ${client.status}`}>
                {client.status}
              </span>
              <dl>
                <div>
                  <dt>Sewa aktif</dt>
                  <dd>{numberFormat.format(client.activeQuantity)} pallet</dd>
                </div>
                <div>
                  <dt>Kontak</dt>
                  <dd>{client.phone || client.email || "-"}</dd>
                </div>
                <div>
                  <dt>Ringkasan</dt>
                  <dd>{client.rentalSummary}</dd>
                </div>
              </dl>
              <div className="row-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => onEditClient(client)}
                >
                  <Edit3 aria-hidden="true" size={15} />
                  Edit
                </button>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => onRemoveClient(client)}
                >
                  <Trash2 aria-hidden="true" size={15} />
                  Hapus
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function RepairPage({ clientDamageTotal, repairTotal, transactions }) {
  return (
    <section className="panel page-section">
      <div className="panel-title section-title-row">
        <div>
          <h2>Repair & Damage</h2>
          <p>Data pallet rusak ringan, rusak berat, dan laporan dari client.</p>
        </div>
        <div className="mini-stats">
          <span>
            Repair <strong>{numberFormat.format(repairTotal)}</strong>
          </span>
          <span>
            Dari client <strong>{numberFormat.format(clientDamageTotal)}</strong>
          </span>
        </div>
      </div>
      <TransactionsTable transactions={transactions} showNote />
    </section>
  );
}

function SecurityPage() {
  return (
    <>
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
    </>
  );
}

function TransactionsTable({ showNote = false, transactions }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Transaksi</th>
            <th>Tipe</th>
            <th>Jumlah</th>
            <th>Client/Kondisi</th>
            {showNote && <th>Catatan</th>}
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan={showNote ? 6 : 5}>Tidak ada data.</td>
            </tr>
          ) : (
            transactions.map((trx) => (
              <tr key={trx.id}>
                <td>{trx.date}</td>
                <td>{movementLabel(trx.movement)}</td>
                <td>Pallet {trx.palletType}</td>
                <td>{numberFormat.format(trx.quantity)}</td>
                <td>{detailsLabel(trx)}</td>
                {showNote && <td>{trx.note || "-"}</td>}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function RentalValidation({ client, palletType, rental }) {
  const cleanClient = sanitizeText(client, 80);

  if (!cleanClient) {
    return (
      <div className="rental-check rental-check-warning full-field">
        Isi nama client untuk validasi sewa aktif.
      </div>
    );
  }

  if (!rental) {
    return (
      <div className="rental-check rental-check-warning full-field">
        Client ini belum punya sewa aktif untuk pallet tipe {palletType}.
      </div>
    );
  }

  return (
    <div className="rental-check rental-check-valid full-field">
      <strong>Validasi sewa cocok</strong>
      <span>
        {rental.client} sedang menyewa{" "}
        {numberFormat.format(rental.activeQuantity)} pallet tipe {palletType}.
      </span>
      <span>Durasi sewa aktif: {rental.yearsSummary}.</span>
    </div>
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
