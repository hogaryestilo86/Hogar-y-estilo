import { execSync } from "child_process";

try {
  console.log("git status:");
  console.log(execSync("git status").toString());
} catch (e: any) {
  console.error("git status failed:", e.message);
}

try {
  console.log("git diff head or diff of products.json:");
  console.log(execSync("git diff --name-status").toString());
} catch (e: any) {
  console.error(e.message);
}
