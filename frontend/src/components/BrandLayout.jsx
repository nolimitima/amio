// src/components/BrandLayout.jsx
export default function BrandLayout({ children, branding }) {
    const brand = {
      name: branding?.name || "Card",
      primary: branding?.primary || "#D1E889",
      bg: branding?.bg || "#F6F5F3",
      logoUrl: branding?.logoUrl || "/logo-amian.svg",
    };
  
    return (
      <div className="min-h-screen" style={{ background: brand.bg }}>
        <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
          <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={brand.logoUrl} alt="Logo" className="h-6 w-6 rounded" />
              <span className="font-medium">{brand.name}</span>
            </div>
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: brand.primary + "33" }}>
              Secure Join
            </span>
          </div>
        </header>
  
        <main className="mx-auto max-w-3xl px-4 py-10">{children}</main>
  
        <footer className="mt-10 border-t">
          <div className="mx-auto max-w-3xl px-4 py-6 text-xs text-neutral-500 flex items-center justify-between">
            <span>© {new Date().getFullYear()} {brand.name}</span>
            <span>made with <strong>Amian</strong></span>
          </div>
        </footer>
      </div>
    );
  }
  