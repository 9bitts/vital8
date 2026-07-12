export type VideoRoomInput = {
  organizationId: string;
  encounterId: string;
  expiresInMinutes?: number;
  scheduledAt?: Date;
  durationMinutes?: number;
};

export type VideoRoomResult = {
  provider: string;
  url: string;
  roomName: string;
  expiresAt: Date;
};

export type MeetingTokenInput = {
  roomName: string;
  userName: string;
  isOwner: boolean;
  expiresAtUnix: number;
};

export interface VideoAdapter {
  readonly provider: string;
  createRoom(input: VideoRoomInput): Promise<VideoRoomResult>;
  createMeetingToken?(input: MeetingTokenInput): Promise<string>;
  isRoomJoinable?(roomName: string): Promise<boolean>;
}
