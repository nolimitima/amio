export default function BrandLayout({ children, branding }) {
  const brand = {
    name: branding?.name || "Card",
    logoUrl: branding?.logoUrl || "/logo-amian.svg",
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f1efed", color: "#000000" }}>
      {/* HEADER: только лого + имя бизнеса */}
      <header className="w-full border-b border-black/10">
        <div className="max-w-2xl mx-auto px-5 h-14 flex items-center">
          <span className="text-lg font-semibold tracking-wide">{brand.name}</span>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-10">{children}</main>
    </div>
  );
}
