/**
 * Run: npx --yes tsx lib/alerty/pinArt.test.ts
 */
import {
  SPONSOR_PIN_H,
  SPONSOR_PIN_W,
  sponsorPinSvg,
  sponsorPinTipX,
  truncateSponsorName,
} from "./pinArt";
import type { PinShape } from "./types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(SPONSOR_PIN_W > 0 && SPONSOR_PIN_H > 0, "pin size is positive");
  assert(sponsorPinTipX("flag") === SPONSOR_PIN_W / 2, "flag tip is center");
  assert(sponsorPinTipX("pin") === SPONSOR_PIN_W / 2, "pin tip is center");
  assert(sponsorPinTipX("house") === SPONSOR_PIN_W / 2, "house tip is center");
  assert(sponsorPinTipX("shield") === SPONSOR_PIN_W / 2, "shield tip is center");

  assert(truncateSponsorName("") === "Aliado", "empty name falls back");
  assert(truncateSponsorName("   ") === "Aliado", "blank name falls back");
  assert(truncateSponsorName("Café Luna") === "Café Luna", "short name intact");
  const long = truncateSponsorName("Farmacias del Ahorro – Centro Histórico Culiacán");
  assert(long.endsWith("…"), "long name gets ellipsis");
  assert(long.length < 30, "truncated name stays short");
  assert(!long.includes("<"), "truncation does not invent markup");

  const shapes: PinShape[] = ["flag", "pin", "house", "shield"];
  for (const shape of shapes) {
    const svg = sponsorPinSvg({
      color: shape === "shield" ? "#1F9D6E" : "#D9552B",
      shape,
      name: "Café Luna",
    });
    assert(svg.includes(`viewBox="0 0 ${SPONSOR_PIN_W} ${SPONSOR_PIN_H}"`), `${shape} viewBox`);
    assert(svg.includes("Café Luna"), `${shape} shows name`);
    assert(svg.includes("#ffffff") || svg.includes("#fff"), `${shape} white chip`);
    assert(svg.includes("<text"), `${shape} has text`);
    assert(svg.includes("<circle"), `${shape} has ground dot`);
    assert(!svg.includes("radialGradient"), `${shape} is flat (no clay gradients)`);
  }

  const escaped = sponsorPinSvg({
    color: "#D9552B",
    shape: "pin",
    name: `A&B <x>`,
  });
  assert(escaped.includes("&amp;"), "ampersand escaped");
  assert(escaped.includes("&lt;"), "angles escaped");
  assert(!escaped.includes("<x>"), "raw angle tags not present");

  const withLogo = sponsorPinSvg({
    color: "#D9552B",
    shape: "pin",
    name: "Logo Co",
    logoUrl: "https://cdn.example/logo.png",
  });
  assert(withLogo.includes("<image"), "logo renders as image");
  assert(withLogo.includes("https://cdn.example/logo.png"), "logo url present");

  console.log("pinArt tests ok");
}

run();
