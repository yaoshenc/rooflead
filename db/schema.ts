import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const researchJobs = sqliteTable('research_jobs', {
 id: text('id').primaryKey(), owner: text('owner').notNull(), leadId:text('lead_id').notNull(),
 status:text('status').notNull(), responseId:text('response_id'), payload:text('payload'),
 createdAt:integer('created_at').notNull(), updatedAt:integer('updated_at').notNull(),
}, t=>[index('research_owner_created').on(t.owner,t.createdAt)]);
export const roofOutlines = sqliteTable('roof_outlines', {
 id:text('id').primaryKey(),owner:text('owner').notNull(),researchId:text('research_id').notNull(),status:text('status').notNull(),
 responseId:text('response_id'),payload:text('payload'),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull(),
},t=>[index('outline_owner_created').on(t.owner,t.createdAt)]);
