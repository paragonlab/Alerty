/**
 * Run: npx tsx lib/alerty/displayTitle.test.ts
 */
import {
  applyGazetteerCasing,
  cleanShareTitle,
  displayTitle,
  looksLikeAllCaps,
  mostlyShouting,
  stripNoise,
  toSentenceCaseEs,
  toTitleCaseEs,
  truncateAtWord,
} from "./displayTitle";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(looksLikeAllCaps("BALACERA EN LAS QUINTAS URGENTE"), "detecta mayúsculas");
  assert(!looksLikeAllCaps("Balacera en Las Quintas"), "título normal no es all-caps");
  assert(!looksLikeAllCaps("SOS"), "sigla corta no cuenta");

  assert(
    mostlyShouting("PROYECTAN 37 MIL VIVIENDAS DEL BIENESTAR PARA Sinaloa"),
    "mayoría en mayúsculas + nombre propio al final",
  );
  assert(!mostlyShouting("Proyectan viviendas en Sinaloa"), "oración normal no es shouting");

  assert(toTitleCaseEs("la obregón") === "La Obregón", `title case: ${toTitleCaseEs("la obregón")}`);
  assert(
    toSentenceCaseEs("PROYECTAN 37 MIL VIVIENDAS") === "Proyectan 37 mil viviendas",
    `sentence: ${toSentenceCaseEs("PROYECTAN 37 MIL VIVIENDAS")}`,
  );

  const soft = displayTitle("🚨 URGENTE: BALACERA EN CENTRO!!!!");
  assert(!soft.includes("🚨"), `sin emoji sirena, got ${soft}`);
  assert(soft !== soft.toUpperCase(), `no queda en mayúsculas: ${soft}`);
  assert(!/!{2,}/.test(soft), `sin gritos de puntuación: ${soft}`);
  assert(soft.startsWith("Balacera"), `oración: ${soft}`);

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

  const noisy =
    "🏠🚨 PROYECTAN 37 MIL VIVIENDAS DEL BIENESTAR PARA Sinaloa\nhttps://t.co/abc123XYZ más";
  assert(!stripNoise(noisy).includes("t.co"), "strip urls");
  assert(!stripNoise(noisy).includes("\n"), "strip newlines");

  const share = cleanShareTitle(noisy, "Aviso", 80);
  assert(!/https?:|t\.co/i.test(share), `cleanShare sin links: ${share}`);
  assert(share.length <= 81, `≤80+…: ${share.length}`);
  assert(share.endsWith("…") || share.length <= 80, "ellipsis o corto");
  assert(/Sinaloa|viviendas|Proyectan/i.test(share), `queda sentido: ${share}`);
  assert(share !== share.toUpperCase(), "no grita en mayúsculas");
  assert(
    !share.includes("PROYECTAN") && !share.includes("VIVIENDAS") && !share.includes("MIL"),
    `sentence case, got ${share}`,
  );
  assert(share.startsWith("Proyectan"), `mayúscula inicial: ${share}`);
  assert(/\bmil\b/.test(share), `mil en minúscula: ${share}`);
  assert(/\bviviendas\b/.test(share), `viviendas en minúscula: ${share}`);
  assert(share.includes("Sinaloa"), `gazetteer Sinaloa: ${share}`);
  assert(share.includes("Bienestar"), `gazetteer Bienestar: ${share}`);

  assert(truncateAtWord("hola mundo feliz", 10) === "hola…", truncateAtWord("hola mundo feliz", 10));

  console.log("displayTitle.test.ts OK");
}

run();
