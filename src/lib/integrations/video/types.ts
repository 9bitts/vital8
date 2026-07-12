export type VideoRoomInput = {
  organizationId: string;
  encounterId: string;
  expiresInMinutes?: number;
};

export type VideoRoomResult = {
  provider: string;
  url: string;
  roomName: string;
  expiresAt: Date;
};

export interface VideoAdapter {
  createRoom(input: VideoRoomInput): Promise<VideoRoomResult>;
}
