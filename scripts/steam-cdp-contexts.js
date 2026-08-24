#!/usr/bin/env node

const [, , targetPattern = "Steam$", expressionArgument] = process.argv;
if (!expressionArgument) {
  console.error("usage: steam-cdp-contexts.js <target-regexp> <base64-expression|@file>");
  process.exit(2);
}

const expression = expressionArgument.startsWith("@")
  ? await import("node:fs/promises").then((fs) =>
      fs.readFile(expressionArgument.slice(1), "utf8"),
    )
  : Buffer.from(expressionArgument, "base64").toString("utf8");
const targets = await fetch("http://127.0.0.1:8080/json/list").then((response) =>
  response.json(),
);
const matcher = new RegExp(targetPattern, "i");
const target = targets.find(
  (item) => matcher.test(item.title || "") || matcher.test(item.url || ""),
);
if (!target) throw new Error(`No Steam target matched ${targetPattern}`);

const socket = new WebSocket(target.webSocketDebuggerUrl);
const contexts = new Map();
const pending = new Map();
let nextId = 1;

function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.executionContextCreated") {
    contexts.set(message.params.context.id, message.params.context);
  }
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  }
});

await command("Runtime.enable");
await new Promise((resolve) => setTimeout(resolve, 500));
const output = [];
for (const context of contexts.values()) {
  try {
    const result = await command("Runtime.evaluate", {
      expression,
      contextId: context.id,
      awaitPromise: true,
      returnByValue: true,
      generatePreview: false,
    });
    output.push({
      context: {
        id: context.id,
        name: context.name,
        origin: context.origin,
        auxData: context.auxData,
      },
      value: result.result?.value,
      exception: result.exceptionDetails,
    });
  } catch (error) {
    output.push({ context: { id: context.id, name: context.name }, error: String(error) });
  }
}
socket.close();
process.stdout.write(JSON.stringify(output));
