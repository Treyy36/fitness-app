import sharp from 'sharp';

async function generateIcons() {
  // Create a simple SVG with a dumbbell-like design on a dark background
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#0f172a"/>
  <g transform="translate(256,256)" fill="none" stroke="#6366f1" stroke-width="28" stroke-linecap="round">
    <!-- Barbell -->
    <line x1="-160" y1="0" x2="160" y2="0"/>
    <!-- Left plates -->
    <rect x="-180" y="-50" width="20" height="100" rx="6" fill="#818cf8"/>
    <rect x="-210" y="-38" width="20" height="76" rx="6" fill="#a5b4fc"/>
    <!-- Right plates -->
    <rect x="160" y="-50" width="20" height="100" rx="6" fill="#818cf8"/>
    <rect x="190" y="-38" width="20" height="76" rx="6" fill="#a5b4fc"/>
  </g>
</svg>`;

  const sizes = [
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
    { size: 180, name: 'apple-touch-icon.png' },
  ];

  for (const { size, name } of sizes) {
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(`public/${name}`);
    console.log(`✓ Generated ${name} (${size}x${size})`);
  }
}

generateIcons().catch(console.error);
