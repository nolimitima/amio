export default function BrandLayout({ children, branding }) {
    const brand = {
      name: branding?.name || "Card",
      logoUrl: branding?.logoUrl || "/logo-amian.svg",
      bg: branding?.bg || "#0E1411",
      text: branding?.text || "#F8FAF9",
    };
  
    return (
      <div className="min-h-screen flex flex-col" style={{ background: brand.bg, color: brand.text }}>
        {/* HEADER: только лого + имя бизнеса */}
        <header className="w-full border-b border-white/10">
          <div className="max-w-2xl mx-auto px-5 h-14 flex items-center gap-2">
            {/* логотип */}
            <img
              src={brand.logoUrl}
              alt={`${brand.name} logo`}
              className="h-5 w-5 rounded-sm object-contain bg-white/80"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
            <span className="text-sm font-medium tracking-wide opacity-90">{brand.name}</span>
          </div>
        </header>
  
        {/* MAIN */}
        <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-10">{children}</main>
  
        {/* FOOTER: всегда #121e1d, по центру, только "made in Amian" со ссылкой на / */}
        <footer className="w-full" style={{ background: "#121e1d" }}>
          <div className="max-w-2xl mx-auto px-5 py-5 flex items-center justify-center">
            <a
              href="/"
              className="text-xs text-white/70 hover:text-white transition inline-flex items-center gap-1"
              style={{ letterSpacing: ".02em" }}
              aria-label="Made in Amian – go to home"
            >
              <span className="opacity-70">made in</span>
              <span className="font-semibold underline underline-offset-4">Amian</span>
            </a>
          </div>
        </footer>
      </div>
    );
  }
  