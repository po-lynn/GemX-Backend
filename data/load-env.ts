/** Load .env then .env.local so CLI scripts (seed, etc.) see the same env as Next.js. */
import "dotenv/config"
import { config } from "dotenv"
config({ path: ".env.local", override: true })
