(() => {
  const roots = [];
  const rootSet = new Set();
  for (const element of document.querySelectorAll("*")) {
    const key = Object.getOwnPropertyNames(element).find((name) =>
      name.startsWith("__reactFiber$"),
    );
    if (key) {
      let fiber = element[key];
      while (fiber.return) fiber = fiber.return;
      if (!rootSet.has(fiber)) {
        rootSet.add(fiber);
        roots.push(fiber);
      }
    }
  }
  if (!roots.length) return { error: "React fiber not found" };

  const queue = roots.map((value, index) => ({ value, path: `fiber${index}`, depth: 0 }));
  const seen = new WeakSet();
  const matches = [];
  let visited = 0;

  while (queue.length && visited < 250000 && matches.length < 250) {
    const { value, path, depth } = queue.shift();
    if ((typeof value !== "object" && typeof value !== "function") || !value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    visited += 1;

    if (value instanceof Map && value.size >= 500) {
      const entries = Array.from(value.entries()).slice(0, 2);
      matches.push({
        kind: "Map",
        path,
        size: value.size,
        sampleKeys: entries.map(([key]) => key),
        sampleValueProps: entries.map(([, item]) =>
          item && (typeof item === "object" || typeof item === "function")
            ? Object.getOwnPropertyNames(item).slice(0, 40)
            : typeof item,
        ),
      });
    } else if (Array.isArray(value) && value.length >= 500) {
      matches.push({
        kind: "Array",
        path,
        size: value.length,
        sample: value.slice(0, 3),
      });
    }

    if (depth >= 16) continue;
    let descriptors;
    try {
      descriptors = Object.getOwnPropertyDescriptors(value);
    } catch {
      continue;
    }
    for (const [name, descriptor] of Object.entries(descriptors)) {
      if (!("value" in descriptor)) continue;
      const child = descriptor.value;
      if (!child || (typeof child !== "object" && typeof child !== "function")) continue;
      if (child === globalThis || child instanceof Node) continue;
      if (name === "prototype" || name === "constructor") continue;
      queue.push({ value: child, path: `${path}.${name}`, depth: depth + 1 });
    }
    if (value instanceof Map) {
      let index = 0;
      for (const [key, child] of value) {
        if (index++ >= 100) break;
        if (child && (typeof child === "object" || typeof child === "function")) {
          queue.push({ value: child, path: `${path}.get(${JSON.stringify(key)})`, depth: depth + 1 });
        }
      }
    }
    if (value instanceof Set) {
      let index = 0;
      for (const child of value) {
        if (index++ >= 100) break;
        if (child && (typeof child === "object" || typeof child === "function")) {
          queue.push({ value: child, path: `${path}.setValue`, depth: depth + 1 });
        }
      }
    }
  }
  return { roots: roots.length, visited, queued: queue.length, matches };
})()
