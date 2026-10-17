import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app, 'us-central1');

export interface PublicUserProfile {
  id: string;
  name: string;
  nickname: string;
  avatar: string;
  bio: string;
  status: 'online' | 'offline';
  lastSeen: string;
  badge: string;
}

export async function searchUserByEmail(email: string): Promise<PublicUserProfile | null> {
  const call = httpsCallable<{ email: string }, { user: PublicUserProfile | null }>(
    functions,
    'searchUserByEmail',
  );
  const result = await call({ email: email.trim().toLowerCase() });
  return result.data.user;
}

export async function sendFriendRequest(toUserId: string): Promise<{
  status: 'pending' | 'accepted' | 'incoming';
  user: PublicUserProfile;
}> {
  const call = httpsCallable<{ toUserId: string }, {
    status: 'pending' | 'accepted' | 'incoming';
    user: PublicUserProfile;
  }>(functions, 'sendFriendRequest');
  const result = await call({ toUserId });
  return result.data;
}

export async function respondToFriendRequest(
  requestId: string,
  action: 'accept' | 'decline',
): Promise<void> {
  const call = httpsCallable<{ requestId: string; action: 'accept' | 'decline' }, { success: boolean }>(
    functions,
    'respondToFriendRequest',
  );
  await call({ requestId, action });
}
