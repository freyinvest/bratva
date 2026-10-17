
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
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
import { getDoc, onSnapshot, query, collection, doc, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
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
    replyTo?: Message['replyToMessage']
  ) => void;
  toggleReaction: (messageId: string, emoji: string) => void;
  deleteMessage: (messageId: string) => void;
  createGroupChat: (
    title: string,
    participantIds: string[],
    avatar?: string,
    description?: string
  ) => string;
  startDirectChat: (targetUserId: string) => string;
  addFriend: (targetUserId: string) => Promise<void>;
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

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('chats');
  const [callState, setCallState] = useState<CallState | null>(null);
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

  const currentUser =
    allUsers.find((user) => user.id === currentUserId) || EMPTY_USER;

  const activeChat = chats.find((chat) => chat.id === activeChatId) || null;

  // Publish a short-lived heartbeat so stale "online" flags expire after a closed tab
  // or a lost connection. Other clients subscribe to each known public profile below.
  useEffect(() => {
    if (!currentUserId) return;

    const publishPresence = (online: boolean) => {
      const now = Date.now();
      const lastSeen = online ? 'в сети' : 'был(а) недавно';
      const presence = {
        status: online ? 'online' : 'offline',
        lastSeen,
        lastSeenAt: now,
      };
      void Promise.all([
        setDoc(doc(db, 'users', currentUserId), presence, { merge: true }),
        setDoc(doc(db, 'publicProfiles', currentUserId), presence, { merge: true }),
      ]).catch((error) => {
        console.warn('Не удалось обновить статус присутствия:', error);
      });
      if (!online) {
        setAllUsers((previous) => previous.map((user) =>
          user.id === currentUserId ? { ...user, ...presence } : user
        ));
      } else {
        setAllUsers((previous) => previous.map((user) =>
          user.id === currentUserId && user.status !== 'online'
            ? { ...user, ...presence }
            : user
        ));
      }
    };

    publishPresence(true);
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') publishPresence(true);
    }, 30_000);
    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') publishPresence(true);
    };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
      publishPresence(false);
    };
  }, [currentUserId]);

  // Keep friend/contact presence live across accounts and mark old heartbeats offline.
  const knownOtherUserIds = allUsers
    .filter((user) => user.id && user.id !== currentUserId)
    .map((user) => user.id)
    .join('|');

  useEffect(() => {
    if (!currentUserId || !knownOtherUserIds) return;
    const ids = knownOtherUserIds.split('|');
    const unsubscribe = ids.map((userId) => onSnapshot(
      doc(db, 'publicProfiles', userId),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        const lastSeenAt = typeof data.lastSeenAt === 'number' ? data.lastSeenAt : null;
        const online = data.status === 'online' && lastSeenAt !== null &&
          Date.now() - lastSeenAt < 120_000;
        let lastSeen = 'не в сети';
        if (online) {
          lastSeen = 'в сети';
        } else if (lastSeenAt !== null) {
          const minutes = Math.max(1, Math.floor((Date.now() - lastSeenAt) / 60_000));
          lastSeen = minutes < 2 ? 'был(а) недавно'
            : minutes < 60 ? `был(а) ${minutes} мин. назад`
            : `был(а) ${Math.floor(minutes / 60)} ч. назад`;
        } else if (typeof data.lastSeen === 'string' && data.lastSeen !== 'в сети') {
          lastSeen = data.lastSeen || 'не в сети';
        }
        setAllUsers((previous) => {
          const existing = previous.find((user) => user.id === userId);
          if (!existing || (existing.status === (online ? 'online' : 'offline') &&
              existing.lastSeen === lastSeen)) return previous;
          return previous.map((user) => user.id === userId
            ? { ...user, status: online ? 'online' : 'offline', lastSeen,
                ...(lastSeenAt !== null ? { lastSeenAt } : {}) }
            : user
          );
        });
      },
      (error) => console.warn('Не удалось обновить статус контакта:', error),
    ));
    return () => unsubscribe.forEach((stop) => stop());
  }, [currentUserId, knownOtherUserIds]);

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
  };

  // Отправляем только сообщение текущего пользователя.
  // Автоответы и случайные ответы собеседников отключены.
  const sendMessage = (
    chatId: string,
    text?: string,
    imageUrl?: string,
    replyTo?: Message['replyToMessage']
  ) => {
    if (!text?.trim() && !imageUrl) return;
    if (!currentUserId) return;

    const sender = allUsers.find((user) => user.id === currentUserId);
    if (!sender) return;

    const now = new Date();
    const timeStr =
      String(now.getHours()).padStart(2, '0') +
      ':' +
      String(now.getMinutes()).padStart(2, '0');

    const newMsg: Message = {
      id: 'msg-' + Date.now(),
      chatId,
      senderId: sender.id,
      text,
      imageUrl,
      timestamp: timeStr,
      isRead: false,
      replyToMessage: replyTo,
      reactions: {},
    };

    sounds.playSend();
    setMessages((prev) => [...prev, newMsg]);

    const previewText = imageUrl ? '📷 Фотография' : text || '';

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              updatedAt: timeStr,
              lastMessage: {
                text: previewText,
                timestamp: timeStr,
                senderId: sender.id,
                isRead: false,
              },
            }
          : chat
      )
    );
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
    setActiveChatId(newChatId);

    return newChatId;
  };

  const startDirectChat = (targetUserId: string): string => {
    if (!currentUserId) return '';

    const existing = chats.find(
      (chat) =>
        chat.type === 'direct' &&
        chat.participants.includes(currentUserId) &&
        chat.participants.includes(targetUserId)
    );

    if (existing) {
      setActiveChatId(existing.id);
      setActiveTab('chats');
      return existing.id;
    }

    const targetUser = allUsers.find((user) => user.id === targetUserId);
    if (!targetUser || targetUser.id === currentUserId) return '';

    const creator = allUsers.find((user) => user.id === currentUserId);
    if (!creator) return '';

    const newChatId = 'chat-dir-' + Date.now();
    const now = new Date();
    const timeStr =
      String(now.getHours()).padStart(2, '0') +
      ':' +
      String(now.getMinutes()).padStart(2, '0');

    const newChat: Chat = {
      id: newChatId,
      type: 'direct',
      title: targetUser.name,
      avatar: targetUser.avatar,
      participants: [creator.id, targetUserId],
      unreadCount: 0,
      isPinned: false,
      updatedAt: timeStr,
      lastMessage: {
        text: 'Диалог начат',
        timestamp: timeStr,
        senderId: creator.id,
        isRead: true,
      },
    };

    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChatId);
    setActiveTab('chats');

    return newChatId;
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
        badge: updatedUser.badge || 'Свой',
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

  const startCall = (targetUser: User, type: 'audio' | 'video') => {
    sounds.playTap();

    setCallState({
      isActive: true,
      type,
      user: targetUser,
      status: 'ringing',
      isMuted: false,
      isVideoOff: false,
      durationSeconds: 0,
    });

    setTimeout(() => {
      setCallState((curr) => {
        if (!curr || !curr.isActive) return null;
        return { ...curr, status: 'connected' };
      });
    }, 2500);
  };

  const endCall = () => {
    sounds.playTap();
    setCallState(null);
  };

  const toggleCallMute = () => {
    setCallState((curr) =>
      curr ? { ...curr, isMuted: !curr.isMuted } : null
    );
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
        acceptFriendRequest,
        declineFriendRequest,
        updateProfile,
        loginAsUser,
        logout,
        setAuthenticatedUser,
        registerUser,
        startCall,
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
