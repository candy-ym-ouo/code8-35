import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { currentUser, requireAuth } from '../../lib/auth.js';
import { env } from '../../config/env.js';
import { buildExportEventWhere, type DeletedEntityIds } from './filter.js';

function notDeletedFilter(includeDeleted: boolean) {
  return includeDeleted ? {} : { deletedAt: null };
}

async function loadDeletedEntityIds(userId: string): Promise<DeletedEntityIds> {
  const [books, dogEars, annotations, rereadMarks, reflections] = await Promise.all([
    prisma.book.findMany({ where: { userId, deletedAt: { not: null } }, select: { id: true } }),
    prisma.dogEar.findMany({ where: { userId, deletedAt: { not: null } }, select: { id: true } }),
    prisma.annotation.findMany({ where: { userId, deletedAt: { not: null } }, select: { id: true } }),
    prisma.rereadMark.findMany({ where: { userId, deletedAt: { not: null } }, select: { id: true } }),
    prisma.completionReflection.findMany({ where: { userId, deletedAt: { not: null } }, select: { id: true } })
  ]);
  return {
    BOOK: books.map((row) => row.id),
    DOG_EAR: dogEars.map((row) => row.id),
    ANNOTATION: annotations.map((row) => row.id),
    REREAD_MARK: rereadMarks.map((row) => row.id),
    COMPLETION_REFLECTION: reflections.map((row) => row.id)
  };
}

export const exportRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAuth);

  app.get('/exports/me', async (request, reply) => {
    const userId = currentUser(request).id;
    const query = request.query as Record<string, unknown>;
    const includeDeleted = String(query.includeDeleted ?? 'false').toLowerCase() === 'true';
    const filter = notDeletedFilter(includeDeleted);
    // 事件与对象明细同一口径：不包含软删除对象时，其事件（含标题、摘录、原因）也不导出
    const eventWhere = buildExportEventWhere(userId, includeDeleted ? null : await loadDeletedEntityIds(userId));

    const [booksCount, dogEarsCount, annotationsCount, rereadCount, reflectionsCount, eventsCount] =
      await Promise.all([
        prisma.book.count({ where: { userId, ...filter } }),
        prisma.dogEar.count({ where: { userId, ...filter } }),
        prisma.annotation.count({ where: { userId, ...filter } }),
        prisma.rereadMark.count({ where: { userId, ...filter } }),
        prisma.completionReflection.count({ where: { userId, ...filter } }),
        prisma.activityEvent.count({ where: eventWhere })
      ]);
    const totalRows =
      booksCount + dogEarsCount + annotationsCount + rereadCount + reflectionsCount + eventsCount;
    if (totalRows > env.EXPORT_MAX_ROWS) {
      throw new AppError(413, 'EXPORT_TOO_LARGE', `导出数据超过 ${env.EXPORT_MAX_ROWS} 行限制`);
    }

    const [user, books, dogEars, annotations, rereadMarks, reflections, activityEvents] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      prisma.book.findMany({ where: { userId, ...filter }, orderBy: { createdAt: 'asc' } }),
      prisma.dogEar.findMany({ where: { userId, ...filter }, orderBy: { createdAt: 'asc' } }),
      prisma.annotation.findMany({ where: { userId, ...filter }, orderBy: { createdAt: 'asc' } }),
      prisma.rereadMark.findMany({ where: { userId, ...filter }, orderBy: { createdAt: 'asc' } }),
      prisma.completionReflection.findMany({ where: { userId, ...filter }, orderBy: { createdAt: 'asc' } }),
      prisma.activityEvent.findMany({ where: eventWhere, orderBy: { occurredAt: 'asc' } })
    ]);
    const exportedAt = new Date();
    const payload = {
      schemaVersion: 1,
      exportedAt: exportedAt.toISOString(),
      includeDeleted,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      books,
      dogEars,
      annotations,
      rereadMarks,
      reflections,
      activityEvents
    };
    const date = exportedAt.toISOString().slice(0, 10);
    reply
      .header('Content-Type', 'application/json; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="paper-book-traces-${date}.json"`);
    return reply.send(JSON.stringify(payload, null, 2));
  });
};
