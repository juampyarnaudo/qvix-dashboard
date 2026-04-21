"use client";
import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileDown, BarChart2, PlusCircle, Sheet, Users } from "lucide-react";
import SummaryCards from "./components/SummaryCards";
import EvolutionChart from "./components/EvolutionChart";
import TotalesChart from "./components/TotalesChart";
import DiffTable from "./components/DiffTable";
import DataTable from "./components/DataTable";
import OrgDetail from "./components/OrgDetail";
import DataEntryModal from "./components/DataEntryModal";
import DonutChart from "./components/DonutChart";
import ProjectionTable from "./components/ProjectionTable";
import GoalsPanel from "./components/GoalsPanel";
import RankingTable from "./components/RankingTable";
import HistoryPanel from "./components/HistoryPanel";
import ThemeToggle from "./components/ThemeToggle";
import DuplicadosView from "./components/DuplicadosView";
import LicenciasView from "./components/LicenciasView";
import SucursalesView from "./components/SucursalesView";
import Image from "next/image";
import { buildOrgStats, buildSummaries, buildTotales } from "./lib/dataUtils";
import { exportToPDF } from "./lib/exportPDF";
import { exportToExcel } from "./lib/exportExcel";
import { parseCSV } from "./lib/csvParser";
import type { DataRow, Servicio } from "./lib/types";

type Tab = "graficos" | "tabla" | "variacion" | "distribucion" | "proyeccion" | "analisis";

function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<DataRow[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>((searchParams.get("tab") as Tab) ?? "graficos");
  const [showModal, setShowModal] = useState(false);
  const [editRow, setEditRow] = useState<DataRow | null>(null);
  const [showDuplicados, setShowDuplicados] = useState(false);
  const [showLicencias, setShowLicencias] = useState(false);
  const [showSucursales, setShowSucursales] = useState(false);
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>(
    searchParams.get("orgs") ? searchParams.get("orgs")!.split(",") : []
  );
  const [servicio, setServicio] = useState<Servicio>(
    (searchParams.get("svc") as Servicio) ?? "GOTV"
  );

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (servicio !== "GOTV") params.set("svc", servicio);
    if (activeTab !== "graficos") params.set("tab", activeTab);
    if (selectedOrgs.length > 0) params.set("orgs", selectedOrgs.join(","));
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/", { scroll: false });
  }, [servicio, activeTab, selectedOrgs, router]);

  const loadData = useCallback(() => {
    fetch("/api/data")
      .then((res) => res.text())
      .then((text) => {
        const data = parseCSV(text);
        if (data.length > 0) setRows(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtrar por servicio activo
  const servicioRows = rows.filter((r) => r.servicio === servicio);

  const orgStats = buildOrgStats(servicioRows);
  const summaries = buildSummaries(orgStats);
  const totales = buildTotales(servicioRows);
  const hasData = servicioRows.length > 0;
  const orgsActuales = [...new Set(servicioRows.map((r) => r.organizacion))];

  // Filtrar por orgs seleccionadas
  const hasOrgFilter = selectedOrgs.length > 0;
  const filteredRows = hasOrgFilter ? servicioRows.filter((r) => selectedOrgs.includes(r.organizacion)) : servicioRows;
  const filteredOrgStats = hasOrgFilter ? orgStats.filter((o) => selectedOrgs.includes(o.organizacion)) : orgStats;
  const filteredSummaries = hasOrgFilter ? summaries.filter((s) => selectedOrgs.includes(s.organizacion)) : summaries;
  const filteredTotales = buildTotales(filteredRows);
  // Vista detalle solo si hay exactamente 1 org seleccionada
  const singleOrg = selectedOrgs.length === 1 ? selectedOrgs[0] : null;
  const selectedOrgStat = singleOrg ? orgStats.find((o) => o.organizacion === singleOrg) : null;
  const selectedOrgIndex = singleOrg ? orgStats.findIndex((o) => o.organizacion === singleOrg) : -1;

  // ── Vista activa (mutuamente exclusivas) ───────────────────────────────────
  const goHome = () => { setShowDuplicados(false); setShowLicencias(false); setShowSucursales(false); };
  const goTo = (view: "duplicados" | "licencias" | "sucursales") => {
    setShowDuplicados(view === "duplicados");
    setShowLicencias(view === "licencias");
    setShowSucursales(view === "sucursales");
  };

  const toggleOrg = (org: string) => {
    setSelectedOrgs((prev) =>
      prev.includes(org) ? prev.filter((o) => o !== org) : [...prev, org]
    );
  };

  // Totales por servicio (último período de cada uno) para el universo combinado
  const getLastPeriodTotals = (svc: Servicio) => {
    const svcRows = rows.filter((r) => r.servicio === svc);
    if (svcRows.length === 0) return { stb: 0, movil: 0 };
    const lastFecha = [...new Set(svcRows.map((r) => r.fecha))].sort().at(-1)!;
    const filtered = svcRows.filter((r) => r.fecha === lastFecha);
    return {
      stb: filtered.reduce((s, r) => s + r.stb, 0),
      movil: filtered.reduce((s, r) => s + r.movil, 0),
    };
  };
  const gotvLast = getLastPeriodTotals("GOTV");
  const viewtvLast = getLastPeriodTotals("ViewTV");
  const stbUniverso = gotvLast.stb + viewtvLast.stb;
  const movilUniverso = gotvLast.movil + viewtvLast.movil;
  const universoTotal = stbUniverso + movilUniverso;
  const gotvStbPct = stbUniverso > 0 ? Math.round((gotvLast.stb / stbUniverso) * 100) : null;
  const viewtvStbPct = stbUniverso > 0 ? Math.round((viewtvLast.stb / stbUniverso) * 100) : null;
  const gotvMovilPct = movilUniverso > 0 ? Math.round((gotvLast.movil / movilUniverso) * 100) : null;
  const viewtvMovilPct = movilUniverso > 0 ? Math.round((viewtvLast.movil / movilUniverso) * 100) : null;

  const handleDelete = async (row: DataRow) => {
    if (!confirm(`¿Eliminar ${row.organizacion} / ${row.fecha}?`)) return;
    await fetch("/api/data", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ servicio: row.servicio, organizacion: row.organizacion, fecha: row.fecha }),
    });
    loadData();
  };

  const handleServicioChange = (s: Servicio) => {
    setServicio(s);
    setSelectedOrgs([]);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-6 py-2 flex items-center justify-between gap-4">
          {/* Logo + Título */}
          <div className="flex items-center gap-3">
            <Image src="/ultranet.png" alt="Ultranet" width={120} height={32} className="opacity-80 object-contain cursor-pointer" onClick={goHome} />
            <div className="w-px h-7 bg-slate-700" />
            <div>
              <h1 className="text-base font-bold tracking-tight leading-tight">GOTV Dashboard</h1>
              <p className="text-xs text-slate-400 leading-tight">Seguimiento de usuarios STB y Móvil</p>
            </div>
          </div>

          {/* Botones */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <ThemeToggle />
            <HistoryPanel onRestored={loadData} />
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <PlusCircle size={15} />
              Cargar datos
            </button>
            <button
              onClick={() => goTo("duplicados")}
              className="flex items-center gap-1.5 bg-rose-700 hover:bg-rose-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Users size={15} />
              Duplicados
            </button>
            {hasData && (
              <>
                <button
                  onClick={() => exportToExcel(filteredRows, filteredOrgStats, servicio)}
                  className="flex items-center gap-1.5 bg-teal-700 hover:bg-teal-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Sheet size={15} />
                  Excel
                </button>
                <button
                  onClick={() => exportToPDF(filteredRows, filteredOrgStats, servicio)}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  <FileDown size={15} />
                  PDF
                </button>
              </>
            )}
          </div>
        </div>

        {/* Selector de servicio + universo % */}
        <div className="max-w-screen-xl mx-auto px-6 pb-2 flex items-center gap-3 flex-wrap">
          {(["GOTV", "ViewTV"] as Servicio[]).map((s) => (
            <button
              key={s}
              onClick={() => handleServicioChange(s)}
              className={`px-5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                servicio === s
                  ? s === "GOTV"
                    ? "bg-purple-700 border-purple-600 text-white"
                    : "bg-cyan-500 border-cyan-400 text-white"
                  : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
              }`}
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => goTo("licencias")}
            className="px-5 py-1.5 rounded-full text-sm font-semibold border border-indigo-700 text-indigo-400 hover:bg-indigo-900/40 hover:border-indigo-500 hover:text-indigo-300 transition-colors"
          >
            Licencias
          </button>
          <button
            onClick={() => goTo("sucursales")}
            className="px-5 py-1.5 rounded-full text-sm font-semibold border border-sky-700 text-sky-400 hover:bg-sky-900/40 hover:border-sky-500 hover:text-sky-300 transition-colors"
          >
            Monitoreo
          </button>
          {universoTotal > 0 && (
            <>
              <div className="w-px h-5 bg-slate-700 mx-1" />
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs font-medium">
                  <span className="text-slate-500 w-10">STB</span>
                  <span className="text-slate-400">GOTV</span>
                  <span className="text-purple-400 font-bold ml-1">{gotvStbPct}%</span>
                  <span className="text-slate-600 mx-0.5">/</span>
                  <span className="text-slate-400">ViewTV</span>
                  <span className="text-cyan-400 font-bold ml-1">{viewtvStbPct}%</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs font-medium">
                  <span className="text-slate-500 w-10">Móvil</span>
                  <span className="text-slate-400">GOTV</span>
                  <span className="text-purple-400 font-bold ml-1">{gotvMovilPct}%</span>
                  <span className="text-slate-600 mx-0.5">/</span>
                  <span className="text-slate-400">ViewTV</span>
                  <span className="text-cyan-400 font-bold ml-1">{viewtvMovilPct}%</span>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {showDuplicados && <DuplicadosView onClose={goHome} />}
      {showLicencias && (
        <LicenciasView
          gotvStb={gotvLast.stb}
          gotvMovil={gotvLast.movil}
          viewtvStb={viewtvLast.stb}
          viewtvMovil={viewtvLast.movil}
          onClose={goHome}
        />
      )}
      {showSucursales && (
        <SucursalesView
          gotvOrgs={[...new Set(rows.filter(r => r.servicio === "GOTV").map(r => r.organizacion))].sort()}
          onClose={goHome}
        />
      )}

      <main className={`max-w-screen-xl mx-auto px-6 py-8 space-y-8 ${showDuplicados || showLicencias || showSucursales ? "hidden" : ""}`}>
        {hasData && (
          <>
            {/* Filtro de organizaciones */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-slate-400 font-medium text-xs uppercase tracking-wider">Organización</h2>
                {selectedOrgs.length > 0 && (
                  <button
                    onClick={() => setSelectedOrgs([])}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Limpiar selección
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {orgsActuales.length > 1 && (
                  <button
                    onClick={() => setSelectedOrgs([])}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      selectedOrgs.length === 0
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Todas
                  </button>
                )}
                {orgsActuales.map((org) => (
                  <button
                    key={org}
                    onClick={() => toggleOrg(org)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      selectedOrgs.includes(org)
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {org}
                  </button>
                ))}
              </div>
              {selectedOrgs.length > 1 && (
                <p className="text-xs text-slate-500 mt-2">{selectedOrgs.length} organizaciones seleccionadas — vista comparativa</p>
              )}
            </section>

            {/* Vista detalle de una organización (solo 1 seleccionada) */}
            {singleOrg && selectedOrgStat ? (
              <OrgDetail org={selectedOrgStat} index={selectedOrgIndex} />
            ) : (
              <>
                {/* Summary cards */}
                <section>
                  <h2 className="text-slate-300 font-medium text-sm uppercase tracking-wider mb-3">
                    Resumen — último período
                  </h2>
                  <SummaryCards summaries={filteredSummaries} />
                </section>

                {/* Totales globales */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Total STB", value: filteredTotales[filteredTotales.length - 1]?.stb ?? 0, color: "text-indigo-400" },
                    { label: "Total Móvil", value: filteredTotales[filteredTotales.length - 1]?.movil ?? 0, color: "text-emerald-400" },
                    { label: "Total Usuarios", value: (filteredTotales[filteredTotales.length - 1]?.stb ?? 0) + (filteredTotales[filteredTotales.length - 1]?.movil ?? 0), color: "text-amber-400" },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-slate-800 border border-slate-700 rounded-xl p-5 text-center">
                      <div className="text-slate-400 text-sm mb-1">{stat.label}</div>
                      <div className={`text-3xl font-bold ${stat.color}`}>{stat.value.toLocaleString()}</div>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <section>
                  <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 w-fit mb-5">
                    {([
                      { key: "graficos", label: "Gráficos" },
                      { key: "tabla", label: "Tabla de datos" },
                      { key: "variacion", label: "Variación %" },
                      { key: "distribucion", label: "Distribución" },
                      { key: "proyeccion", label: "Proyección" },
                      { key: "analisis", label: "Análisis" },
                    ] as { key: Tab; label: string }[]).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          activeTab === tab.key
                            ? "bg-indigo-600 text-white"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {activeTab === "graficos" && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <EvolutionChart rows={filteredRows} tipo="stb" title="Evolución STB (decos) por organización" />
                        <EvolutionChart rows={filteredRows} tipo="movil" title="Evolución Móvil (app) por organización" />
                      </div>
                      <TotalesChart totales={filteredTotales} />
                    </div>
                  )}
                  {activeTab === "tabla" && (
                    <DataTable
                      rows={filteredRows}
                      onEdit={(row) => setEditRow(row)}
                      onDelete={handleDelete}
                    />
                  )}
                  {activeTab === "variacion" && <DiffTable orgStats={filteredOrgStats} />}
                  {activeTab === "proyeccion" && <ProjectionTable orgStats={filteredOrgStats} />}
                  {activeTab === "analisis" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      <RankingTable orgStats={filteredOrgStats} />
                      <GoalsPanel orgStats={filteredOrgStats} servicio={servicio} />
                    </div>
                  )}
                  {activeTab === "distribucion" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      <DonutChart rows={filteredRows} tipo="stb" title="Distribución STB por organización" />
                      <DonutChart rows={filteredRows} tipo="movil" title="Distribución Móvil por organización" />
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}

        {!hasData && (
          <div className="text-center py-24 text-slate-600">
            <BarChart2 size={52} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg">Sin datos para {servicio}</p>
            <p className="text-sm mt-1">
              Usá el botón <span className="text-indigo-400 font-medium">Cargar datos</span> para agregar información
            </p>
          </div>
        )}
      </main>

      {showModal && (
        <DataEntryModal
          organizaciones={orgsActuales}
          servicioActivo={servicio}
          onSaved={loadData}
          onClose={() => setShowModal(false)}
        />
      )}
      {editRow && (
        <DataEntryModal
          organizaciones={orgsActuales}
          servicioActivo={editRow.servicio}
          onSaved={loadData}
          onClose={() => setEditRow(null)}
          editRow={editRow}
        />
      )}
    </div>
  );
}

// Wrapper con Suspense requerido por useSearchParams en Next.js App Router
import { Suspense } from "react";
export default function Page() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}
