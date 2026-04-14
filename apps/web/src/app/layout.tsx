import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tenders",
  description: "Monitor de licitaciones públicas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
            <a
              href="/"
              className="text-lg font-semibold tracking-tight text-slate-900 hover:text-slate-700"
            >
              Tenders
            </a>
            <span className="text-slate-300">/</span>
            <span className="text-sm text-slate-500">Licitaciones</span>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
