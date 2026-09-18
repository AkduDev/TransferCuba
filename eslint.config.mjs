import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([
    {
        extends: [...next],
    },
    {
        // Las pruebas de Playwright no son React. `rules-of-hooks` marca como
        // hook el `use(...)` con el que un fixture entrega su valor, que no
        // tiene nada que ver: es la convención de Playwright para envolver
        // setup y teardown alrededor de la prueba.
        files: ["e2e/**/*.ts", "playwright.config.ts"],
        rules: {
            "react-hooks/rules-of-hooks": "off",
        },
    },
]);
