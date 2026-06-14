import fs from "fs";

async function fetchGithubProducts() {
  const repo = "hogaryestilo86/Hogar-y-estilo";
  const branch = "main";
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/products.json`;
  
  console.log(`Fetching from GitHub: ${url}`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const products = await res.json();
    console.log(`Successfully fetched ${products.length} products from GitHub.`);
    fs.writeFileSync("github_original_products.json", JSON.stringify(products, null, 2));
    
    console.log("GitHub original products count:", products.length);
    console.log("Sample titles:", products.slice(0, 3).map((p: any) => `${p.id}: ${p.title || p.name} (${p.category})`));
  } catch (err: any) {
    console.error("Failed to fetch from GitHub:", err.message);
  }
}

fetchGithubProducts();
