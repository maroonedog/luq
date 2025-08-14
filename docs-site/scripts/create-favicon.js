const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

async function createFavicons() {
  const inputPath = path.join(__dirname, "../public/img/luq-logo.png");
  const outputDir = path.join(__dirname, "../public");

  // Create different sizes for favicon
  const sizes = [16, 32, 48, 64, 128, 256];

  for (const size of sizes) {
    await sharp(inputPath)
      .resize(size, size)
      .toFile(path.join(outputDir, `favicon-${size}x${size}.png`));
  }

  // Create main favicon.ico (32x32)
  await sharp(inputPath)
    .resize(32, 32)
    .toFile(path.join(outputDir, "favicon.ico"));

  console.log("Favicons created successfully!");
}

createFavicons().catch(console.error);
