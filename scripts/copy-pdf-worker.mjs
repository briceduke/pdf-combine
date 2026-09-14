import { copyFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const rootDirectory = join(dirname(fileURLToPath(import.meta.url)), "..")

copyFileSync(
  require.resolve("pdfjs-dist/build/pdf.worker.min.mjs"),
  join(rootDirectory, "public", "pdf.worker.min.mjs")
)
