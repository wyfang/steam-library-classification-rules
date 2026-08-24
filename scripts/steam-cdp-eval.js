#!/usr/bin/env node

const [, , targetPattern = "Steam$", expressionArgument, outputPath] = process.argv;

if (!expressionArgument) {
  console.error(
    "usage: steam-cdp-eval.js <target-regexp> <base64-expression|@file> [output-file]",
  );
  process.exit(2);
}

const targets = await fetch("http://127.0.0.1:8080/json/list").then((response) =>
  response.json(),
);
const matcher = new RegExp(targetPattern, "i");
const target = targets.find(
  (item) => matcher.test(item.title || "") || matcher.test(item.url || ""),
);

if (!target) {
  console.error(`No Steam target matched ${targetPattern}`);
  process.exit(3);
}

const expression = expressionArgument.startsWith("@")
  ? await import("node:fs/promises").then((fs) =>
      fs.readFile(expressionArgument.slice(1), "utf8"),
    )
  : Buffer.from(expressionArgument, "base64").toString("utf8");
const socket = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 1;

const result = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("CDP evaluation timed out")), 30000);
  socket.addEventListener("open", () => {
    socket.send(
      JSON.stringify({
        id: nextId++,
        method: "Runtime.evaluate",
        params: {
          expression,
          awaitPromise: true,
          returnByValue: true,
          generatePreview: false,
        },
      }),
    );
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    clearTimeout(timer);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  });
  socket.addEventListener("error", reject);
});

socket.close();
if (result.exceptionDetails) {
  console.error(JSON.stringify(result.exceptionDetails, null, 2));
  process.exit(4);
}

const serialized = JSON.stringify(result.result?.value ?? null);
if (outputPath) {
  await import("node:fs/promises").then((fs) => fs.writeFile(outputPath, serialized));
  process.stdout.write(`${outputPath}\n`);
} else {
  process.stdout.write(serialized);
}
