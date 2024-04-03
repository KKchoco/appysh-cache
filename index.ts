import { mkdir } from "node:fs/promises";
import { Database } from "bun:sqlite";

const cacheDir = "./cache/";
const headers = {
  headers: { "Content-Type": "image/png" },
};
const db = new Database("db.sqlite");

db.query(`create table if not exists users (id INT PRIMARY KEY);`).run();
await mkdir(cacheDir, { recursive: true });

if (Bun.file(cacheDir + "default").size === 0) {
  const resp = await fetch("http://a.ppy.sh/undefined");
  await Bun.write(cacheDir + "default", resp);
}

const server = Bun.serve({
  port: 7030,
  async fetch(req) {
    const path = new URL(req.url).pathname.slice(1);
    if (path === "favicon.ico") {
      return new Response("", headers);
    }
    const userId = db
      .query(`select id from users where id = ${path};`)
      .values();
    if (userId.length !== 0) {
      console.log(userId);
      return new Response(Bun.file(cacheDir + "/default").stream(), headers);
    }
    const file = Bun.file(cacheDir + path);
    if (file.size === 0) {
      return getCache(path);
    } else {
      return new Response(file.stream(), headers);
    }
  },
});

const getCache = async (path: string) => {
  const resp = await fetch("http://a.ppy.sh/" + path);
  const blob = await resp.blob();
  if (
    resp.headers.get("content-length") !== null &&
    resp.headers.get("content-length") === "2343"
  ) {
    db.query(`insert into users (id) values (${path});`).run();
    return new Response(Bun.file(cacheDir + "/default").stream(), headers);
  }
  await Bun.write(cacheDir + path, blob);
  if (resp.status === 200) {
    return new Response(await blob, headers);
  }
  return new Response("404 not found");
};

console.log(`Listening on localhost:${server.port}`);
