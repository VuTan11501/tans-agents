export const JS_SANDBOX_WORKER_SOURCE = String.raw`
const originalLog = console.log.bind(console)
const originalError = console.error.bind(console)
const serialize = (value) => {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

console.log = (...args) => {
  self.postMessage({ type: "stdout", text: args.map(serialize).join(" ") })
  originalLog(...args)
}

console.error = (...args) => {
  self.postMessage({ type: "stderr", text: args.map(serialize).join(" ") })
  originalError(...args)
}

self.addEventListener("message", async (event) => {
  const code = event.data && event.data.code
  if (typeof code !== "string") return
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const result = await new AsyncFunction("fetch", '"use strict";\n' + code)(fetch.bind(self))
    if (result !== undefined) {
      self.postMessage({ type: "stdout", text: serialize(result) })
    }
    self.postMessage({ type: "done" })
  } catch (error) {
    self.postMessage({ type: "stderr", text: error && error.stack ? error.stack : String(error) })
    self.postMessage({ type: "error" })
  }
})
`