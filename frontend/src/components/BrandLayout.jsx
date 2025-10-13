export default function BrandLayout({ children, branding }) {
    const brand = {
      name: branding?.name || "Example",
      logoUrl: branding?.logoUrl || "/logo-amian.svg",
      primary: branding?.primary || "#D1E889",
      bg: branding?.bg || "#0E1411",      // глубокий фон, ближе к Badge
      surface: branding?.surface || "#FFFFFF",
      text: branding?.text || "#F8FAF9",
    };
  
    return (
      <div
        className="min-h-screen flex flex-col justify-between font-sans"
        style={{ background: brand.bg, color: brand.text }}
      >
        {/* HEADER */}
        <header className="w-full border-b border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-5 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                src={brand.logoUrl}
                alt="Logo"
                className="h-5 w-5 rounded-sm"
                style={{ filter: "drop-shadow(0 0 1px rgba(0,0,0,0.3))" }}
              />
              <span className="text-sm font-medium tracking-wide opacity-90">
                {brand.name}
              </span>
            </div>
            <span
              className="text-[11px] px-2 py-1 rounded-full font-medium"
              style={{
                background: brand.primary + "26",
                color: brand.primary,
              }}
            >
              Secure Join
            </span>
          </div>
        </header>
  
        {/* MAIN CONTENT */}
        <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-10">
          {children}
        </main>
  
        {/* FOOTER */}
        <footer className="w-full border-t border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-5 py-5 flex items-center justify-between text-xs text-white/40">
            <span>© {new Date().getFullYear()} {brand.name}</span>
            <span>
              made with <span className="text-white/60 font-medium">Amian</span>
            </span>
          </div>
        </footer>
      </div>
    );
  }
  