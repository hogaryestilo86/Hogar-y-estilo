import fs from "fs";

const local = JSON.parse(fs.readFileSync("products.json", "utf-8"));
const github = JSON.parse(fs.readFileSync("github_original_products.json", "utf-8"));

console.log("Comparing media URLs:");
let diffCount = 0;
for (const gp of github) {
  const lp = local.find((p: any) => p.id === gp.id);
  if (!lp) {
    console.log(` - Product ${gp.id} doesn't exist in local`);
    continue;
  }
  const gUrls = (gp.media || []).map((m: any) => m.url);
  const lUrls = (lp.media || []).map((m: any) => m.url);
  
  const gBackupUrls = (gp.media || []).map((m: any) => m.backupUrl || "");
  const lBackupUrls = (lp.media || []).map((m: any) => m.backupUrl || "");

  if (JSON.stringify(gUrls) !== JSON.stringify(lUrls) || JSON.stringify(gBackupUrls) !== JSON.stringify(lBackupUrls)) {
    diffCount++;
    console.log(`\nProduct diff: ${gp.id} - ${gp.title || gp.name}`);
    console.log("  GitHub URLs:", gUrls);
    console.log("  Local URLs :", lUrls);
    console.log("  GitHub Backup URLs:", gBackupUrls);
    console.log("  Local Backup URLs :", lBackupUrls);
  }
}
console.log(`Total products with media diff: ${diffCount}`);
