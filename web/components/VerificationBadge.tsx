import type { VerificationTier } from "@/lib/types";

const config: Record<
  VerificationTier,
  { label: string; className: string }
> = {
  unverified: {
    label: "Unverified",
    className: "bg-gray-100 text-gray-500 border border-gray-200",
  },
  auto_verified: {
    label: "Auto-verified",
    className: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  },
  community: {
    label: "Community",
    className: "bg-green-50 text-green-700 border border-green-200",
  },
  official: {
    label: "Official",
    className: "bg-blue-50 text-blue-700 border border-blue-200",
  },
};

export default function VerificationBadge({
  tier,
}: {
  tier: VerificationTier;
}) {
  const { label, className } = config[tier] ?? config.unverified;
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
