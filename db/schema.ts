import { sqliteTable, text, integer, index, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';
export const researchJobs = sqliteTable('research_jobs', {
 id: text('id').primaryKey(), owner: text('owner').notNull(), leadId:text('lead_id').notNull(),
 status:text('status').notNull(), responseId:text('response_id'), payload:text('payload'),
 createdAt:integer('created_at').notNull(), updatedAt:integer('updated_at').notNull(),
}, t=>[index('research_owner_created').on(t.owner,t.createdAt)]);
export const roofOutlines = sqliteTable('roof_outlines', {
 id:text('id').primaryKey(),owner:text('owner').notNull(),researchId:text('research_id').notNull(),status:text('status').notNull(),
 responseId:text('response_id'),payload:text('payload'),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull(),
},t=>[index('outline_owner_created').on(t.owner,t.createdAt)]);
// Leads received by webhooks (Facebook Lead Ads, Messenger) until the browser
// workspace imports them into its local lead list.
export const inboundLeads = sqliteTable('inbound_leads', {
 id:text('id').primaryKey(),owner:text('owner').notNull(),source:text('source').notNull(),externalId:text('external_id').notNull(),
 status:text('status').notNull(),payload:text('payload').notNull(),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull(),
},t=>[uniqueIndex('inbound_owner_source_external').on(t.owner,t.source,t.externalId),index('inbound_owner_status').on(t.owner,t.status,t.updatedAt)]);
// Server-side workspace settings needed without a browser (e.g. auto-reply templates).
export const workspaceSettings = sqliteTable('workspace_settings', {
 owner:text('owner').notNull(),key:text('key').notNull(),value:text('value').notNull(),updatedAt:integer('updated_at').notNull(),
},t=>[primaryKey({columns:[t.owner,t.key]})]);
