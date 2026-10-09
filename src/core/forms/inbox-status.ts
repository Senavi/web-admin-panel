/** Submission statuses and inbox filters (client-safe constants). */

export const SubmissionStatus = {
  New: 'new',
  Read: 'read',
  Archived: 'archived',
} as const;
export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

/** Inbox filter: `open` = new + read (the default view). */
export const InboxFilter = {
  Open: 'open',
  New: SubmissionStatus.New,
  Read: SubmissionStatus.Read,
  Archived: SubmissionStatus.Archived,
  All: 'all',
} as const;
export type InboxFilter = (typeof InboxFilter)[keyof typeof InboxFilter];
