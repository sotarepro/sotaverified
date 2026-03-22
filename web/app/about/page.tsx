export const metadata = {
  title: "About — SOTAVerified",
};

export default function AboutPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight mb-6">About</h1>

      <section className="mb-8 space-y-3 text-sm text-gray-700 leading-relaxed">
        <h2 className="text-base font-semibold text-gray-900">What is SOTAVerified?</h2>
        <p>
          SOTAVerified is open infrastructure for tracking and verifying machine learning
          research results. We index papers from arXiv weekly, maintain benchmark leaderboards
          across thousands of ML tasks, and let the community log reproductions so reported
          results can be independently confirmed.
        </p>
        <p>
          The goal is simple: make it easy to know whether a result actually holds up — on
          your hardware, in your environment, with your data.
        </p>
      </section>

      <section className="mb-8 space-y-3 text-sm text-gray-700 leading-relaxed">
        <h2 className="text-base font-semibold text-gray-900">Verification tiers</h2>
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-2.5 font-medium text-gray-600 w-16">Tier</th>
                <th className="px-4 py-2.5 font-medium text-gray-600">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-2.5 font-medium">1</td>
                <td className="px-4 py-2.5 text-gray-600">Code confirmed to run against the linked repository</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium">2</td>
                <td className="px-4 py-2.5 text-gray-600">Reported metrics match the paper&apos;s numbers</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium">3</td>
                <td className="px-4 py-2.5 text-gray-600">Independent reproduction in a fresh environment</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium">4</td>
                <td className="px-4 py-2.5 text-gray-600">Confirmed by multiple independent groups</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8 space-y-3 text-sm text-gray-700 leading-relaxed">
        <h2 className="text-base font-semibold text-gray-900">Built for agents too</h2>
        <p>
          Every reproduction logged here becomes ground-truth data that autonomous research
          agents can query. Donate your compute to verify papers you care about —
          verification as a public good.
        </p>
        <div className="rounded-xl bg-gray-950 p-4 text-xs">
          <pre className="text-green-400">curl https://sotaverified.org/api/v1/papers/2401.12345</pre>
        </div>
      </section>

      <section className="text-sm text-gray-600">
        <a
          href="https://github.com/sotarepro/sotaverified"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          GitHub repo
        </a>
        {" — "}
        contributions welcome. Open an issue or PR.
      </section>
    </div>
  );
}
