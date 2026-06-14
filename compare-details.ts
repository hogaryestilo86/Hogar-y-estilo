import fs from "fs";

const local = JSON.parse(fs.readFileSync("products.json", "utf-8"));
const github = JSON.parse(fs.readFileSync("github_original_products.json", "utf-8"));

const localIds = local.map((p: any) => p.id);
const githubIds = github.map((p: any) => p.id);

console.log("Local count:", local.length);
console.log("GitHub count:", github.length);

const onlyLocal = localIds.filter((id: string) => !githubIds.includes(id));
console.log("IDs only in Local (not on GitHub):", onlyLocal);

const onlyGithub = githubIds.filter((id: string) => !localIds.includes(id));
console.log("IDs only on GitHub (not locally):", onlyGithub);

for (const id of onlyLocal) {
  const item = local.find((p: any) => p.id === id);
  console.log(` - Only Local: ${item.id} - ${item.title || item.name}`);
}

for (const id of onlyGithub) {
  const item = github.find((p: any) => p.id === id);
  console.log(` - Only GitHub: ${item.id} - ${item.title || item.name}`);
}
