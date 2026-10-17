/**
 * «Братва» — Современный мобильный мессенджер для общения друзей
 * Реализован с адаптивным дизайном под Android, поддержкой личных и групповых чатов,
 * отправкой изображений, поиском по нику и номеру, профилем и архитектурой Firebase.
 */

import React, { useEffect } from 'react';
import { ChatProvider } from './context/ChatContext';
import { AndroidShell } from './components/layout/AndroidShell';

export default function App() {
  useEffect(() => {
    try {
      document.documentElement.dataset.theme =
        ['light-blue', 'neutral'].includes(localStorage.getItem('bratva-theme') || '') ? localStorage.getItem('bratva-theme')! : 'dark-emerald';
    } catch {
      document.documentElement.dataset.theme = 'dark-emerald';
    }
  }, []);

  return (
    <ChatProvider>
      <AndroidShell />
    </ChatProvider>
  );
}
