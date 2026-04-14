"use client";

import { useEffect } from "react";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error("App error boundary caught:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f172a] p-6 text-slate-200">
      <section className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-red-900/10 p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-red-200">Application error recovered</h1>
        <p className="mt-2 text-sm text-slate-300">
          A client-side exception occurred. Click retry to reload this route with fresh assets.
        </p>
        <button
          onClick={() => reset()}
          className="mt-4 rounded-lg border border-red-400/40 bg-red-500/20 px-4 py-2 text-sm text-red-100 transition hover:bg-red-500/30"
        >
          Retry
        </button>
      </section>
    </main>
  );
}
