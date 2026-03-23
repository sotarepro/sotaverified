export default function TooNewPage() {
  return (
    <main className="max-w-lg mx-auto px-4 py-24 text-center">
      <h1 className="text-2xl font-bold mb-4">Verification Required</h1>
      <p className="text-gray-600 mb-4">
        Your GitHub account didn&apos;t meet our automated verification criteria.
        This is an anti-spam measure — most real developers pass automatically.
      </p>
      <p className="text-gray-600 mb-6">
        You&apos;ve been added to our review queue and an admin will review your
        request. If you believe this is an error, contact{" "}
        <a
          href="mailto:support@sotaverified.org"
          className="text-blue-600 hover:underline"
        >
          support@sotaverified.org
        </a>
        .
      </p>
      <a
        href="/"
        className="inline-block rounded-lg bg-gray-100 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
      >
        Back to homepage
      </a>
    </main>
  );
}
