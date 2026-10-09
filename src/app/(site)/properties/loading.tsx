export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading properties">
      <div className="h-44 bg-navy-900" />
      <div className="container-page grid gap-8 py-10 lg:grid-cols-[270px_1fr]">
        <div className="skeleton hidden h-[520px] lg:block" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="card overflow-hidden">
              <div className="skeleton aspect-[4/3] rounded-none" />
              <div className="space-y-3 p-4">
                <div className="skeleton h-5 w-3/4" />
                <div className="skeleton h-4 w-1/2" />
                <div className="skeleton h-6 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
