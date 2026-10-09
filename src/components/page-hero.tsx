export function PageHero({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <section className="navy-texture border-b border-white/10">
      <div className="container-page py-14 sm:py-16">
        {eyebrow && <p className="eyebrow mb-3 text-gold-400">{eyebrow}</p>}
        <h1 className="max-w-3xl font-serif text-4xl leading-tight font-medium tracking-tight text-white sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-[15px] leading-7 text-navy-200">{subtitle}</p>}
      </div>
    </section>
  );
}
