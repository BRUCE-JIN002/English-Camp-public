// Run through `docker compose run --rm -T --no-deps -v /absolute/media:/import:ro server node < import-media.cjs`.
const fs = require('node:fs');
const path = require('node:path');
const Minio = require('minio');
const client = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: Number(process.env.MINIO_PORT),
  useSSL: !!Number(process.env.MINIO_USE_SSL),
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});
async function main() {
  for (const bucket of ['course', 'avatar']) {
    if (!await client.bucketExists(bucket)) await client.makeBucket(bucket);
    await client.setBucketPolicy(bucket, JSON.stringify({
      Version: '2012-10-17',
      Statement: [{ Effect: 'Allow', Principal: '*', Action: ['s3:GetObject'], Resource: [`arn:aws:s3:::${bucket}/*`] }],
    }));
    const root = `/import/${bucket}`;
    if (!fs.existsSync(root)) continue;
    let count = 0;
    async function walk(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) await walk(file);
        else if (entry.isFile()) {
          const type = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[path.extname(file).toLowerCase()] || 'application/octet-stream';
          await client.fPutObject(bucket, path.relative(root, file), file, { 'Content-Type': type });
          count++;
        }
      }
    }
    await walk(root);
    console.log(`${bucket}: ${count} objects imported`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
