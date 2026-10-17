
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';
import {
  User,
  Chat,
  Message,
  FriendRequest,
  AppTab,
  CallState,
} from '../types';
import {
} from '../data/mockData';
import { signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { addDoc, getDoc, onSnapshot, query, collection, doc, serverTimestamp, setDoc, updateDoc, where, orderBy, increment, deleteDoc } from 'firebase/firestore';
import { sounds } from '../utils/sound';

interface ChatContextType {
  currentUser: User;
  allUsers: User[];
  chats: Chat[];
  messages: Message[];
  friendRequests: FriendRequest[];
  activeChatId: string | null;
  activeChat: Chat | null;
  activeTab: AppTab;
  callState: CallState | null;
  localCallStream: MediaStream | null;
  remoteCallStream: MediaStream | null;
  callError: string | null;
  messageError: string | null;
  clearMessageError: () => void;
  previewImage: string | null;
  chatFilter: 'all' | 'direct' | 'groups' | 'unread';
  isTypingUserId: string | null;
  soundEnabled: boolean;
  deviceMode: 'frame' | 'fullscreen';
  isAuthModalOpen: boolean;

  setActiveTab: (tab: AppTab) => void;
  setActiveChatId: (id: string | null) => void;
  setChatFilter: (filter: 'all' | 'direct' | 'groups' | 'unread') => void;
  setPreviewImage: (url: string | null) => void;
  setDeviceMode: (mode: 'frame' | 'fullscreen') => void;
  setSoundEnabled: (enabled: boolean) => void;
  setIsAuthModalOpen: (open: boolean) => void;

  sendMessage: (
    chatId: string,
    text?: string,
    imageUrl?: string,
    replyTo?: Message['replyToMessage'],
    voiceUrl?: string,
    voiceDuration?: number
  ) => void;
  toggleReaction: (messageId: string, emoji: string) => void;
  deleteMessage: (messageId: string) => void;
  createGroupChat: (
    title: string,
    participantIds: string[],
    avatar?: string,
    description?: string
  ) => string;
  startDirectChat: (targetUserId: string, targetProfile?: User) => string;
  addFriend: (targetUserId: string) => Promise<void>;
  contactRelations: Record<string, 'removed' | 'blocked'>;
  removeContact: (targetUser: User) => Promise<void>;
  blockContact: (targetUser: User) => Promise<void>;
  unblockContact: (targetUserId: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => void;
  declineFriendRequest: (requestId: string) => void;
  updateProfile: (updated: Partial<User>) => void;
  loginAsUser: (userId: string) => void;
  setAuthenticatedUser: (user: User) => void;
  logout: () => Promise<void>;
  registerUser: (data: {
    name: string;
    nickname: string;
    phone: string;
    email: string;
    avatar?: string;
    bio?: string;
  }) => void;
  startCall: (targetUser: User, type: 'audio' | 'video') => void;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleCallMute: () => void;
  toggleCallVideo: () => void;
  pinChat: (chatId: string) => void;
  muteChat: (chatId: string) => void;
  deleteChat: (chatId: string) => void;
  markChatAsRead: (chatId: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Больше не добавляем демо-профили в список пользователей.
const EMPTY_USER: User = {
  id: '',
  name: '',
  nickname: '',
  phone: '',
  email: '',
  avatar: '',
  bio: '',
  status: 'offline',
  lastSeen: '',
  badge: '',
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [allUsers, setAllUsers] = useState<User[]>(() => {
    const userId = localStorage.getItem('bratva_current_user_id') || '';
    if (!userId) return [];

    try {
      const scoped = localStorage.getItem(`bratva_users_${userId}`);
      if (scoped) {
        const parsed = JSON.parse(scoped);
        if (Array.isArray(parsed)) return parsed.filter((user: User) => user && typeof user.id === 'string');
      }

      // Migrate only the signed-in user's own profile from legacy storage.
      // Never import other accounts' cached users as this account's friends.
      const legacy = localStorage.getItem('bratva_users');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed)) return parsed.filter((user: User) => user?.id === userId);
      }
    } catch (error) {
      console.error('Не удалось прочитать локальных пользователей:', error);
    }
    return [];
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return localStorage.getItem('bratva_current_user_id') || '';
  });

  const [remoteChatIds, setRemoteChatIds] = useState<string[]>([]);

  const [chats, setChats] = useState<Chat[]>(() => {
    const userId = localStorage.getItem('bratva_current_user_id') || '';
    if (!userId) return [];
    try {
      const scoped = localStorage.getItem(`bratva_chats_${userId}`);
      if (scoped) return JSON.parse(scoped);
      const legacy = localStorage.getItem('bratva_chats');
      const parsed = legacy ? JSON.parse(legacy) : [];
      return Array.isArray(parsed) ? parsed.filter((chat: Chat) => chat.participants?.includes(userId)) : [];
    } catch {
      return [];
    }
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    const userId = localStorage.getItem('bratva_current_user_id') || '';
    if (!userId) return [];
    try {
      const scoped = localStorage.getItem(`bratva_messages_${userId}`);
      if (scoped) return JSON.parse(scoped);
      const legacyChats = localStorage.getItem('bratva_chats');
      const legacyMessages = localStorage.getItem('bratva_messages');
      const chatsForUser: Chat[] = legacyChats ? JSON.parse(legacyChats) : [];
      const allowedChatIds = new Set(
        Array.isArray(chatsForUser)
          ? chatsForUser.filter((chat) => chat.participants?.includes(userId)).map((chat) => chat.id)
          : [],
      );
      const parsed = legacyMessages ? JSON.parse(legacyMessages) : [];
      return Array.isArray(parsed) ? parsed.filter((message: Message) => allowedChatIds.has(message.chatId)) : [];
    } catch {
      return [];
    }
  });


  // Friend requests are loaded from Firestore for the signed-in account.
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [contactRelations, setContactRelations] = useState<Record<string, 'removed' | 'blocked'>>({});

  useEffect(() => {
    if (!currentUserId) { setContactRelations({}); return; }
    const relationsQuery = query(collection(db, 'userContacts'), where('ownerId', '==', currentUserId));
    return onSnapshot(relationsQuery, (snapshot) => {
      const next: Record<string, 'removed' | 'blocked'> = {};
      snapshot.docs.forEach((item) => {
        const data = item.data();
        const contactId = typeof data.contactId === 'string' ? data.contactId : '';
        if (contactId && (data.status === 'removed' || data.status === 'blocked')) next[contactId] = data.status;
      });
      setContactRelations(next);
    }, (error) => console.error('Не удалось синхронизировать список контактов:', error));
  }, [currentUserId]);

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const activeChatIdRef = useRef<string | null>(activeChatId);
  useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);
  const [activeTab, setActiveTab] = useState<AppTab>('chats');
  const [callState, setCallState] = useState<CallState | null>(null);
  const [localCallStream, setLocalCallStream] = useState<MediaStream | null>(null);
  const [remoteCallStream, setRemoteCallStream] = useState<MediaStream | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [chatFilter, setChatFilter] = useState<
    'all' | 'direct' | 'groups' | 'unread'
  >('all');

  // Сохраняем поле для совместимости с остальными компонентами,
  // но автоматически больше никому не имитируем набор текста.
  const [isTypingUserId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(true);
  const [deviceMode, setDeviceMode] = useState<'frame' | 'fullscreen'>('frame');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(
    () => !localStorage.getItem('bratva_current_user_id')
  );

  useEffect(() => {
    localStorage.removeItem('bratva_stories');
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    try {
      localStorage.setItem(`bratva_users_${currentUserId}`, JSON.stringify(allUsers));
    } catch (error) {
      console.warn('Не удалось сохранить пользователей в локальном кэше:', error);
    }
  }, [allUsers, currentUserId]);

  useEffect(() => {
    try {
      if (currentUserId) {
        localStorage.setItem('bratva_current_user_id', currentUserId);
      } else {
        localStorage.removeItem('bratva_current_user_id');
      }
    } catch (error) {
      console.warn('Не удалось сохранить состояние входа:', error);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    try {
      localStorage.setItem(`bratva_chats_${currentUserId}`, JSON.stringify(chats));
    } catch (error) {
      console.warn('Не удалось сохранить чаты в локальном кэше:', error);
    }
  }, [chats, currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    try {
      localStorage.setItem(`bratva_messages_${currentUserId}`, JSON.stringify(messages));
    } catch (error) {
      // Storage quota errors must never crash the chat screen after sending media.
      console.warn('Не удалось сохранить сообщения в локальном кэше:', error);
    }
  }, [messages, currentUserId]);


  // Sync shared conversations from Firestore so every participant sees the same chat list.
  useEffect(() => {
    if (!currentUserId) {
      setRemoteChatIds([]);
      return;
    }
    const sharedChatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUserId),
    );
    return onSnapshot(sharedChatsQuery, (snapshot) => {
      const remoteChats = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          type: data.type === 'group' ? 'group' as const : 'direct' as const,
          title: typeof data.title === 'string' ? data.title : 'Чат',
          avatar: typeof data.avatar === 'string' ? data.avatar : '',
          participants: Array.isArray(data.participants) ? data.participants.filter((id): id is string => typeof id === 'string') : [],
          unreadCount: data.unreadCounts && typeof data.unreadCounts === 'object'
            ? (typeof data.unreadCounts[currentUserId] === 'number' ? data.unreadCounts[currentUserId] : 0)
            : (typeof data.unreadCount === 'number' ? data.unreadCount : 0),
          updatedAtMs: typeof data.updatedAtMs === 'number' ? data.updatedAtMs : 0,
          isPinned: Boolean(data.isPinned),
          isMuted: Boolean(data.isMuted),
          updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
          creatorId: typeof data.creatorId === 'string' ? data.creatorId : undefined,
          description: typeof data.description === 'string' ? data.description : undefined,
          lastMessage: data.lastMessage && typeof data.lastMessage === 'object' ? data.lastMessage as Chat['lastMessage'] : undefined,
        } satisfies Chat;
      }).filter((chat) => chat.type !== 'direct' || !chat.participants.some((participantId) => participantId !== currentUserId && contactRelations[participantId] === 'blocked'));
      const ids = remoteChats.map((chat) => chat.id);
      setRemoteChatIds(ids);
      setChats((previous) => {
        const localOnly = previous.filter((chat) => !ids.includes(chat.id) && !(chat.type === 'direct' && chat.participants.some((participantId) => participantId !== currentUserId && contactRelations[participantId] === 'blocked')));
        return [...remoteChats, ...localOnly];
      });
    }, (error) => {
      console.error('Не удалось синхронизировать чаты из Firebase:', error);
    });
  }, [currentUserId, contactRelations]);



  // Keep the signed-in profile's presence fresh and expire it after a missed heartbeat.
  useEffect(() => {
    if (!currentUserId) return;
    const publishPresence = (online: boolean) => {
      const lastSeenAt = Date.now();
      const presence: Pick<User, 'status' | 'lastSeen' | 'lastSeenAt'> = {
        status: online ? 'online' : 'offline',
        lastSeen: online ? 'в сети' : 'был(а) недавно',
        lastSeenAt,
      };
      void Promise.all([
        setDoc(doc(db, 'users', currentUserId), presence, { merge: true }),
        setDoc(doc(db, 'publicProfiles', currentUserId), presence, { merge: true }),
      ]).catch((error) => console.warn('Не удалось обновить статус присутствия:', error));
      setAllUsers((previous) => previous.map((user) =>
        user.id === currentUserId ? { ...user, ...presence } : user
      ));
    };
    publishPresence(true);
    const heartbeatId = window.setInterval(() => {
      if (document.visibilityState === 'visible') publishPresence(true);
    }, 30_000);
    const refresh = () => {
      if (document.visibilityState === 'visible') publishPresence(true);
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(heartbeatId);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      publishPresence(false);
    };
  }, [currentUserId]);

  // Refresh peer profiles live so avatar/name changes propagate to chats and friends.
  const knownProfileIds = Array.from(new Set([
    ...allUsers.map((user) => user.id),
    ...chats.flatMap((chat) => chat.participants),
  ])).filter((id) => id && id !== currentUserId).sort().join('|');

  useEffect(() => {
    if (!currentUserId || !knownProfileIds) return;
    const unsubscribers = knownProfileIds.split('|').map((userId) => onSnapshot(
      doc(db, 'publicProfiles', userId),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        const lastSeenAt = typeof data.lastSeenAt === 'number' ? data.lastSeenAt : null;
        const online = data.status === 'online' && lastSeenAt !== null && Date.now() - lastSeenAt < 120_000;
        const lastSeen = online ? 'в сети' : lastSeenAt !== null
          ? (Math.floor((Date.now() - lastSeenAt) / 60_000) < 2
              ? 'был(а) недавно'
              : `был(а) ${Math.floor((Date.now() - lastSeenAt) / 60_000)} мин. назад`)
          : (typeof data.lastSeen === 'string' ? data.lastSeen : 'не в сети');
        setAllUsers((previous) => {
          const existing = previous.find((user) => user.id === userId);
          const profile: User = {
            ...(existing || EMPTY_USER),
            id: userId,
            name: typeof data.name === 'string' && data.name ? data.name : existing?.name || 'Пользователь',
            nickname: typeof data.nickname === 'string' ? data.nickname : existing?.nickname || '',
            phone: '',
            email: '',
            avatar: typeof data.avatar === 'string' ? data.avatar : existing?.avatar || '',
            bio: typeof data.bio === 'string' ? data.bio : existing?.bio || '',
            status: online ? 'online' : 'offline',
            lastSeen,
            ...(lastSeenAt !== null ? { lastSeenAt } : {}),
            badge: typeof data.badge === 'string' ? data.badge : existing?.badge || '',
          };
          if (existing && existing.name === profile.name && existing.nickname === profile.nickname &&
              existing.avatar === profile.avatar && existing.bio === profile.bio &&
              existing.status === profile.status && existing.lastSeen === profile.lastSeen &&
              existing.badge === profile.badge) return previous;
          return existing
            ? previous.map((user) => user.id === userId ? profile : user)
            : [...previous, profile];
        });
      },
      (error) => console.warn('Не удалось обновить профиль собеседника:', error),
    ));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [currentUserId, knownProfileIds]);

  // Subscribe to each shared conversation's message stream.
  const remoteChatKey = remoteChatIds.slice().sort().join('|');
  useEffect(() => {
    if (!currentUserId || !remoteChatKey) return;
    const ids = remoteChatKey.split('|');
    // The first snapshot contains message history; only play sounds for later incoming additions.
    const initializedMessageStreams = new Set<string>();
    const unsubscribers = ids.map((chatId) => onSnapshot(
      query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc')),
      (snapshot) => {
        const isInitialSnapshot = !initializedMessageStreams.has(chatId);
        initializedMessageStreams.add(chatId);
        if (!isInitialSnapshot) {
          const incomingChanges = snapshot.docChanges().filter((change) =>
            change.type === 'added' && change.doc.data().senderId !== currentUserId
          );
          if (incomingChanges.length > 0) sounds.playReceive();
          incomingChanges.forEach((change) => {
            const data = change.doc.data();
            if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
            if (document.visibilityState !== 'hidden' && activeChatIdRef.current === chatId) return;
            const body = typeof data.text === 'string' && data.text.trim()
              ? data.text
              : data.imageUrl ? '📷 Фотография' : data.voiceUrl ? '🎤 Голосовое сообщение' : 'Новое сообщение';
            const notification = new Notification('Братва — новое сообщение', {
              body: body.slice(0, 180),
              icon: '/pwa-192x192.png',
              tag: `bratva-${chatId}`,
            });
            notification.onclick = () => {
              window.focus();
              setActiveTab('chats');
              setActiveChatId(chatId);
              notification.close();
            };
          });
          if (incomingChanges.length > 0 && activeChatIdRef.current === chatId && document.visibilityState !== 'hidden') {
            void updateDoc(doc(db, 'chats', chatId), { [`unreadCounts.${currentUserId}`]: 0 })
              .catch((error) => console.warn('Не удалось сбросить счётчик открытого чата:', error));
          }
        }
        const remoteMessages: Message[] = snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            chatId,
            senderId: typeof data.senderId === 'string' ? data.senderId : '',
            text: typeof data.text === 'string' ? data.text : undefined,
            imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : undefined,
            voiceUrl: typeof data.voiceUrl === 'string' ? data.voiceUrl : undefined,
            voiceDuration: typeof data.voiceDuration === 'number' ? data.voiceDuration : undefined,
            timestamp: typeof data.timestamp === 'string' ? data.timestamp : '',
            isRead: Boolean(data.isRead),
            replyToMessage: data.replyToMessage as Message['replyToMessage'],
            reactions: data.reactions && typeof data.reactions === 'object' ? data.reactions as Message['reactions'] : {},
          };
        });
        setMessages((previous) => [
          ...previous.filter((message) => message.chatId !== chatId),
          ...remoteMessages,
        ]);
      },
      (error) => console.error('Не удалось синхронизировать сообщения:', chatId, error),
    ));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [currentUserId, remoteChatKey]);


  // Incoming call notifications are shared between accounts through Firestore.
  useEffect(() => {
    if (!currentUserId) return;
    return onSnapshot(
      query(collection(db, 'calls'), where('calleeId', '==', currentUserId)),
      (snapshot) => {
        const incoming = snapshot.docs.find((item) => {
          const data = item.data();
          const createdAt = typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : 0;
          return data.status === 'ringing' &&
            item.id !== callState?.callId &&
            createdAt > 0 &&
            Date.now() - createdAt < 60_000;
        });
        if (!incoming || callState) return;
        const data = incoming.data();
        setCallError(null);
        setCallState({
          isActive: true,
          callId: incoming.id,
          direction: 'incoming',
          type: 'audio',
          user: {
            id: String(data.callerId || ''),
            name: String(data.callerName || 'Пользователь'),
            nickname: String(data.callerNickname || ''),
            phone: '',
            email: '',
            avatar: String(data.callerAvatar || ''),
            bio: '',
            status: 'online',
            lastSeen: 'в сети',
          },
          status: 'ringing',
          isMuted: false,
          isVideoOff: true,
          durationSeconds: 0,
        });
      },
      (error) => console.error('Не удалось получить входящие звонки:', error),
    );
  }, [currentUserId, callState?.callId, callState?.isActive]);

  // Negotiate WebRTC media and listen for the other participant's ICE candidates.
  useEffect(() => {
    if (!callState?.callId) return;
    const callRef = doc(db, 'calls', callState.callId);
    const remoteCandidateCollection = callState.direction === 'outgoing' ? 'calleeCandidates' : 'callerCandidates';
    const stopCall = onSnapshot(callRef, async (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      if (data.status === 'declined' || data.status === 'ended') {
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;
        setLocalCallStream((stream) => { stream?.getTracks().forEach((track) => track.stop()); return null; });
        setRemoteCallStream(null);
        setCallState((current) => current?.callId === snapshot.id ? null : current);
        return;
      }
      const peer = peerConnectionRef.current;
      if (!peer) return;
      try {
        if (data.status === 'accepted' && callState.direction === 'outgoing' && !peer.localDescription) {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          await updateDoc(callRef, { offer: { type: offer.type, sdp: offer.sdp }, status: 'connecting' });
          setCallState((current) => current?.callId === snapshot.id ? { ...current, status: 'connecting' } : current);
        }
        if (data.offer && callState.direction === 'incoming' && !peer.remoteDescription) {
          await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
          for (const candidate of pendingIceCandidatesRef.current.splice(0)) {
            await peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
          }
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await updateDoc(callRef, { answer: { type: answer.type, sdp: answer.sdp }, status: 'connecting' });
          setCallState((current) => current?.callId === snapshot.id ? { ...current, status: 'connecting' } : current);
        }
        if (data.answer && callState.direction === 'outgoing' && !peer.remoteDescription) {
          await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
          for (const candidate of pendingIceCandidatesRef.current.splice(0)) {
            await peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
          }
        }
      } catch (error) {
        console.error('Ошибка соединения WebRTC:', error);
        setCallError('Не удалось установить аудиосоединение. Проверьте разрешение на микрофон и подключение.');
      }
    }, (error) => {
      console.error('Не удалось отслеживать состояние звонка:', error);
      setCallError('Потеряно соединение с сигнализацией звонка.');
    });
    const stopCandidates = onSnapshot(
      collection(db, 'calls', callState.callId, remoteCandidateCollection),
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          const candidate = change.doc.data() as RTCIceCandidateInit;
          const peer = peerConnectionRef.current;
          if (peer?.remoteDescription) {
            void peer.addIceCandidate(new RTCIceCandidate(candidate)).catch((error) =>
              console.warn('ICE-кандидат отклонён:', error)
            );
          } else {
            pendingIceCandidatesRef.current.push(candidate);
          }
        });
      },
      (error) => console.error('Не удалось получить ICE-кандидаты:', error),
    );
    return () => { stopCall(); stopCandidates(); };
  }, [callState?.callId, callState?.direction]);


  useEffect(() => {
    if (!callState || callState.direction !== 'outgoing' || callState.status !== 'ringing') return;
    const callId = callState.callId;
    const timeout = window.setTimeout(() => {
      void updateDoc(doc(db, 'calls', callId), { status: 'ended' }).catch(() => undefined);
      setCallError('На звонок не ответили. Попробуйте ещё раз.');
      setCallState((current) => current?.callId === callId ? null : current);
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      setLocalCallStream((stream) => { stream?.getTracks().forEach((track) => track.stop()); return null; });
      setRemoteCallStream(null);
    }, 45_000);
    return () => window.clearTimeout(timeout);
  }, [callState?.callId, callState?.direction, callState?.status]);

  const currentUser =
    allUsers.find((user) => user.id === currentUserId) || EMPTY_USER;

  const activeChat = chats.find((chat) => chat.id === activeChatId) || null;

  // Keep incoming friend requests synced across signed-in devices.
  useEffect(() => {
    if (!currentUserId) {
      setFriendRequests([]);
      return;
    }

    const requestsQuery = query(
      collection(db, 'friendRequests'),
      where('toUserId', '==', currentUserId),
    );
    return onSnapshot(requestsQuery, async (snapshot) => {
      const requests = await Promise.all(snapshot.docs.map(async (item) => {
        const data = item.data();
        const senderId = typeof data.fromUserId === 'string' ? data.fromUserId : '';
        const localSender = allUsers.find((user) => user.id === senderId);
        let sender = localSender;
        if (!sender && senderId) {
          try {
            const profile = await getDoc(doc(db, 'publicProfiles', senderId));
            if (profile.exists()) {
              const value = profile.data();
              sender = {
                id: senderId,
                name: typeof value.name === 'string' ? value.name : 'Пользователь',
                nickname: typeof value.nickname === 'string' ? value.nickname : '',
                phone: '',
                email: '',
                avatar: typeof value.avatar === 'string' ? value.avatar : '',
                bio: typeof value.bio === 'string' ? value.bio : '',
                status: value.status === 'online' ? 'online' as const : 'offline' as const,
                lastSeen: typeof value.lastSeen === 'string' ? value.lastSeen : '',
                badge: typeof value.badge === 'string' ? value.badge : '',
              };
            }
          } catch (error) {
            console.error('Could not load public sender profile:', error);
          }
        }
        if (!sender) return null;
        setAllUsers((previous) =>
          previous.some((user) => user.id === senderId) ? previous : [sender!, ...previous]
        );
        return {
          id: item.id,
          fromUser: sender,
          toUserId: currentUserId,
          createdAt: 'Заявка в сети',
          status: data.status === 'accepted' || data.status === 'declined' ? data.status : 'pending',
        } satisfies FriendRequest;
      }));
      setFriendRequests(requests.filter((request): request is FriendRequest => request !== null));
    }, (error) => {
      console.error('Friend request subscription failed:', error);
    });
  }, [currentUserId, allUsers]);


  const setSoundEnabled = (val: boolean) => {
    setSoundEnabledState(val);
    sounds.setEnabled(val);
  };

  const markChatAsRead = (chatId: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
      )
    );
    if (currentUserId) {
      void updateDoc(doc(db, 'chats', chatId), { [`unreadCounts.${currentUserId}`]: 0 })
        .catch((error) => console.warn('Не удалось сбросить счётчик непрочитанных:', error));
    }
  };

  // Отправляем только сообщение текущего пользователя.
  // Автоответы и случайные ответы собеседников отключены.
  const sendMessage = (
    chatId: string,
    text?: string,
    imageUrl?: string,
    replyTo?: Message['replyToMessage'],
    voiceUrl?: string,
    voiceDuration?: number
  ) => {
    if (!text?.trim() && !imageUrl && !voiceUrl) return;
    if (!currentUserId) return;
    setMessageError(null);

    const sender = allUsers.find((user) => user.id === currentUserId);
    const chat = chats.find((item) => item.id === chatId);
    if (!sender || !chat) return;

    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0');
    const messageId = 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const newMsg: Message = {
      id: messageId,
      chatId,
      senderId: sender.id,
      ...(text?.trim() ? { text: text.trim() } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(voiceUrl ? { voiceUrl, voiceDuration: Math.max(1, Math.round(voiceDuration || 1)) } : {}),
      timestamp: timeStr,
      isRead: false,
      ...(replyTo ? { replyToMessage: replyTo } : {}),
      reactions: {},
    };

    sounds.playSend();
    setMessages((prev) => [...prev, newMsg]);

    const previewText = imageUrl ? '📷 Фотография' : voiceUrl ? '🎤 Голосовое сообщение' : text?.trim() || '';
    const updatedChat: Chat = {
      ...chat,
      updatedAt: timeStr,
      updatedAtMs: now.getTime(),
      lastMessage: {
        text: previewText,
        timestamp: timeStr,
        senderId: sender.id,
        isRead: false,
      },
    };
    setChats((prev) => prev.map((item) => item.id === chatId ? updatedChat : item));

    // Persist a clean chat document first (Firestore rejects undefined values),
    // then write the message to the shared subcollection.
    const chatPayload: Record<string, unknown> = {
      id: chat.id,
      type: chat.type,
      title: chat.title || '',
      avatar: chat.avatar || '',
      participants: chat.participants.filter(Boolean),
      unreadCount: chat.unreadCount || 0,
      isPinned: Boolean(chat.isPinned),
      isMuted: Boolean(chat.isMuted),
      updatedAt: timeStr,
      updatedAtMs: now.getTime(),
      lastMessage: updatedChat.lastMessage,
    };
    if (chat.creatorId) chatPayload.creatorId = chat.creatorId;
    if (chat.description) chatPayload.description = chat.description;

    const remoteMessage: Record<string, unknown> = {
      id: messageId,
      chatId,
      senderId: sender.id,
      timestamp: timeStr,
      isRead: false,
      createdAt: serverTimestamp(),
      reactions: {},
    };
    if (text?.trim()) remoteMessage.text = text.trim();
    if (imageUrl) remoteMessage.imageUrl = imageUrl;
    if (voiceUrl) {
      remoteMessage.voiceUrl = voiceUrl;
      remoteMessage.voiceDuration = Math.max(1, Math.round(voiceDuration || 1));
    }
    if (replyTo) remoteMessage.replyToMessage = replyTo;

    void (async () => {
      try {
        // Make sure the shared conversation exists before writing its first message.
        await setDoc(doc(db, 'chats', chatId), chatPayload, { merge: true });
        const unreadUpdates: Record<string, unknown> = { updatedAtMs: now.getTime() };
        chat.participants.filter((participantId) => participantId && participantId !== sender.id).forEach((participantId) => {
          unreadUpdates[`unreadCounts.${participantId}`] = increment(1);
        });
        try {
          // Update unread counts before adding the message so an actively open recipient chat
          // can immediately reset its own counter when the message snapshot arrives.
          await updateDoc(doc(db, 'chats', chatId), unreadUpdates);
        } catch (unreadError) {
          console.warn('Не удалось обновить счётчик непрочитанных:', unreadError);
        }
        await setDoc(doc(db, 'chats', chatId, 'messages', messageId), remoteMessage);
      } catch (error) {
        console.error('Не удалось сохранить сообщение в Firebase:', error);
        setMessages((previous) => previous.filter((message) => message.id !== messageId));
        setChats((previous) => previous.map((item) => item.id === chatId ? chat : item));
        const firebaseCode = typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code || '')
          : '';
        setMessageError(firebaseCode === 'permission-denied'
          ? 'Firebase запретил отправку сообщения. Проверьте правила доступа к chats и messages.'
          : 'Сообщение не отправлено. Проверьте интернет и повторите попытку.');
      }
    })();
  };

  const toggleReaction = (messageId: string, emoji: string) => {
    if (!currentUserId) return;

    sounds.playTap();

    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== messageId) return message;

        const currentReactions = { ...(message.reactions || {}) };
        const usersForEmoji = currentReactions[emoji] || [];

        if (usersForEmoji.includes(currentUserId)) {
          const updated = usersForEmoji.filter((id) => id !== currentUserId);

          if (updated.length === 0) {
            delete currentReactions[emoji];
          } else {
            currentReactions[emoji] = updated;
          }
        } else {
          currentReactions[emoji] = [...usersForEmoji, currentUserId];
        }

        return { ...message, reactions: currentReactions };
      })
    );
  };

  const deleteMessage = (messageId: string) => {
    setMessages((prev) => prev.filter((message) => message.id !== messageId));
  };

  const createGroupChat = (
    title: string,
    participantIds: string[],
    avatar?: string,
    description?: string
  ): string => {
    if (!currentUserId) return '';

    const creator = allUsers.find((user) => user.id === currentUserId);
    if (!creator) return '';

    const newChatId = 'chat-grp-' + Date.now();
    const now = new Date();
    const timeStr =
      String(now.getHours()).padStart(2, '0') +
      ':' +
      String(now.getMinutes()).padStart(2, '0');

    const newChat: Chat = {
      id: newChatId,
      type: 'group',
      title,
      avatar:
        avatar ||
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=400&q=80',
      participants: Array.from(new Set([creator.id, ...participantIds])),
      unreadCount: 0,
      isPinned: false,
      updatedAt: timeStr,
      creatorId: creator.id,
      description: description || 'Группа создана пользователем ' + creator.name,
      lastMessage: {
        text: 'Группа «' + title + '» создана',
        timestamp: timeStr,
        senderId: creator.id,
        isRead: true,
      },
    };

    setChats((prev) => [newChat, ...prev]);

    const welcomeMsg: Message = {
      id: 'msg-grp-init-' + Date.now(),
      chatId: newChatId,
      senderId: creator.id,
      text: `Группа «${title}» создана. Приветствуем всех участников! 👊`,
      timestamp: timeStr,
      isRead: true,
    };

    setMessages((prev) => [...prev, welcomeMsg]);
    void Promise.all([
      setDoc(doc(db, 'chats', newChatId), newChat),
      setDoc(doc(db, 'chats', newChatId, 'messages', welcomeMsg.id), {
        ...welcomeMsg,
        createdAt: serverTimestamp(),
      }),
    ]).catch((error) => console.error('Не удалось сохранить группу в Firebase:', error));
    setActiveChatId(newChatId);

    return newChatId;
  };

  const startDirectChat = (targetUserId: string, targetProfile?: User): string => {
    if (!currentUserId || !targetUserId || targetUserId === currentUserId || contactRelations[targetUserId] === 'blocked') return '';

    const targetUser = allUsers.find((user) => user.id === targetUserId) || targetProfile;
    const creator = allUsers.find((user) => user.id === currentUserId);
    if (!targetUser || !creator) return '';
    setAllUsers((previous) => previous.some((user) => user.id === targetUser.id) ? previous : [...previous, targetUser]);

    // A stable ID makes both accounts open the exact same direct conversation.
    const sharedChatId = 'direct-' + [currentUserId, targetUserId].sort().join('-');
    const existing = chats.find((chat) =>
      chat.type === 'direct' &&
      chat.participants.includes(currentUserId) &&
      chat.participants.includes(targetUserId)
    );
    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0');
    const chat: Chat = {
      id: sharedChatId,
      type: 'direct',
      title: targetUser.name,
      avatar: targetUser.avatar || '',
      participants: [currentUserId, targetUserId].sort(),
      unreadCount: existing?.unreadCount || 0,
      isPinned: existing?.isPinned || false,
      ...(existing?.isMuted !== undefined ? { isMuted: existing.isMuted } : {}),
      updatedAt: existing?.updatedAt || timeStr,
      ...(existing?.lastMessage ? { lastMessage: existing.lastMessage } : {}),
      ...(existing?.creatorId ? { creatorId: existing.creatorId } : {}),
      ...(existing?.description ? { description: existing.description } : {}),
    };

    setChats((previous) => [
      chat,
      ...previous.filter((item) => item.id !== sharedChatId &&
        !(item.type === 'direct' && item.participants.includes(currentUserId) && item.participants.includes(targetUserId))),
    ]);
    setMessages((previous) => previous.map((message) =>
      existing && message.chatId === existing.id ? { ...message, chatId: sharedChatId } : message
    ));
    setActiveChatId(sharedChatId);
    setActiveTab('chats');
    void setDoc(doc(db, 'chats', sharedChatId), chat, { merge: true })
      .catch((error) => console.error('Не удалось создать общий личный чат:', error));
    return sharedChatId;
  };

  const addFriend = async (targetUserId: string): Promise<void> => {
    if (!currentUserId || !targetUserId || targetUserId === currentUserId) {
      throw new Error('Нельзя отправить заявку этому пользователю.');
    }

    const requestId = currentUserId + '_' + targetUserId;
    const requestRef = doc(db, 'friendRequests', requestId);
    const existing = await getDoc(requestRef);
    if (existing.exists()) {
      const status = existing.data().status;
      if (status === 'pending' || status === 'accepted') return;
    }

    await setDoc(requestRef, {
      fromUserId: currentUserId,
      toUserId: targetUserId,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  };

  const saveContactRelation = async (targetUser: User, status: 'removed' | 'blocked') => {
    if (!currentUserId || !targetUser.id || targetUser.id === currentUserId) return;
    const relationId = currentUserId + '_' + targetUser.id;
    setContactRelations((previous) => ({ ...previous, [targetUser.id]: status }));
    setAllUsers((previous) => previous.some((user) => user.id === targetUser.id) ? previous : [...previous, targetUser]);
    await setDoc(doc(db, 'userContacts', relationId), {
      ownerId: currentUserId,
      contactId: targetUser.id,
      status,
      contactName: targetUser.name || '',
      contactNickname: targetUser.nickname || '',
      contactAvatar: targetUser.avatar || '',
      updatedAt: serverTimestamp(),
    }, { merge: true });
    if (status === 'blocked') {
      const direct = chats.find((chat) => chat.type === 'direct' && chat.participants.includes(targetUser.id) && chat.participants.includes(currentUserId));
      if (direct) {
        setChats((previous) => previous.filter((chat) => chat.id !== direct.id));
        setMessages((previous) => previous.filter((message) => message.chatId !== direct.id));
        if (activeChatId === direct.id) setActiveChatId(null);
      }
    }
  };

  const removeContact = (targetUser: User) => saveContactRelation(targetUser, 'removed');
  const blockContact = (targetUser: User) => saveContactRelation(targetUser, 'blocked');
  const unblockContact = async (targetUserId: string) => {
    if (!currentUserId || !targetUserId) return;
    await deleteDoc(doc(db, 'userContacts', currentUserId + '_' + targetUserId));
    setContactRelations((previous) => { const next = { ...previous }; delete next[targetUserId]; return next; });
  };

  const acceptFriendRequest = (requestId: string) => {
    const req = friendRequests.find((request) => request.id === requestId);
    if (!req || !currentUserId) return;
    void updateDoc(doc(db, 'friendRequests', requestId), { status: 'accepted' })
      .then(() => startDirectChat(req.fromUser.id))
      .catch((error) => console.error('Could not accept friend request:', error));
  };

  const declineFriendRequest = (requestId: string) => {
    if (!currentUserId) return;
    void updateDoc(doc(db, 'friendRequests', requestId), { status: 'declined' })
      .catch((error) => console.error('Could not decline friend request:', error));
  };

  const updateProfile = (updated: Partial<User>) => {
    if (!currentUserId) return;

    const existingUser = allUsers.find((user) => user.id === currentUserId);
    if (!existingUser) return;

    const updatedUser = { ...existingUser, ...updated };
    delete updatedUser.badge;
    setAllUsers((prev) =>
      prev.map((user) => user.id === currentUserId ? updatedUser : user)
    );

    // Keep the private profile and the public directory in sync so friends
    // see the same saved avatar as the chat header after a profile edit.
    void Promise.all([
      setDoc(doc(db, 'users', currentUserId), updatedUser, { merge: true }),
      setDoc(doc(db, 'publicProfiles', currentUserId), {
        id: currentUserId,
        name: updatedUser.name,
        nickname: updatedUser.nickname,
        nicknameLower: updatedUser.nickname.replace(/^@+/, '').toLowerCase(),
        avatar: updatedUser.avatar || '',
        bio: updatedUser.bio || '',
        status: updatedUser.status || 'offline',
        lastSeen: updatedUser.lastSeen || '',
      }, { merge: true }),
    ]).catch((error) => {
      console.error('Не удалось сохранить профиль для друзей:', error);
    });
  };

  // Демо-вход отключён.
  const loginAsUser = (_userId: string) => {
    console.warn('Вход через демо-аккаунты отключён. Используй Firebase.');
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Ошибка выхода из Firebase:', error);
    } finally {
      setCurrentUserId('');
      setActiveChatId(null);
      setIsAuthModalOpen(true);
    }
  };

  // Load only this account's local cache; never carry another account's chats/users over.
  const setAuthenticatedUser = (user: User) => {
    const loadArray = <T,>(key: string): T[] | null => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed as T[] : null;
      } catch {
        return null;
      }
    };

    const scopedUsers = loadArray<User>(`bratva_users_${user.id}`);
    const scopedChats = loadArray<Chat>(`bratva_chats_${user.id}`);
    const scopedMessages = loadArray<Message>(`bratva_messages_${user.id}`);

    const legacyChats = loadArray<Chat>('bratva_chats') || [];
    const legacyMessages = loadArray<Message>('bratva_messages') || [];
    const migratedChats = legacyChats.filter((chat) => chat.participants?.includes(user.id));
    const migratedChatIds = new Set(migratedChats.map((chat) => chat.id));
    const migratedMessages = legacyMessages.filter((message) => migratedChatIds.has(message.chatId));

    const nextUsers = scopedUsers
      ? [user, ...scopedUsers.filter((item) => item.id !== user.id)]
      : [user];
    setAllUsers(nextUsers);
    setChats(scopedChats ?? migratedChats);
    setMessages(scopedMessages ?? migratedMessages);
    setFriendRequests([]);
    setCurrentUserId(user.id);
    setActiveChatId(null);
    setActiveTab('chats');
    setIsAuthModalOpen(false);
    sounds.playReceive();
  };

  // Регистрация через эту локальную функцию отключена:
  // пользователь должен регистрироваться через Firebase в AuthModal.
  const registerUser = (_data: {
    name: string;
    nickname: string;
    phone: string;
    email: string;
    avatar?: string;
    bio?: string;
  }) => {
    console.warn('Используй регистрацию через Firebase.');
  };

  const prepareCallPeer = (callId: string, role: 'caller' | 'callee', stream: MediaStream) => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
    });
    peerConnectionRef.current?.close();
    peerConnectionRef.current = peer;
    pendingIceCandidatesRef.current = [];
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.ontrack = (event) => {
      if (event.streams[0]) setRemoteCallStream(event.streams[0]);
    };
    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      const bucket = role === 'caller' ? 'callerCandidates' : 'calleeCandidates';
      void addDoc(collection(db, 'calls', callId, bucket), event.candidate.toJSON())
        .catch((error) => console.error('Не удалось отправить ICE-кандидат:', error));
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        setCallError(null);
        setCallState((current) => current?.callId === callId ? { ...current, status: 'connected' } : current);
      } else if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
        setCallError('Соединение нестабильно. Попробуйте перезвонить.');
      }
    };
    setLocalCallStream(stream);
    return peer;
  };

  const startCall = async (targetUser: User, _type: 'audio' | 'video') => {
    if (!currentUserId || !targetUser.id || targetUser.id === currentUserId || callState) return;
    setCallError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCallError('Браузер не поддерживает доступ к микрофону. Откройте сайт по HTTPS.');
      return;
    }
    const callId = 'call-' + currentUserId + '-' + Date.now();
    const caller = allUsers.find((user) => user.id === currentUserId) || EMPTY_USER;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      await setDoc(doc(db, 'calls', callId), {
        callerId: currentUserId,
        calleeId: targetUser.id,
        callerName: caller.name || 'Пользователь',
        callerNickname: caller.nickname || '',
        callerAvatar: caller.avatar || '',
        calleeName: targetUser.name || 'Пользователь',
        calleeAvatar: targetUser.avatar || '',
        type: 'audio',
        status: 'ringing',
        createdAt: serverTimestamp(),
      });
      prepareCallPeer(callId, 'caller', stream);
      setCallState({
        isActive: true,
        callId,
        direction: 'outgoing',
        type: 'audio',
        user: targetUser,
        status: 'ringing',
        isMuted: false,
        isVideoOff: true,
        durationSeconds: 0,
      });
    } catch (error) {
      console.error('Не удалось начать аудиозвонок:', error);
      setCallError('Не удалось включить микрофон или начать вызов. Разрешите доступ к микрофону и попробуйте ещё раз.');
      setLocalCallStream((stream) => { stream?.getTracks().forEach((track) => track.stop()); return null; });
      await updateDoc(doc(db, 'calls', callId), { status: 'ended' }).catch(() => undefined);
    }
  };

  const acceptCall = async () => {
    const activeCall = callState;
    if (!activeCall || activeCall.direction !== 'incoming') return;
    setCallError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone is not supported');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      prepareCallPeer(activeCall.callId, 'callee', stream);
      await updateDoc(doc(db, 'calls', activeCall.callId), { status: 'accepted' });
      setCallState((current) => current?.callId === activeCall.callId
        ? { ...current, status: 'connecting' } : current);
    } catch (error) {
      console.error('Не удалось ответить на звонок:', error);
      setCallError('Не удалось включить микрофон. Разрешите доступ и попробуйте ответить ещё раз.');
      setLocalCallStream((stream) => { stream?.getTracks().forEach((track) => track.stop()); return null; });
    }
  };

  const declineCall = () => {
    setCallError(null);
    const activeCall = callState;
    if (activeCall) {
      void updateDoc(doc(db, 'calls', activeCall.callId), { status: 'declined' })
        .catch((error) => console.warn('Не удалось отклонить вызов:', error));
    }
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    setLocalCallStream((stream) => { stream?.getTracks().forEach((track) => track.stop()); return null; });
    setRemoteCallStream(null);
    setCallState(null);
  };

  const endCall = () => {
    setCallError(null);
    const activeCall = callState;
    if (activeCall) {
      void updateDoc(doc(db, 'calls', activeCall.callId), { status: 'ended' })
        .catch((error) => console.warn('Не удалось завершить вызов:', error));
    }
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    setLocalCallStream((stream) => { stream?.getTracks().forEach((track) => track.stop()); return null; });
    setRemoteCallStream(null);
    setCallState(null);
  };

  const toggleCallMute = () => {
    setCallState((current) => {
      if (!current) return null;
      const nextMuted = !current.isMuted;
      localCallStream?.getAudioTracks().forEach((track) => { track.enabled = !nextMuted; });
      return { ...current, isMuted: nextMuted };
    });
  };

  const toggleCallVideo = () => {
    setCallState((curr) =>
      curr ? { ...curr, isVideoOff: !curr.isVideoOff } : null
    );
  };

  const pinChat = (chatId: string) => {
    sounds.playTap();
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? { ...chat, isPinned: !chat.isPinned }
          : chat
      )
    );
  };

  const muteChat = (chatId: string) => {
    sounds.playTap();
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? { ...chat, isMuted: !chat.isMuted }
          : chat
      )
    );
  };

  const deleteChat = (chatId: string) => {
    setChats((prev) => prev.filter((chat) => chat.id !== chatId));
    setMessages((prev) => prev.filter((message) => message.chatId !== chatId));

    if (activeChatId === chatId) {
      setActiveChatId(null);
    }
  };


  return (
    <ChatContext.Provider
      value={{
        currentUser,
        allUsers,
        chats,
        messages,
        friendRequests,
        activeChatId,
        activeChat,
        activeTab,
        callState,
        localCallStream,
        remoteCallStream,
        callError,
        messageError,
        clearMessageError: () => setMessageError(null),
        previewImage,
        chatFilter,
        isTypingUserId,
        soundEnabled,
        deviceMode,
        isAuthModalOpen,
        setActiveTab,
        setActiveChatId,
        setChatFilter,
        setPreviewImage,
        setDeviceMode,
        setSoundEnabled,
        setIsAuthModalOpen,
        sendMessage,
        toggleReaction,
        deleteMessage,
        createGroupChat,
        startDirectChat,
        addFriend,
        contactRelations,
        removeContact,
        blockContact,
        unblockContact,
        acceptFriendRequest,
        declineFriendRequest,
        updateProfile,
        loginAsUser,
        logout,
        setAuthenticatedUser,
        registerUser,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleCallMute,
        toggleCallVideo,
        pinChat,
        muteChat,
        deleteChat,
        markChatAsRead,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);

  if (!ctx) {
    throw new Error('useChat must be used within ChatProvider');
  }

  return ctx;
};
