import sql from "@/lib/db";
import Image from "next/image";

interface Props {
  paperId: string;
}

interface VerifiedAuthor {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  verification_method: string | null;
}

export default async function VerifiedAuthors({ paperId }: Props) {
  const authors = await sql<VerifiedAuthor[]>`
    SELECT pa.user_id, u.username, u.avatar_url, pa.verification_method
    FROM paper_authors pa
    JOIN users u ON u.github_id = pa.user_id
    WHERE pa.paper_id = ${paperId}
      AND pa.status = 'verified'
    ORDER BY pa.verified_at ASC
  `;

  if (authors.length === 0) return null;

  return (
    <section className="mb-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Verified Authors
      </h3>
      <ul className="flex flex-wrap gap-3">
        {authors.map((a) => (
          <li key={a.user_id} className="flex items-center gap-2">
            {a.avatar_url ? (
              <Image
                src={a.avatar_url}
                alt={a.username ?? a.user_id}
                width={20}
                height={20}
                className="rounded-full"
              />
            ) : (
              <span className="w-5 h-5 rounded-full bg-gray-200 inline-block" />
            )}
            <span className="text-sm text-gray-700">
              <span className="font-medium">@{a.username ?? a.user_id}</span>
              <span className="text-gray-500"> — Verified Author via GitHub</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
