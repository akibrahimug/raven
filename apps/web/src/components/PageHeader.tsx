import Link from "next/link";

/** Title on the left, a way back on the right. Shared by a page and its
 *  loading state, so the header is already in place while data loads. */
export function PageHeader({ title, back }: { title: string; back: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex items-baseline justify-between">
      <h1 className="invitation text-2xl">{title}</h1>
      <Link href={back.href} className="text-sm font-medium text-ink-soft hover:text-ink">
        {back.label}
      </Link>
    </div>
  );
}
