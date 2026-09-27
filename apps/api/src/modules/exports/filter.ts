import { Prisma, type ActivityEntityType } from '@prisma/client';

export type DeletedEntityIds = Record<ActivityEntityType, string[]>;

/**
 * 构造导出时间线事件的查询条件。
 *
 * 导出的事件必须与对象明细保持同一口径：未选择包含软删除对象时，
 * 主体对象已软删除的事件、以及挂在已删除书目下的事件都不得导出，
 * 避免已删除痕迹的标题、摘录或原因从事件 payload 中泄漏。
 *
 * deletedIds 为 null 表示包含软删除对象，事件不做过滤。
 */
export function buildExportEventWhere(
  userId: string,
  deletedIds: DeletedEntityIds | null
): Prisma.ActivityEventWhereInput {
  if (!deletedIds) {
    return { userId };
  }
  const entityClauses = (Object.entries(deletedIds) as Array<[ActivityEntityType, string[]]>)
    .filter(([, ids]) => ids.length > 0)
    .map(([entityType, ids]) => ({ entityType, entityId: { in: ids } }));
  const and: Prisma.ActivityEventWhereInput[] = [
    { OR: [{ bookId: null }, { book: { deletedAt: null } }] }
  ];
  if (entityClauses.length > 0) {
    and.push({ NOT: { OR: entityClauses } });
  }
  return { userId, AND: and };
}
