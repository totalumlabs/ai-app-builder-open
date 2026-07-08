"use client";

import { useI18n } from "@/lib/i18n";
import { files } from "@/assets/files";
import Link from "next/link";
import {
  Sparkles, ArrowRight, Palette, DollarSign, Users, Rocket,
  Globe, Shield, Code2, Zap, Mail, Building2, Megaphone,
  Lock, Server, ChevronRight, Trophy, Gauge,
} from "lucide-react";

// The platform is fully open — no account/login required. Every CTA leads
// straight into the builder dashboard at /dashboard.
export default function LandingPage() {
  const { lang } = useI18n();

  const en = lang === "en";

  return (
    <div className="min-h-screen" style={{ background: "#fcfbf8" }}>
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 backdrop-blur-sm" style={{ background: "rgba(252,251,248,0.85)" }}>
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center"><Sparkles className="w-3.5 h-3.5 text-white" /></div>
            <span className="font-semibold text-gray-900 text-sm">VibeBuild</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#features" className="text-sm text-gray-500 hover:text-gray-800 hidden sm:block">{en ? "Features" : "Funciones"}</a>
            <a href="#use-cases" className="text-sm text-gray-500 hover:text-gray-800 hidden sm:block">{en ? "Use Cases" : "Casos de uso"}</a>
            <a href="#contact" className="text-sm text-gray-500 hover:text-gray-800 hidden sm:block">{en ? "Contact" : "Contacto"}</a>
            <Link href="/dashboard"><button className="flex items-center gap-1.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 px-4 py-1.5 rounded-lg transition-colors">{en ? "Open Builder" : "Abrir Constructor"} <ArrowRight className="w-3.5 h-3.5" /></button></Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-20 pb-24 px-5">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gray-200 text-sm text-gray-600 mb-4">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            {en ? "The First Whitelabel AI App Builder" : "El Primer Constructor de Apps IA Whitelabel"}
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1] mb-6">
            {en ? (
              <>{`Your brand. Your pricing.`}<br /><span className="text-gray-400">{`Your AI app builder.`}</span></>
            ) : (
              <>{`Tu marca. Tus precios.`}<br /><span className="text-gray-400">{`Tu constructor de apps IA.`}</span></>
            )}
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            {en
              ? "The world's first whitelabel AI app builder. Fully customizable, rebrandable, and resellable. Change the logo, set your prices, choose your niche — and launch your own SaaS builder in minutes."
              : "El primer constructor de apps IA whitelabel del mundo. Totalmente personalizable, remarcable y revendible. Cambia el logo, pon tus precios, elige tu nicho — y lanza tu propio builder SaaS en minutos."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/dashboard">
              <button className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-xl text-base font-medium transition-colors">
                {en ? "Start Building — Free, No Sign Up" : "Empezar a crear — Gratis, sin registro"} <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <a href="#contact">
              <button className="flex items-center gap-2 border border-gray-200 text-gray-700 hover:bg-gray-50 px-6 py-3 rounded-xl text-base font-medium transition-colors">
                {en ? "Contact Us" : "Contactanos"} <Mail className="w-4 h-4" />
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* ── Powered by Totalum + Performance ── */}
      <section className="py-16 px-5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-4">{en ? "Technology" : "Tecnologia"}</p>
            <img src={files.totalumLogo.url} alt="Totalum" className="h-8 sm:h-10 mx-auto mb-4 object-contain" />
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <Gauge className="w-6 h-6 text-gray-700 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">{en ? "Top Market Performance" : "Rendimiento Top del Mercado"}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {en
                  ? "Built on Totalum technology, one of the best performing AI code generation engines in the market. Fast builds, reliable deploys, production-grade infrastructure."
                  : "Construido sobre tecnologia Totalum, uno de los motores de generacion de codigo IA con mejor rendimiento del mercado. Builds rapidos, deploys fiables, infraestructura de produccion."}
              </p>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <Server className="w-6 h-6 text-gray-700 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">{en ? "Totalum VCaaS API" : "API VCaaS de Totalum"}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {en
                  ? "All infrastructure runs on the Totalum VCaaS API behind the scenes. Database, hosting, CDN, SSL, deployments, AI agent — everything managed automatically."
                  : "Toda la infraestructura funciona con la API VCaaS de Totalum entre bastidores. Base de datos, hosting, CDN, SSL, despliegues, agente IA — todo gestionado automaticamente."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── What is this ── */}
      <section className="py-20 px-5 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                {en ? "A template for your own AI builder" : "Una plantilla para tu propio constructor IA"}
              </h2>
              <p className="text-gray-500 leading-relaxed mb-6">
                {en
                  ? "This is not just another app builder — it's a fully whitelabel product you can customize and sell as your own. Replace the logo, set your own pricing, target your niche market, and offer AI-powered app creation under your brand."
                  : "Esto no es solo otro constructor de apps — es un producto totalmente whitelabel que puedes personalizar y vender como tuyo. Reemplaza el logo, pon tus precios, apunta a tu mercado nicho, y ofrece creacion de apps con IA bajo tu marca."}
              </p>
              <div className="space-y-3">
                {[
                  { icon: Palette, text: en ? "Custom logo, colors & branding" : "Logo, colores y marca personalizados" },
                  { icon: DollarSign, text: en ? "Set your own pricing plans" : "Define tus propios planes de precios" },
                  { icon: Globe, text: en ? "Your domain, your product" : "Tu dominio, tu producto" },
                  { icon: Users, text: en ? "Multi-tenant user management" : "Gestion de usuarios multi-tenant" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><item.icon className="w-4 h-4 text-gray-600" /></div>
                    <span className="text-sm text-gray-700">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center"><Sparkles className="w-5 h-5 text-white" /></div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{en ? "Your Brand Builder" : "Tu Constructor de Marca"}</p>
                  <p className="text-xs text-gray-400">{en ? "Fully customizable" : "Totalmente personalizable"}</p>
                </div>
              </div>
              <div className="space-y-2 text-xs text-gray-500">
                <div className="flex items-center gap-2"><ChevronRight className="w-3 h-3 text-gray-400" />{en ? "Replace with your logo" : "Reemplaza con tu logo"}</div>
                <div className="flex items-center gap-2"><ChevronRight className="w-3 h-3 text-gray-400" />{en ? "Set pricing: Free, $29/mo, $99/mo..." : "Pon precios: Gratis, 29$/mes, 99$/mes..."}</div>
                <div className="flex items-center gap-2"><ChevronRight className="w-3 h-3 text-gray-400" />{en ? "Connect your Stripe account" : "Conecta tu cuenta de Stripe"}</div>
                <div className="flex items-center gap-2"><ChevronRight className="w-3 h-3 text-gray-400" />{en ? "Custom domain: builder.yourbrand.com" : "Dominio propio: builder.tumarca.com"}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Use Cases ── */}
      <section id="use-cases" className="py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
            {en ? "Perfect for these niches" : "Perfecto para estos nichos"}
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-xl mx-auto">
            {en ? "Create an AI app builder with added value for specific industries and communities" : "Crea un constructor de apps IA con valor anadido para industrias y comunidades especificas"}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Megaphone, title: en ? "Marketing Agencies" : "Agencias de Marketing", desc: en ? "Offer AI app creation as a premium service. Build landing pages, dashboards and tools for your clients." : "Ofrece creacion de apps IA como servicio premium. Construye landings, dashboards y herramientas para tus clientes." },
              { icon: Lock, title: en ? "Private Communities" : "Comunidades Privadas", desc: en ? "Give your community members the power to build their own apps. Perfect for mastermind groups and courses." : "Da a los miembros de tu comunidad el poder de crear sus propias apps. Perfecto para masterminds y cursos." },
              { icon: Building2, title: en ? "New Business Line" : "Nueva Linea de Negocio", desc: en ? "Launch an AI app builder as a standalone product. Set your prices, build recurring revenue." : "Lanza un constructor de apps IA como producto independiente. Pon tus precios, genera ingresos recurrentes." },
              { icon: Code2, title: en ? "Dev Agencies" : "Agencias de Desarrollo", desc: en ? "Let clients prototype before you build. Reduce scope creep and close deals faster." : "Deja que tus clientes prototipan antes de que construyas. Reduce cambios de alcance y cierra tratos mas rapido." },
              { icon: Users, title: en ? "SaaS Founders" : "Fundadores SaaS", desc: en ? "Validate ideas in minutes, not months. Build MVPs instantly and test with real users." : "Valida ideas en minutos, no meses. Construye MVPs al instante y testea con usuarios reales." },
              { icon: Zap, title: en ? "Freelancers" : "Freelancers", desc: en ? "Multiply your output. Deliver complete apps to clients while you focus on strategy." : "Multiplica tu produccion. Entrega apps completas a clientes mientras te enfocas en estrategia." },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-sm transition-shadow">
                <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center mb-3"><item.icon className="w-4.5 h-4.5 text-gray-700" /></div>
                <h3 className="font-semibold text-gray-900 mb-1.5 text-sm">{item.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 px-5 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">{en ? "Everything included" : "Todo incluido"}</h2>
          <p className="text-gray-500 text-center mb-12 max-w-xl mx-auto">{en ? "Built on the Totalum VCaaS API — infrastructure, AI, hosting, and more, all managed for you" : "Construido sobre la API VCaaS de Totalum — infraestructura, IA, hosting y mas, todo gestionado para ti"}</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Sparkles, t: en ? "AI Agent" : "Agente IA", d: en ? "Natural language to full-stack app" : "Lenguaje natural a app full-stack" },
              { icon: Globe, t: en ? "Instant Preview" : "Vista previa", d: en ? "Live dev preview in iframe" : "Preview en vivo en iframe" },
              { icon: Rocket, t: en ? "One-Click Deploy" : "Deploy en 1 clic", d: en ? "Production URL with CDN" : "URL de produccion con CDN" },
              { icon: Server, t: en ? "Managed Database" : "Base de datos", d: en ? "Tables, queries, relations" : "Tablas, consultas, relaciones" },
              { icon: Shield, t: en ? "Auth Built-in" : "Auth incluido", d: en ? "Login, register, sessions" : "Login, registro, sesiones" },
              { icon: Lock, t: en ? "Secret Management" : "Secretos", d: en ? "Encrypted env variables" : "Variables de entorno cifradas" },
              { icon: Globe, t: en ? "Custom Domains" : "Dominios", d: en ? "SSL certificates automatic" : "Certificados SSL automaticos" },
              { icon: Code2, t: en ? "Version History" : "Versiones", d: en ? "Restore any previous state" : "Restaura cualquier estado" },
            ].map((f, i) => (
              <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-4 hover:bg-white hover:shadow-sm transition-all">
                <f.icon className="w-5 h-5 text-gray-600 mb-2" />
                <h4 className="font-medium text-gray-900 text-sm mb-1">{f.t}</h4>
                <p className="text-xs text-gray-400">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 px-5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{en ? "How to get your own builder" : "Como obtener tu propio constructor"}</h2>
          <p className="text-gray-500 mb-12 max-w-xl mx-auto">{en ? "Contact us to customize this builder with your branding, pricing and domain" : "Contactanos para personalizar este constructor con tu marca, precios y dominio"}</p>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { n: "1", t: en ? "Contact us" : "Contactanos", d: en ? "Reach out via email and tell us about your project" : "Escribenos por email y cuentanos sobre tu proyecto" },
              { n: "2", t: en ? "We customize" : "Customizamos", d: en ? "We set up your logo, colors, domain and pricing" : "Configuramos tu logo, colores, dominio y precios" },
              { n: "3", t: en ? "You launch" : "Tu lanzas", d: en ? "Start offering AI app building to your audience" : "Empieza a ofrecer creacion de apps IA a tu audiencia" },
            ].map((s, i) => (
              <div key={i}>
                <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold mx-auto mb-3">{s.n}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{s.t}</h3>
                <p className="text-sm text-gray-500">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="py-20 px-5 bg-white">
        <div className="max-w-2xl mx-auto text-center">
          <Mail className="w-10 h-10 text-gray-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-900 mb-3">{en ? "Ready to launch your builder?" : "Listo para lanzar tu constructor?"}</h2>
          <p className="text-gray-500 mb-8 max-w-lg mx-auto">
            {en
              ? "Contact us to learn how to fully customize this AI app builder with your brand, logo, colors, pricing and domain. We'll walk you through everything."
              : "Contactanos para saber como personalizar completamente este constructor de apps IA con tu marca, logo, colores, precios y dominio. Te guiaremos en todo."}
          </p>
          <a href="mailto:contacto@totalum.app" className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-xl text-base font-medium transition-colors">
            <Mail className="w-4 h-4" /> contacto@totalum.app
          </a>
          <p className="text-xs text-gray-400 mt-4">
            {en ? "Or try the builder right now:" : "O prueba el constructor ahora mismo:"}{" "}
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 underline">{en ? "Open the builder" : "Abrir el constructor"}</Link>
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 px-5 border-t border-gray-100">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <img src={files.totalumLogo.url} alt="Totalum" className="h-5 object-contain" />
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <Link href="/dashboard" className="hover:text-gray-600">{en ? "Open Builder" : "Abrir Constructor"}</Link>
            <a href="mailto:contacto@totalum.app" className="hover:text-gray-600">{en ? "Contact" : "Contacto"}</a>
            <Link href="/privacy-policy" className="hover:text-gray-600">{en ? "Privacy" : "Privacidad"}</Link>
          </div>
          <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} {en ? "Powered by Totalum" : "Desarrollado por Totalum"}</p>
        </div>
      </footer>
    </div>
  );
}
