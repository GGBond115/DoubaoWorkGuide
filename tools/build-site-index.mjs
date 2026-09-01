/** 从完整内容生成首页、导读和目录所需的轻量索引。 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "site/content/site-content.json");
const outputPath = path.join(root, "site/content/site-index.json");
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

const plainText = (markdown = "") =>
  markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^[-*>]+\s*/gm, "")
    .replace(/[|`*_~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const documents = source.documents.map((doc) => {
  const body = plainText(doc.content || "");
  const withoutRepeatedTitle = body.startsWith(doc.title) ? body.slice(doc.title.length).trim() : body;
  return {
    nodeToken: doc.nodeToken,
    parentToken: doc.parentToken,
    title: doc.title,
    hasChild: Boolean(doc.hasChild),
    depth: doc.depth,
    order: doc.order,
    imageCount: doc.images?.length || 0,
    videoCount: doc.videos?.length || 0,
    charCount: doc.content?.length || 0,
    excerpt: withoutRepeatedTitle.slice(0, 180),
  };
});

const output = {
  schemaVersion: source.schemaVersion,
  fetchedAt: source.fetchedAt,
  generatedFrom: "site-content.json",
  nodeCount: documents.length,
  mediaErrorCount: source.mediaErrorCount || 0,
  documents,
};

fs.writeFileSync(outputPath, `${JSON.stringify(output)}\n`);
console.log(
  JSON.stringify({
    status: "PASS",
    output: path.relative(root, outputPath),
    documents: documents.length,
    bytes: fs.statSync(outputPath).size,
  })
);
