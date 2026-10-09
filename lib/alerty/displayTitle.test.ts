/**
 * Run: npx tsx lib/alerty/displayTitle.test.ts
 */
import { displayTitle, looksLikeAllCaps } from "./displayTitle";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(looksLikeAllCaps("BALACERA EN LAS QUINTAS URGENTE"), "detecta mayúsculas");
  assert(!looksLikeAllCaps("Balacera en Las Quintas"), "título normal no es all-caps");
  assert(!looksLikeAllCaps("SOS"), "sigla corta no cuenta");

  const soft = displayTitle("🚨 URGENTE: BALACERA EN CENTRO!!!!");
  assert(!soft.includes("🚨"), `sin emoji sirena, got ${soft}`);
  assert(soft !== soft.toUpperCase(), `no queda en mayúsculas: ${soft}`);
  assert(!/!{2,}/.test(soft), `sin gritos de puntuación: ${soft}`);

  assert(
    displayTitle(null, "Accidente vial") === "Accidente vial",
    "fallback cuando no hay título",
  );
  assert(displayTitle("   ") === "Aviso en tu zona", "vacío → fallback amable");

  console.log("displayTitle.test.ts OK");
}

run();
