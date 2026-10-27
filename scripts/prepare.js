const { execSync } = require("child_process");

try {
  execSync("git rev-parse --git-dir", { stdio: "ignore" });
  execSync("git config core.hooksPath .githooks", { stdio: "inherit" });
} catch {
  // CLI deploys upload files without .git. npm install still has to succeed.
}
