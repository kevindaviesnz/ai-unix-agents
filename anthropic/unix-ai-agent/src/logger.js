/**
 * logger.js
 *
 * Pretty-prints each phase of the agent loop so you can follow
 * the AI's reasoning and actions in real time.
 */

const COLORS = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  cyan:    "\x1b[36m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  blue:    "\x1b[34m",
  magenta: "\x1b[35m",
  red:     "\x1b[31m",
  white:   "\x1b[37m",
  bgBlue:  "\x1b[44m",
};

const c = (color, text) => `${COLORS[color]}${text}${COLORS.reset}`;

function timestamp() {
  return c("dim", `[${new Date().toLocaleTimeString()}]`);
}

export const logger = {
  header(title) {
    const bar = "═".repeat(60);
    console.log(`\n${c("cyan", bar)}`);
    console.log(`${c("cyan", "║")} ${c("bold", title.padEnd(57))}${c("cyan", "║")}`);
    console.log(`${c("cyan", bar)}\n`);
  },

  separator() {
    console.log(c("dim", "─".repeat(60)));
  },

  info(msg) {
    console.log(`${timestamp()} ${c("blue", "ℹ")} ${msg}`);
  },

  warn(msg) {
    console.log(`${timestamp()} ${c("yellow", "⚠")}  ${msg}`);
  },

  step(label) {
    console.log(`\n${timestamp()} ${c("bold", c("magenta", `▶ ${label}`))}`);
  },

  thinking(text) {
    const lines = text.trim().split("\n");
    console.log(`${timestamp()} ${c("cyan", "🧠 AI Reasoning:")}`);
    for (const line of lines) {
      console.log(`   ${c("dim", line)}`);
    }
  },

  toolCall(name, input) {
    const inputStr = JSON.stringify(input, null, 2)
      .split("\n")
      .map((l, i) => (i === 0 ? l : `      ${l}`))
      .join("\n");
    console.log(`\n${timestamp()} ${c("green", "🔧 Tool Call:")} ${c("bold", name)}`);
    console.log(`   ${c("dim", "Input:")} ${c("white", inputStr)}`);
  },

  toolResult(name, result) {
    const preview =
      typeof result === "string" && result.length > 500
        ? result.slice(0, 500) + c("dim", `\n   ... [${result.length - 500} more chars]`)
        : result;
    const lines = String(preview).split("\n");
    console.log(`${timestamp()} ${c("green", "📤 Result from")} ${c("bold", name)}:`);
    for (const line of lines.slice(0, 30)) {
      console.log(`   ${line}`);
    }
    if (lines.length > 30) {
      console.log(c("dim", `   ... [${lines.length - 30} more lines]`));
    }
  },

  finalReport(report, score, usage, iterations) {
    const bar = "═".repeat(60);
    console.log(`\n${c("green", bar)}`);
    console.log(`${c("green", "║")} ${c("bold", "FINAL HEALTH REPORT".padEnd(57))}${c("green", "║")}`);
    console.log(`${c("green", bar)}\n`);

    console.log(report);

    if (score !== null) {
      const scoreColor = score >= 7 ? "green" : score >= 4 ? "yellow" : "red";
      console.log(
        `\n${c("bold", "Health Score:")} ${c(scoreColor, c("bold", `${score}/10`))}`
      );
    }

    console.log(`\n${c("dim", "─".repeat(60))}`);
    console.log(c("dim", `Completed in ${iterations} iteration(s)`));
    console.log(
      c(
        "dim",
        `Token usage: ${usage.input_tokens.toLocaleString()} in / ${usage.output_tokens.toLocaleString()} out` +
        ` (~$${estimateCost(usage)})`
      )
    );
    console.log(c("dim", "─".repeat(60)));
  },
};

/**
 * Rough cost estimate based on claude-sonnet-4 pricing.
 * Prices may change — treat this as approximate.
 */
function estimateCost(usage) {
  const INPUT_COST_PER_1M  = 3.00;
  const OUTPUT_COST_PER_1M = 15.00;
  const cost =
    (usage.input_tokens / 1_000_000) * INPUT_COST_PER_1M +
    (usage.output_tokens / 1_000_000) * OUTPUT_COST_PER_1M;
  return cost.toFixed(4);
}
