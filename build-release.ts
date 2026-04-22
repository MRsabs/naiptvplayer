import { $, argv, chalk, path, fs } from "zx";

const version = argv._[0];

if (!version) {
  console.log(chalk.red("❌ Version is required"));
  console.log(chalk.yellow("Usage: pnpm release 0.1.0"));
  process.exit(1);
}

console.log(chalk.cyan(`\n🚀 Building Not Another IPTV Player v${version}`));

// Check for signing key before building
console.log(chalk.yellow("\n🔑 Checking for signing key..."));
const keyPath = path.join(import.meta.dirname, "signature.key");

try {
  await fs.access(keyPath);
  console.log(chalk.green("✅ Signing key found"));
} catch {
  console.log(chalk.red(`❌ Signing key not found at ${keyPath}`));
  console.log(
    chalk.yellow("Run: pnpm tauri signer generate -w ./signature.key"),
  );
  process.exit(1);
}

// Build the application (with TAURI_SIGNING_PRIVATE_KEY in environment)
console.log(chalk.yellow("\n📦 Building application..."));
console.log(chalk.gray("(Tauri will automatically sign the installer)\n"));

// Set the signing key in environment
const keyContent = await fs.readFile(keyPath, "utf-8");
process.env.TAURI_SIGNING_PRIVATE_KEY = keyContent;
process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "";

await $`pnpm tauri build`;

// Find the NSIS installer
const bundlePath = "src-tauri/target/release/bundle/nsis";
const files = await fs.readdir(bundlePath);

const exeInstaller = files.find((f: string) => f.endsWith("-setup.exe"));

if (!exeInstaller) {
  console.log(chalk.red(`❌ NSIS installer not found in ${bundlePath}`));
  process.exit(1);
}

const exePath = path.join(bundlePath, exeInstaller);
console.log(chalk.cyan(`\n📄 Found installer: ${exeInstaller}`));

// Read the auto-generated signature file
const signaturePath = `${exePath}.sig`;
try {
  await fs.access(signaturePath);
  console.log(
    chalk.green(`✅ Signature found: ${path.basename(signaturePath)}`),
  );
} catch {
  console.log(chalk.red(`❌ Signature file not found at ${signaturePath}`));
  console.log(
    chalk.yellow("Make sure createUpdaterArtifacts is true in tauri.conf.json"),
  );
  process.exit(1);
}

// Generate Static JSON File for updater
console.log(chalk.yellow("\n📝 Generating latest.json..."));
const sigContent = await fs.readFile(signaturePath, "utf-8");
const manifest = {
  version,
  notes: `Release version ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature: sigContent.trim(),
      url: `https://github.com/MRsabs/naiptvplayer/releases/download/v${version}/${exeInstaller}`,
    },
  },
};

await fs.writeFile("latest.json", JSON.stringify(manifest, null, 2));

console.log(chalk.green("✅ Generated latest.json"));
console.log(chalk.green("\n✅ Build completed successfully!"));

console.log(chalk.yellow("\n📋 Next steps:"));
console.log("1. Go to: https://github.com/MRsabs/naiptvplayer/releases/new");
console.log(`2. Tag: v${version}`);
console.log(`3. Upload: ${exeInstaller}`);
console.log("4. Upload: latest.json");
console.log("5. Publish the release");
console.log(chalk.cyan(`\n📂 Files location: ${bundlePath}`));
