import type { Prisma, Role } from "@prisma/client";
import { Search } from "lucide-react";
import { setUserRoleAction, setUserStatusAction } from "@/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, PageHeader, Pagination, UserStatusBadge } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

const PAGE = 20;
const ROLES: Role[] = ["CUSTOMER", "OWNER", "ADMIN"];

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; page?: string }> }) {
  const admin = await requireRole(["ADMIN"], "/admin/users");
  const { q = "", role = "", page: pageParam } = await searchParams;
  const page = Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);
  const query = q.trim().slice(0, 80);

  const where: Prisma.UserWhereInput = {
    ...(ROLES.includes(role as Role) && { role: role as Role }),
    ...(query && { OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }] }),
  };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, _count: { select: { bookings: true, properties: true } } },
    }),
  ]);
  const hrefFor = (n: number) => `/admin/users?${new URLSearchParams({ ...(query && { q: query }), ...(role && { role }), ...(n > 1 && { page: String(n) }) }).toString()}`;

  return (
    <>
      <PageHeader title="Users" subtitle={`${total} account${total === 1 ? "" : "s"}. Suspend accounts or change roles — every change is audited.`} />

      <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1">
          <span className="label">Search</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy-300" aria-hidden="true" />
            <input name="q" defaultValue={query} placeholder="Name or email" className="input pl-9" />
          </span>
        </label>
        <label>
          <span className="label">Role</span>
          <select name="role" defaultValue={role} className="input min-w-40">
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-navy">
          Filter
        </button>
      </form>

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Joined</th>
              <th>Activity</th>
              <th>Status</th>
              <th>Role</th>
              <th className="text-right">Account</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === admin.id;
              return (
                <tr key={user.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} className="size-9 text-xs" />
                      <div className="min-w-0">
                        <p className="font-medium text-ink">
                          {user.name} {isSelf && <span className="text-xs font-normal text-muted">(you)</span>}
                        </p>
                        <p className="truncate text-xs text-muted">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-muted">{formatDate(user.createdAt)}</td>
                  <td className="text-xs whitespace-nowrap text-muted">
                    {user._count.bookings} booking{user._count.bookings === 1 ? "" : "s"}
                    {user._count.properties > 0 && ` · ${user._count.properties} listing${user._count.properties === 1 ? "" : "s"}`}
                  </td>
                  <td>
                    <UserStatusBadge status={user.status} />
                  </td>
                  <td>
                    {isSelf ? (
                      <span className="text-sm text-ink">{ROLE_LABEL[user.role]}</span>
                    ) : (
                      <ActionForm action={setUserRoleAction} compact messagePosition="bottom" confirm={`Change the role of ${user.name}?`}>
                        <input type="hidden" name="userId" value={user.id} />
                        <div className="flex items-center gap-1.5">
                          <select name="role" defaultValue={user.role} aria-label={`Role for ${user.name}`} className="input w-36 px-2 py-1.5 text-xs">
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </option>
                            ))}
                          </select>
                          <SubmitButton className="btn btn-outline btn-sm">Save</SubmitButton>
                        </div>
                      </ActionForm>
                    )}
                  </td>
                  <td className="text-right">
                    {!isSelf && (
                      <ActionForm
                        action={setUserStatusAction}
                        compact
                        messagePosition="bottom"
                        confirm={user.status === "ACTIVE" ? `Suspend ${user.name}? They will be signed out immediately and unable to sign in.` : undefined}
                      >
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="status" value={user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"} />
                        <SubmitButton className={user.status === "ACTIVE" ? "btn btn-danger btn-sm" : "btn btn-outline btn-sm"}>
                          {user.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-muted">
                  No users match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / PAGE))} hrefFor={hrefFor} />
    </>
  );
}
