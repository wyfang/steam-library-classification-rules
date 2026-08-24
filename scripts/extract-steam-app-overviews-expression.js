(() => {
  const tile = document.querySelector(".WYgDg9NyCcMIVuMyZ_NBC");
  if (!tile) return { error: "No app tile found" };
  const fiberKey = Object.keys(tile).find((key) => key.startsWith("__reactFiber$"));
  let fiber = tile[fiberKey];
  while (fiber && !Array.isArray(fiber.memoizedProps?.appOverviews)) fiber = fiber.return;
  const apps = fiber?.memoizedProps?.appOverviews;
  if (!apps) return { error: "No app overview array found" };

  const normalize = (value, depth = 0) => {
    if (value == null || ["string", "number", "boolean"].includes(typeof value)) {
      return value;
    }
    if (typeof value === "bigint") return value.toString();
    if (typeof value === "function" || depth >= 5) return undefined;
    if (value instanceof Set) return Array.from(value, (item) => normalize(item, depth + 1));
    if (value instanceof Map) {
      return Array.from(value, ([key, item]) => [normalize(key, depth + 1), normalize(item, depth + 1)]);
    }
    if (Array.isArray(value)) return value.map((item) => normalize(item, depth + 1));
    if (typeof value[Symbol.iterator] === "function") {
      return Array.from(value, (item) => normalize(item, depth + 1));
    }
    const output = {};
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (!("value" in descriptor)) continue;
      const normalized = normalize(descriptor.value, depth + 1);
      if (normalized !== undefined) output[key] = normalized;
    }
    return output;
  };

  return apps.map((app) => normalize(app));
})()
