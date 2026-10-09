/**
 * Run: npx tsx lib/alerty/actionLines.test.ts
 */
import { actionLineFor, CATEGORY_ACTION_LINE } from "./actionLines";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(actionLineFor("bloqueo").toLowerCase().includes("rodea") || actionLineFor("bloqueo").toLowerCase().includes("ruta"), "bloqueo sugiere rodear");
  assert(actionLineFor("operativo").toLowerCase().includes("retraso"), "operativo menciona retraso");
  assert(actionLineFor("sos").includes("911"), "sos aclara que no sustituye 911");
  assert(Object.keys(CATEGORY_ACTION_LINE).length >= 14, "cubre categorías pin");
  assert(actionLineFor("desconocida").length > 0, "fallback genérico");
  console.log("actionLines.test.ts OK");
}

run();
