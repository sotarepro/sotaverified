---
title: "Built on Randomness: Why the Optimizer Is the Least Important Part of Deep Learning"
date: "2026-04-19"
excerpt: "Train the same model twice with different random seeds. Both hit 90% accuracy, but they disagree on 10% of the test set. This isn't noise. It's a window into the deep structure of neural networks: the geometry of the loss landscape, the lottery tickets hiding in your initialization, and the distinct modes that make ensembles work."
author: "David Colmenares"
tags: ["ml-synthesis", "deep-learning", "loss-landscape", "lottery-ticket", "ensembles", "uncertainty"]
---

I train models all the time, often training the same model multiple times. It's the same architecture, same data, same optimizer, same hyperparameters. The only difference is the random seed, how the weights are randomly initialized. But the performance of these runs can be very different. Even when the models converge to the same accuracy, they seem to disagree on what samples in the test set they classify correctly. Not on hard examples that both get wrong in different ways, but on examples where one model is confidently right and the other is confidently wrong. How is that possible? If training is deterministic up to initialization, and both runs reach the same accuracy, shouldn't they learn the same function?

The reason they don't reveals something fundamental about why deep learning works at all. This post connects three ideas that together explain the phenomenon: the geometry of the loss landscape, the lottery ticket hypothesis, and the concept of "modes" in weight space. Each idea is well-established on its own, but the connections between them paint a picture of deep learning that's more elegant (and more unsettling) than the standard narrative of "gradient descent finds a good solution."

## 1. The Loss Landscape Is the Whole Story

The standard story of neural network training is that you initialize randomly, follow gradients downhill, and arrive at a good solution. The optimizer is the hero. But this story has the emphasis exactly backwards.

A neural network's weight space is absurdly high-dimensional. Even a modest ResNet20 has around 272,000 parameters, meaning training navigates a 272,000-dimensional space. The "loss landscape" is the loss function evaluated at every point in this space. We can't visualize it, but we can reason about its geometry, and that geometry turns out to determine almost everything about whether training succeeds.

The crucial insight from the loss landscape literature is that three ingredients define the landscape's shape: the network architecture (depth, width, skip connections), the dataset paired with the loss function (which together define what "good" means), and the degree of overparameterization (how many parameters relative to the complexity of the task).

When a network is small or underparameterized, the landscape is rugged. Many local minima, narrow basins, high barriers between solutions. SGD is fundamentally greedy local search with no backtracking and no global view. It follows the gradient downhill and stops wherever it lands. Drop it into a rugged landscape and it will get stuck in mediocre solutions or fail to converge at all. This is why training small on-device models is so frustrating: the landscape itself is working against you.

When a network is massively overparameterized, something remarkable happens. The landscape smooths out. Good basins become wider, more numerous, and more connected. SGD almost always finds a good solution because almost every direction from a random initialization leads downhill to one. The miracle of modern deep learning isn't in the optimizer. It's that we've learned to engineer landscapes where the optimizer can't fail.

This reframes the whole enterprise. The initialization places you at a starting point in this landscape. The optimizer rolls you downhill from there. That's it. The architecture, the data, the loss function, and the degree of overparameterization are doing the real work. The optimizer is the least interesting part.

## 2. Lottery Tickets Are the Mechanism

If the landscape explains the macro-structure of training, the lottery ticket hypothesis (Frankle & Carlin, 2019) explains the micro-structure: what's actually happening inside the network as SGD rolls downhill.

The core idea is that a large, randomly initialized network contains many sparse subnetworks, called "lottery tickets," each of which could achieve competitive performance if trained in isolation from its original initialization. The overparameterized network is like buying many lottery tickets at once. You're nearly guaranteed to have a winning subnetwork somewhere in the initial random weights.

This reframes what SGD actually does during training. It isn't building a solution from scratch. It's starting close enough to one of these lottery tickets that gradient descent can reveal it, reinforcing the connections that matter and suppressing the ones that don't. The ticket was already there at initialization. Training is refinement, not discovery.

The lottery ticket isn't a localized structure sitting in a few layers. It's a distributed "program" spanning the entire depth and width of the network, a specific pattern of connection strengths that collectively implement a function. When people talk about "what the network learned," they're really talking about which ticket got revealed.

This connects directly back to the landscape story. Overparameterization works because having more parameters means having more lottery tickets, which means more good subnetworks to find, which means more good basins in the landscape, which means SGD almost always has somewhere good to roll downhill to. The lottery ticket hypothesis gives us the mechanistic explanation for why overparameterization smooths the loss landscape. It's not that you need all those extra parameters at convergence. You need them at initialization to ensure you have a winning ticket to find.

## 3. Modes Are Multiple Winning Tickets

Now we can explain why two runs that both achieve 90% accuracy, have a 10% disagreement on the test set.

Fort, Hu, and Lakshminarayanan (2019) demonstrated that different random initializations converge to different "modes," meaning distinct, well-separated basins in weight space that represent functionally different solutions. The solutions aren't just numerically different (slightly different weight values). They're geometrically different: cosine similarity between weight vectors from different random seeds is approximately 0.105. These solutions are nearly orthogonal in a 272,000-dimensional space, meaning they found completely different regions of the landscape. Despite this near-orthogonality, all modes reach approximately the same accuracy. They're equally good solutions to the same problem, but they're different solutions.

I reproduced this on my RTX 3090 with ResNet20v1 on CIFAR-10, training three independent runs with different seeds. Mean test accuracy was 89.95% ± 0.18% across seeds, effectively identical performance. But cross-seed prediction disagreement was 10.97%. These models agree on about 89% of test examples and flat-out disagree on the other 11%. Within a single training trajectory (comparing checkpoints from the same run), disagreement is only 1-5%. t-SNE visualization of prediction vectors shows the trajectories clustering separately: each seed is its own island in function space.

In lottery ticket terms, each random initialization reveals a different winning ticket. Each ticket is a different sparse subnetwork implementing a different function that happens to achieve the same overall accuracy. The examples they disagree on aren't necessarily "hard" in any objective sense. They're examples that sit near the decision boundary of one ticket but not another. Each ticket has its own failure mode, its own region of the input space where it's less reliable.

This is a profound and somewhat unsettling result. Two models with identical accuracy can have almost completely different error profiles. Accuracy alone tells you nothing about which parts of the input space your model handles well.

It also explains immediately why deep ensembles work (Lakshminarayanan et al., 2017). You're not averaging across models that are each slightly better. You're averaging across models that are wrong about different things. The errors cancel because the failure modes are independent, a direct consequence of the models occupying different modes in weight space.

And it explains why dropout and MC Dropout don't achieve the same effect. Dropout samples within a single mode's neighborhood. It perturbs a model but never escapes the basin it trained into. Within-mode diversity gives you 1-5% disagreement. Getting true mode diversity, the kind that makes ensembles powerful, requires independent random initializations that land in entirely different basins. This is the core argument of Fort et al. for why deep ensembles consistently outperform Bayesian approximations.

## 4. MIMO Finds Multiple Tickets in One Network

If a network is sufficiently overparameterized, it doesn't just contain one winning lottery ticket. It contains several. MIMO (Havasi et al., 2021) exploits this directly by routing M different input streams through a shared backbone to M separate output heads, encouraging each stream to discover and train an independent subnetwork. At inference, you run one forward pass and get M diverse predictions to ensemble. Near-zero extra cost.

I tested this on ResNet20 (272K params) and the results tell a clean story about the relationship between capacity and mode diversity:

| Method | Ensemble Acc | Per-head Acc | Disagreement (D_dis) |
|---|---|---|---|
| MIMO M=1 | 89.53% | 89.53% | 0.000 |
| MIMO M=2 | 89.45% | ~87.5% avg | 0.139 |
| MIMO M=3 | 86.91% | ~84% avg | 0.153 |
| Naive M=3 | 89.30% | ~89.3% | 0.005 |

The M=2 result is interesting. The network finds real diversity (D_dis=0.139, comparable to independent seeds!) but the per-head accuracy drops enough that the ensemble accuracy is unchanged. The capacity cost of fitting two independent tickets exactly cancels the diversity benefit at this model size.

M=3 is where it breaks. ResNet20 doesn't have enough parameters to fit three good lottery tickets simultaneously. Each head degrades to ~84% individual accuracy, and even with three diverse predictions, the ensemble can't recover.

The naive multi-head baseline is the control that makes the result convincing. Without MIMO's structured input routing, all three heads learn the same function (D_dis=0.005, essentially zero diversity). The routing mechanism is what forces the network to discover different tickets rather than collapsing to a single solution.

The paper's accuracy gains live on WRN-28-10 (36.5M parameters, 134x larger than ResNet20), where there's surplus capacity for multiple tickets without degrading any of them. This is a direct, quantitative demonstration of why on-device models are harder. You've squeezed out the overparameterization that makes these tricks work.

## 5. The Unified Picture

We don't train neural networks so much as we design conditions under which training is almost guaranteed to work. The architecture and overparameterization define a loss landscape with many good basins. The random initialization places us near one of many winning lottery tickets. SGD reveals that ticket by rolling downhill. The result is a model that works, but it's one of many possible models we could have found, each occupying a different mode in weight space, each with its own failure profile.

This has a practical implication for uncertainty estimation that I think is underappreciated. If modes are real and they disagree on ~10% of examples, then a single model's confidence scores are structurally optimistic. The model can tell you about uncertainty within its mode (how close an example is to its decision boundary), but it has no way of knowing that a different lottery ticket would classify that example differently. It doesn't know what it doesn't know, because it's only one ticket.

True predictive uncertainty requires covering multiple modes. That's what deep ensembles provide, and it's why they remain the gold standard for uncertainty estimation despite being expensive. MIMO approximates this cheaply when you have surplus capacity. But for small on-device models, where you can't afford an ensemble and don't have capacity for MIMO, the model's uncertainty estimates are fundamentally limited. Not wrong, just incomplete, capturing within-mode uncertainty but missing the between-mode disagreement that accounts for a full 10% of test examples.

Model soups (Wortsman et al., 2022) might seem to contradict this picture since they average weights from multiple runs and get better performance. But the resolution is clean: model soups fine-tune from a shared pretrained checkpoint, which constrains all runs to the same broad basin. Weight averaging works because the starting point is the same. Models trained from scratch with different random initializations land in different basins with loss barriers between them, and averaging their weights produces nonsense.

The next time you train a model and get 90% accuracy, remember that another version of that model, equally accurate, would confidently disagree with yours on one in ten examples. The examples it gets wrong aren't hard. They're just not what its particular lottery ticket is good at.

---

*This is the first post in a "Why Machine Learning Works" series exploring the mechanisms behind deep learning phenomena. The experimental results (10% cross-seed disagreement, MIMO scaling behavior) were reproduced on an RTX 3090 with ResNet20v1 on CIFAR-10. Full reproduction details available on request.*

*I'd love to hear from practitioners who've seen the seed sensitivity problem in production, or from anyone working on uncertainty estimation for on-device models where ensembles aren't an option.*
