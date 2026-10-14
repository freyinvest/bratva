import React, { useEffect, useState } from 'react';
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Sparkles
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';

export const CallOverlay: React.FC = () => {
  const { callState, endCall, toggleCallMute, toggleCallVideo } = useChat();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!callState || callState.status !== 'connected') return;
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callState?.status]);

  if (!callState || !callState.isActive) return null;

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col justify-between p-6 text-white select-none">
      {/* Background ambient video/gradient mockup */}
      <div className="absolute inset-0 bg-radial from-emerald-950/30 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Top Header */}
      <div className="relative z-10 flex flex-col items-center mt-6 text-center space-y-1">
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
          {callState.type === 'video' ? 'Видеозвонок' : 'Аудиозвонок'}
        </span>
        <h2 className="text-2xl font-black tracking-tight mt-2">{callState.user.name}</h2>
        <p className="text-xs text-slate-400">{callState.user.nickname}</p>
        <p className="text-sm font-semibold text-emerald-400 mt-2 font-mono">
          {callState.status === 'ringing' ? 'Вызов братвы...' : formatDuration(seconds)}
        </p>
      </div>

      {/* Central User Avatar with animated pulsating rings */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto">
        <div className="relative">
          {/* Pulsating wave rings */}
          <div className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping" />
          <div className="absolute -inset-8 rounded-full bg-emerald-500/10 animate-pulse" />

          <img
            src={callState.user.avatar}
            alt={callState.user.name}
            className="relative w-36 h-36 rounded-full object-cover border-4 border-emerald-500 shadow-2xl shadow-emerald-500/30"
          />
        </div>

        {callState.type === 'video' && !callState.isVideoOff && (
          <div className="mt-4 px-3 py-1 rounded-full bg-slate-800/80 text-[11px] text-slate-300 border border-slate-700 flex items-center gap-1.5">
            <Sparkles size={12} className="text-emerald-400" />
            Камера HD включена
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="relative z-10 flex items-center justify-center gap-4 mb-8">
        {/* Mute button */}
        <button
          onClick={toggleCallMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            callState.isMuted
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
              : 'bg-slate-800 hover:bg-slate-700 text-white'
          }`}
          title={callState.isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        >
          {callState.isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        {/* Video button if video call */}
        {callState.type === 'video' && (
          <button
            onClick={toggleCallVideo}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              callState.isVideoOff
                ? 'bg-slate-800 text-slate-400'
                : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
            title="Камера"
          >
            {callState.isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
          </button>
        )}

        {/* End Call Button */}
        <button
          onClick={endCall}
          className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-600/40 hover:scale-105 active:scale-95 transition-all"
          title="Завершить вызов"
        >
          <PhoneOff size={26} />
        </button>
      </div>
    </div>
  );
};
