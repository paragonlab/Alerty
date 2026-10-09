/**
 * Run: npx tsx lib/alerty/neighborThanks.test.ts
 */
import { neighborThanksLine } from "./neighborThanks";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(
    neighborThanksLine({ username: "@ana", notifiedCount: 1 }) ===
      "Gracias a @ana se avisó a 1 persona",
    "singular",
  );
  assert(
    neighborThanksLine({ username: null, notifiedCount: 3 }) ===
      "Gracias a un vecino se avisó a 3 personas",
    "sin handle",
  );
  console.log("neighborThanks.test.ts OK");
}

run();
