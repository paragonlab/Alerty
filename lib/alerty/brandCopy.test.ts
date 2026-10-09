/**
 * Run: npx tsx lib/alerty/brandCopy.test.ts
 */
import {
  SITE_CITIES_LABEL,
  activeColoniaTagline,
  appShareMessage,
  coloniaTagline,
  neighborsBlurb,
  siteDocumentTitle,
} from "./brandCopy";
import { setCityPreference } from "./city";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(coloniaTagline(null) === "¿Cómo está tu colonia hoy?", "neutro sin ciudad");
  assert(
    coloniaTagline("Mazatlán") === "¿Cómo está tu colonia en Mazatlán?",
    "con ciudad",
  );
  assert(
    siteDocumentTitle() === "Pulso Ciudadano · Cómo está tu colonia hoy",
    "title neutro",
  );
  assert(
    siteDocumentTitle("Culiacán").includes("Culiacán"),
    "title con ciudad",
  );
  assert(neighborsBlurb(null).includes(SITE_CITIES_LABEL), "blurb global");
  assert(neighborsBlurb("Mazatlán").includes("Mazatlán"), "blurb ciudad");
  assert(!neighborsBlurb("Mazatlán").includes("Culiacán y"), "blurb no mezcla");

  setCityPreference("mazatlan");
  assert(activeColoniaTagline().includes("Mazatlán"), "active mazatlan");
  assert(appShareMessage().includes("Mazatlán"), "share app mazatlan");
  assert(appShareMessage().includes("pulso-ciudadano.com"), "share tiene link");

  setCityPreference("culiacan");
  assert(activeColoniaTagline().includes("Culiacán"), "active culiacan");

  setCityPreference(null);
  console.log("brandCopy.test.ts OK");
}

run();
