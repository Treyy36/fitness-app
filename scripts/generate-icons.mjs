import sharp from 'sharp';

async function generateIcons() {
  // Use work.png as the source image for all icon sizes
  const sourcePath = 'public/work.png';

  const sizes = [
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
    { size: 180, name: 'apple-touch-icon.png' },
  ];

  for (const { size, name } of sizes) {
    await sharp(sourcePath)
      .resize(size, size)
      .png()
      .toFile(`public/${name}`);
    console.log(`✓ Generated ${name} (${size}x${size})`);
  }

  // Also generate a 32x32 favicon
  await sharp(sourcePath)
    .resize(32, 32)
    .png()
    .toFile('public/favicon-32.png');
  console.log('✓ Generated favicon-32.png (32x32)');
}

generateIcons().catch(console.error);
