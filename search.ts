import fs from "fs";
import path from "path";

function searchFiles(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".next" && file !== "dist" && file !== ".git") {
        searchFiles(fullPath);
      }
    } else {
      if (file.toLowerCase().includes("product") || file.toLowerCase().includes("catalog") || file.toLowerCase().includes("backup")) {
        console.log("Found file:", fullPath, "Size:", stat.size);
      }
    }
  }
}

console.log("Searching for files containing 'product', 'catalog' or 'backup'...");
searchFiles(".");
