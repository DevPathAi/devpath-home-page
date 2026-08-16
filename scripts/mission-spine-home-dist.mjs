import { createHash } from 'node:crypto';
import {
  appendFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { gunzipSync, inflateRawSync } from 'node:zlib';

export const homeRepository = 'DevPathAi/devpath-home-page';
export const homeWorkflow = '.github/workflows/mission-spine-home-dist.yml';
export const homeBranch = 'master';

const MIB = 1024 * 1024;
const MAX_ARCHIVE_BYTES = 100 * MIB;
const MAX_TAR_BYTES = 100 * MIB;
const MAX_ZIP_BYTES = 105 * MIB;
const MAX_EVIDENCE_BYTES = 64 * 1024;
const MAX_FILES = 10_000;
const TAR_BLOCK = 512;
const TAR_END_BYTES = TAR_BLOCK * 2;
const SHA40 = /^(?!0{40}$)[0-9a-f]{40}$/;
const SHA64 = /^(?!0{64}$)[0-9a-f]{64}$/;
const SAFE_RELEASE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SAFE_ARTIFACT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const EVIDENCE_KEYS = [
  'candidate_spec_sha256',
  'status',
  'producer_run_id',
  'producer_run_attempt',
  'home_source_sha',
  'dist_sha256',
];
const PACKAGE_FILES = ['dist.tar.gz', 'evidence.json'];

function fail(message) {
  throw new Error(`Mission Spine Home dist failed: ${message}`);
}

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function exact(actual, expected, name) {
  if (actual !== expected) fail(`${name} mismatch`);
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(`${name} must be a positive integer`);
  }
  return value;
}

function sha40(value, name) {
  if (typeof value !== 'string' || !SHA40.test(value)) {
    fail(`${name} must be a nonzero lowercase Git SHA`);
  }
  return value;
}

function sha64(value, name) {
  if (typeof value !== 'string' || !SHA64.test(value)) {
    fail(`${name} must be a nonzero lowercase SHA-256 digest`);
  }
  return value;
}

function releaseId(value) {
  if (typeof value !== 'string' || !SAFE_RELEASE_ID.test(value)) {
    fail('release_id is not a safe identifier');
  }
  return value;
}

function exactOrderedKeys(value, expected, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${name} must be an object`);
  }
  const actual = Object.keys(value);
  if (
    actual.length !== expected.length ||
    actual.some((entry, index) => entry !== expected[index])
  ) {
    fail(`${name} exact ordered key set mismatch`);
  }
}

function regularDirectory(path, name) {
  let info;
  try {
    info = lstatSync(path);
  } catch (error) {
    fail(`${name} is absent: ${error.message}`);
  }
  if (!info.isDirectory() || info.isSymbolicLink()) {
    fail(`${name} must be one regular non-link directory`);
  }
  if (realpathSync(path) !== resolve(path)) {
    fail(`${name} must resolve to its exact path`);
  }
  return info;
}

function regularFile(path, name, maximumBytes) {
  let info;
  try {
    info = lstatSync(path);
  } catch (error) {
    fail(`${name} is absent: ${error.message}`);
  }
  if (!info.isFile() || info.isSymbolicLink()) {
    fail(`${name} must be one regular non-link file`);
  }
  if (maximumBytes !== undefined && (info.size < 1 || info.size > maximumBytes)) {
    fail(`${name} has an invalid byte size`);
  }
  return info;
}

function parseUtf8JsonFile(path, name, maximumBytes = MAX_EVIDENCE_BYTES) {
  regularFile(path, name, maximumBytes);
  const bytes = readFileSync(path);
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    fail(`${name} must be UTF-8 without BOM`);
  }
  try {
    return {
      bytes,
      value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
    };
  } catch (error) {
    fail(`${name} must be valid UTF-8 JSON: ${error.message}`);
  }
}

function validateArchivePath(path) {
  if (
    typeof path !== 'string' ||
    path.length < 1 ||
    path.length > 255 ||
    Buffer.byteLength(path, 'utf8') !== path.length ||
    path.startsWith('/') ||
    path.endsWith('/') ||
    path.includes('\\') ||
    path.includes('\0') ||
    !/^[A-Za-z0-9._/-]+$/.test(path)
  ) {
    fail(`unsafe or noncanonical archive path: ${JSON.stringify(path)}`);
  }
  const parts = path.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) {
    fail(`unsafe archive path segment: ${JSON.stringify(path)}`);
  }
  return path;
}

function validateDistArchivePath(path) {
  const value = validateArchivePath(path);
  const parts = value.split('/');
  if (parts.length < 2 || parts[0] !== 'dist') {
    fail(`tar entry must be beneath the single dist/ root: ${JSON.stringify(path)}`);
  }
  return value;
}

function collectDistFiles(distRoot) {
  const root = resolve(distRoot);
  regularDirectory(root, 'dist root');
  const files = [];
  let total = 0;

  function walk(directory, prefix) {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareAscii(left.name, right.name));
    for (const entry of entries) {
      const path = join(directory, entry.name);
      const relative = validateArchivePath(prefix ? `${prefix}/${entry.name}` : entry.name);
      const before = lstatSync(path, { bigint: true });
      if (before.isSymbolicLink()) fail(`dist entry is a symbolic link: ${relative}`);
      if (before.isDirectory()) {
        walk(path, relative);
        continue;
      }
      if (!before.isFile()) fail(`dist entry is not a regular file: ${relative}`);
      if (before.size > BigInt(MAX_TAR_BYTES)) fail(`dist file is too large: ${relative}`);
      const content = readFileSync(path);
      const after = lstatSync(path, { bigint: true });
      if (
        !after.isFile() ||
        after.isSymbolicLink() ||
        before.dev !== after.dev ||
        before.ino !== after.ino ||
        before.size !== after.size ||
        before.mtimeNs !== after.mtimeNs ||
        BigInt(content.length) !== after.size
      ) {
        fail(`dist file changed while packaging: ${relative}`);
      }
      total += content.length;
      if (total > MAX_TAR_BYTES) fail('dist regular-file bytes exceed 100 MiB');
      files.push({ path: validateDistArchivePath(`dist/${relative}`), content });
      if (files.length > MAX_FILES) fail('dist contains too many files');
    }
  }

  walk(root, '');
  if (files.length === 0) fail('dist contains no regular files');
  files.sort((left, right) => compareAscii(left.path, right.path));
  if (!files.some((file) => file.path === 'dist/index.html')) {
    fail('dist/index.html is absent from the canonical distribution');
  }
  return files;
}

function splitUstarPath(path) {
  const bytes = Buffer.byteLength(path, 'ascii');
  if (bytes <= 100) return { name: path, prefix: '' };
  for (let index = path.lastIndexOf('/'); index > 0; index = path.lastIndexOf('/', index - 1)) {
    const prefix = path.slice(0, index);
    const name = path.slice(index + 1);
    if (Buffer.byteLength(prefix, 'ascii') <= 155 && Buffer.byteLength(name, 'ascii') <= 100) {
      return { name, prefix };
    }
  }
  fail(`archive path does not fit POSIX ustar fields: ${path}`);
}

function writeString(header, offset, length, value, name) {
  const bytes = Buffer.from(value, 'ascii');
  if (bytes.length > length) fail(`${name} exceeds its ustar field`);
  bytes.copy(header, offset);
}

function writeOctal(header, offset, length, value, name) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${name} is invalid`);
  const encoded = value.toString(8).padStart(length - 1, '0');
  if (encoded.length !== length - 1) fail(`${name} exceeds its ustar field`);
  writeString(header, offset, length, `${encoded}\0`, name);
}

function tarHeader(path, size) {
  const checkedPath = validateDistArchivePath(path);
  const { name, prefix } = splitUstarPath(checkedPath);
  const header = Buffer.alloc(TAR_BLOCK);
  writeString(header, 0, 100, name, 'ustar name');
  writeOctal(header, 100, 8, 0o644, 'ustar mode');
  writeOctal(header, 108, 8, 0, 'ustar uid');
  writeOctal(header, 116, 8, 0, 'ustar gid');
  writeOctal(header, 124, 12, size, 'ustar size');
  writeOctal(header, 136, 12, 0, 'ustar mtime');
  header.fill(0x20, 148, 156);
  header[156] = 0x30;
  writeString(header, 257, 6, 'ustar\0', 'ustar magic');
  writeString(header, 263, 2, '00', 'ustar version');
  writeOctal(header, 329, 8, 0, 'ustar devmajor');
  writeOctal(header, 337, 8, 0, 'ustar devminor');
  writeString(header, 345, 155, prefix, 'ustar prefix');
  const checksum = header.reduce((sum, value) => sum + value, 0);
  const encodedChecksum = checksum.toString(8).padStart(6, '0');
  if (encodedChecksum.length !== 6) fail('ustar checksum exceeds its field');
  writeString(header, 148, 8, `${encodedChecksum}\0 `, 'ustar checksum');
  return header;
}

function buildCanonicalTar(files) {
  const chunks = [];
  let size = TAR_END_BYTES;
  for (const file of files) {
    const padding = (TAR_BLOCK - (file.content.length % TAR_BLOCK)) % TAR_BLOCK;
    size += TAR_BLOCK + file.content.length + padding;
    if (size > MAX_TAR_BYTES) fail('canonical tar bytes exceed 100 MiB');
    chunks.push(tarHeader(file.path, file.content.length), file.content);
    if (padding) chunks.push(Buffer.alloc(padding));
  }
  chunks.push(Buffer.alloc(TAR_END_BYTES));
  return Buffer.concat(chunks, size);
}

const CRC32_TABLE = new Uint32Array(256);
for (let index = 0; index < CRC32_TABLE.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  }
  CRC32_TABLE[index] = value >>> 0;
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = (value >>> 8) ^ CRC32_TABLE[(value ^ byte) & 0xff];
  }
  return (value ^ 0xffffffff) >>> 0;
}

function storedDeflate(bytes) {
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += 65_535) {
    const length = Math.min(65_535, bytes.length - offset);
    const final = offset + length === bytes.length;
    const header = Buffer.alloc(5);
    header[0] = final ? 1 : 0;
    header.writeUInt16LE(length, 1);
    header.writeUInt16LE((~length) & 0xffff, 3);
    chunks.push(header, bytes.subarray(offset, offset + length));
  }
  return Buffer.concat(chunks);
}

function canonicalGzip(tarBytes) {
  const header = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0, 0, 0, 0, 0x00, 0x03]);
  const trailer = Buffer.alloc(8);
  trailer.writeUInt32LE(crc32(tarBytes), 0);
  trailer.writeUInt32LE(tarBytes.length >>> 0, 4);
  const archive = Buffer.concat([header, storedDeflate(tarBytes), trailer]);
  if (archive.length > MAX_ARCHIVE_BYTES) fail('dist.tar.gz exceeds 100 MiB');
  return archive;
}

export function createCanonicalHomeArchive(distRoot) {
  return canonicalGzip(buildCanonicalTar(collectDistFiles(distRoot)));
}

function readTarString(field, name) {
  const zero = field.indexOf(0);
  const end = zero === -1 ? field.length : zero;
  if (zero !== -1 && field.subarray(zero).some((value) => value !== 0)) {
    fail(`${name} has nonzero bytes after NUL`);
  }
  const bytes = field.subarray(0, end);
  if (bytes.some((value) => value < 0x20 || value > 0x7e)) {
    fail(`${name} is not printable ASCII`);
  }
  return bytes.toString('ascii');
}

function readTarOctal(field, name) {
  if (field[field.length - 1] !== 0) fail(`${name} is not canonical octal`);
  const digits = field.subarray(0, field.length - 1).toString('ascii');
  if (!/^[0-7]+$/.test(digits)) fail(`${name} is not canonical octal`);
  const value = Number.parseInt(digits, 8);
  if (!Number.isSafeInteger(value)) fail(`${name} is too large`);
  return value;
}

function parseCanonicalTar(tarBytes) {
  if (
    !Buffer.isBuffer(tarBytes) ||
    tarBytes.length < TAR_BLOCK * 3 ||
    tarBytes.length > MAX_TAR_BYTES ||
    tarBytes.length % TAR_BLOCK !== 0
  ) {
    fail('tar byte length is invalid');
  }
  const entries = [];
  let offset = 0;
  while (offset < tarBytes.length) {
    const header = tarBytes.subarray(offset, offset + TAR_BLOCK);
    if (header.every((value) => value === 0)) {
      if (
        offset + TAR_END_BYTES !== tarBytes.length ||
        !tarBytes.subarray(offset).every((value) => value === 0)
      ) {
        fail('tar must end in exactly two zero blocks');
      }
      break;
    }
    const name = readTarString(header.subarray(0, 100), 'tar name');
    const prefix = readTarString(header.subarray(345, 500), 'tar prefix');
    const path = validateDistArchivePath(prefix ? `${prefix}/${name}` : name);
    const size = readTarOctal(header.subarray(124, 136), 'tar size');
    if (!header.equals(tarHeader(path, size))) {
      fail(`tar header metadata or checksum is not canonical: ${path}`);
    }
    if (entries.length && compareAscii(entries.at(-1).path, path) >= 0) {
      fail(`tar paths are duplicated or out of order: ${path}`);
    }
    const contentStart = offset + TAR_BLOCK;
    const contentEnd = contentStart + size;
    const paddedEnd = contentStart + Math.ceil(size / TAR_BLOCK) * TAR_BLOCK;
    if (contentEnd > tarBytes.length - TAR_END_BYTES || paddedEnd > tarBytes.length) {
      fail(`tar entry exceeds archive bounds: ${path}`);
    }
    if (!tarBytes.subarray(contentEnd, paddedEnd).every((value) => value === 0)) {
      fail(`tar padding is nonzero: ${path}`);
    }
    const content = Buffer.from(tarBytes.subarray(contentStart, contentEnd));
    entries.push({ path, size, mode: 0o644, sha256: sha256(content), content });
    if (entries.length > MAX_FILES) fail('tar contains too many files');
    offset = paddedEnd;
  }
  if (entries.length === 0) fail('tar contains no regular files');
  if (!entries.some((entry) => entry.path === 'dist/index.html')) {
    fail('tar must contain dist/index.html');
  }
  return entries;
}

export function inspectCanonicalHomeTar(input, options = {}) {
  let tarBytes;
  if (options.inputIsTar) {
    tarBytes = Buffer.from(input);
  } else {
    const archive = Buffer.from(input);
    if (archive.length < 18 || archive.length > MAX_ARCHIVE_BYTES) {
      fail('dist.tar.gz byte length is invalid');
    }
    const expectedHeader = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0, 0, 0, 0, 0x00, 0x03]);
    if (!archive.subarray(0, 10).equals(expectedHeader)) {
      fail('dist.tar.gz header is not canonical');
    }
    try {
      tarBytes = gunzipSync(archive, { maxOutputLength: MAX_TAR_BYTES });
    } catch (error) {
      fail(`dist.tar.gz cannot be safely decompressed: ${error.message}`);
    }
    const expectedCrc = archive.readUInt32LE(archive.length - 8);
    const expectedSize = archive.readUInt32LE(archive.length - 4);
    if (expectedCrc !== crc32(tarBytes) || expectedSize !== (tarBytes.length >>> 0)) {
      fail('dist.tar.gz trailer does not bind the tar bytes');
    }
  }
  const entries = parseCanonicalTar(tarBytes);
  return options.returnTarBytes ? { entries, tarBytes } : entries;
}

export function createHomeDistEvidence({
  candidateSpecSha256,
  homeSourceSha,
  distSha256,
  producerRunId,
  producerRunAttempt,
}) {
  sha64(candidateSpecSha256, 'candidate_spec_sha256');
  sha40(homeSourceSha, 'home_source_sha');
  sha64(distSha256, 'dist_sha256');
  positiveInteger(producerRunId, 'producer_run_id');
  if (producerRunAttempt !== 1) {
    fail('protected producer requires attempt 1 and a fresh workflow_dispatch');
  }
  return {
    candidate_spec_sha256: candidateSpecSha256,
    status: 'passed',
    producer_run_id: producerRunId,
    producer_run_attempt: 1,
    home_source_sha: homeSourceSha,
    dist_sha256: distSha256,
  };
}

function validateEvidence(value, expected) {
  exactOrderedKeys(value, EVIDENCE_KEYS, 'evidence');
  const canonical = createHomeDistEvidence({
    candidateSpecSha256: expected.candidateSpecSha256,
    homeSourceSha: expected.homeSourceSha,
    distSha256: expected.expectedDistSha256,
    producerRunId: expected.producerRunId,
    producerRunAttempt: expected.producerRunAttempt,
  });
  for (const key of EVIDENCE_KEYS) exact(value[key], canonical[key], `evidence.${key}`);
  return value;
}

function validateExactPackageRoot(packageRoot) {
  regularDirectory(packageRoot, 'Home dist package root');
  const entries = readdirSync(packageRoot, { withFileTypes: true })
    .sort((left, right) => compareAscii(left.name, right.name));
  if (
    entries.length !== PACKAGE_FILES.length ||
    entries.some((entry, index) =>
      entry.name !== PACKAGE_FILES[index] ||
      !entry.isFile() ||
      entry.isSymbolicLink())
  ) {
    fail('package must contain exactly dist.tar.gz and evidence.json');
  }
}

export function validateHomeDistPackage({
  distRoot,
  packageRoot,
  candidateSpecSha256,
  homeSourceSha,
  expectedDistSha256,
  producerRunId,
  producerRunAttempt,
}) {
  sha64(candidateSpecSha256, 'candidate_spec_sha256');
  sha40(homeSourceSha, 'home_source_sha');
  sha64(expectedDistSha256, 'expected dist SHA-256');
  positiveInteger(producerRunId, 'producer_run_id');
  if (producerRunAttempt !== 1) fail('producer_run_attempt must be 1');
  validateExactPackageRoot(packageRoot);

  const archivePath = join(packageRoot, 'dist.tar.gz');
  regularFile(archivePath, 'dist.tar.gz', MAX_ARCHIVE_BYTES);
  const archive = readFileSync(archivePath);
  const distSha256 = sha256(archive);
  exact(distSha256, expectedDistSha256, 'dist.tar.gz SHA-256');
  inspectCanonicalHomeTar(archive);
  const canonical = createCanonicalHomeArchive(distRoot);
  if (!archive.equals(canonical)) fail('dist.tar.gz differs from exact current dist bytes');

  const evidenceFile = parseUtf8JsonFile(join(packageRoot, 'evidence.json'), 'evidence.json');
  validateEvidence(evidenceFile.value, {
    candidateSpecSha256,
    homeSourceSha,
    expectedDistSha256,
    producerRunId,
    producerRunAttempt,
  });
  return { distSha256, evidence: evidenceFile.value };
}

export function packageHomeDist({
  distRoot,
  outputRoot,
  candidateSpecSha256,
  homeSourceSha,
  expectedDistSha256,
  producerRunId,
  producerRunAttempt,
}) {
  sha64(candidateSpecSha256, 'candidate_spec_sha256');
  sha40(homeSourceSha, 'home_source_sha');
  sha64(expectedDistSha256, 'expected dist SHA-256');
  positiveInteger(producerRunId, 'producer_run_id');
  if (producerRunAttempt !== 1) {
    fail('protected producer requires attempt 1 and a fresh workflow_dispatch');
  }
  const archive = createCanonicalHomeArchive(distRoot);
  const distSha256 = sha256(archive);
  exact(distSha256, expectedDistSha256, 'produced dist SHA-256');
  const evidence = createHomeDistEvidence({
    candidateSpecSha256,
    homeSourceSha,
    distSha256,
    producerRunId,
    producerRunAttempt,
  });

  const parent = dirname(resolve(outputRoot));
  regularDirectory(parent, 'Home dist package parent');
  try {
    lstatSync(outputRoot);
    fail('Home dist package output already exists');
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error;
  }
  mkdirSync(outputRoot, { recursive: false, mode: 0o755 });
  writeFileSync(join(outputRoot, 'dist.tar.gz'), archive, { flag: 'wx', mode: 0o644 });
  writeFileSync(join(outputRoot, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o644,
  });
  validateHomeDistPackage({
    distRoot,
    packageRoot: outputRoot,
    candidateSpecSha256,
    homeSourceSha,
    expectedDistSha256,
    producerRunId,
    producerRunAttempt,
  });
  return { distSha256, evidence };
}

function validateWorkflowPath(value) {
  const allowed = new Set([
    homeWorkflow,
    `${homeWorkflow}@${homeBranch}`,
    `${homeWorkflow}@refs/heads/${homeBranch}`,
  ]);
  if (!allowed.has(value)) fail('workflow run path/ref mismatch');
}

export function validateHomeWorkflowRunFacts({
  sourceSha,
  runId,
  runAttempt,
  run,
  branch,
  workflowBytes,
  localWorkflowBytes,
}) {
  sha40(sourceSha, 'source SHA');
  positiveInteger(runId, 'run ID');
  if (runAttempt !== 1) fail('protected producer requires attempt 1');
  exact(run?.id, runId, 'workflow run.id');
  exact(run?.run_attempt, 1, 'workflow run.run_attempt');
  exact(run?.event, 'workflow_dispatch', 'workflow run.event');
  exact(run?.status, 'in_progress', 'workflow run.status');
  exact(run?.conclusion, null, 'workflow run.conclusion');
  exact(run?.head_sha, sourceSha, 'workflow run.head_sha');
  exact(run?.head_branch, homeBranch, 'workflow run.head_branch');
  exact(run?.repository?.full_name, homeRepository, 'workflow run.repository');
  exact(run?.head_repository?.full_name, homeRepository, 'workflow run.head_repository');
  validateWorkflowPath(run?.path);
  exact(branch?.name, homeBranch, 'protected branch name');
  exact(branch?.commit?.sha, sourceSha, 'protected branch current SHA');
  exact(branch?.protected, true, 'protected branch policy');
  if (!Buffer.isBuffer(workflowBytes) || workflowBytes.length < 1) {
    fail('workflow source bytes are absent');
  }
  if (!Buffer.isBuffer(localWorkflowBytes) || !workflowBytes.equals(localWorkflowBytes)) {
    fail('workflow source differs from exact checked-out bytes');
  }
  return { sourceSha, workflowSha256: sha256(workflowBytes) };
}

function normalizedDigest(value, name) {
  if (typeof value !== 'string') fail(`${name} is absent`);
  const normalized = value.startsWith('sha256:') ? value.slice(7) : value;
  return sha64(normalized, name);
}

export function validateHomeArtifactMetadata({
  metadata,
  artifactId,
  artifactName,
  artifactDigest,
  runId,
  sourceSha,
}) {
  positiveInteger(artifactId, 'artifact ID');
  positiveInteger(runId, 'run ID');
  sha40(sourceSha, 'source SHA');
  if (typeof artifactName !== 'string' || !SAFE_ARTIFACT_NAME.test(artifactName)) {
    fail('artifact name is unsafe');
  }
  const digest = normalizedDigest(artifactDigest, 'artifact digest');
  exact(metadata?.id, artifactId, 'artifact metadata.id');
  exact(metadata?.name, artifactName, 'artifact metadata.name');
  exact(metadata?.expired, false, 'artifact metadata.expired');
  positiveInteger(metadata?.size_in_bytes, 'artifact metadata.size_in_bytes');
  if (metadata.size_in_bytes > MAX_ZIP_BYTES) fail('artifact ZIP exceeds 105 MiB');
  exact(metadata?.digest, `sha256:${digest}`, 'artifact metadata.digest');
  exact(metadata?.workflow_run?.id, runId, 'artifact metadata.workflow_run.id');
  exact(metadata?.workflow_run?.head_sha, sourceSha, 'artifact metadata.workflow_run.head_sha');
  return true;
}

function decodeZipName(bytes) {
  let value;
  try {
    value = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    fail(`ZIP entry name is not UTF-8: ${error.message}`);
  }
  validateArchivePath(value);
  if (value.includes('/')) fail(`ZIP package entry must be at the root: ${value}`);
  return value;
}

function findEndOfCentralDirectory(zipBytes) {
  const minimum = Math.max(0, zipBytes.length - (65_535 + 22));
  for (let offset = zipBytes.length - 22; offset >= minimum; offset -= 1) {
    if (zipBytes.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  fail('artifact ZIP end-of-central-directory is absent');
}

function inflateZipEntry(method, compressed, maximumBytes, name) {
  if (method === 0) return Buffer.from(compressed);
  if (method !== 8) fail(`ZIP entry compression is unsupported: ${name}`);
  try {
    return inflateRawSync(compressed, { maxOutputLength: maximumBytes });
  } catch (error) {
    fail(`ZIP entry cannot be safely inflated (${name}): ${error.message}`);
  }
}

function parseArtifactZip(zipBytes) {
  if (!Buffer.isBuffer(zipBytes) || zipBytes.length < 100 || zipBytes.length > MAX_ZIP_BYTES) {
    fail('artifact ZIP byte length is invalid');
  }
  const endOffset = findEndOfCentralDirectory(zipBytes);
  if (endOffset + 22 !== zipBytes.length || zipBytes.readUInt16LE(endOffset + 20) !== 0) {
    fail('artifact ZIP must have no comment or trailing bytes');
  }
  if (
    zipBytes.readUInt16LE(endOffset + 4) !== 0 ||
    zipBytes.readUInt16LE(endOffset + 6) !== 0
  ) {
    fail('artifact ZIP must be single-disk');
  }
  const diskEntries = zipBytes.readUInt16LE(endOffset + 8);
  const totalEntries = zipBytes.readUInt16LE(endOffset + 10);
  if (diskEntries !== 2 || totalEntries !== 2) fail('artifact ZIP must contain exactly two entries');
  const centralSize = zipBytes.readUInt32LE(endOffset + 12);
  const centralOffset = zipBytes.readUInt32LE(endOffset + 16);
  if (centralOffset + centralSize !== endOffset) fail('artifact ZIP central directory bounds mismatch');

  const centralEntries = [];
  let cursor = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > endOffset || zipBytes.readUInt32LE(cursor) !== 0x02014b50) {
      fail('artifact ZIP central directory entry is malformed');
    }
    const madeBy = zipBytes.readUInt16LE(cursor + 4);
    const flags = zipBytes.readUInt16LE(cursor + 8);
    const method = zipBytes.readUInt16LE(cursor + 10);
    const checksum = zipBytes.readUInt32LE(cursor + 16);
    const compressedSize = zipBytes.readUInt32LE(cursor + 20);
    const uncompressedSize = zipBytes.readUInt32LE(cursor + 24);
    const nameLength = zipBytes.readUInt16LE(cursor + 28);
    const extraLength = zipBytes.readUInt16LE(cursor + 30);
    const commentLength = zipBytes.readUInt16LE(cursor + 32);
    const diskStart = zipBytes.readUInt16LE(cursor + 34);
    const externalAttributes = zipBytes.readUInt32LE(cursor + 38);
    const localOffset = zipBytes.readUInt32LE(cursor + 42);
    const end = cursor + 46 + nameLength + extraLength + commentLength;
    if (end > endOffset) fail('artifact ZIP central entry exceeds bounds');
    const name = decodeZipName(zipBytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (
      flags & ~0x0808 ||
      flags & 0x0001 ||
      ![0, 8].includes(method) ||
      diskStart !== 0 ||
      extraLength !== 0 ||
      commentLength !== 0 ||
      [compressedSize, uncompressedSize, localOffset].includes(0xffffffff)
    ) {
      fail(`artifact ZIP entry metadata is unsafe or noncanonical: ${name}`);
    }
    const host = madeBy >>> 8;
    const mode = externalAttributes >>> 16;
    const type = mode & 0xf000;
    if (host === 3 && type !== 0 && type !== 0x8000) {
      fail(`artifact ZIP entry is a link or special file: ${name}`);
    }
    centralEntries.push({
      name,
      flags,
      method,
      checksum,
      compressedSize,
      uncompressedSize,
      localOffset,
    });
    cursor = end;
  }
  if (cursor !== endOffset) fail('artifact ZIP central directory has unexpected bytes');
  const names = centralEntries.map((entry) => entry.name).sort(compareAscii);
  if (names.length !== PACKAGE_FILES.length || names.some((name, index) => name !== PACKAGE_FILES[index])) {
    fail('artifact ZIP must contain exactly dist.tar.gz and evidence.json');
  }

  const ranges = [];
  const extracted = new Map();
  for (const entry of centralEntries) {
    const offset = entry.localOffset;
    if (offset + 30 > centralOffset || zipBytes.readUInt32LE(offset) !== 0x04034b50) {
      fail(`artifact ZIP local header is malformed: ${entry.name}`);
    }
    const flags = zipBytes.readUInt16LE(offset + 6);
    const method = zipBytes.readUInt16LE(offset + 8);
    const localChecksum = zipBytes.readUInt32LE(offset + 14);
    const localCompressedSize = zipBytes.readUInt32LE(offset + 18);
    const localUncompressedSize = zipBytes.readUInt32LE(offset + 22);
    const nameLength = zipBytes.readUInt16LE(offset + 26);
    const extraLength = zipBytes.readUInt16LE(offset + 28);
    const name = decodeZipName(zipBytes.subarray(offset + 30, offset + 30 + nameLength));
    if (name !== entry.name || flags !== entry.flags || method !== entry.method || extraLength !== 0) {
      fail(`artifact ZIP local/central metadata mismatch: ${entry.name}`);
    }
    const dataStart = offset + 30 + nameLength;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataEnd > centralOffset) fail(`artifact ZIP entry exceeds local-data bounds: ${entry.name}`);
    let rangeEnd = dataEnd;
    if (flags & 0x0008) {
      let descriptor = dataEnd;
      if (zipBytes.readUInt32LE(descriptor) === 0x08074b50) descriptor += 4;
      if (descriptor + 12 > centralOffset) fail(`artifact ZIP descriptor is truncated: ${entry.name}`);
      if (
        zipBytes.readUInt32LE(descriptor) !== entry.checksum ||
        zipBytes.readUInt32LE(descriptor + 4) !== entry.compressedSize ||
        zipBytes.readUInt32LE(descriptor + 8) !== entry.uncompressedSize
      ) {
        fail(`artifact ZIP descriptor mismatch: ${entry.name}`);
      }
      rangeEnd = descriptor + 12;
    } else if (
      localChecksum !== entry.checksum ||
      localCompressedSize !== entry.compressedSize ||
      localUncompressedSize !== entry.uncompressedSize
    ) {
      fail(`artifact ZIP local sizes or CRC mismatch: ${entry.name}`);
    }
    const maximum = entry.name === 'dist.tar.gz' ? MAX_ARCHIVE_BYTES : MAX_EVIDENCE_BYTES;
    if (entry.uncompressedSize < 1 || entry.uncompressedSize > maximum) {
      fail(`artifact ZIP entry size is invalid: ${entry.name}`);
    }
    const body = inflateZipEntry(
      method,
      zipBytes.subarray(dataStart, dataEnd),
      maximum,
      entry.name,
    );
    if (body.length !== entry.uncompressedSize || crc32(body) !== entry.checksum) {
      fail(`artifact ZIP entry bytes or CRC mismatch: ${entry.name}`);
    }
    ranges.push([offset, rangeEnd]);
    extracted.set(entry.name, body);
  }
  ranges.sort((left, right) => left[0] - right[0]);
  if (
    ranges[0][0] !== 0 ||
    ranges.at(-1)[1] !== centralOffset ||
    ranges.some((range, index) => index > 0 && ranges[index - 1][1] !== range[0])
  ) {
    fail('artifact ZIP local entries overlap or contain gaps');
  }
  return extracted;
}

export function validateHomeArtifactZip({ zipBytes, packageRoot, expectedZipSha256 }) {
  const bytes = Buffer.from(zipBytes);
  exact(sha256(bytes), normalizedDigest(expectedZipSha256, 'artifact ZIP SHA-256'), 'artifact ZIP SHA-256');
  validateExactPackageRoot(packageRoot);
  const extracted = parseArtifactZip(bytes);
  for (const name of PACKAGE_FILES) {
    regularFile(
      join(packageRoot, name),
      `Home dist package ${name}`,
      name === 'dist.tar.gz' ? MAX_ARCHIVE_BYTES : MAX_EVIDENCE_BYTES,
    );
    const expected = readFileSync(join(packageRoot, name));
    if (!extracted.get(name)?.equals(expected)) {
      fail(`artifact ZIP ${name} differs from the validated package bytes`);
    }
  }
  return true;
}

async function github(path, token, fetchImpl = fetch) {
  const response = await fetchImpl(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    redirect: 'error',
  });
  if (!response.ok) fail(`GitHub API ${path} returned HTTP ${response.status}`);
  const raw = await response.text();
  if (Buffer.byteLength(raw, 'utf8') > MIB) fail(`GitHub API ${path} response is too large`);
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`GitHub API ${path} response is not JSON: ${error.message}`);
  }
}

function strictBase64(value, name) {
  if (typeof value !== 'string') fail(`${name} is absent`);
  const normalized = value.replace(/\s/g, '');
  if (
    normalized.length < 4 ||
    normalized.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)
  ) {
    fail(`${name} is not canonical base64`);
  }
  const bytes = Buffer.from(normalized, 'base64');
  if (bytes.toString('base64') !== normalized) fail(`${name} is not canonical base64`);
  return bytes;
}

async function authenticateHomeRun({ repositoryRoot, sourceSha, runId, runAttempt }) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) fail('GITHUB_TOKEN is absent');
  const run = await github(
    `/repos/${homeRepository}/actions/runs/${runId}/attempts/${runAttempt}`,
    token,
  );
  const branch = await github(`/repos/${homeRepository}/branches/${homeBranch}`, token);
  const encodedWorkflow = homeWorkflow.split('/').map((part) => encodeURIComponent(part)).join('/');
  const workflow = await github(
    `/repos/${homeRepository}/contents/${encodedWorkflow}?ref=${sourceSha}`,
    token,
  );
  exact(workflow.type, 'file', 'workflow source type');
  exact(workflow.path, homeWorkflow, 'workflow source path');
  exact(workflow.encoding, 'base64', 'workflow source encoding');
  const workflowBytes = strictBase64(workflow.content, 'workflow source content');
  const workflowPath = join(repositoryRoot, homeWorkflow);
  regularFile(workflowPath, 'local Home dist workflow', MIB);
  return validateHomeWorkflowRunFacts({
    sourceSha,
    runId,
    runAttempt,
    run,
    branch,
    workflowBytes,
    localWorkflowBytes: readFileSync(workflowPath),
  });
}

function parseOptions(arguments_) {
  const values = new Map();
  for (const argument of arguments_) {
    if (!argument.startsWith('--') || !argument.includes('=')) fail(`invalid option ${argument}`);
    const split = argument.indexOf('=');
    const key = argument.slice(2, split);
    if (!key || values.has(key)) fail(`duplicate or empty option --${key}`);
    values.set(key, argument.slice(split + 1));
  }
  return values;
}

function required(options, key) {
  const value = options.get(key);
  if (!value) fail(`missing --${key}`);
  return value;
}

function integerOption(options, key) {
  const value = required(options, key);
  if (!/^[1-9][0-9]*$/.test(value)) fail(`--${key} must be a positive integer`);
  return positiveInteger(Number(value), key);
}

function exactOptions(options, expected) {
  const actual = [...options.keys()].sort(compareAscii);
  const wanted = [...expected].sort(compareAscii);
  if (actual.length !== wanted.length || actual.some((value, index) => value !== wanted[index])) {
    fail(`options must be exactly ${wanted.join(', ')}`);
  }
}

function packageOptions(options) {
  const common = {
    distRoot: required(options, 'dist-root'),
    packageRoot: required(options, 'package-root'),
    candidateSpecSha256: required(options, 'candidate-spec-sha256'),
    homeSourceSha: required(options, 'home-source-sha'),
    expectedDistSha256: required(options, 'expected-dist-sha256'),
    producerRunId: integerOption(options, 'producer-run-id'),
    producerRunAttempt: integerOption(options, 'producer-run-attempt'),
  };
  releaseId(required(options, 'release-id'));
  return common;
}

async function cli() {
  const [command, ...arguments_] = process.argv.slice(2);
  const options = parseOptions(arguments_);
  if (command === 'authenticate-run') {
    exactOptions(options, ['repository-root', 'source-sha', 'run-id', 'run-attempt']);
    const result = await authenticateHomeRun({
      repositoryRoot: resolve(required(options, 'repository-root')),
      sourceSha: required(options, 'source-sha'),
      runId: integerOption(options, 'run-id'),
      runAttempt: integerOption(options, 'run-attempt'),
    });
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `workflow_sha256=${result.workflowSha256}\n`, 'utf8');
    }
    process.stdout.write('Home protected master run authenticated\n');
    return;
  }
  if (command === 'package-home-dist' || command === 'validate-home-dist') {
    exactOptions(options, [
      'release-id',
      'dist-root',
      'package-root',
      'candidate-spec-sha256',
      'home-source-sha',
      'expected-dist-sha256',
      'producer-run-id',
      'producer-run-attempt',
    ]);
    const common = packageOptions(options);
    if (command === 'package-home-dist') {
      packageHomeDist({ ...common, outputRoot: common.packageRoot });
      process.stdout.write('Canonical Home dist package created\n');
    } else {
      validateHomeDistPackage(common);
      process.stdout.write('Canonical Home dist package valid\n');
    }
    return;
  }
  if (command === 'validate-artifact-metadata') {
    exactOptions(options, [
      'metadata',
      'artifact-id',
      'artifact-name',
      'artifact-digest',
      'run-id',
      'source-sha',
    ]);
    const metadata = parseUtf8JsonFile(required(options, 'metadata'), 'artifact metadata', MIB).value;
    validateHomeArtifactMetadata({
      metadata,
      artifactId: integerOption(options, 'artifact-id'),
      artifactName: required(options, 'artifact-name'),
      artifactDigest: required(options, 'artifact-digest'),
      runId: integerOption(options, 'run-id'),
      sourceSha: required(options, 'source-sha'),
    });
    process.stdout.write('Uploaded Home artifact metadata valid\n');
    return;
  }
  if (command === 'validate-artifact-zip') {
    exactOptions(options, ['zip', 'package-root', 'expected-zip-sha256']);
    const zipPath = required(options, 'zip');
    regularFile(zipPath, 'artifact ZIP', MAX_ZIP_BYTES);
    validateHomeArtifactZip({
      zipBytes: readFileSync(zipPath),
      packageRoot: required(options, 'package-root'),
      expectedZipSha256: required(options, 'expected-zip-sha256'),
    });
    process.stdout.write('Uploaded Home artifact ZIP valid\n');
    return;
  }
  fail('unknown command');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  cli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
