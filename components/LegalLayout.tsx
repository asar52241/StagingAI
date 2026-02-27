import Link from "next/link";
import { LEGAL } from "@/config/legal";

interface LegalLayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function LegalLayout({ children, title }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white">
        <nav className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="text-sm font-extrabold tracking-[0.18em] text-gray-900 transition hover:text-gray-600"
          >
            {LEGAL.brandName}
          </Link>
          <Link href="/" className="text-sm text-gray-500 transition hover:text-gray-900">
            ← На главную
          </Link>
        </nav>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{title}</h1>
        <div className="prose prose-sm mt-8 max-w-none text-gray-700 [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-900 [&_h3]:mb-1.5 [&_h3]:mt-5 [&_h3]:font-semibold [&_h3]:text-gray-800 [&_li]:my-0.5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-100 bg-white">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-6 sm:px-6">
          <div className="flex flex-wrap gap-4 text-xs text-gray-400">
            <Link href="/offer" className="transition hover:text-gray-700">Публичная оферта</Link>
            <Link href="/privacy" className="transition hover:text-gray-700">Политика конфиденциальности</Link>
            <Link href="/refund" className="transition hover:text-gray-700">Возврат</Link>
            <Link href="/contacts" className="transition hover:text-gray-700">Контакты</Link>
          </div>
          <p className="text-xs text-gray-400">
            {LEGAL.sellerType} {LEGAL.sellerName} · ИНН {LEGAL.sellerInn} · г. {LEGAL.sellerCity}
          </p>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} {LEGAL.brandName}</p>
        </div>
      </footer>
    </div>
  );
}
