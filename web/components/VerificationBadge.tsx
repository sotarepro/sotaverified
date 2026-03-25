import type { VerificationTier } from "@/lib/types";
import type { BadgeType } from "@/lib/verification";

type NewProps = {
  badge: BadgeType;
  count?: number;
  score?: number;
};

type LegacyProps = {
  tier: VerificationTier;
  score?: number;
};

type Props = NewProps | LegacyProps;

function isNewProps(props: Props): props is NewProps {
  return "badge" in props;
}

function tierToBadge(tier: string): BadgeType {
  switch (tier) {
    // New badge values (stored by recomputeVerificationScore)
    case "code_available": return "code_available";
    case "author_verified": return "author_verified";
    case "community_verified": return "community_verified";
    // Legacy PWC enum values
    case "auto_verified": return "code_available";
    case "community": return "community_verified";
    case "official": return "author_verified";
    default: return "unverified";
  }
}

function badgeLabel(badge: BadgeType, count?: number): string {
  switch (badge) {
    case "unverified": return "Unverified";
    case "code_available": return "Code Available";
    case "author_verified": return "Author Verified";
    case "community_verified":
      if (!count || count <= 0) return "Community Verified";
      if (count === 1) return "Community Verified";
      if (count <= 3) return "Independently Verified";
      return "Strongly Verified";
    default: return "Unverified";
  }
}

const badgeStyles: Record<BadgeType, string> = {
  unverified: "bg-gray-100 text-gray-500 border border-gray-200",
  code_available: "bg-blue-50 text-blue-700 border border-blue-200",
  author_verified: "bg-purple-50 text-purple-700 border border-purple-200",
  community_verified: "bg-green-50 text-green-700 border border-green-200",
};

export default function VerificationBadge(props: Props) {
  let badge: BadgeType;
  let count: number | undefined;
  let score: number | undefined;

  if (isNewProps(props)) {
    badge = props.badge;
    count = props.count;
    score = props.score;
  } else {
    badge = tierToBadge(props.tier);
    score = props.score;
    // Estimate reproduction count from verification_score for legacy props
    // Score formula: 5 (repo) + 10 (author) + 10 per repro + bonuses
    // Rough estimate: (score - 5) / 10 gives minimum repro count
    if (badge === "community_verified" && score != null && score > 5) {
      count = Math.max(1, Math.floor((score - 5) / 10));
    }
  }

  const label = badgeLabel(badge, count);
  const style = badgeStyles[badge] ?? badgeStyles.unverified;

  const displayParts: string[] = [label];
  if (badge === "community_verified" && count != null && count > 0) {
    displayParts.push(`${count} reproduction${count !== 1 ? "s" : ""}`);
  }

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${style}`}
      title={score != null && score > 0 ? `Verification score: ${score}` : undefined}
    >
      {badge === "community_verified" && count != null && count > 0
        ? `${label} — ${count} reproduction${count !== 1 ? "s" : ""}`
        : label}
    </span>
  );
}
