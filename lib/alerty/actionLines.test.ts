/**
 * Run: npx tsx lib/alerty/actionLines.test.ts
 */
import {
  actionLineFor,
  CATEGORY_ACTION_LINE,
  showsActionLine,
} from "./actionLines";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(actionLineFor("bloqueo").toLowerCase().includes("rodea") || actionLineFor("bloqueo").toLowerCase().includes("ruta"), "bloqueo sugiere rodear");
  assert(actionLineFor("operativo").toLowerCase().includes("retraso"), "operativo menciona retraso");
  assert(actionLineFor("sos").includes("911"), "sos aclara que no sustituye 911");
  assert(Object.keys(CATEGORY_ACTION_LINE).length >= 14, "cubre categorías pin");
  assert(actionLineFor("desconocida") === "", "fallback vacío para desconocida");
  assert(actionLineFor("alerta") === "", "alerta informativa sin action line");
  assert(actionLineFor("otro") === "", "otro informativo sin action line");
  assert(!showsActionLine("alerta"), "showsActionLine alerta=false");
  assert(showsActionLine("bloqueo"), "showsActionLine bloqueo=true");
  console.log("actionLines.test.ts OK");
}

run();
