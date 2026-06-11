// Tiny DB query helper. Reads the gitignored session-pooler URI from pipeline/.db_url
// (percent-encoded password) and runs SQL passed as argv[2], or piped via stdin.
//   node pipeline/q.mjs "select count(*) from recipes;"
import pg from "pg";
import { readFileSync } from "fs";

const url = readFileSync(new URL("./.db_url", import.meta.url), "utf8").trim();
const sql = process.argv[2] || readFileSync(0, "utf8");

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const res = await client.query(sql);
  if (Array.isArray(res)) {
    for (const r of res) console.log(JSON.stringify(r.rows, null, 2));
  } else {
    console.log(JSON.stringify(res.rows, null, 2));
  }
} finally {
  await client.end();
}
