import Image from "next/image";
import Link from "next/link";
import type React from "react";
import {
    ArrowLeft,
    Bot,
    Boxes,
    Building2,
    CheckCircle2,
    Code2,
    ExternalLink,
    Globe,
    Mail,
    ShieldCheck,
    Sparkles,
} from "lucide-react";

const appModules = [
    "Pedidos multi-borrador",
    "Despacho operativo",
    "Inventario y conteos",
    "CRM de clientes",
    "Cuadre diario",
    "Analitica y calidad de datos",
];

const techStack = ["Next.js", "React", "TypeScript", "Tailwind CSS", "Supabase", "API Flex CRM"];

export default function AboutPage() {
    return (
        <main className="min-h-screen bg-background">
            <section className="border-b border-border bg-background/95">
                <div className="container mx-auto max-w-7xl px-4 py-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-xs font-black text-brand">
                                <Sparkles className="h-3.5 w-3.5" />
                                Acerca de
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-white">Fast Order</h1>
                            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                                Plataforma operativa para pedidos, inventario, despacho, CRM y cuadre diario.
                            </p>
                        </div>

                        <Link
                            href="/pedidos"
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:bg-muted"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Volver a Pedidos
                        </Link>
                    </div>
                </div>
            </section>

            <section className="container mx-auto max-w-7xl px-4 py-6">
                <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                    <article className="overflow-hidden rounded-lg border border-border bg-card">
                        <div className="border-b border-border p-6">
                            <div className="relative h-20 w-72">
                                <Image
                                    src="/brand/fastorder-logo-horizontal-ui.png"
                                    alt="Fast Order"
                                    fill
                                    priority
                                    sizes="288px"
                                    className="object-contain object-left"
                                />
                            </div>
                            <p className="mt-5 max-w-3xl text-sm leading-6 text-muted-foreground">
                                Fast Order fue construido para acompanar la operacion diaria del granero sin reemplazar
                                su ERP. La aplicacion interpreta, consolida y presenta datos operativos en tiempo real
                                para ayudar a tomar mejores decisiones durante la jornada.
                            </p>
                        </div>

                        <div className="grid gap-4 p-6 md:grid-cols-3">
                            {[
                                { label: "Version", value: "0.1.0", icon: Code2 },
                                { label: "Estado", value: "Operacion activa", icon: CheckCircle2 },
                                { label: "Integracion", value: "Milenium via API", icon: Boxes },
                            ].map((item) => (
                                <div key={item.label} className="rounded-lg border border-border bg-background p-4">
                                    <item.icon className="h-5 w-5 text-brand" />
                                    <p className="mt-3 text-xs font-black uppercase text-muted-foreground">{item.label}</p>
                                    <p className="mt-1 text-lg font-black text-white">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </article>

                    <article className="overflow-hidden rounded-lg border border-border bg-card">
                        <div className="border-b border-border p-6">
                            <p className="text-xs font-black uppercase text-muted-foreground">Desarrollado por</p>
                            <div className="relative mt-5 h-24 w-full max-w-md">
                                <Image
                                    src="/brand/synergia-logo-horizontal-ui.png"
                                    alt="Synerg-IA Automation"
                                    fill
                                    sizes="448px"
                                    className="object-contain object-left"
                                />
                            </div>
                            <p className="mt-5 text-sm leading-6 text-muted-foreground">
                                Startup colombiana enfocada en automatizacion con inteligencia artificial para PYMEs.
                                Su principio de trabajo: automatizar procesos y potenciar crecimiento con soluciones
                                sobrias, medibles y adaptadas al negocio real.
                            </p>
                        </div>

                        <div className="space-y-3 p-6">
                            <InfoRow icon={Building2} label="Empresa" value="Synerg-IA Automation S.A.S." />
                            <InfoRow icon={Bot} label="Enfoque" value="Automatizacion IA para PYMEs" />
                            <InfoRow icon={ShieldCheck} label="Responsable" value="Johnathan Beltran" />
                            <InfoRow icon={Globe} label="Dominio" value="synergiaautomation.com" href="https://synergiaautomation.com" />
                            <InfoRow icon={Mail} label="Contacto" value="contacto@synergiaautomation.com" href="mailto:contacto@synergiaautomation.com" />
                        </div>
                    </article>
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    <section className="rounded-lg border border-border bg-card p-6">
                        <h2 className="text-lg font-black text-white">Modulos incluidos</h2>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            {appModules.map((module) => (
                                <div key={module} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                                    <span className="text-sm font-semibold text-slate-200">{module}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-lg border border-border bg-card p-6">
                        <h2 className="text-lg font-black text-white">Base tecnica</h2>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {techStack.map((item) => (
                                <span
                                    key={item}
                                    className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-200"
                                >
                                    {item}
                                </span>
                            ))}
                        </div>
                        <p className="mt-4 text-sm leading-6 text-muted-foreground">
                            La integracion con Milenium se realiza por API Flex CRM. Fast Order mantiene la capa
                            operativa y visual sobre Supabase, sin modificar datos brutos del ERP fuera de los flujos
                            acordados.
                        </p>
                    </section>
                </div>
            </section>
        </main>
    );
}

function InfoRow({
    icon: Icon,
    label,
    value,
    href,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    href?: string;
}) {
    const content = (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 transition hover:bg-muted/30">
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-200">
                    <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-muted-foreground">{label}</p>
                    <p className="truncate text-sm font-bold text-slate-100">{value}</p>
                </div>
            </div>
            {href && <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </div>
    );

    if (!href) return content;

    return (
        <Link href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
            {content}
        </Link>
    );
}
