/**
 * Run: npx --yes tsx lib/alerty/cityPreference.test.ts
 *
 * Mockea AsyncStorage / Platform para poder correr en Node sin bundler RN.
 */
import Module from "node:module";

const memory = new Map<string, string>();

const origLoad = (Module as any)._load;
(Module as any)._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === "@react-native-async-storage/async-storage") {
    return {
      __esModule: true,
      default: {
        getItem: async (key: string) => memory.get(key) ?? null,
        setItem: async (key: string, value: string) => {
          memory.set(key, value);
        },
        removeItem: async (key: string) => {
          memory.delete(key);
        },
      },
    };
  }
  if (request === "react-native") {
    return { Platform: { OS: "ios" } };
  }
  return origLoad(request, parent, isMain);
};

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function run() {
  const {
    CITY_IDS,
    CITY_PREFERENCE_KEY,
    getActiveCitySlug,
    getCityPreference,
    setCityPreference,
    subscribeCityChange,
  } = await import("./city");
  const { hydrateCityPreference, persistCityPreference } = await import("./cityPreference");
  const { cityIdForFeedQuery, filterRowsByActiveCity } = await import("./cityFeeds");

  setCityPreference(null);
  memory.clear();

  assert(getActiveCitySlug() === "culiacan", "default active is culiacan");
  assert(getCityPreference() === null, "no preference stored yet");

  await persistCityPreference("mazatlan");
  assert(getActiveCitySlug() === "mazatlan", "persist switches active slug");
  assert(getCityPreference() === "mazatlan", "preference is mazatlan");
  assert(memory.get(CITY_PREFERENCE_KEY) === "mazatlan", "storage keeps mazatlan");

  setCityPreference(null);
  assert(getActiveCitySlug() === "culiacan", "reset to default before hydrate");
  const hydrated = await hydrateCityPreference();
  assert(hydrated === "mazatlan", "hydrate returns mazatlan");
  assert(getActiveCitySlug() === "mazatlan", "hydrate applies mazatlan");

  assert(cityIdForFeedQuery() === CITY_IDS.mazatlan, "feed query uses mazatlan id");
  const rows = [
    { id: "c", city_id: CITY_IDS.culiacan },
    { id: "m", city_id: CITY_IDS.mazatlan },
  ];
  const filtered = filterRowsByActiveCity(rows);
  assert(filtered.length === 1 && filtered[0]!.id === "m", "feed filter by selected city");

  let heard: string | null = null;
  const unsub = subscribeCityChange((slug) => {
    heard = slug;
  });
  await persistCityPreference("culiacan");
  assert(heard === "culiacan", "subscribers notified on city change");
  unsub();

  setCityPreference(null);
  memory.clear();
  console.log("cityPreference tests ok");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
