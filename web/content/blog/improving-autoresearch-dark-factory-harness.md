---
title: "The Dark Factory Harness: Turning Autonomous Hill-Climbing into Autonomous Research"
date: "2026-04-08"
excerpt: "Autonomous ML experiment loops like autoresearch nail the primitives: edit, train, evaluate, keep or discard. But after 20 experiments, the agent is doing a random walk through code space. The fix isn't a better model, it's a better environment. Five principles for turning autonomous hill-climbing into autonomous research."
author: "David Colmenares"
tags: ["autoresearch", "agents", "infrastructure", "harness engineering"]
---

You point an agent at a training script, tell it to optimize a metric, and go to sleep. You wake up to 50 experiments. The agent swapped activation functions, varied the depth, and tweaked the loss weighting. Each experiment ran, evaluated, and was kept or discarded. The log is clean. The metric improved.

But when you read the log, there's no story. The experiments are a random walk through code space that happened to go uphill. There's no throughline, no reasoning, no sense that experiment 23 built on what experiment 14 learned. The agent can write code, run training, and check results. What it can't do is research.

The problem isn't capability, it's the environment. An agent dropped into a flat instruction file and a mutable training script will do perturbation. To do research, an agent needs planning structure, diagnostic depth, and periodic reflection. The difference is the harness.

## What breaks after 20 experiments

The [autoresearch](https://github.com/karpathy/autoresearch) loop works. But after 20 experiments, failure modes emerge that the loop alone can't address:

**Random walk.** Without research context, the agent has no basis for choosing what to try next. After 30 experiments, the log is a jumble of changes with no throughline.

**No memory of why things failed.** The loop logs outcomes but not causes. The agent can't distinguish an OOM from a shape mismatch and doesn't generalize from past failures.

**Only the final number.** The agent sees the validation metric. It doesn't see loss curves, gradient norms, or whether specific components are actually learning. When a change hurts the metric, the agent discards it without diagnosing why.

**Context fog.** As experiments accumulate, the context window fills with old diffs, training logs, and git output. By experiment 40, the agent is reasoning through noise.

These are well-documented failure modes across the autoresearch community, and they're what motivated this design. I'm building a harness for URM-Energy, my project applying energy-based stopping to Universal Reasoning Models for ARC-AGI. Working through these problems before running the loop is what produced this synthesis.

Karpathy's [autoresearch](https://github.com/karpathy/autoresearch) gives us the experiment loop. OpenAI's [harness engineering](https://openai.com/index/harness-engineering/) post demonstrates that the bottleneck is not the model, but the structure, tools, and feedback loops that feed it context. This post synthesizes both perspectives into five principles for what that environment looks like when the target is ML research.

## 1. Plan before you perturb

The highest-leverage addition is forcing the agent to write a hypothesis before it touches code. A structured plan states what it's changing, why, what outcome it expects, and what prior result or paper motivates the change.

This lives in `docs/hypotheses.md`. Every entry follows a template:

```
## Experiment 14 — Deeper energy head
Hypothesis: A 2-layer energy head may model the energy landscape
  better than the current single linear layer.
Expected outcome: Energy calibration score improves from 0.72 to ~0.78.
Inspired by: Energy transformer paper (docs/papers/energy_transformer.md)
  reports diminishing returns beyond 3 layers for energy heads of this size.
Risk: Additional parameters may slow convergence within the time budget.
```

The "Inspired by" field is the key constraint. It forces the agent to cite a paper summary, a prior experimental result, or the current strategy document before making a change. Every experiment becomes grounded in either the literature or the project's own history.

To make this work, the agent needs accessible context to plan from. The instruction file (`program.md`) should be short, 100 lines or less. It functions as a table of contents into a `docs/` directory. Deep context lives in separate documents: system architecture, hardware constraints, research strategy. A single monolithic instruction file degrades over time. Splitting context into versioned, focused documents keeps each source of truth maintainable and lets the agent pull in exactly what it needs for a given hypothesis.

This mirrors a pattern the OpenAI harness engineering team converged on: separating planning from execution was the single most important structural intervention.

## 2. Give the agent eyes

In a standard loop, the agent sees one number: the validation metric. It has no way to ask why the metric dropped. Did the energy head stop learning or was there a tradeoff between calibration and raw accuracy?

The fix is dumping rich diagnostics to structured JSON after every training run:

```
metrics/<commit_hash>.json
├── training_curves (task_loss, energy_loss, total_loss)
├── gradient_norms (backbone, energy_head)
├── energy_calibration (positive/negative mean energy, separation, stopping accuracy)
└── eval (pass@1, pass@10, pass@100)
```

The agent doesn't consult this every cycle, only when results are unexpected. If pass@k dropped despite a reasonable change, the agent can check whether the energy head's loss curve flatlined (capacity problem), whether backbone gradient norms spiked (instability), or whether energy separation collapsed (contrastive loss broke). This turns "the number dropped, try something else" into "the number dropped because the energy head stopped learning after step 200, suggesting the learning rate is too low."

Don't over-invest in making diagnostics human-readable. The agent consumes structured JSON directly. Your morning review should happen through the narrative layer (hypothesis log and results table), not through raw metrics.

## 3. Periodic distillation

Even with hypotheses and diagnostics, the agent operates experiment-by-experiment. It doesn't naturally step back and notice patterns across runs. Those patterns exist in the data but the agent never synthesizes them unless you build a mechanism for it.

Every 10 experiments, the agent pauses the loop. It reviews the full experiment history (`results.tsv`, the hypothesis log, the metrics JSONs) and synthesizes meta-patterns into an updated `docs/strategy.md`.

The strategy document is a living research agenda. It tracks the current best result, ranks directions by productivity, and logs explored ideas with conclusions. Most importantly, it records observations like "energy head architecture changes have yielded improvements in 4 of 5 experiments while backbone depth changes have yielded improvements in 1 of 6. Prioritize energy head work."

These observations are what turn a sequence of disconnected experiments into a directed search that narrows over time. The OpenAI team does something similar at the organizational level, running extraction loops across agent session logs to identify where agents are struggling. The distillation step is how a solo researcher's agent learns from its own history.

## 4. Fail fast, fail cheap

In a long autonomous run, crashes are inevitable. The default agent behavior is to debug: read the traceback, try a fix, run again, try another fix. This is exactly wrong. Each debugging attempt consumes context, eats the time budget, and usually produces a fragile patch.

The better principle is that code is disposable. Build a `crash_advisor.py` that reads tracebacks, matches against known failure patterns, and outputs a structured diagnosis with one suggested fix. If that fix also fails, the agent reverts to the last known good state and moves on to a different idea entirely.

The more interesting version of this principle is pre-training sanity checks. A `pre_train_check.py` validates shapes, memory estimates, and configuration consistency before any training run starts. The key detail is that its error messages are written to teach the fix, not just report the failure.

Instead of: `Error: rotary embedding length mismatch`

The agent sees: `rotary_dim is 64 but should be seq_len // num_heads = 16. Update ROTARY_DIM on line 47 of train.py.`

The error message becomes context injection. The agent reads it, applies the fix, re-runs the check, and proceeds without wasting a training cycle on a run that was going to crash at step 1. Every time the agent hits a new failure mode that isn't covered, that's a signal to add a new entry. The harness gets smarter over time. The agent's mistakes become the harness's immune memory. After a few weeks of runs, most common failures are caught before they cost GPU time.

## 5. The morning read

All of this engineering exists to change what the human does in the morning. Without a harness, you wake up and read code trying to reconstruct what the agent was thinking. You're supervising at the code level, which means you're doing the same work you would have done yourself, just with extra indirection.

With a harness, you wake up and read a research narrative:

```
## Experiment 31 — Separate LR for energy head
Hypothesis: The energy head is a smaller module and may need a higher
  learning rate to keep pace with the backbone.
Inspired by: Distillation meta-pattern — energy head changes have been
  3x more productive, but energy_loss curves show slow early convergence.
Expected outcome: Energy calibration improves; pass@k stable or better.

### Result
val_accuracy: 0.152 (previous best: 0.135)
Status: keep
Learning: Separate LR confirmed effective. Energy head converges faster
  with 3x backbone LR. Update strategy.md to make this the new default.
```

This is the level of abstraction where human supervision becomes productive. You're reviewing research decisions, not code changes. You can see when the agent is stuck in an unproductive direction. This allows you to apply your own intuition to the parts of research that benefit from it while the agent handles the mechanical iteration. The hypothesis log, the results table, and the strategy document are the research output.

## What this looks like concretely

Here's the directory structure:

```
autoresearch-urm/
├── program.md              # ~100 lines, table of contents into docs/
├── docs/
│   ├── architecture.md     # System design: backbone, energy head, training pipeline
│   ├── constraints.md      # Hardware limits, known failures, anti-patterns
│   ├── strategy.md         # Prioritized research directions (agent updates)
│   ├── papers/
│   │   ├── urm.md          # Paper summary: actionable details for hypothesis generation
│   │   └── energy_transformer.md
│   └── hypotheses.md       # Running log: hypothesis → result → learning
├── checks/
│   ├── pre_train_check.py  # Sanity checks with teaching error messages
│   └── crash_advisor.py    # Maps tracebacks to known fixes
├── train.py                # The ONE file the agent modifies
├── prepare.py              # Read-only: data, eval, constants
├── results.tsv             # Experiment log
└── metrics/
    └── <commit_hash>.json  # Loss curves, gradient norms, calibration
```

The experiment loop itself is unchanged from autoresearch: edit `train.py`, train, evaluate, keep or discard, repeat. Everything in the harness exists in the space around that loop: structuring decisions going in, enriching understanding of results coming out, and periodically stepping back to learn from the trajectory.

The loop gives you hill-climbing. The harness gives you research.

---

*I haven't run this yet. This is me thinking through the design in public before pointing an agent at my URM-Energy project on a single 3090. Next post will be results: what worked, what broke, and what I got wrong about the harness itself. I'd love to hear your feedback on how you've successfully applied these ideas to your own work!*