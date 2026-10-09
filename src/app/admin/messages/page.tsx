import { Mail } from "lucide-react";
import { resolveMessageAction } from "@/actions/admin";
import { StatusTabs } from "@/components/booking-list";
import { ActionForm, SubmitButton } from "@/components/forms";
import { EmptyState, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole(["ADMIN"], "/admin/messages");
  const { status = "" } = await searchParams;
  const filter = status === "RESOLVED" ? "RESOLVED" : "NEW";

  const [messages, fresh, resolved] = await Promise.all([
    prisma.contactMessage.findMany({ where: { status: filter }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
    prisma.contactMessage.count({ where: { status: "RESOLVED" } }),
  ]);

  return (
    <>
      <PageHeader title="Messages" subtitle="Enquiries sent through the contact form. Reply by email, then mark them resolved." />
      <StatusTabs
        base="/admin/messages"
        current={filter === "NEW" ? "" : "RESOLVED"}
        tabs={[
          { value: "", label: "New", count: fresh },
          { value: "RESOLVED", label: "Resolved", count: resolved },
        ]}
      />
      {messages.length === 0 ? (
        <EmptyState icon={Mail} title={filter === "NEW" ? "Inbox zero" : "No resolved messages"} text="Contact form messages will appear here." />
      ) : (
        <ul className="space-y-3">
          {messages.map((message) => (
            <li key={message.id} className="card card-pad">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-serif text-lg font-medium text-ink">{message.subject}</h2>
                  <p className="text-xs text-muted">
                    {message.name} ·{" "}
                    <a href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`} className="font-medium text-gold-700 hover:underline">
                      {message.email}
                    </a>{" "}
                    · {formatDateTime(message.createdAt)}
                  </p>
                </div>
                <ActionForm action={resolveMessageAction} compact messagePosition="bottom">
                  <input type="hidden" name="messageId" value={message.id} />
                  <input type="hidden" name="status" value={message.status === "NEW" ? "RESOLVED" : "NEW"} />
                  <SubmitButton className="btn btn-outline btn-sm">{message.status === "NEW" ? "Mark resolved" : "Reopen"}</SubmitButton>
                </ActionForm>
              </div>
              <p className="mt-3 text-sm leading-6 whitespace-pre-line text-muted">{message.message}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
