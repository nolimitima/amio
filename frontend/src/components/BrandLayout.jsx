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
          <span className="text-sm font-medium tracking-wide">{brand.name}</span>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-10">{children}</main>
    </div>
  );
}
