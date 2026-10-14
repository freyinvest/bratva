/**
 * «Братва» — Современный мобильный мессенджер для общения друзей
 * Реализован с адаптивным дизайном под Android, поддержкой личных и групповых чатов,
 * отправкой изображений, поиском по нику и номеру, профилем и архитектурой Firebase.
 */

import React from 'react';
import { ChatProvider } from './context/ChatContext';
import { AndroidShell } from './components/layout/AndroidShell';

export default function App() {
  return (
    <ChatProvider>
      <AndroidShell />
    </ChatProvider>
  );
}
