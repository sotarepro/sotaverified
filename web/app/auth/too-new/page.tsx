export default function TooNewPage() {
  return (
    <main className="max-w-lg mx-auto px-4 py-24 text-center">
      <h1 className="text-2xl font-bold mb-4">Account Too New</h1>
      <p className="text-gray-600 mb-4">
        To prevent spam, GitHub accounts must be at least 30 days old to join
        SOTAVerified.
      </p>
      <p className="text-gray-600 mb-6">
        Your sign-up request has been submitted for admin review. If you believe
        this is an error, contact{" "}
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
