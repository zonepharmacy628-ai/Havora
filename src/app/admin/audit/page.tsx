import { PageHeader, Pagination } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

const PAGE = 40;

function summarise(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  return Object.entries(metadata as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== "" && typeof value !== "object")
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ")
    .slice(0, 220);
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireRole(["ADMIN"], "/admin/audit");
  const { page: pageParam } = await searchParams;
  const page = Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);

  const [total, entries] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { actor: { select: { name: true, email: true, role: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader title="Audit Logs" subtitle={`${total} recorded action${total === 1 ? "" : "s"}. Entries are append-only and cannot be edited from the app.`} />
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="text-xs whitespace-nowrap text-muted">{formatDateTime(entry.createdAt)}</td>
                <td>
                  {entry.actor ? (
                    <>
                      <p className="text-sm font-medium text-ink">{entry.actor.name}</p>
                      <p className="text-xs text-muted">{entry.actor.role.toLowerCase()}</p>
                    </>
                  ) : (
                    <span className="text-xs text-muted">System / deleted user</span>
                  )}
                </td>
                <td>
                  <code className="rounded bg-cream-100 px-1.5 py-0.5 text-xs text-ink">{entry.action}</code>
                </td>
                <td className="text-xs text-muted">{entry.entityType}</td>
                <td className="max-w-md text-xs break-words text-muted">{summarise(entry.metadata)}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-muted">
                  No actions recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / PAGE))} hrefFor={(n) => (n > 1 ? `/admin/audit?page=${n}` : "/admin/audit")} />
    </>
  );
}
