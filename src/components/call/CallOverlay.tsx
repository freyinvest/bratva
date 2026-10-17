import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, AlertCircle } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { PRESET_AVATARS } from '../../data/mockData';

export const CallOverlay: React.FC = () => {
  const {
    callState,
    localCallStream,
    remoteCallStream,
    callError,
    acceptCall,
    declineCall,
    endCall,
    toggleCallMute,
  } = useChat();
  const [seconds, setSeconds] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    setSeconds(0);
  }, [callState?.callId]);

  useEffect(() => {
    if (!callState || callState.status !== 'connected') return;
    const interval = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [callState?.callId, callState?.status]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.srcObject = remoteCallStream;
    if (remoteCallStream) {
      void audio.play().catch((error) => console.warn('Автовоспроизведение звука заблокировано браузером:', error));
    }
  }, [remoteCallStream, callState?.callId]);

  if (!callState && !callError) return null;

  const formatDuration = (value: number) =>
    `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

  if (!callState) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-6 text-white">
        <div className="w-full max-w-sm rounded-3xl border border-rose-500/30 bg-slate-900 p-6 text-center space-y-4">
          <AlertCircle size={36} className="mx-auto text-rose-400" />
          <p className="text-sm text-slate-200">{callError}</p>
          <button onClick={endCall} className="px-5 py-2 rounded-xl bg-slate-700 text-white font-bold text-sm">Закрыть</button>
        </div>
      </div>
    );
  }

  const incoming = callState.direction === 'incoming' && callState.status === 'ringing';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col justify-between p-6 text-white select-none">
      <audio ref={audioRef} autoPlay playsInline />
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/30 via-slate-950 to-slate-950 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center mt-6 text-center space-y-2">
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
          Настоящий аудиозвонок
        </span>
        <h2 className="text-2xl font-black tracking-tight mt-2">{callState.user.name}</h2>
        <p className="text-xs text-slate-400">{callState.user.nickname}</p>
        <p className="text-sm font-semibold text-emerald-400 mt-2 font-mono">
          {incoming ? 'Входящий вызов…' :
            callState.status === 'ringing' ? 'Вызов…' :
            callState.status === 'connecting' ? 'Соединяем…' : formatDuration(seconds)}
        </p>
        {callError && <p className="max-w-xs text-xs text-rose-300">{callError}</p>}
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center my-auto">
        <div className="relative">
          {callState.status !== 'connected' && (
            <>
              <div className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping" />
              <div className="absolute -inset-8 rounded-full bg-emerald-500/10 animate-pulse" />
            </>
          )}
          <img
            src={callState.user.avatar || PRESET_AVATARS[0]}
            onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = PRESET_AVATARS[0]; }}
            alt={callState.user.name}
            className="relative w-36 h-36 rounded-full object-cover border-4 border-emerald-500 shadow-2xl shadow-emerald-500/30"
          />
        </div>
        <div className="mt-5 flex items-center gap-2 px-3 py-2 rounded-full bg-slate-800/80 text-xs text-slate-300 border border-slate-700">
          <Volume2 size={15} className={remoteCallStream ? 'text-emerald-400' : 'text-slate-500'} />
          {remoteCallStream ? 'Звук подключён' : 'Ожидание соединения'}
        </div>
        {localCallStream && <p className="mt-2 text-[11px] text-slate-500">Микрофон готов к работе</p>}
      </div>

      <div className="relative z-10 flex items-center justify-center gap-4 mb-8">
        {incoming ? (
          <>
            <button onClick={declineCall} className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-xl" title="Отклонить вызов">
              <PhoneOff size={25} />
            </button>
            <button onClick={() => void acceptCall()} className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-xl animate-pulse" title="Ответить">
              <Phone size={25} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={toggleCallMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${callState.isMuted ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
              title={callState.isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
            >
              {callState.isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
            <button onClick={endCall} className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-600/40" title="Завершить звонок">
              <PhoneOff size={26} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
