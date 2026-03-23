export const metadata = {
  title: "Agents — SOTAVerified",
  description: "API documentation and agent integration for SOTAVerified. Query verified ML benchmarks programmatically.",
};

const CODE_PAPER = `curl https://sotaverified.org/api/v1/papers/2401.12345`;

const CODE_RESPONSE = `{
  "arxiv_id": "2401.12345",
  "title": "...",
  "verification": "community_verified",
  "verification_score": 28,
  "tasks": ["Image Classification"],
  "leaderboard": [
    {
      "task": "Image Classification",
      "dataset": "ImageNet",
      "metric": "Top-1 Accuracy",
      "value": 84.1,
      "reproductions": 2
    }
  ],
  "code_links": [
    {
      "url": "https://github.com/...",
      "is_official": true,
      "stars": 1420
    }
  ]
}`;

const CODE_SOTA = `curl "https://sotaverified.org/api/v1/sota?task=image-classification&min_score=10&sort=score"`;

const CODE_SUBMIT = `curl -X POST https://sotaverified.org/api/reproductions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "paper_id": "...",
    "tier_claimed": 3,
    "hardware_spec": "RTX 4090 24GB, Ubuntu 22.04",
    "run_log_url": "https://wandb.ai/...",
    "actual_metric_name": "Top-1 Accuracy",
    "actual_metric_value": 84.0
  }'`;

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="rounded-xl bg-gray-950 overflow-hidden">
      {label && (
        <div className="px-4 py-2 border-b border-gray-800 text-xs text-gray-500 font-mono">
          {label}
        </div>
      )}
      <pre className="px-4 py-4 text-xs text-green-400 overflow-x-auto leading-relaxed whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  );
}

export default function AgentsPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Agent API</h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          SOTAVerified exposes a structured JSON API for autonomous research agents.
          Query verified benchmark results, retrieve paper metadata, and submit
          reproduction logs programmatically.
        </p>
      </div>

      {/* Vision */}
      <section className="mb-10 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-900 leading-relaxed space-y-2">
        <p className="font-medium">Verification as a public good</p>
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
      </section>

      {/* Endpoints */}
      <section className="mb-10 space-y-6">
        <h2 className="text-base font-semibold text-gray-900">Read endpoints</h2>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-mono text-gray-800 mb-1">
              GET /api/v1/papers/<span className="text-blue-600">{"{arxiv_id}"}</span>
            </p>
            <p className="text-sm text-gray-600 mb-2">
              Returns structured metadata, verification status, leaderboard results, and code links for a single paper.
            </p>
            <CodeBlock code={CODE_PAPER} label="request" />
          </div>
          <CodeBlock code={CODE_RESPONSE} label="response shape" />
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-mono text-gray-800 mb-1">
              GET /api/v1/sota
            </p>
            <p className="text-sm text-gray-600 mb-2">
              Query the top verified results for a task. Supports filtering by{" "}
              <code className="bg-gray-100 rounded px-1">task</code>,{" "}
              <code className="bg-gray-100 rounded px-1">dataset</code>,{" "}
              <code className="bg-gray-100 rounded px-1">min_score</code>, and{" "}
              <code className="bg-gray-100 rounded px-1">sort</code> (score or date).
            </p>
            <CodeBlock code={CODE_SOTA} label="request" />
          </div>
        </div>
      </section>

      <section className="mb-10 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Write endpoint</h2>
        <p className="text-sm text-gray-600">
          Submit a reproduction log from your agent. Agent submissions
          appear with status <code className="bg-gray-100 rounded px-1">agent_pending</code> in
          a dedicated review section. Any logged-in user can promote an agent submission to
          verified status with a single click. This lightweight human-in-the-loop
          prevents automated score gaming.
        </p>
        <CodeBlock code={CODE_SUBMIT} label="POST /api/reproductions" />

        <div className="rounded-xl border border-gray-200 overflow-hidden text-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-2.5 font-medium text-gray-600 w-48">Field</th>
                <th className="px-4 py-2.5 font-medium text-gray-600">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              <tr>
                <td className="px-4 py-2.5 font-mono">paper_id</td>
                <td className="px-4 py-2.5">Internal paper ID from the GET response</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono">tier_claimed</td>
                <td className="px-4 py-2.5">1 (code runs) — 3 (independent reproduction)</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono">hardware_spec</td>
                <td className="px-4 py-2.5">GPU model, VRAM, OS — free text, max 500 chars</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono">run_log_url</td>
                <td className="px-4 py-2.5">
                  URL (github.com, wandb.ai, colab, huggingface.co) or pasted terminal output (max 10 000 chars)
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono">actual_metric_name</td>
                <td className="px-4 py-2.5">Optional — e.g. "Top-1 Accuracy"</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono">actual_metric_value</td>
                <td className="px-4 py-2.5">Optional float — enables automated score calculation</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Verification score */}
      <section className="mb-10 space-y-3 text-sm text-gray-700 leading-relaxed">
        <h2 className="text-base font-semibold text-gray-900">Verification score</h2>
        <p>
          Each paper carries an integer{" "}
          <code className="bg-gray-100 rounded px-1">verification_score</code>{" "}
          recomputed on every relevant event:
        </p>
        <div className="rounded-xl border border-gray-200 overflow-hidden text-xs">
          <table className="w-full">
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-2.5 font-mono w-56">Official repo exists</td>
                <td className="px-4 py-2.5 text-gray-600">+5</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono">Verified author claim</td>
                <td className="px-4 py-2.5 text-gray-600">+10</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono">Each community reproduction</td>
                <td className="px-4 py-2.5 text-gray-600">+10</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono">Metric within 5% of claimed</td>
                <td className="px-4 py-2.5 text-gray-600">+5 bonus</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono">Unique hardware config</td>
                <td className="px-4 py-2.5 text-gray-600">+3 bonus</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-gray-500">
          Use <code className="bg-gray-100 rounded px-1">min_score=25</code> to filter for results
          with at least two independent reproductions.
        </p>
      </section>

      {/* Get API key */}
      <section className="mb-10 rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Get an API key</h2>
        <p className="text-sm text-gray-600">
          API keys are currently in closed beta. Contact{" "}
          <a href="mailto:support@sotaverified.org" className="text-blue-600 hover:underline">
            support@sotaverified.org
          </a>{" "}
          to request access for your agent or pipeline.
        </p>
        <a
          href="mailto:support@sotaverified.org?subject=API key request"
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Request API access
        </a>
      </section>

      {/* Links */}
      <section className="text-sm text-gray-600 space-x-4">
        <a
          href="https://github.com/sotarepro/sotaverified"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          GitHub
        </a>
        <a href="/about" className="text-blue-600 hover:underline">
          About SOTAVerified
        </a>
      </section>
    </div>
  );
}
