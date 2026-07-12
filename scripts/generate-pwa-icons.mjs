import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/** PNG azul 1x1 válido — placeholders escalados pelo SO para ícones PWA. */
const MINI_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(iconsDir, { recursive: true });

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
for (const s of sizes) {
  fs.writeFileSync(path.join(iconsDir, `icon-${s}.png`), MINI_PNG);
}
fs.writeFileSync(path.join(iconsDir, "icon-maskable-192.png"), MINI_PNG);
fs.writeFileSync(path.join(iconsDir, "icon-maskable-512.png"), MINI_PNG);
console.log("Ícones PWA gerados em public/icons/");
