/**
 * Strip LaTeX markup from paper titles and abstracts.
 * Handles: \textbf{}, \color{red}{}, \text{}, $...$, $$...$$, \commands
 */
export function stripLatex(text: string): string {
  return text
    // $$...$$ block math → remove entirely
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    // $...$ inline math → keep content, strip delimiters and commands
    .replace(/\$([^$]*?)\$/g, (_m, inner: string) =>
      inner.replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "")
    )
    // \textbf{X}, \textit{X}, \emph{X}, \text{X}, \mathrm{X} etc → X
    .replace(/\\(?:textbf|textit|emph|text|mathrm|mathbf|mathit|mathcal|mathbb|operatorname)\{([^}]*)\}/g, "$1")
    // \color{...}{X} → X (two-arg command)
    .replace(/\\color\{[^}]*\}\{([^}]*)\}/g, "$1")
    // \href{url}{text} → text
    .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, "$1")
    // Remaining \cmd{content} → content
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, "$1")
    // Remaining \commands → space
    .replace(/\\[a-zA-Z]+/g, " ")
    // Clean up leftover braces
    .replace(/[{}]/g, "")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}
