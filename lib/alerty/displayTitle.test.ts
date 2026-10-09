/**
 * Run: npx tsx lib/alerty/displayTitle.test.ts
 */
import {
  applyGazetteerCasing,
  displayTitle,
  looksLikeAllCaps,
  toTitleCaseEs,
} from "./displayTitle";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(looksLikeAllCaps("BALACERA EN LAS QUINTAS URGENTE"), "detecta mayúsculas");
  assert(!looksLikeAllCaps("Balacera en Las Quintas"), "título normal no es all-caps");
  assert(!looksLikeAllCaps("SOS"), "sigla corta no cuenta");

  assert(toTitleCaseEs("la obregón") === "La Obregón", `title case: ${toTitleCaseEs("la obregón")}`);
  assert(
    toTitleCaseEs("balacera en la obregón") === "Balacera en la Obregón",
    `small words: ${toTitleCaseEs("balacera en la obregón")}`,
  );

  const soft = displayTitle("🚨 URGENTE: BALACERA EN CENTRO!!!!");
  assert(!soft.includes("🚨"), `sin emoji sirena, got ${soft}`);
  assert(soft !== soft.toUpperCase(), `no queda en mayúsculas: ${soft}`);
  assert(!/!{2,}/.test(soft), `sin gritos de puntuación: ${soft}`);

  const place = displayTitle("BALACERA EN LA OBREGÓN");
  assert(
    place.includes("Obregón") || place.includes("La Obregón"),
    `respeta nombre propio, got ${place}`,
  );
  assert(!place.includes("obregón"), `no deja obregón en minúsculas: ${place}`);

  const quintas = displayTitle("ALERTA EN LAS QUINTAS");
  assert(quintas.includes("Las Quintas") || quintas.includes("Quintas"), `gazetteer: ${quintas}`);

  assert(
    applyGazetteerCasing("pasó en las quintas ayer").includes("Las Quintas"),
    "gazetteer mid-sentence",
  );

  assert(
    displayTitle(null, "Accidente vial") === "Accidente vial",
    "fallback cuando no hay título",
  );
  assert(displayTitle("   ") === "Aviso en tu zona", "vacío → fallback amable");

  console.log("displayTitle.test.ts OK");
}

run();
