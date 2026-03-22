import type { VerificationTier } from "@/lib/types";
import type { BadgeType } from "@/lib/verification";

type NewProps = {
  badge: BadgeType;
  count?: number;
  score?: number;
};

type LegacyProps = {
  tier: VerificationTier;
};

type Props = NewProps | LegacyProps;

function isNewProps(props: Props): props is NewProps {
  return "badge" in props;
}

// Map legacy tier to BadgeType
function tierToBadge(tier: VerificationTier): BadgeType {
  switch (tier) {
    case "auto_verified":
      return "code_available";
    case "community":
      return "community_verified";
    case "official":
      return "author_verified";
    case "unverified":
    default:
      return "unverified";
  }
}

const badgeConfig: Record<BadgeType, { label: string; className: string }> = {
  unverified: {
    label: "Unverified",
    className: "bg-gray-100 text-gray-500 border border-gray-200",
  },
  code_available: {
    label: "Code Available",
    className: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  author_verified: {
    label: "Author Verified",
    className: "bg-purple-50 text-purple-700 border border-purple-200",
  },
  community_verified: {
    label: "Community Verified",
    className: "bg-green-50 text-green-700 border border-green-200",
  },
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
  }

  const { label, className } = badgeConfig[badge] ?? badgeConfig.unverified;

  const parts: string[] = [label];
  if (badge === "community_verified" && count != null && count > 0) {
    parts.push(`${count}`);
  }
  if (score != null && score > 0) {
    parts.push(`score ${score}`);
  }

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${className}`}
    >
      {parts.join(" · ")}
    </span>
  );
}
