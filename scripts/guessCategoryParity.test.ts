/**
 * Paridad TS ↔ SQL del clasificador de community_posts.
 * Run: npx --yes tsx scripts/guessCategoryParity.test.ts
 *
 * El espejo SQL usa los mismos patrones que
 * 20261007120000_community_category_guess_backfill.sql, con \m/\M → \b
 * (en Postgres \b es backspace; en JS \b es límite de palabra).
 */
import {
  guessCategory,
  normalizeEs,
  type CanonicalCategory,
} from "../supabase/functions/_shared/guessCategory";

/** Patrones Postgres (\m/\M) en el mismo orden que la migración. */
const SQL_RULES: Array<{ guess: CanonicalCategory; patterns: string[] }> = [
  {
    guess: "sos",
    patterns: [String.raw`\m(sos|auxilio|auxilien)\M`, String.raw`\mpid(e|en) ayuda\M`],
  },
  {
    guess: "desaparecida",
    patterns: [
      String.raw`\m(desaparecid[oa]s?|levanton|levantamiento|secuestro|plagiad[oa]s?|extraviad[oa]s?)\M`,
      String.raw`\mprivacion de la libertad\M`,
      String.raw`\mbuscan a\M`,
    ],
  },
  {
    guess: "operativo",
    patterns: [
      String.raw`\m(operativo|despliegue|militares?|ejercito|rastrillo)\M`,
      String.raw`\mguardia nacional\M`,
      String.raw`\mfederal(es)?\M`,
      String.raw`\mrevision de vehiculos\M`,
    ],
  },
  {
    guess: "balacera",
    patterns: [String.raw`\m(balacera|tiroteo|disparos?|balead[oa]s?|rafagas?)\M`],
  },
  {
    guess: "enfrentamiento",
    patterns: [
      String.raw`\m(enfrentamiento)\M`,
      String.raw`\mgrupo armado\M`,
      String.raw`\melementos armados\M`,
      String.raw`\mchoque armado\M`,
      String.raw`\mtoma de cuartel\M`,
    ],
  },
  {
    guess: "detonaciones",
    patterns: [String.raw`\m(detonaciones?|explosiones?|estallidos?)\M`],
  },
  {
    guess: "narcobloqueo",
    patterns: [
      String.raw`\m(narcobloqueo|narcobloqueos)\M`,
      String.raw`\mvehiculos quemados en la via\M`,
    ],
  },
  {
    guess: "bloqueo",
    patterns: [
      String.raw`\mbloqueo vial\M`,
      String.raw`\mbloqueos?\M`,
      String.raw`\mtoma de (la )?(calle|avenida|carretera)\M`,
      String.raw`\mbarricadas?\M`,
    ],
  },
  {
    guess: "captura",
    patterns: [String.raw`\m(captura|detenid[oa]s?|arrestad[oa]s?|asegurad[oa]s?|detencion)\M`],
  },
  {
    guess: "robo",
    patterns: [String.raw`\m(robo|asalto|raspon|carjacking)\M`, String.raw`\mportacion ilegal\M`],
  },
  {
    guess: "accidente",
    patterns: [String.raw`\m(accidente|choque|volcadura|colision)\M`, String.raw`\mpercance vial\M`],
  },
  {
    guess: "incendio",
    patterns: [
      String.raw`\m(incendio|conflagracion|lamas)\M`,
      String.raw`\mse quema\M`,
      String.raw`\mvehiculos? en llamas\M`,
    ],
  },
  {
    guess: "inundacion",
    patterns: [
      String.raw`\m(inundacion|inundad[oa]s?|encharcamiento|desborde)\M`,
      String.raw`\mlluvias torrenciales\M`,
    ],
  },
  {
    guess: "zona segura",
    patterns: [
      String.raw`\mzona segura\M`,
      String.raw`\mtodo en calma\M`,
      String.raw`\msin novedad\M`,
      String.raw`\mse restablece\M`,
    ],
  },
  {
    guess: "alerta",
    patterns: [
      String.raw`\m(alerta|alertan|reportan|precaucion)\M`,
      String.raw`\mzona de riesgo\M`,
    ],
  },
];

/** Espejo JS del clasificador SQL (translate de acentos + \m/\M como \b). */
export function guessCategorySql(raw: string): CanonicalCategory | null {
  if (!raw || !raw.trim()) return null;
  let t = raw.toLowerCase();
  const from = "áéíóúüñÁÉÍÓÚÜÑ";
  const to = "aeiouunAEIOUUN";
  t = t
    .split("")
    .map((ch) => {
      const i = from.indexOf(ch);
      return i >= 0 ? to[i]! : ch;
    })
    .join("");

  for (const rule of SQL_RULES) {
    for (const pgPat of rule.patterns) {
      const jsPat = pgPat.replace(/\\m/g, "\\b").replace(/\\M/g, "\\b");
      if (new RegExp(jsPat).test(t)) return rule.guess;
    }
  }
  return null;
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const SAMPLES: Array<{ text: string; expect: CanonicalCategory | null }> = [
  // Falsos positivos históricos de sos sin word-boundary
  { text: "homicidios dolosos en la colonia", expect: null },
  { text: "varios casos de robo", expect: "robo" },
  { text: "el gobernador sostuvo que hay calma", expect: null },
  { text: "diversos reportes en redes", expect: null },
  { text: "cuesta 50 pesos el trámite", expect: null },
  { text: "faltan recursos en la zona", expect: null },
  { text: "hay procesos penales abiertos", expect: null },
  // SOS real
  { text: "SOS necesitamos auxilio en Tres Ríos", expect: "sos" },
  { text: "piden ayuda urgente en el centro", expect: "sos" },
  // Categorías fuertes
  { text: "Reportan balacera en Humaya", expect: "balacera" },
  { text: "ALERTAN por levantón en la Loyola", expect: "desaparecida" },
  { text: "Despliegue de militares en el centro", expect: "operativo" },
  { text: "Incendio de vehículo en la avenida", expect: "incendio" },
  { text: "Narcobloqueo en la salida sur", expect: "narcobloqueo" },
  { text: "Bloqueo vial en Chapultepec", expect: "bloqueo" },
  { text: "Alertan zona de riesgo cerca del malecón", expect: "alerta" },
  { text: "partido de fútbol y turismo", expect: null },
  { text: "", expect: null },
];

function run() {
  // Acentos: SQL translate y TS normalizeEs deben coincidir en samples
  assert(normalizeEs("Culiacán") === "culiacan", "normalizeEs");

  for (const sample of SAMPLES) {
    const ts = guessCategory(sample.text);
    const sql = guessCategorySql(sample.text);
    assert(
      ts === sql,
      `TS/SQL diverge on "${sample.text}": ts=${ts} sql=${sql}`,
    );
    assert(
      ts === sample.expect,
      `expected ${sample.expect} for "${sample.text}", got ${ts}`,
    );
  }

  // Explicit: substrings must NOT be sos
  for (const word of ["dolosos", "casos", "pesos", "recursos", "procesos", "sostuvo", "diversos"]) {
    assert(guessCategory(word) !== "sos", `TS: ${word} must not be sos`);
    assert(guessCategorySql(word) !== "sos", `SQL: ${word} must not be sos`);
    assert(guessCategory(word) === null, `TS: ${word} alone → null`);
    assert(guessCategorySql(word) === null, `SQL: ${word} alone → null`);
  }

  console.log("guessCategory parity tests ok");
}

run();
