export type UserStatus = 'online' | 'offline' | 'away' | 'busy';

export interface User {
  id: string;
  name: string;
  nickname: string; // e.g. @belyi
  phone: string;    // e.g. +7 999 111-22-33
  email: string;
  avatar: string;
  bio: string;
  status: UserStatus;
  lastSeen?: string;
  lastSeenAt?: number;
  badge?: string;   // e.g. 'Основатель', 'Свой', 'Брат', 'Авторитет'
}

export interface Reaction {
  emoji: string;
  count: number;
  users: string[]; // user IDs
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  voiceUrl?: string;
  voiceDuration?: number; // seconds
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  timestamp: string;
  isRead: boolean;
  replyToMessage?: {
    id: string;
    senderName: string;
    text: string;
  };
  reactions?: { [emoji: string]: string[] }; // emoji -> array of userIds
}

export type ChatType = 'direct' | 'group';

export interface Chat {
  id: string;
  type: ChatType;
  title: string;
  avatar: string;
  participants: string[]; // user IDs
  lastMessage?: {
    text: string;
    timestamp: string;
    senderId: string;
    isRead: boolean;
  };
  unreadCount: number;
  isPinned?: boolean;
  isMuted?: boolean;
  updatedAt: string;
  updatedAtMs?: number;
  creatorId?: string;
  description?: string;
}

export interface FriendRequest {
  id: string;
  fromUser: User;
  toUserId: string;
  createdAt: string;
  status: 'pending' | 'accepted' | 'declined';
}

export type AppTab = 'chats' | 'friends' | 'calls' | 'profile' | 'settings';

export interface CallState {
  isActive: boolean;
  callId: string;
  direction: 'incoming' | 'outgoing';
  type: 'audio' | 'video';
  user: User;
  status: 'ringing' | 'connecting' | 'connected' | 'ended';
  isMuted: boolean;
  isVideoOff: boolean;
  durationSeconds: number;
}
