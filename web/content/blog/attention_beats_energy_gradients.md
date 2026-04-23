---
title: "Attention Beats Energy Gradients"
date: "2026-04-22"
excerpt: "A controlled comparison of URM-style transformer recurrence versus EBT-style MCMC refinement in shared hidden space on ARC-AGI. At matched compute, each transformer pass is a decisively better refinement step than each energy-gradient step. First-order trajectory ranking fails across five distinct failure modes. Second-order MCMC produces a correct energy landscape whose gradients don't improve decoding."
author: "David Colmenares"
tags: ["urm", "energy-based-models", "arc-agi", "recurrence", "refinement", "experiments"]
---

*Why explicit iterative refinement loses to transformer recurrence on ARC-AGI*

Over the last month I ran a controlled comparison between two mechanisms for iterative refinement in small recurrent transformers on ARC-AGI: URM-style recurrence (Gao et al., 2024) and EBT-style MCMC in hidden space (Gladstone et al., 2025). The experiments share a single backbone, same attention layers, embeddings, training data, and compute budget. I directly compared refinement using a transformer pass versus a gradient step on a learned energy function.

The result was that at matched compute in shared hidden space, each transformer pass is a better refinement step than each energy-gradient step. First-order trajectory ranking fails to produce a usable verifier across five distinct failure modes. Training with second-order gradients produces a directionally correct energy landscape, but following its gradients doesn't improve performance. The general mechanistic interpretation of the results is that one URM step applies a full parameterized attention + MLP transformation across every position, while one MCMC step applies a single scalar gradient direction in the same hidden space. Structured updates beat scalar updates, and you don't close that gap by making the scalar direction more accurate.

All code, configs, and wandb runs: [`uberdavid-bot/URM-Energy-Stopping`](https://github.com/uberdavid-bot/URM-Energy-Stopping).

## 1. The setup

URM (Gao et al., 2024) and its cousins (HRM by Wang et al., 2025 and TRM by Jolicoeur-Martineau, 2025) are small transformers that solve abstract reasoning through shared-weight recurrence. The model applies the same transformer block N times to a sequence of hidden states, re-injects the puzzle embedding each step, and uses a learned Q-halt head (lineage: Graves, 2016) to decide when to stop. The recurrence can be interpreted as implicit energy minimization, where each pass refines the hidden state toward a fixed point using attention as the structured update rule.

Energy-Based Transformers (EBT; Gladstone et al., 2025) propose a different mechanism. Instead of applying transformer blocks recurrently, EBT learns a scalar energy function `E(input, hidden)` and refines predictions by gradient descent: `hidden ← hidden − step_size · ∇_hidden E`. Stopping criterion is energy convergence. IREM (Du et al., 2022) and IRED (Du et al., 2024) explore the same idea, with IREM acknowledging discrete outputs as where this class of methods struggles and IRED partially addressing it through multi-scale landscapes.

The question I wanted to answer was when the backbone and hidden space are held constant, which refinement mechanism is better? I trained one transformer backbone with both an `lm_head` (for decoding) and an energy head (for MCMC gradients), and compared modes that differ only in whether refinement steps are transformer passes or energy-gradient steps.

I ran the experiments on my RTX 3090 on 10×10 ARC grids with 80K training steps. Although I didn't directly replicate paper results due to smaller models (76K–300K params), the goal was comparing mechanism at matched compute.

## 2. The baseline

Before comparing refinement mechanisms, I needed a backbone that achieved refinement across steps. Earlier attempts with hidden=128 plateaued in 1–2 steps. If the model converges immediately, refinement has nothing to add. The right-sizing effort landed at depth=1, hidden=96, expansion=2, 8 steps, 76.6K parameters, with dropout=0.1 on attention and MLP. Two details mattered:

**Deep supervision is non-negotiable.** Earlier experiments used `.detach()` between carry-based recurrence steps, which turns each step into an independent single-pass model with shared weights. Deep supervision from TRM (Jolicoeur-Martineau, 2025) fixes this by running all N steps with gradient flow and applying reconstruction loss + Q-halt BCE at every step with a `(t+1)/N` linear weight ramp. Without it the per-step accuracy curve is flat.

**Dropout closes the train/eval gap.** At h=64 train exact was 6× eval; dropout=0.1 compressed that to 3.9× without hurting eval. At h=96 the gap is 2.3×.

**Table 1** — Per-step eval accuracy for the baseline URM (80K steps, 76.6K params)

| Step | Token Acc | Exact Acc | Δnorm |
|:---:|:---:|:---:|:---:|
| 1 | 67.58% | 0.24% | — |
| 2 | 78.89% | 5.44% | 0.0105 |
| 3 | 82.43% | 11.60% | 0.0055 |
| 4 | 83.47% | 13.97% | 0.0034 |
| 5 | 83.79% | 15.22% | 0.0023 |
| 6 | 83.83% | 16.08% | 0.0016 |
| 7 | 83.75% | **16.09%** | 0.0012 |
| 8 | 83.61% | 15.59% | 0.00098 |

Eval exact improves monotonically 0.24% → 16.09% with mild decay at step 8.

The Δnorm column is a diagnostic borrowed from the Deep Equilibrium Model literature (Bai et al., 2019). The L2 norm of the hidden-state change between consecutive steps, ‖h_t − h_{t−1}‖, measures how much work each recurrence step is doing. Exact accuracy is binary per puzzle and noisy at small sample sizes, while delta norm is continuous and tells you directly whether the model is converging toward a fixed point, oscillating, or stuck. Here it decays monotonically from 0.0105 to 0.00098 across the 8 steps. The model is genuinely converging, with each successive step making a smaller correction. This metric becomes the basis for comparing URM and MCMC step magnitudes in §4. If an MCMC step produces a delta norm far smaller than a URM step, it's doing proportionally less work per unit of compute.

pass@1 = 20.78%, pass@1000 = 40.91%. This is the curve explicit refinement has to beat.

## 3. The verification arc: five ways trajectory ranking fails

The first way energy heads are supposed to earn their keep is as verifiers. EBT's strongest claim (Section 2.1) is that verification is easier than generation: sample K candidates from URM, score each by energy, return the best. In principle this could be a free improvement over Q-halt reranking.

The training signal I used was **trajectory ranking**. Deep supervision gives every recurrence step its own reconstruction loss, so I can measure the exact accuracy of each step's prediction against the ground-truth output grid. This produces a measured quality ordering across the trajectory. For each pair of steps (i, j) where step j has strictly higher exact accuracy than step i, the energy head should assign lower energy to step j's hidden state. The loss is an all-pairs weighted margin `quality_gap · ReLU(E(better) − E(worse) + margin)`, where quality_gap is the measured accuracy difference. Pairs with tied accuracy are excluded. This is a dense, ordered signal that avoids contrastive collapse, the trivial-solution degeneracy I'd hit in an earlier experiment where contrastive loss alone drove the energy gap to zero.

That collapse, fixed by trajectory ranking, is **failure mode 1**. The next four are what trajectory ranking produces instead.

### Failure mode 2: the step-index shortcut

I co-trained a mean-pool linear energy head alongside the URM backbone at h=64, using the trajectory ranking loss. On training data, the energy head learned to order trajectory steps near-perfectly. The diagnostic I tracked was Spearman rank correlation between energy and exact accuracy across the 8 trajectory steps. A correlation of −1.0 means the head assigns monotonically lower energy to higher-accuracy steps, which is exactly what a good verifier should do. On training data, this correlation reached −1.00.

On held-out puzzles it was −0.48, with energy pass@100 = 1.3% vs Q-halt's 22.7%. The key metric, energy-based pass@K, where you run the model with K different random seeds and pick the prediction the energy head scores lowest, told a clear result. The energy head learns to rank steps *within* a trajectory, but this doesn't transfer to ranking predictions across different puzzles.

In order to understand the mechanism for this, I conducted several ablations. First I detached the energy gradients from the backbone so the head sees backbone features but can't shape them. This made the eval Spearman *better* (−0.26 vs −0.07 with the coupled head). The coupled head learns a shortcut, using features that encode step depth, not hidden-state quality. With gradient coupling, the backbone develops features the head can use to tell "this is step 6" vs "this is step 2" without inspecting quality at all. Increasing capacity of the energy head by making it position-aware made this worse, with eval Spearman *collapsing* to −0.07.

**Table 2** — Trajectory ranking variants at h=64 (80K steps)

| Variant | Train ρ | Eval ρ | Energy p@100 | Q-halt p@100 |
|---|:---:|:---:|:---:|:---:|
| Linear energy head (no dropout) | −1.00 | −0.48 | 1.3% | 22.7% |
| Linear energy head (+dropout) | −0.91 | −0.59 | 1.3% | 22.7% |
| Position-aware MLP (+dropout) | −0.96 | −0.07 | 2.6% | 26.0% |

### Failure mode 3: capacity inversion

The position-aware energy head ranked poorly on eval, yet its backbone posted the best eval exact I'd seen at h=64 (6.95% vs 5.33% without energy). Three ablations confirmed the mechanism as structured multi-task regularization. It requires both a correctly-ordered trajectory signal (random labels regress it catastrophically) and gradient coupling into the backbone (detaching kills the gain).

However, this result did not hold up when scaling the model. At h=96 the same recipe costs **−3.81pp** (11.78% vs the baseline's 15.59%), and train exact also drops, ruling out overfitting. The energy objective competes for representational budget when the backbone isn't capacity-starved. This is an important caveat for any improvements discovered at small scale — you have to run scale-up experiments to confirm they generalize.

### Failure mode 4: distribution mismatch

One response to the step-index shortcut is to structurally eliminate it. I tried cross-trajectory ranking at h=96, comparing hidden states across *different augmentations of the same puzzle* at the *same step*. If both candidates are at step 6, step depth can't be the signal. The implementation came for free since the dataloader already fills each batch with 512 augmentations of one puzzle, so same-step cross-augmentation pairs are naturally available.

However, this also failed. Eval Spearman = **+0.118** showed negative correlation with quality. Training-time diagnostics looked fine (~962K active cross-trajectory pairs per forward, non-zero quality variance across augmentations), but the energy head learned features that discriminate quality across augmentations *of a specific puzzle*. Eval batches contain heterogeneous puzzles. The head was being asked to rank predictions across puzzles it wasn't trained to compare.

The single-puzzle-per-batch dataloader design makes this structural. Fixing it would require re-plumbing to mix multiple puzzles per batch, halving the effective examples-per-puzzle. That's expensive, with no guarantee the resulting ranker would beat Q-halt even if the Spearman generalized. Which brings us to mode 5.

### Failure mode 5: even the working fix doesn't beat Q-halt

A third attempt to address the shortcut was inspired by Langevin sampling. I added Gaussian noise σ ~ U(0, 0.01) to hidden states before the energy head scores them, freshly sampled each step. Noise corrupts the features that encode step identity while preserving coarse quality differences. Quality labels come from the clean forward pass; only the features used to predict them are corrupted.

This worked, in the sense of producing the first meaningful negative eval Spearman in the project: **−0.227**. But energy pass@100 = 5.84%, still far below Q-halt's 31.82%.

Why? Q-halt is trained per-sample with a binary target ("is this argmax correct?"). That pointwise signal is structurally more informative for pass@K than any trajectory-trained energy, regardless of whether the ranking generalizes. I ran this expecting "if we fix the shortcut, energy ranking works." What emerged was "if we fix the shortcut, energy ranking is still worse than a simpler baseline that doesn't have this problem to fix."

Ultimately, verification-by-energy did not pan out. The best ranker I could train in this family underperforms a simpler pointwise classifier that was there all along.

## 4. The refinement arc

Since energy verification was not successful, I moved on to refinement. Even if energy isn't the best way to pick among candidates, maybe it's the best way to *improve* them. Take gradient steps in hidden space to minimize energy, end at a hidden state with a better argmax. This is the EBT thesis.

Before training a dedicated energy head, I ran a cheap diagnostic using Q-halt's pre-sigmoid logit as the energy function and take gradient steps toward higher Q-halt confidence. Q-halt is already a well-calibrated pointwise quality signal, so this is the best-case version of "repurpose the classifier we already have as a refiner." I swept across 108 conditions varying URM step budgets (M ∈ {4, 5, 6}), MCMC step counts (K ∈ {1, 2, 4}), six step sizes, and normalized vs raw gradients. No condition improved over M-step URM by more than a single puzzle. The interesting part is *how* it failed. At large step sizes, Q-halt confidence climbed while exact accuracy dropped:

**Table 3** — Adversarial Q-halt MCMC at step_size=1.0, K=4, normalized

| M | q_before → q_after | sigmoid(q) | Exact_before → Exact_after |
|:---:|:---:|:---:|:---:|
| 4 | −3.75 → **+5.37** | 0.023 → 0.996 | 13.97% → 13.03% |
| 5 | −3.63 → **+5.49** | 0.026 → 0.996 | 15.22% → 14.40% |
| 6 | −3.60 → **+5.54** | 0.027 → 0.996 | 16.08% → 15.34% |

Q-halt's sigmoid moves from ~0.02 to ~0.996, a 40× increase in stated confidence, while exact accuracy *drops* 0.7–0.9pp. MCMC fools Q-halt into regions of hidden space where its readout says "great answer" and `lm_head` decodes a worse one. Q-halt was trained on hidden states that transformer recurrence actually produces; MCMC takes you off that manifold in directions Q-halt can't judge.

That's a diagnostic on a classifier not built for this. An energy head trained *through* MCMC with `create_graph=True` is co-adapted to its own gradient by construction: reconstruction loss on MCMC-refined predictions flows back through the MCMC chain into the energy head, forcing the landscape to be one where gradient descent produces better hidden states. This is EBT's actual setup.

The proper experiment runs this at h=96: five URM steps followed by three MCMC steps, matched total compute (M+K=8). Mean-pool linear energy head. Langevin noise during training only (following Pang et al., 2020 and IREM stabilization recommendations). Randomized MCMC step count during training. Dual reconstruction loss on both unrefined and refined predictions. Separate gradient clipping (energy head max_norm=1, backbone max_norm=5). Second-order gradients via `create_graph=True`, no detach between MCMC steps during training.

### The landscape trains correctly; the refinement signal isn't there

At step_size=0.1, trained for the full 80K steps, the energy head shows strictly monotonic energy descent at every one of 15 evaluation checkpoints, total Δ = −0.158 across the three MCMC steps. The head unambiguously learns a landscape. MCMC updates are meaningful in magnitude: delta norm at the first MCMC step is 0.10, roughly 7% of URM's per-step 1.62. These are real perturbations, not numerical noise or a fixed point.

But `mcmc_improvement` — the difference in exact accuracy between refined and unrefined predictions at the same checkpoint — oscillates around zero. Median **−0.016%**, final **−0.02%**, sign **4+/9−** across evaluations. The energy landscape descends monotonically in its own coordinates. Following the gradient moves the hidden state by 7% of a URM step. Resulting predictions are no better than unrefined ones, and slightly worse on average.

### The mechanism

One URM step is a full parameterized transformation using multi-head attention across ~200 positions, gated MLP with learned nonlinearity, residual connections, and layer norms. It's a structured update that uses the spatial relationships in the puzzle. One MCMC step is a single scalar direction in the same hidden space, uniformly applied. Even with a directionally correct landscape (and this one empirically has one), gradient descent is constrained to the manifold of "changes that look like `−step_size · ∇E`." A transformer pass is more flexible, applying more complex transformations the attention weights have learned.

The energy surface and the reconstruction-quality surface are different functions of hidden states with different critical-point geometry. They touch (a globally optimal hidden state is a critical point of both), but the gradient fields don't align in general. Training the energy head to be co-adapted with its own gradient (which `create_graph=True` enforces) optimizes the landscape, but doesn't fix the alignment between landscapes. What would fix it is a parameterization of the update with the expressivity of attention, which is to say, a transformer.

## 5. Why this probably generalizes

The orthogonality finding is specific to this backbone, scale, and energy parameterization. The mechanistic asymmetry isn't. Hidden-space MCMC in its standard form (gradient of a scalar energy, fixed step size, same space the forward pass operates in) is a uniformly-scaled single-direction update. Transformer recurrence applies a learned structured transformation. At matched compute in shared hidden space, the structured transformation wins unless the scalar direction is so well-aligned with the task manifold that its scale dominates the richness of the alternative. On discrete reasoning with spatially-structured hidden states, I don't see a plausible story for that alignment.

Three concrete ways the counter-claim could live:

1. **Discrete-space MCMC.** Operate on token proposals in output space with learned proposal distributions, not hidden-space gradients. Sidesteps the scalar-direction limitation by construction.
2. **Multi-scale energy landscapes.** IRED (Du et al., 2024) trains a sequence of landscapes at different noise levels and anneals across them, producing coarse-to-fine proposal distributions. A much richer update class than fixed-step descent on a single landscape.
3. **Learned MCMC proposals.** Parameterize the update direction itself rather than computing it as `−∇E`. At that point you've recovered something closer to a transformer step, and the asymmetry argument weakens, which is consistent with the thesis.

All three are reasonable directions. None are single-scalar-energy MCMC in hidden space. The result here is about the latter.

## 6. Takeaways

**Practitioners** working on small recurrent transformers for discrete reasoning: URM + Q-halt is the strong default. Don't reach for energy-based refinement without a concrete mechanistic story for why it would outperform attention at matched compute.

**Methods researchers**: at matched compute in shared hidden space, attention-based recurrence is a better refinement operator than single-landscape energy-gradient descent. A convincing counter-claim should (a) hold compute constant, (b) operate in the same hidden space, (c) measure argmax flips rather than energy descent (these can disagree sharply), and (d) explain what about the proposed method beats attention at structured updates.

**Independent positive finding.** Co-training with a correctly-ordered trajectory ranking signal improves underfitting backbones via structured multi-task regularization. But it inverts at adequate capacity, so it's a capacity-starvation crutch, not a universal recipe. Run the scaling check before using auxiliary losses with small models.

Code, configs, training logs, wandb runs: [`uberdavid-bot/URM-Energy-Stopping`](https://github.com/uberdavid-bot/URM-Energy-Stopping). Full per-experiment log in `docs_hypotheses.md`.

---

### References

- Bai, S. et al. (2019). *Deep Equilibrium Models.* NeurIPS. [arXiv:1909.01377](https://arxiv.org/abs/1909.01377).
- Chollet, F. (2019). *On the Measure of Intelligence.* [arXiv:1911.01547](https://arxiv.org/abs/1911.01547).
- Du, Y. et al. (2022). *Learning Iterative Reasoning through Energy Minimization* (IREM). ICML. [arXiv:2206.15448](https://arxiv.org/abs/2206.15448).
- Du, Y. et al. (2024). *Learning Iterative Reasoning through Energy Diffusion* (IRED).
- Gao, Z. et al. (2024). *Universal Reasoning Model* (URM). [arXiv:2512.14693](https://arxiv.org/abs/2512.14693).
- Gladstone, A. et al. (2025). *Energy-Based Transformers* (EBT). [arXiv:2507.02092](https://arxiv.org/abs/2507.02092).
- Graves, A. (2016). *Adaptive Computation Time for Recurrent Neural Networks* (ACT). [arXiv:1603.08983](https://arxiv.org/abs/1603.08983).
- Jolicoeur-Martineau, A. (2025). *Less is More: Recursive Reasoning with Tiny Networks* (TRM). [arXiv:2510.04871](https://arxiv.org/abs/2510.04871).
- Pang, B. et al. (2020). *Learning Latent Space Energy-Based Prior Models.* NeurIPS.
- Wang, G. et al. (2025). *Hierarchical Reasoning Model* (HRM).
