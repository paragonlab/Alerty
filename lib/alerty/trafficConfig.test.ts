/**
 * Run: npx tsx lib/alerty/trafficConfig.test.ts
 */
import {
  getTomTomKey,
  isTrafficFeatureFlagOn,
  isTrafficMockEnabled,
  tomTomTrafficTileUrlTemplate,
  TOMTOM_ATTRIBUTION,
} from "./trafficConfig";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(typeof isTrafficFeatureFlagOn() === "boolean", "flag bool");
  assert(TOMTOM_ATTRIBUTION.includes("TomTom"), "atribución");

  const prevKey = process.env.EXPO_PUBLIC_TOMTOM_KEY;
  const prevAlt = process.env.EXPO_PUBLIC_TOMTOM_API_KEY;
  const prevMock = process.env.EXPO_PUBLIC_TRAFFIC_MOCK;
  try {
    delete process.env.EXPO_PUBLIC_TOMTOM_KEY;
    delete process.env.EXPO_PUBLIC_TOMTOM_API_KEY;
    process.env.EXPO_PUBLIC_TRAFFIC_MOCK = "0";
    assert(getTomTomKey() === "", "sin key");
    assert(tomTomTrafficTileUrlTemplate() === null, "sin template sin key");

    process.env.EXPO_PUBLIC_TOMTOM_KEY = "test-key-123";
    const url = tomTomTrafficTileUrlTemplate();
    assert(url && url.includes("tomtom.com"), "url tomtom");
    assert(url!.includes("relative0"), "flow relative0");
    assert(url!.includes("test-key-123"), "key en url");

    process.env.EXPO_PUBLIC_TRAFFIC_MOCK = "1";
    assert(isTrafficMockEnabled(), "mock on");
  } finally {
    if (prevKey === undefined) delete process.env.EXPO_PUBLIC_TOMTOM_KEY;
    else process.env.EXPO_PUBLIC_TOMTOM_KEY = prevKey;
    if (prevAlt === undefined) delete process.env.EXPO_PUBLIC_TOMTOM_API_KEY;
    else process.env.EXPO_PUBLIC_TOMTOM_API_KEY = prevAlt;
    if (prevMock === undefined) delete process.env.EXPO_PUBLIC_TRAFFIC_MOCK;
    else process.env.EXPO_PUBLIC_TRAFFIC_MOCK = prevMock;
  }

  console.log("trafficConfig.test.ts OK");
}

run();
