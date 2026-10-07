/**
 * Run: npx --yes tsx lib/alerty/pinArt.test.ts
 */
import {
  SPONSOR_PIN_H,
  SPONSOR_PIN_W,
  citizenPinSvg,
  giroFromPinShape,
  girosForZoneType,
  pulsoPinSvg,
  shouldShowSponsorName,
  sponsorPinAnchor,
  sponsorPinDisplaySize,
  sponsorPinSvg,
  sponsorPinTipX,
  sponsorPinTipY,
  truncateSponsorName,
} from "./pinArt";
import type { PinGiro, PinShape } from "./types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(SPONSOR_PIN_H >= 48 && SPONSOR_PIN_H <= 52, "pin height ~48–52px");
  assert(SPONSOR_PIN_W > 0, "pin width positive");

  const noName = sponsorPinDisplaySize(false);
  const withName = sponsorPinDisplaySize(true);
  assert(withName.h > noName.h, "name tag grows canvas height");
  assert(withName.w > noName.w, "name tag grows canvas width");

  assert(sponsorPinTipX(false) === SRC_CENTER_X(false), "tip X centered without tag");
  assert(sponsorPinTipY(false) === sponsorPinTipY(true), "tip Y stable with/without tag");
  assert(sponsorPinTipY(false) < noName.h, "tip above bottom of balloon canvas");
  assert(sponsorPinTipY(true) < withName.h, "tip above bottom when tag present");

  const a0 = sponsorPinAnchor(false);
  const a1 = sponsorPinAnchor(true);
  assert(a0.x > 0.4 && a0.x < 0.6, "anchor x ~center");
  assert(a1.y < a0.y, "with tag, normalized tip Y is lower (taller canvas)");

  assert(shouldShowSponsorName({ zoom: 15 }), "zoom 15 shows name");
  assert(!shouldShowSponsorName({ zoom: 12 }), "zoom 12 hides name");
  assert(shouldShowSponsorName({ latitudeDelta: 0.015 }), "close delta shows name");
  assert(!shouldShowSponsorName({ latitudeDelta: 0.16 }), "city delta hides name");

  assert(giroFromPinShape("flag") === "tienda", "flag → tienda");
  assert(giroFromPinShape("pin") === "generico", "pin → generico");
  assert(giroFromPinShape("house", "refugio") === "casa", "house refugio → casa");
  assert(giroFromPinShape("house", "anuncio") === "tienda", "house aliado → tienda");
  assert(giroFromPinShape("shield") === "escudo", "shield → escudo");
  assert(girosForZoneType("anuncio").includes("farmacia"), "aliado has farmacia");
  assert(girosForZoneType("refugio").includes("escudo"), "refugio has escudo");
  assert(!girosForZoneType("refugio").includes("cafe"), "refugio has no cafe");

  assert(truncateSponsorName("") === "Aliado", "empty name falls back");
  assert(truncateSponsorName("Café Luna") === "Café Luna", "short name intact");
  const long = truncateSponsorName("Farmacias del Ahorro – Centro Histórico Culiacán");
  assert(long.endsWith("…"), "long name gets ellipsis");

  const giros: PinGiro[] = ["tienda", "farmacia", "cafe", "generico", "casa", "escudo"];
  for (const giro of giros) {
    const zoneType = giro === "casa" || giro === "escudo" ? "refugio" : "anuncio";
    const svg = sponsorPinSvg({
      zoneType,
      giro,
      name: "Café Luna",
      showName: false,
    });
    assert(svg.includes('viewBox="0 0 120 132"'), `${giro} balloon viewBox`);
    assert(svg.includes("#1A1A1A"), `${giro} dark outline`);
    assert(svg.includes("A51,51"), `${giro} balloon arc`);
    assert(!svg.includes("Café Luna"), `${giro} hides name when showName=false`);
    assert(!svg.includes("radialGradient"), `${giro} flat (no clay)`);
  }

  const named = sponsorPinSvg({
    zoneType: "anuncio",
    giro: "cafe",
    name: "Café Luna",
    showName: true,
  });
  assert(named.includes('viewBox="0 0 170 160"'), "named viewBox");
  assert(named.includes("Café Luna"), "named shows label");
  assert(named.includes("<text"), "named has text node");

  const escaped = sponsorPinSvg({
    zoneType: "anuncio",
    giro: "generico",
    name: "A&B <x>",
    showName: true,
  });
  assert(escaped.includes("&amp;"), "ampersand escaped");
  assert(escaped.includes("&lt;"), "angles escaped");

  const withLogo = sponsorPinSvg({
    zoneType: "anuncio",
    giro: "farmacia",
    name: "Logo Co",
    logoUrl: "https://cdn.example/logo.png",
    showName: false,
  });
  assert(withLogo.includes("<image"), "logo renders as image");
  assert(withLogo.includes("https://cdn.example/logo.png"), "logo url present");
  assert(withLogo.includes("r=\"17\""), "badge ~22% larger than mock r=14");

  const shapes: PinShape[] = ["flag", "pin", "house", "shield"];
  for (const shape of shapes) {
    const svg = sponsorPinSvg({ shape, zoneType: "anuncio", name: "X", showName: false });
    assert(svg.includes("<path"), `${shape} still renders via legacy mapping`);
  }

  const citizen = citizenPinSvg({
    characterId: "vecina",
    category: "balacera",
    showBadge: true,
    showName: false,
  });
  assert(citizen.includes("#FF9EB5"), "vecina bg");
  assert(citizen.includes("#D9342B"), "balacera badge color");
  assert(citizen.includes("A51,51"), "citizen balloon");

  const pulsoA = pulsoPinSvg({
    category: "incendio",
    logoUrl: "https://cdn.example/ln.png",
    showName: false,
  });
  assert(pulsoA.includes("<image"), "pulso A logo");
  assert(pulsoA.includes("#EF4B23"), "incendio color");

  const pulsoB = pulsoPinSvg({ category: "robo", source: "rss", showName: false });
  assert(!pulsoB.includes("<image"), "pulso B no logo");
  assert(pulsoB.includes("#C79A1E"), "robo color");

  const pulsoC = pulsoPinSvg({
    category: "detonaciones",
    logoUrl: "https://cdn.example/x.png",
    extraSources: 3,
  });
  assert(pulsoC.includes("+3"), "cluster counter");

  console.log("pinArt tests ok");
}

function SRC_CENTER_X(showName: boolean): number {
  return sponsorPinTipX(showName);
}

run();
