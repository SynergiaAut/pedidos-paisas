"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  History,
  Package,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { getInventoryStats, triggerInventorySync, type InventoryStats } from "@/app/actions/inventory";
import { BehaviorTab } from "@/components/inventory/BehaviorTab";
import { CyclicCountWizard } from "@/components/inventory/CyclicCountWizard";
import { DataQualityTab } from "@/components/inventory/DataQualityTab";
import { InventoryAnalysisTab } from "@/components/inventory/InventoryAnalysisTab";
import { UnifiedStockTable } from "@/components/inventory/UnifiedStockTable";
import { cn } from "@/lib/utils";

type InventoryTab = "catalog" | "analysis" | "behavior" | "quality";

type PendingSession = {
  id: string;
  name: string;
  mode: "desktop" | "mobile_link";
  link_token: string | null;
};

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  onClick?: () => void;
  cursorPointer?: boolean;
}

const tabs: Array<{ id: InventoryTab; label: string }> = [
  { id: "catalog", label: "Catalogo" },
  { id: "analysis", label: "Analisis" },
  { id: "behavior", label: "Comportamiento" },
  { id: "quality", label: "Calidad de Datos" },
];

function StatsCard({ title, value, subtitle, icon: Icon, tone, onClick, cursorPointer }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={cn(
        "rounded-lg border border-border bg-card p-4 transition",
        cursorPointer && "cursor-pointer hover:border-brand/40 hover:bg-muted/15"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-black text-white">{value}</p>
          {subtitle && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", tone)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Nunca";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${Math.floor(hours / 24)}d`;
}

export default function InventarioPage() {
  const [activeTab, setActiveTab] = useState<InventoryTab>("catalog");
  const [showWizard, setShowWizard] = useState(false);
  const [selectedPendingSession, setSelectedPendingSession] = useState<PendingSession | null>(null);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const loadStats = async () => {
    const result = await getInventoryStats();
    if (!("error" in result)) setStats(result);
  };

  useEffect(() => {
    void loadStats();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg("Sincronizando con Milenium... puede tardar hasta 1 minuto por base.");
    try {
      const result = await triggerInventorySync("all");
      if ("error" in result) {
        setSyncMsg(`Error: ${result.error}`);
      } else {
        const parts = result.results.map((item) =>
          item.error ? `BD${item.db_source}: pendiente (${item.error})` : `BD${item.db_source}: ${item.upserted} productos`
        );
        setSyncMsg(
          `${result.status === "success" ? "Sincronizacion completa" : "Sincronizacion parcial"}: ${parts.join(
            " · "
          )}. Se conservan los ultimos datos validos de las bases que no respondan. (${(result.duration_ms / 1000).toFixed(1)}s)`
        );
        await loadStats();
      }
    } catch (error) {
      setSyncMsg(`Error inesperado: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleGoToHistory = () => {
    setActiveTab("analysis");
    setTimeout(() => {
      document.getElementById("historial-sesiones")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-background/95">
        <div className="container mx-auto max-w-7xl px-4 py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-xs font-black text-brand">
                <Package className="h-3.5 w-3.5" />
                Inventario
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white">Gestion de Inventario</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Sincronizacion multi-base, control ciclico, comportamiento de ventas y calidad de datos.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 text-sm font-black text-emerald-200 transition hover:bg-emerald-500/15 disabled:opacity-60"
              >
                <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
                {syncing ? "Sincronizando" : "Sincronizar"}
              </button>

              <button
                onClick={handleGoToHistory}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:bg-muted"
              >
                <History className="h-4 w-4" />
                Historial
              </button>

              <button
                onClick={() => setShowWizard(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-black text-black shadow-sm shadow-brand/20 transition hover:bg-brand/90"
              >
                <Plus className="h-4 w-4" />
                Nuevo Conteo
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <StatsCard
              title="Total Productos"
              value={stats ? stats.totalProducts.toLocaleString("es-CO") : "..."}
              subtitle={
                stats
                  ? `+ ${stats.totalServices.toLocaleString("es-CO")} servicios/fletes · ${(
                      stats.totalProducts + stats.totalServices
                    ).toLocaleString("es-CO")} items ERP`
                  : undefined
              }
              icon={Package}
              tone="bg-blue-500/10 text-blue-300"
            />
            <StatsCard
              title="Unidades en Stock"
              value={
                stats
                  ? `${Math.round(stats.stockUnitsByDb["01"] ?? 0).toLocaleString("es-CO")} / ${Math.round(
                      stats.stockUnitsByDb["02"] ?? 0
                    ).toLocaleString("es-CO")}`
                  : "..."
              }
              subtitle={stats ? "Interna BD1 / Fiscal BD2" : undefined}
              icon={Boxes}
              tone="bg-cyan-500/10 text-cyan-300"
            />
            <StatsCard
              title="Descuadres"
              value={stats ? stats.discrepancies.toLocaleString("es-CO") : "..."}
              subtitle="Conteo fisico diferente al sistema"
              icon={AlertTriangle}
              tone="bg-amber-500/10 text-amber-300"
            />
            <StatsCard
              title="Conteos Pendientes"
              value={stats ? stats.pendingSessions.toLocaleString("es-CO") : "..."}
              subtitle={stats && stats.pendingSession ? `Reanudar: ${stats.pendingSession.name}` : "Sesiones sin completar"}
              icon={ClipboardCheck}
              tone="bg-emerald-500/10 text-emerald-300"
              cursorPointer={Boolean(stats && stats.pendingSessions > 0)}
              onClick={() => {
                if (stats?.pendingSession) {
                  setSelectedPendingSession(stats.pendingSession as PendingSession);
                  setShowWizard(true);
                }
              }}
            />
            <StatsCard
              title="Ultima Sincronizacion"
              value={stats ? timeAgo(stats.lastSyncAt) : "..."}
              subtitle="Milenium via API Flex CRM"
              icon={History}
              tone="bg-violet-500/10 text-violet-300"
            />
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-7xl px-4 py-6">
        <AnimatePresence>
          {showWizard && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                className="relative w-full max-w-4xl"
              >
                <button
                  onClick={() => {
                    setShowWizard(false);
                    setSelectedPendingSession(null);
                  }}
                  className="absolute -top-12 right-0 rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 transition hover:text-white"
                  title="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
                <CyclicCountWizard
                  onComplete={() => {
                    setShowWizard(false);
                    setSelectedPendingSession(null);
                    void loadStats();
                  }}
                  initialSession={selectedPendingSession}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {syncMsg && (
          <div className="mb-5 rounded-lg border border-brand/25 bg-brand/10 px-4 py-3 text-sm font-semibold text-brand">
            {syncMsg}
          </div>
        )}

        <div className="mb-5 flex flex-wrap gap-2 rounded-lg border border-border bg-card p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "h-9 rounded-md px-4 text-sm font-black transition",
                activeTab === tab.id ? "bg-brand text-black" : "text-muted-foreground hover:bg-muted/40 hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {activeTab === "catalog" ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-white">Catalogo de Productos</h2>
                  <p className="text-sm text-muted-foreground">Existencias consolidadas por base y reglas de unidad.</p>
                </div>
                <span className="text-xs font-bold uppercase text-muted-foreground">BD 01 + BD 02</span>
              </div>
              <UnifiedStockTable />
            </div>
          ) : activeTab === "analysis" ? (
            <InventoryAnalysisTab />
          ) : activeTab === "behavior" ? (
            <BehaviorTab />
          ) : (
            <DataQualityTab />
          )}
        </div>
      </section>
    </main>
  );
}
