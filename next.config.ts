import { withWorkflow } from "workflow/next"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "pdf-lib", "pg", "better-auth"],
}

export default withWorkflow(nextConfig)
