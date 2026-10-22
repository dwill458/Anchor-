/** Real PostgreSQL QA only. Refuses remote databases; run with a disposable local cluster. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { prisma } from '../src/lib/prisma';
import { VisionService } from '../src/services/v2/VisionService';
import { CreateVisionNoteSchema } from '../src/domain/v2/vision';

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert(['127.0.0.1', 'localhost'].includes(url.hostname), 'QA requires an isolated local database');
  const service = new VisionService();
  const stateFile = process.argv[3];
  assert(stateFile, 'Pass a local QA state file');
  if (process.argv[2] === 'restore') {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const restored = await service.getAnchorVision(state.userId, state.anchorId);
    assert.equal(restored?.notes?.[0]?.id, state.noteId);
    assert.equal(restored?.notes?.[0]?.content.text, 'Time to create. A quieter life.');
    assert.deepEqual(restored?.notes?.[0]?.presentation, state.presentation);
    console.log('PASS: persisted note content/material/position/size/rotation restored after PostgreSQL and process restart');
    return;
  }
  const userId = randomUUID();
  const otherUserId = randomUUID();
  const anchorId = randomUUID();
  await prisma.user.createMany({ data: [userId, otherUserId].map(id => ({ id, email: `${id}@vision-notes.invalid`, authUid: id, authProvider: 'email' })) });
  await prisma.anchor.create({ data: { id: anchorId, userId, intentionText: 'A life with time to create', category: 'creativity' } });
  const input = CreateVisionNoteSchema.parse({ clientRequestId: randomUUID(), content: { text: 'Time to create.' },
    presentation: { styleId: 'paper_blush_torn', x: .24, y: .3, width: .3, height: .24, rotation: -3, scale: 1, layerOrder: 1 } });
  const reads = await Promise.all([service.createNote(userId, anchorId, input), service.createNote(userId, anchorId, input)]);
  assert.equal(reads[0].id, reads[1].id);
  assert.equal(await prisma.vision.count({ where: { anchorId, status: 'ACTIVE' } }), 1);
  assert.equal(await prisma.visionNote.count({ where: { visionId: reads[0].id } }), 1);
  const noteId = reads[0].notes![0].id;
  const visionId = reads[0].id;
  console.log('PASS: concurrent retries created one persisted Vision and one note');
  const presentation = { ...input.presentation, styleId: 'editorial_midnight_editorial' as const, x: .62, y: .4, width: .34, height: .25, rotation: 12, scale: 1.2 };
  const updated = await service.updateNote(userId, visionId, noteId, { content: { text: 'Time to create. A quieter life.' }, presentation });
  assert.deepEqual(updated.notes![0].presentation, presentation);
  await assert.rejects(() => service.updateNote(otherUserId, visionId, noteId, { content: { text: 'Not mine' } }));
  assert.equal((await service.deleteNote(userId, visionId, noteId)).notes!.length, 0);
  await assert.rejects(() => service.updateNote(userId, visionId, noteId, { content: { text: 'Archived' } }));
  assert.equal((await service.restoreNote(userId, visionId, noteId)).notes![0].id, noteId);
  console.log('PASS: real edit/transform, cross-user rejection, soft deletion, and restoration');
  fs.writeFileSync(stateFile, JSON.stringify({ userId, anchorId, visionId, noteId, presentation }), 'utf8');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
