export default function BrandLayout({ children, branding }) {
    const brand = {
      name: branding?.name || "Card",
      logoUrl: branding?.logoUrl || "/logo-amian.svg",
      primary: branding?.primary || "#D1E889",
      bg: branding?.bg || "#0E1411",
      text: branding?.text || "#F8FAF9",
    };
  
    return (
      <div className="min-h-screen flex flex-col justify-between" style={{ background: brand.bg, color: brand.text }}>
        {/* Header с брендом бизнеса */}
        <header className="w-full border-b border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-5 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                src={brand.logoUrl}
                alt={`${brand.name} logo`}
                className="h-5 w-5 rounded-sm object-contain bg-white/80"
                onError={(e) => (e.currentTarget.style.visibility = "hidden")}
              />
              <span className="text-sm font-medium tracking-wide opacity-90">{brand.name}</span>
            </div>
            <span className="text-[11px] px-2 py-1 rounded-full font-medium"
                  style={{ background: brand.primary + "26", color: brand.primary }}>
              Secure Join
            </span>
          </div>
        </header>
  
        <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-10">{children}</main>
  
        {/* Footer: только made in Amian → ссылка на главную */}
        <footer className="w-full border-t border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-5 py-5 flex items-center justify-end text-xs text-white/60">
            <span>
              made in{" "}
              <a href="/" className="underline underline-offset-2 hover:opacity-80">
                Amian
              </a>
            </span>
          </div>
        </footer>
      </div>
    );
  }
  