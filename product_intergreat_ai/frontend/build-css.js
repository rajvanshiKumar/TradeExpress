const { compile, optimize } = require("@tailwindcss/node");
const { Scanner } = require("@tailwindcss/oxide");
const fs = require("fs");
const path = require("path");

async function build() {
  const inputCss = fs.readFileSync(path.resolve(__dirname, "src/app/globals.input.css"), "utf8");
  const compiler = await compile(inputCss, {
    base: path.resolve(__dirname, "src/app"),
    from: path.resolve(__dirname, "src/app/globals.input.css"),
    onDependency: () => {},
  });
  const scanner = new Scanner({
    sources: [{ base: path.resolve(__dirname, "src"), pattern: "**/*", negated: false }],
  });
  const candidates = scanner.scan();
  console.log(`Scanned ${candidates.length} candidate classes.`);
  const compiled = compiler.build([...candidates]);
  const optimized = optimize(compiled, { minify: false }).code;
  fs.writeFileSync(path.resolve(__dirname, "src/app/globals.css"), optimized);
  console.log(`Generated src/app/globals.css (${optimized.length} bytes).`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
