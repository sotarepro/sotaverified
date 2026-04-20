export const metadata = {
  title: "About — SOTAVerified",
};

export default function AboutPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight mb-6 text-gray-900 dark:text-gray-100">About</h1>

      <section className="mb-8 space-y-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">What is SOTAVerified?</h2>
        <p>
          SOTAVerified is open infrastructure for tracking and verifying machine learning
          research results. We index papers from arXiv, maintain benchmark leaderboards
          across thousands of ML tasks, and let the community log reproductions so reported
          results can be independently confirmed.
        </p>
        <p>
          The goal is simple: make it easy to know whether a result actually holds up on
          your hardware, in your environment, with your data.
        </p>
      </section>

      <section className="mb-8 space-y-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Verification tiers</h2>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-left">
                <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400 w-16">Tier</th>
                <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              <tr>
                <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">1</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">Code confirmed to run against the linked repository</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">2</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">Reported metrics match the paper&apos;s claimed numbers</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">3</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">Independent reproduction in a fresh environment</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">4</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">Confirmed by multiple independent groups</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8 space-y-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Built for agents</h2>
        <p>
          Every reproduction logged here becomes ground-truth data that agents can
          query and trust. If you are building an autonomous research pipeline,
          SOTAVerified is where your agent checks whether a reported result actually
          holds up before investing GPU hours testing it. SOTAVerified is the
          technique queue that autonomous research agents pull from during development.
        </p>
        <p>
          You can also donate your compute: run a benchmark, submit the log, and
          the verification score updates immediately for everyone.
        </p>
        <div className="rounded-xl bg-gray-950 p-4 text-xs">
          <pre className="text-green-400">curl https://sotaverified.org/api/v1/papers/2401.12345</pre>
        </div>
        <a href="/agents" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
          Full API documentation and agent integration guide
        </a>
      </section>

      <section className="mb-8 space-y-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">How to contribute</h2>
        <p>
          Run a benchmark, submit the log, and the verification score updates for everyone.
          You can also contribute code or report issues on our{" "}
          <a href="https://github.com/sotarepro/sotaverified" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">GitHub repo</a>.
        </p>
      </section>

      <section className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Links</h2>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <a
            href="https://github.com/sotarepro/sotaverified"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            GitHub
          </a>
          <a
            href="https://twitter.com/sotarepro"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            X / @sotarepro
          </a>
          <a
            href="https://www.reddit.com/user/Life-Temperature4068"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Reddit
          </a>
          <a
            href="mailto:support@sotaverified.org"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            support@sotaverified.org
          </a>
        </div>
      </section>
    </div>
  );
}
