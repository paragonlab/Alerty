/**
 * Run: npx --yes tsx lib/alerty/circulo.test.ts
 */
import { canAddCirculoZone, circuloZoneLimit, CIRCULO_FREE_ZONE_LIMIT, CIRCULO_PLUS_ZONE_LIMIT } from "./circulo";
import { communitySourceLabel, isNewsPost } from "./communityLabel";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(circuloZoneLimit(false) === CIRCULO_FREE_ZONE_LIMIT, "free limit is 1");
  assert(circuloZoneLimit(true) === CIRCULO_PLUS_ZONE_LIMIT, "plus limit is 5");
  assert(canAddCirculoZone(0, false), "free can add first zone");
  assert(!canAddCirculoZone(1, false), "free cannot add a second zone");
  assert(canAddCirculoZone(4, true), "plus can add fifth zone");
  assert(!canAddCirculoZone(5, true), "plus cannot add a sixth zone");

  assert(isNewsPost({ source: "rss", trustTier: "news" }), "rss is news");
  assert(!isNewsPost({ source: "x", trustTier: "community" }), "x is not news");
  assert(
    communitySourceLabel({ source: "rss", trustTier: "news", authorName: "Línea Directa" }) ===
      "Línea Directa",
    "rss uses outlet name",
  );
  assert(
    communitySourceLabel({ source: "rss", trustTier: "news", authorName: null }) === "Noticia",
    "rss without name falls back",
  );
  assert(
    communitySourceLabel({ source: "x", trustTier: "community", authorName: "Alguien" }) ===
      "Desde X",
    "x stays Desde X",
  );

  console.log("circulo tests ok");
}

run();
