export interface CleanupOptionsDto {
  olderThanDays?: 30 | 60 | 90;
  groupMediaOnly?: boolean;
  failedDownloadsOnly?: boolean;
  videosOnly?: boolean;
  documentsOnly?: boolean;
  keepStarred?: boolean;
  keepQuoteLinked?: boolean;
}

export interface CleanupRunDto extends CleanupOptionsDto {
  confirmToken: string;
}
