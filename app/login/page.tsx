"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, pass }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const d = await res.json();
      setError(d.error ?? "Error al iniciar sesión");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ultranet.png" alt="Ultranet Analytics" style={{ width: 180 }} className="object-contain" />
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Usuario</label>
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="tu usuario"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Contraseña</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
